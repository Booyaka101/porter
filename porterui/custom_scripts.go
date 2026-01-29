package porterui

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// ============================================================================
// TYPES
// ============================================================================

// CustomScript represents a user-uploaded script
type CustomScript struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	Content     string    `json:"content,omitempty"`
	FileName    string    `json:"file_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Size        int64     `json:"size"`
	Tags        []string  `json:"tags,omitempty"`
}

// ScriptInput represents the input for creating/updating a script
type ScriptInput struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Content     string   `json:"content"`
	FileName    string   `json:"file_name"`
	Tags        []string `json:"tags"`
}

// APIResponse provides consistent API responses
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// ============================================================================
// VALIDATION
// ============================================================================

var (
	fileNameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.sh$`)
	categoryRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`)
)

// ValidateScriptInput validates script input
func ValidateScriptInput(input *ScriptInput, requireContent bool) error {
	if strings.TrimSpace(input.Name) == "" {
		return fmt.Errorf("script name is required")
	}
	if len(input.Name) > 100 {
		return fmt.Errorf("script name must be less than 100 characters")
	}
	if requireContent && strings.TrimSpace(input.Content) == "" {
		return fmt.Errorf("script content is required")
	}
	if len(input.Content) > 1024*1024 { // 1MB limit
		return fmt.Errorf("script content exceeds 1MB limit")
	}
	if len(input.Description) > 500 {
		return fmt.Errorf("description must be less than 500 characters")
	}
	if input.Category != "" && !categoryRegex.MatchString(input.Category) {
		return fmt.Errorf("category contains invalid characters")
	}
	return nil
}

// SanitizeFileName creates a safe filename from input
func SanitizeFileName(name, fileName string) string {
	if fileName != "" {
		// Clean the provided filename
		fileName = filepath.Base(fileName)
		if !strings.HasSuffix(fileName, ".sh") {
			fileName += ".sh"
		}
		if fileNameRegex.MatchString(fileName) {
			return fileName
		}
	}
	// Generate from name
	safe := strings.ToLower(name)
	safe = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(safe, "-")
	safe = strings.Trim(safe, "-")
	if safe == "" {
		safe = "script"
	}
	return safe + ".sh"
}

// ============================================================================
// STORE
// ============================================================================

// CustomScriptStore manages user-uploaded scripts
type CustomScriptStore struct {
	mu       sync.RWMutex
	scripts  map[string]*CustomScript
	basePath string
}

var customScriptStore *CustomScriptStore

// InitCustomScripts initializes the custom scripts store
func InitCustomScripts() error {
	basePath := filepath.Join(getDataDir(), "custom-scripts")
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return fmt.Errorf("failed to create custom scripts directory: %w", err)
	}

	customScriptStore = &CustomScriptStore{
		scripts:  make(map[string]*CustomScript),
		basePath: basePath,
	}

	if err := customScriptStore.loadIndex(); err != nil {
		log.Printf("Warning: failed to load custom scripts index: %v", err)
	}

	return nil
}

func (s *CustomScriptStore) indexPath() string {
	return filepath.Join(s.basePath, "index.json")
}

func (s *CustomScriptStore) loadIndex() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.indexPath())
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to read index: %w", err)
	}

	var scripts []*CustomScript
	if err := json.Unmarshal(data, &scripts); err != nil {
		return fmt.Errorf("failed to parse index: %w", err)
	}

	for _, script := range scripts {
		s.scripts[script.ID] = script
	}
	log.Printf("Loaded %d custom scripts", len(s.scripts))
	return nil
}

func (s *CustomScriptStore) saveIndex() error {
	scripts := make([]*CustomScript, 0, len(s.scripts))
	for _, script := range s.scripts {
		scripts = append(scripts, script)
	}

	// Sort by name for consistent output
	sort.Slice(scripts, func(i, j int) bool {
		return scripts[i].Name < scripts[j].Name
	})

	data, err := json.MarshalIndent(scripts, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal index: %w", err)
	}

	if err := os.WriteFile(s.indexPath(), data, 0644); err != nil {
		return fmt.Errorf("failed to write index: %w", err)
	}
	return nil
}

func (s *CustomScriptStore) scriptPath(id string) string {
	return filepath.Join(s.basePath, id+".sh")
}

// Add adds a new custom script
func (s *CustomScriptStore) Add(input *ScriptInput) (*CustomScript, error) {
	if err := ValidateScriptInput(input, true); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	script := &CustomScript{
		ID:          fmt.Sprintf("custom-%d", now.UnixNano()),
		Name:        strings.TrimSpace(input.Name),
		Description: strings.TrimSpace(input.Description),
		Category:    strings.TrimSpace(input.Category),
		FileName:    SanitizeFileName(input.Name, input.FileName),
		Tags:        input.Tags,
		CreatedAt:   now,
		UpdatedAt:   now,
		Size:        int64(len(input.Content)),
	}

	if script.Category == "" {
		script.Category = "general"
	}

	// Write script file
	if err := os.WriteFile(s.scriptPath(script.ID), []byte(input.Content), 0755); err != nil {
		return nil, fmt.Errorf("failed to write script file: %w", err)
	}

	s.scripts[script.ID] = script
	if err := s.saveIndex(); err != nil {
		// Rollback file creation
		os.Remove(s.scriptPath(script.ID))
		delete(s.scripts, script.ID)
		return nil, err
	}

	return script, nil
}

// Update updates an existing script
func (s *CustomScriptStore) Update(id string, input *ScriptInput) (*CustomScript, error) {
	if err := ValidateScriptInput(input, false); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	existing, ok := s.scripts[id]
	if !ok {
		return nil, fmt.Errorf("script not found")
	}

	existing.Name = strings.TrimSpace(input.Name)
	existing.Description = strings.TrimSpace(input.Description)
	if input.Category != "" {
		existing.Category = strings.TrimSpace(input.Category)
	}
	if input.Tags != nil {
		existing.Tags = input.Tags
	}
	existing.UpdatedAt = time.Now()

	if input.Content != "" {
		existing.Size = int64(len(input.Content))
		if err := os.WriteFile(s.scriptPath(id), []byte(input.Content), 0755); err != nil {
			return nil, fmt.Errorf("failed to write script file: %w", err)
		}
	}

	if err := s.saveIndex(); err != nil {
		return nil, err
	}

	return existing, nil
}

// Delete removes a custom script
func (s *CustomScriptStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.scripts[id]; !ok {
		return fmt.Errorf("script not found")
	}

	// Remove script file (ignore error if file doesn't exist)
	os.Remove(s.scriptPath(id))

	delete(s.scripts, id)
	return s.saveIndex()
}

// Get returns a script by ID
func (s *CustomScriptStore) Get(id string) (*CustomScript, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	script, ok := s.scripts[id]
	if !ok {
		return nil, false
	}
	// Return a copy to prevent mutation
	copy := *script
	return &copy, true
}

// GetContent returns the content of a script
func (s *CustomScriptStore) GetContent(id string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, ok := s.scripts[id]; !ok {
		return "", fmt.Errorf("script not found")
	}

	content, err := os.ReadFile(s.scriptPath(id))
	if err != nil {
		return "", fmt.Errorf("failed to read script content: %w", err)
	}
	return string(content), nil
}

// List returns all custom scripts sorted by name
func (s *CustomScriptStore) List() []*CustomScript {
	s.mu.RLock()
	defer s.mu.RUnlock()

	scripts := make([]*CustomScript, 0, len(s.scripts))
	for _, script := range s.scripts {
		copy := *script
		scripts = append(scripts, &copy)
	}

	sort.Slice(scripts, func(i, j int) bool {
		return scripts[i].Name < scripts[j].Name
	})

	return scripts
}

// Count returns the number of custom scripts
func (s *CustomScriptStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.scripts)
}

// GetScriptForExecution returns the script path for execution
func (s *CustomScriptStore) GetScriptForExecution(id string) (string, func(), error) {
	s.mu.RLock()
	script, ok := s.scripts[id]
	s.mu.RUnlock()

	if !ok {
		return "", nil, fmt.Errorf("script not found")
	}

	tempDir, err := os.MkdirTemp("", "custom-script-")
	if err != nil {
		return "", nil, fmt.Errorf("failed to create temp directory: %w", err)
	}

	content, err := os.ReadFile(s.scriptPath(id))
	if err != nil {
		os.RemoveAll(tempDir)
		return "", nil, fmt.Errorf("failed to read script: %w", err)
	}

	scriptPath := filepath.Join(tempDir, script.FileName)
	if err := os.WriteFile(scriptPath, content, 0755); err != nil {
		os.RemoveAll(tempDir)
		return "", nil, fmt.Errorf("failed to write temp script: %w", err)
	}

	return scriptPath, func() { os.RemoveAll(tempDir) }, nil
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

// sendJSON sends a JSON response
func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// sendError sends an error response
func sendError(w http.ResponseWriter, status int, message string) {
	sendJSON(w, status, APIResponse{Success: false, Error: message})
}

// sendSuccess sends a success response
func sendSuccess(w http.ResponseWriter, data interface{}, message string) {
	sendJSON(w, http.StatusOK, APIResponse{Success: true, Data: data, Message: message})
}

// CustomScriptsRoutes sets up custom script API routes
func CustomScriptsRoutes(r *mux.Router) {
	// List all custom scripts
	r.HandleFunc("/api/custom-scripts", handleListScripts).Methods("GET")
	r.HandleFunc("/api/custom-scripts", handleCreateScript).Methods("POST")
	r.HandleFunc("/api/custom-scripts/upload", handleUploadScript).Methods("POST")
	r.HandleFunc("/api/custom-scripts/stats", handleScriptStats).Methods("GET")
	r.HandleFunc("/api/custom-scripts/{id}", handleGetScript).Methods("GET")
	r.HandleFunc("/api/custom-scripts/{id}", handleUpdateScript).Methods("PUT")
	r.HandleFunc("/api/custom-scripts/{id}", handleDeleteScript).Methods("DELETE")
	r.HandleFunc("/api/custom-scripts/{id}/download", handleDownloadScript).Methods("GET")
	r.HandleFunc("/api/custom-scripts/{id}/duplicate", handleDuplicateScript).Methods("POST")
}

func handleListScripts(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	scripts := customScriptStore.List()
	if scripts == nil {
		scripts = []*CustomScript{}
	}
	json.NewEncoder(w).Encode(scripts)
}

func handleGetScript(w http.ResponseWriter, req *http.Request) {
	id := mux.Vars(req)["id"]

	script, ok := customScriptStore.Get(id)
	if !ok {
		sendError(w, http.StatusNotFound, "Script not found")
		return
	}

	content, err := customScriptStore.GetContent(id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to read script content")
		return
	}

	script.Content = content
	sendJSON(w, http.StatusOK, script)
}

func handleCreateScript(w http.ResponseWriter, req *http.Request) {
	var input ScriptInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	script, err := customScriptStore.Add(&input)
	if err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, script)
}

func handleUploadScript(w http.ResponseWriter, req *http.Request) {
	// Parse multipart form (max 10MB)
	if err := req.ParseMultipartForm(10 << 20); err != nil {
		sendError(w, http.StatusBadRequest, "File too large (max 10MB)")
		return
	}

	file, header, err := req.FormFile("file")
	if err != nil {
		sendError(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to read file")
		return
	}

	name := req.FormValue("name")
	if name == "" {
		name = strings.TrimSuffix(header.Filename, ".sh")
	}

	input := &ScriptInput{
		Name:        name,
		Description: req.FormValue("description"),
		Category:    req.FormValue("category"),
		Content:     string(content),
		FileName:    header.Filename,
	}

	script, err := customScriptStore.Add(input)
	if err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, script)
}

func handleUpdateScript(w http.ResponseWriter, req *http.Request) {
	id := mux.Vars(req)["id"]

	var input ScriptInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	script, err := customScriptStore.Update(id, &input)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "script not found" {
			status = http.StatusNotFound
		}
		sendError(w, status, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, script)
}

func handleDeleteScript(w http.ResponseWriter, req *http.Request) {
	id := mux.Vars(req)["id"]

	if err := customScriptStore.Delete(id); err != nil {
		sendError(w, http.StatusNotFound, err.Error())
		return
	}

	sendSuccess(w, nil, "Script deleted successfully")
}

func handleDownloadScript(w http.ResponseWriter, req *http.Request) {
	id := mux.Vars(req)["id"]

	script, ok := customScriptStore.Get(id)
	if !ok {
		http.Error(w, "Script not found", http.StatusNotFound)
		return
	}

	content, err := customScriptStore.GetContent(id)
	if err != nil {
		http.Error(w, "Failed to read script", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/x-sh")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", script.FileName))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(content)))
	w.Write([]byte(content))
}

func handleDuplicateScript(w http.ResponseWriter, req *http.Request) {
	id := mux.Vars(req)["id"]

	original, ok := customScriptStore.Get(id)
	if !ok {
		sendError(w, http.StatusNotFound, "Script not found")
		return
	}

	content, err := customScriptStore.GetContent(id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to read script content")
		return
	}

	input := &ScriptInput{
		Name:        original.Name + " (Copy)",
		Description: original.Description,
		Category:    original.Category,
		Content:     content,
		Tags:        original.Tags,
	}

	script, err := customScriptStore.Add(input)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, script)
}

func handleScriptStats(w http.ResponseWriter, req *http.Request) {
	scripts := customScriptStore.List()

	categories := make(map[string]int)
	var totalSize int64
	for _, s := range scripts {
		categories[s.Category]++
		totalSize += s.Size
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"total":      len(scripts),
		"categories": categories,
		"total_size": totalSize,
	})
}

// GetCustomScriptPath returns the base path for custom scripts
func GetCustomScriptPath() string {
	if customScriptStore != nil {
		return customScriptStore.basePath
	}
	return ""
}
