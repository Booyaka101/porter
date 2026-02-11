package porterui

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"net/http"

	"github.com/gorilla/mux"
)

// ExecutionRecord represents a single script execution in history
type ExecutionRecord struct {
	ID          string    `json:"id"`
	MachineID   string    `json:"machine_id"`
	MachineName string    `json:"machine_name"`
	MachineIP   string    `json:"machine_ip"`
	ScriptPath  string    `json:"script_path"`
	ScriptName  string    `json:"script_name"`
	Args        string    `json:"args"`
	PresetName  string    `json:"preset_name,omitempty"`
	StartedAt   time.Time `json:"started_at"`
	FinishedAt  time.Time `json:"finished_at"`
	Duration    string    `json:"duration"`
	Success     bool      `json:"success"`
	Output      string    `json:"output"`
	Error       string    `json:"error,omitempty"`
	ExitCode    int       `json:"exit_code"`
	Operator    string    `json:"operator,omitempty"`
}

// ExecutionRecordSummary is a lightweight version without Output for list views
type ExecutionRecordSummary struct {
	ID          string    `json:"id"`
	MachineID   string    `json:"machine_id"`
	MachineName string    `json:"machine_name"`
	MachineIP   string    `json:"machine_ip"`
	ScriptPath  string    `json:"script_path"`
	ScriptName  string    `json:"script_name"`
	Args        string    `json:"args"`
	PresetName  string    `json:"preset_name,omitempty"`
	StartedAt   time.Time `json:"started_at"`
	FinishedAt  time.Time `json:"finished_at"`
	Duration    string    `json:"duration"`
	Success     bool      `json:"success"`
	Error       string    `json:"error,omitempty"`
	ExitCode    int       `json:"exit_code"`
	Operator    string    `json:"operator,omitempty"`
}

// ToSummary converts an ExecutionRecord to ExecutionRecordSummary
func (r *ExecutionRecord) ToSummary() ExecutionRecordSummary {
	return ExecutionRecordSummary{
		ID:          r.ID,
		MachineID:   r.MachineID,
		MachineName: r.MachineName,
		MachineIP:   r.MachineIP,
		ScriptPath:  r.ScriptPath,
		ScriptName:  r.ScriptName,
		Args:        r.Args,
		PresetName:  r.PresetName,
		StartedAt:   r.StartedAt,
		FinishedAt:  r.FinishedAt,
		Duration:    r.Duration,
		Success:     r.Success,
		Error:       r.Error,
		ExitCode:    r.ExitCode,
		Operator:    r.Operator,
	}
}

// HistoryStore manages persistent execution history
type HistoryStore struct {
	mu       sync.RWMutex
	records  []ExecutionRecord
	filePath string
	maxSize  int
}

var historyStore *HistoryStore

// InitHistoryStore initializes the history store
func InitHistoryStore() error {
	dataDir := getDataDir()
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	historyStore = &HistoryStore{
		filePath: filepath.Join(dataDir, "execution_history.json"),
		maxSize:  1000, // Keep last 1000 executions
	}

	return historyStore.load()
}

var portableMode bool

// SetPortableMode enables portable mode (data stored alongside binary)
func SetPortableMode(enabled bool) {
	portableMode = enabled
}

func getDataDir() string {
	// Check for DATA_DIR environment variable first
	if dataDir := os.Getenv("DATA_DIR"); dataDir != "" {
		return dataDir
	}

	// Check if /app/data exists (Docker container)
	if _, err := os.Stat("/app/data"); err == nil {
		return "/app/data"
	}

	if portableMode {
		// Portable mode: store data alongside the executable
		execPath, err := os.Executable()
		if err != nil {
			return "./data"
		}
		return filepath.Join(filepath.Dir(execPath), "data")
	}
	// Default: use user config directory
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "./data"
	}
	return filepath.Join(configDir, "idx-deploy")
}

func (h *HistoryStore) load() error {
	h.mu.Lock()
	defer h.mu.Unlock()

	// If using database, load from there
	if db != nil {
		records, err := loadHistoryFromDB()
		if err != nil {
			h.records = []ExecutionRecord{}
			return nil
		}
		h.records = records
		return nil
	}

	// Fallback to JSON file
	data, err := os.ReadFile(h.filePath)
	if os.IsNotExist(err) {
		h.records = []ExecutionRecord{}
		return nil
	}
	if err != nil {
		return err
	}

	return json.Unmarshal(data, &h.records)
}

// loadHistoryFromDB loads execution history from the database
func loadHistoryFromDB() ([]ExecutionRecord, error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	rows, err := db.db.Query(`
		SELECT id, COALESCE(machine_id, ''), COALESCE(machine_name, ''), COALESCE(machine_ip, ''),
		       COALESCE(script_path, ''), COALESCE(script_name, ''), COALESCE(args, ''),
		       COALESCE(preset_name, ''), started_at, finished_at, COALESCE(duration, ''),
		       success, COALESCE(output, ''), COALESCE(error, ''), exit_code, COALESCE(operator, '')
		FROM execution_history ORDER BY created_at DESC LIMIT 1000`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []ExecutionRecord
	for rows.Next() {
		var r ExecutionRecord
		var startedAt, finishedAt, output, errorMsg string
		var success int

		if err := rows.Scan(&r.ID, &r.MachineID, &r.MachineName, &r.MachineIP,
			&r.ScriptPath, &r.ScriptName, &r.Args, &r.PresetName,
			&startedAt, &finishedAt, &r.Duration, &success, &output, &errorMsg,
			&r.ExitCode, &r.Operator); err != nil {
			continue
		}

		r.Success = success == 1
		r.Output = output
		r.Error = errorMsg
		r.StartedAt, _ = parseDateTime(startedAt)
		r.FinishedAt, _ = parseDateTime(finishedAt)

		records = append(records, r)
	}

	return records, nil
}

func (h *HistoryStore) save() error {
	// If using database, we don't need to save to file
	// Records are saved individually via saveHistoryRecordToDB
	if db != nil {
		return nil
	}

	// Fallback to JSON file
	data, err := json.MarshalIndent(h.records, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(h.filePath, data, 0644)
}

// saveHistoryRecordToDB saves a single execution record to the database
func saveHistoryRecordToDB(record ExecutionRecord) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	successInt := 0
	if record.Success {
		successInt = 1
	}

	_, err := db.db.Exec(`
		INSERT OR REPLACE INTO execution_history 
		(id, machine_id, machine_name, machine_ip, script_path, script_name, args, preset_name,
		 started_at, finished_at, duration, success, output, error, exit_code, operator, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		record.ID, record.MachineID, record.MachineName, record.MachineIP,
		record.ScriptPath, record.ScriptName, record.Args, record.PresetName,
		record.StartedAt.Format(time.RFC3339), record.FinishedAt.Format(time.RFC3339),
		record.Duration, successInt, record.Output, record.Error, record.ExitCode,
		record.Operator, time.Now().Format(time.RFC3339))

	return err
}

// Add adds a new execution record
func (h *HistoryStore) Add(record ExecutionRecord) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Generate ID if not set
	if record.ID == "" {
		record.ID = fmt.Sprintf("exec-%d", time.Now().UnixNano())
	}

	// Calculate duration
	if !record.FinishedAt.IsZero() && !record.StartedAt.IsZero() {
		record.Duration = record.FinishedAt.Sub(record.StartedAt).Round(time.Second).String()
	}

	h.records = append([]ExecutionRecord{record}, h.records...)

	// Trim to max size
	if len(h.records) > h.maxSize {
		h.records = h.records[:h.maxSize]
	}

	// Save to database if available
	if db != nil {
		saveHistoryRecordToDB(record)
	} else {
		h.save()
	}
}

// GetAll returns all execution records
func (h *HistoryStore) GetAll() []ExecutionRecord {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.records
}

// GetByMachine returns records for a specific machine
func (h *HistoryStore) GetByMachine(machineID string) []ExecutionRecord {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var filtered []ExecutionRecord
	for _, r := range h.records {
		if r.MachineID == machineID {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

// GetByScript returns records for a specific script
func (h *HistoryStore) GetByScript(scriptPath string) []ExecutionRecord {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var filtered []ExecutionRecord
	for _, r := range h.records {
		if r.ScriptPath == scriptPath {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

// GetByID returns a single record by ID
func (h *HistoryStore) GetByID(id string) *ExecutionRecord {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for i := range h.records {
		if h.records[i].ID == id {
			return &h.records[i]
		}
	}
	return nil
}

// GetRecent returns the most recent N records
func (h *HistoryStore) GetRecent(n int) []ExecutionRecord {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if n > len(h.records) {
		n = len(h.records)
	}
	return h.records[:n]
}

// GetStats returns execution statistics
func (h *HistoryStore) GetStats() map[string]interface{} {
	h.mu.RLock()
	defer h.mu.RUnlock()

	total := len(h.records)
	successful := 0
	failed := 0
	machineStats := make(map[string]int)
	scriptStats := make(map[string]int)

	for _, r := range h.records {
		if r.Success {
			successful++
		} else {
			failed++
		}
		machineStats[r.MachineName]++
		scriptStats[r.ScriptName]++
	}

	// Get top machines and scripts
	type kv struct {
		Key   string
		Value int
	}

	var topMachines, topScripts []kv
	for k, v := range machineStats {
		topMachines = append(topMachines, kv{k, v})
	}
	for k, v := range scriptStats {
		topScripts = append(topScripts, kv{k, v})
	}

	sort.Slice(topMachines, func(i, j int) bool { return topMachines[i].Value > topMachines[j].Value })
	sort.Slice(topScripts, func(i, j int) bool { return topScripts[i].Value > topScripts[j].Value })

	if len(topMachines) > 5 {
		topMachines = topMachines[:5]
	}
	if len(topScripts) > 5 {
		topScripts = topScripts[:5]
	}

	return map[string]interface{}{
		"total":        total,
		"successful":   successful,
		"failed":       failed,
		"success_rate": float64(successful) / float64(max(total, 1)) * 100,
		"top_machines": topMachines,
		"top_scripts":  topScripts,
	}
}

// Clear clears all history
func (h *HistoryStore) Clear() error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.records = []ExecutionRecord{}
	return h.save()
}

// HistoryRoutes sets up history API routes
func HistoryRoutes(r *mux.Router) {
	// Get all history (returns summaries without Output for performance)
	r.HandleFunc("/api/history", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		limit := 100
		if l := req.URL.Query().Get("limit"); l != "" {
			fmt.Sscanf(l, "%d", &limit)
		}

		machineID := req.URL.Query().Get("machine_id")
		scriptPath := req.URL.Query().Get("script_path")

		var records []ExecutionRecord
		if machineID != "" {
			records = historyStore.GetByMachine(machineID)
		} else if scriptPath != "" {
			records = historyStore.GetByScript(scriptPath)
		} else {
			records = historyStore.GetRecent(limit)
		}

		// Convert to summaries (without Output) for better performance
		summaries := make([]ExecutionRecordSummary, len(records))
		for i, r := range records {
			summaries[i] = r.ToSummary()
		}

		json.NewEncoder(w).Encode(summaries)
	}).Methods("GET")

	// Get history stats
	r.HandleFunc("/api/history/stats", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(historyStore.GetStats())
	}).Methods("GET")

	// Clear history
	r.HandleFunc("/api/history", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := historyStore.Clear(); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("DELETE")

	// Get single execution record by ID
	r.HandleFunc("/api/history/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)
		id := vars["id"]

		record := historyStore.GetByID(id)
		if record == nil {
			http.Error(w, "Record not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(record)
	}).Methods("GET")
}

// RecordExecution creates a history record from an execution result
func RecordExecution(result ExecutionResult, scriptPath, args, presetName string) {
	if historyStore == nil {
		return
	}

	exitCode := 0
	if !result.Success {
		exitCode = 1
	}

	record := ExecutionRecord{
		MachineID:   result.MachineID,
		MachineName: result.MachineName,
		MachineIP:   "", // Will be filled by caller if available
		ScriptPath:  scriptPath,
		ScriptName:  filepath.Base(scriptPath),
		Args:        args,
		PresetName:  presetName,
		StartedAt:   result.StartedAt,
		FinishedAt:  result.FinishedAt,
		Success:     result.Success,
		Output:      result.Output,
		Error:       result.Error,
		ExitCode:    exitCode,
	}

	historyStore.Add(record)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
