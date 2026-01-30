package porterui

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// ============================================================================
// SECURITY & VALIDATION
// ============================================================================

// Dangerous command patterns that require confirmation
var dangerousPatterns = []string{
	`\brm\s+(-rf?|--recursive)`,
	`\brm\s+-[a-z]*f`,
	`\bdd\s+`,
	`\bmkfs\.`,
	`\bformat\s+`,
	`>\s*/dev/`,
	`\bshutdown\b`,
	`\breboot\b`,
	`\bpoweroff\b`,
	`\bhalt\b`,
	`\binit\s+0`,
	`\bkill\s+-9\s+-1`,
	`\bkillall\b`,
	`\bchmod\s+777`,
	`\bchown\s+-R\s+root`,
	`:\(\)\s*{\s*:\|:&\s*}`, // Fork bomb
	`/dev/null\s*>\s*/etc/`, // Overwriting system files
}

// Compiled dangerous patterns for performance
var dangerousRegexps []*regexp.Regexp

func init() {
	for _, pattern := range dangerousPatterns {
		re, err := regexp.Compile(pattern)
		if err == nil {
			dangerousRegexps = append(dangerousRegexps, re)
		}
	}
}

// IsDangerousCommand checks if a command matches dangerous patterns
func IsDangerousCommand(cmd string) bool {
	cmdLower := strings.ToLower(cmd)
	for _, re := range dangerousRegexps {
		if re.MatchString(cmdLower) {
			return true
		}
	}
	return false
}

// SanitizeFilePath prevents path traversal attacks
func SanitizeFilePath(path string) string {
	// Remove null bytes
	path = strings.ReplaceAll(path, "\x00", "")
	// Check for path traversal BEFORE cleaning (since Clean resolves ..)
	if strings.Contains(path, "..") {
		return ""
	}
	// Clean the path
	path = filepath.Clean(path)
	return path
}

// ValidateCommand performs basic command validation
func ValidateCommand(cmd string) (string, error) {
	if strings.TrimSpace(cmd) == "" {
		return "", fmt.Errorf("command cannot be empty")
	}
	if len(cmd) > 10000 {
		return "", fmt.Errorf("command too long (max 10000 characters)")
	}
	// Remove null bytes
	cmd = strings.ReplaceAll(cmd, "\x00", "")
	return cmd, nil
}

// RateLimiter for API endpoints
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	limit    int
	window   time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	// Filter out old requests
	var recent []time.Time
	for _, t := range rl.requests[key] {
		if t.After(windowStart) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= rl.limit {
		rl.requests[key] = recent
		return false
	}

	rl.requests[key] = append(recent, now)
	return true
}

// Global rate limiter: 30 requests per minute per machine
var commandRateLimiter = NewRateLimiter(30, time.Minute)

// ============================================================================
// TYPES
// ============================================================================

type Machine struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	IP        string   `json:"ip"`
	Username  string   `json:"username"`
	Password  string   `json:"password,omitempty"`
	Status    string   `json:"status"`
	Category  string   `json:"category,omitempty"`
	Notes     string   `json:"notes,omitempty"`
	AgentPort int      `json:"agent_port,omitempty"`
	HasAgent  bool     `json:"has_agent"`
	Tags      []string `json:"tags,omitempty"`
	MAC       string   `json:"mac,omitempty"`
}

type ExecutionRequest struct {
	MachineIDs []string          `json:"machine_ids"`
	ScriptPath string            `json:"script_path"`
	Flags      map[string]string `json:"flags"`
}

type ExecutionResult struct {
	MachineID   string    `json:"machine_id"`
	MachineName string    `json:"machine_name"`
	ScriptPath  string    `json:"script_path"`
	Success     bool      `json:"success"`
	Output      string    `json:"output"`
	Error       string    `json:"error"`
	StartedAt   time.Time `json:"started_at"`
	FinishedAt  time.Time `json:"finished_at"`
}

type ScriptExecution struct {
	ID         string            `json:"id"`
	Status     string            `json:"status"`
	Results    []ExecutionResult `json:"results"`
	ScriptPath string            `json:"script_path,omitempty"`
	ScriptName string            `json:"script_name,omitempty"`
	MachineIDs []string          `json:"machine_ids,omitempty"`
	Args       string            `json:"args,omitempty"`
	StartedAt  time.Time         `json:"started_at,omitempty"`
}

// ============================================================================
// MACHINE REPOSITORY
// ============================================================================

// LoadMachines loads all machines from storage (helper for other packages)
func LoadMachines() ([]Machine, error) {
	// If using database, load from there
	if db != nil {
		return LoadMachinesFromDB()
	}

	// Fallback to JSON file storage
	var machines []Machine
	if err := GetStore().Load("machines.json", &machines); err != nil {
		// Return empty list if file doesn't exist
		if os.IsNotExist(err) {
			return []Machine{}, nil
		}
		return nil, err
	}
	return machines, nil
}

// LoadMachinesFromDB loads all machines from the database
func LoadMachinesFromDB() ([]Machine, error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	rows, err := db.db.Query(`
		SELECT id, name, ip, username, COALESCE(password, ''), status, 
		       COALESCE(category, ''), COALESCE(notes, ''), agent_port, has_agent,
		       COALESCE(tags, '[]'), COALESCE(mac, '')
		FROM machines`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var machines []Machine
	for rows.Next() {
		var m Machine
		var tagsJSON string
		var password, category, notes, mac string

		if err := rows.Scan(&m.ID, &m.Name, &m.IP, &m.Username, &password,
			&m.Status, &category, &notes, &m.AgentPort, &m.HasAgent, &tagsJSON, &mac); err != nil {
			continue
		}

		m.Password = password
		m.Category = category
		m.Notes = notes
		m.MAC = mac

		// Parse tags JSON
		if tagsJSON != "" && tagsJSON != "[]" {
			json.Unmarshal([]byte(tagsJSON), &m.Tags)
		}

		machines = append(machines, m)
	}

	return machines, nil
}

type MachineRepo struct {
	machines map[string]*Machine
	mu       sync.RWMutex
	store    *Store
}

func NewMachineRepo(store *Store) *MachineRepo {
	repo := &MachineRepo{
		machines: make(map[string]*Machine),
		store:    store,
	}
	repo.load()
	return repo
}

func (r *MachineRepo) load() {
	// If using database, load from there
	if db != nil {
		machines, err := LoadMachinesFromDB()
		if err == nil {
			r.mu.Lock()
			for _, m := range machines {
				mCopy := m // Create copy to avoid pointer issues
				r.machines[m.ID] = &mCopy
			}
			r.mu.Unlock()
		}
		return
	}

	// Fallback to JSON file
	var machineList []*Machine
	if err := r.store.Load("machines.json", &machineList); err == nil {
		r.mu.Lock()
		for _, m := range machineList {
			r.machines[m.ID] = m
		}
		r.mu.Unlock()
	}
}

func (r *MachineRepo) save() {
	if db != nil {
		return // Database saves are done individually
	}
	r.mu.RLock()
	machineList := make([]*Machine, 0, len(r.machines))
	for _, m := range r.machines {
		machineList = append(machineList, m)
	}
	r.mu.RUnlock()
	r.store.Save("machines.json", machineList)
}

// saveMachineToDB saves a machine to the database
func saveMachineToDB(m *Machine) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	tagsJSON, _ := json.Marshal(m.Tags)
	hasAgentInt := 0
	if m.HasAgent {
		hasAgentInt = 1
	}

	_, err := db.db.Exec(`
		INSERT OR REPLACE INTO machines 
		(id, name, ip, username, password, status, category, notes, agent_port, has_agent, tags, mac, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, m.Name, m.IP, m.Username, m.Password, m.Status, m.Category, m.Notes,
		m.AgentPort, hasAgentInt, string(tagsJSON), m.MAC,
		time.Now().Format(time.RFC3339), time.Now().Format(time.RFC3339))

	return err
}

// deleteMachineFromDB deletes a machine from the database
func deleteMachineFromDB(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.db.Exec("DELETE FROM machines WHERE id = ?", id)
	return err
}

func (r *MachineRepo) List() []*Machine {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]*Machine, 0, len(r.machines))
	for _, m := range r.machines {
		list = append(list, m)
	}
	return list
}

func (r *MachineRepo) Get(id string) (*Machine, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	m, ok := r.machines[id]
	return m, ok
}

func (r *MachineRepo) Add(m *Machine) {
	r.mu.Lock()
	r.machines[m.ID] = m
	r.mu.Unlock()
	if db != nil {
		saveMachineToDB(m)
	} else {
		go r.save()
	}
}

func (r *MachineRepo) Delete(id string) {
	r.mu.Lock()
	delete(r.machines, id)
	r.mu.Unlock()
	if db != nil {
		deleteMachineFromDB(id)
	} else {
		go r.save()
	}
}

func (r *MachineRepo) UpdateStatus(id, status string) {
	r.mu.Lock()
	if m, ok := r.machines[id]; ok {
		m.Status = status
	}
	r.mu.Unlock()
}

func (r *MachineRepo) Update(updated *Machine) bool {
	r.mu.Lock()
	found := false
	var machineToSave *Machine
	if m, ok := r.machines[updated.ID]; ok {
		m.Name = updated.Name
		m.IP = updated.IP
		m.Username = updated.Username
		if updated.Password != "" {
			m.Password = updated.Password
		}
		m.Category = updated.Category
		m.Notes = updated.Notes
		m.AgentPort = updated.AgentPort
		m.HasAgent = updated.HasAgent
		m.Tags = updated.Tags
		machineToSave = m
		found = true
	}
	r.mu.Unlock()
	if found {
		if db != nil {
			saveMachineToDB(machineToSave)
		} else {
			go r.save()
		}
	}
	return found
}

func (r *MachineRepo) UpdateAgentStatus(id string, hasAgent bool, port int) {
	r.mu.Lock()
	var machineToSave *Machine
	if m, ok := r.machines[id]; ok {
		m.HasAgent = hasAgent
		if port > 0 {
			m.AgentPort = port
		}
		machineToSave = m
	}
	r.mu.Unlock()
	if machineToSave != nil {
		if db != nil {
			saveMachineToDB(machineToSave)
		} else {
			go r.save()
		}
	}
}

// ============================================================================
// EXECUTION HISTORY
// ============================================================================

type ExecutionHistory struct {
	results []ExecutionResult
	mu      sync.RWMutex
}

func NewExecutionHistory() *ExecutionHistory {
	return &ExecutionHistory{results: make([]ExecutionResult, 0)}
}

func (h *ExecutionHistory) Add(result ExecutionResult) {
	h.mu.Lock()
	h.results = append(h.results, result)
	h.mu.Unlock()
}

func (h *ExecutionHistory) List() []ExecutionResult {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.results
}

// ============================================================================
// SCRIPT EXECUTION TRACKER
// ============================================================================

type ExecutionTracker struct {
	executions map[string]*ScriptExecution
	mu         sync.RWMutex
}

func NewExecutionTracker() *ExecutionTracker {
	return &ExecutionTracker{executions: make(map[string]*ScriptExecution)}
}

func (t *ExecutionTracker) Create(id, scriptPath, args string, machineIDs []string) *ScriptExecution {
	scriptName := scriptPath
	if idx := strings.LastIndex(scriptPath, "/"); idx >= 0 {
		scriptName = scriptPath[idx+1:]
	}
	exec := &ScriptExecution{
		ID:         id,
		Status:     "running",
		Results:    make([]ExecutionResult, 0),
		ScriptPath: scriptPath,
		ScriptName: scriptName,
		MachineIDs: machineIDs,
		Args:       args,
		StartedAt:  time.Now(),
	}
	t.mu.Lock()
	t.executions[id] = exec
	t.mu.Unlock()
	return exec
}

func (t *ExecutionTracker) Get(id string) (*ScriptExecution, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	exec, ok := t.executions[id]
	return exec, ok
}

func (t *ExecutionTracker) AddResult(id string, result ExecutionResult) {
	t.mu.Lock()
	if exec, ok := t.executions[id]; ok {
		exec.Results = append(exec.Results, result)
	}
	t.mu.Unlock()
}

func (t *ExecutionTracker) SetStatus(id, status string) {
	t.mu.Lock()
	if exec, ok := t.executions[id]; ok {
		exec.Status = status
	}
	t.mu.Unlock()
}

func (t *ExecutionTracker) Cancel(id string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if exec, ok := t.executions[id]; ok {
		if exec.Status == "running" {
			exec.Status = "cancelled"
			return true
		}
	}
	return false
}

// ListRunning returns all currently running executions
func (t *ExecutionTracker) ListRunning() []*ScriptExecution {
	t.mu.RLock()
	defer t.mu.RUnlock()
	var running []*ScriptExecution
	for _, exec := range t.executions {
		if exec.Status == "running" {
			running = append(running, exec)
		}
	}
	return running
}

// List returns all executions (running and completed)
func (t *ExecutionTracker) List() []*ScriptExecution {
	t.mu.RLock()
	defer t.mu.RUnlock()
	var all []*ScriptExecution
	for _, exec := range t.executions {
		all = append(all, exec)
	}
	return all
}

// ============================================================================
// GLOBAL INSTANCES
// ============================================================================

var (
	machineRepo      *MachineRepo
	executionHistory *ExecutionHistory
	execTracker      *ExecutionTracker
)

func init() {
	machineRepo = NewMachineRepo(GetStore())
	executionHistory = NewExecutionHistory()
	execTracker = NewExecutionTracker()
}

// ReloadMachineRepo reloads machines from database after DB is initialized
func ReloadMachineRepo() {
	if db != nil && machineRepo != nil {
		machineRepo.load()
	}
}

// ============================================================================
// HELPERS
// ============================================================================

func testMachineConnection(m *Machine) {
	client := NewSSHClient(SSHConfig{
		Host:     m.IP,
		Username: m.Username,
		Password: m.Password,
		Timeout:  5 * time.Second,
	})

	if err := client.TestConnection(); err != nil {
		machineRepo.UpdateStatus(m.ID, "offline")
	} else {
		machineRepo.UpdateStatus(m.ID, "online")
	}
}

func executeScriptOnMachine(machine *Machine, scriptPath string, flags map[string]string) ExecutionResult {
	// Build args string from flags
	var flagArgs []string
	for flag, value := range flags {
		if value == "true" {
			flagArgs = append(flagArgs, flag)
		} else if value != "" && value != "false" {
			flagArgs = append(flagArgs, fmt.Sprintf("%s=%s", flag, value))
		}
	}
	return runScriptOnMachine(machine, scriptPath, strings.Join(flagArgs, " "))
}

func MachinesRoutes(router *mux.Router) {
	// POST /api/machines/test - Test machine connection (must be before {id} route)
	router.HandleFunc("/api/machines/test", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "Missing machine ID", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(id)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		go testMachineConnection(machine)
		w.WriteHeader(http.StatusOK)
	}).Methods("POST")

	// GET /api/machines - List all machines
	router.HandleFunc("/api/machines", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Return machines without passwords
		machines := machineRepo.List()
		safeMachines := make([]*Machine, len(machines))
		for i, m := range machines {
			safeMachines[i] = &Machine{
				ID:        m.ID,
				Name:      m.Name,
				IP:        m.IP,
				Username:  m.Username,
				Status:    m.Status,
				Category:  m.Category,
				Notes:     m.Notes,
				AgentPort: m.AgentPort,
				HasAgent:  m.HasAgent,
				Tags:      m.Tags,
			}
		}
		json.NewEncoder(w).Encode(safeMachines)
	}).Methods("GET")

	// GET /api/machines/{id}/processes - Get running processes (must be before {id} route)
	router.HandleFunc("/api/machines/{id}/processes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		machineID := mux.Vars(r)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"processes": []interface{}{}, "error": err.Error()})
			return
		}
		defer client.Close()

		// Get process list with CPU and memory usage
		output, _ := RunPorterTask(client, password, "List processes",
			"ps aux --sort=-%cpu | head -100 | awk 'NR>1 {print $2\"|\"$1\"|\"$3\"|\"$4\"|\"$11}'",
			"processes")

		var processes []map[string]interface{}
		lines := strings.Split(strings.TrimSpace(output), "\n")
		for _, line := range lines {
			parts := strings.Split(line, "|")
			if len(parts) >= 5 {
				var cpu, mem float64
				fmt.Sscanf(parts[2], "%f", &cpu)
				fmt.Sscanf(parts[3], "%f", &mem)
				processes = append(processes, map[string]interface{}{
					"pid":     parts[0],
					"user":    parts[1],
					"cpu":     cpu,
					"mem":     mem,
					"name":    parts[4],
					"command": parts[4],
				})
			}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{"processes": processes})
	}).Methods("GET")

	// POST /api/machines/{id}/processes/{pid}/kill - Kill a process (must be before {id} route)
	router.HandleFunc("/api/machines/{id}/processes/{pid}/kill", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		machineID := mux.Vars(r)["id"]
		pid := mux.Vars(r)["pid"]

		var request struct {
			Signal string `json:"signal"`
		}
		json.NewDecoder(r.Body).Decode(&request)
		if request.Signal == "" {
			request.Signal = "TERM"
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
			return
		}
		defer client.Close()

		// Kill the process
		cmd := fmt.Sprintf("kill -%s %s 2>&1 || sudo kill -%s %s 2>&1", request.Signal, pid, request.Signal, pid)
		output, _ := RunPorterTask(client, password, "Kill process", cmd, "kill")

		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "output": output})
	}).Methods("POST")

	// GET /api/machines/{id} - Get a single machine by ID
	router.HandleFunc("/api/machines/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		id := mux.Vars(r)["id"]
		machine, exists := machineRepo.Get(id)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Return machine without password
		safeMachine := *machine
		safeMachine.Password = ""
		json.NewEncoder(w).Encode(safeMachine)
	}).Methods("GET")

	// POST /api/machines - Add a new machine
	router.HandleFunc("/api/machines", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var machine Machine
		if err := json.NewDecoder(r.Body).Decode(&machine); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		machine.ID = fmt.Sprintf("machine-%d", time.Now().UnixNano())
		machine.Status = "unknown"

		machineRepo.Add(&machine)
		go testMachineConnection(&machine)

		json.NewEncoder(w).Encode(machine)
	}).Methods("POST")

	// PUT /api/machines - Update a machine
	router.HandleFunc("/api/machines", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var machine Machine
		if err := json.NewDecoder(r.Body).Decode(&machine); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if machine.ID == "" {
			http.Error(w, "Missing machine ID", http.StatusBadRequest)
			return
		}

		if !machineRepo.Update(&machine) {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Return updated machine (without password)
		updated, _ := machineRepo.Get(machine.ID)
		safeMachine := *updated
		safeMachine.Password = ""
		json.NewEncoder(w).Encode(safeMachine)
	}).Methods("PUT")

	// DELETE /api/machines - Delete a machine
	router.HandleFunc("/api/machines", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "Missing machine ID", http.StatusBadRequest)
			return
		}
		machineRepo.Delete(id)
		w.WriteHeader(http.StatusOK)
	}).Methods("DELETE")

	// POST /api/execute - Execute script (sync)
	router.HandleFunc("/api/execute", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var req ExecutionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		var results []ExecutionResult
		var wg sync.WaitGroup
		var resultsMu sync.Mutex

		for _, machineID := range req.MachineIDs {
			machine, exists := machineRepo.Get(machineID)
			if !exists {
				continue
			}

			wg.Add(1)
			go func(m *Machine) {
				defer wg.Done()
				result := executeScriptOnMachine(m, req.ScriptPath, req.Flags)
				executionHistory.Add(result)

				resultsMu.Lock()
				results = append(results, result)
				resultsMu.Unlock()
			}(machine)
		}

		wg.Wait()
		json.NewEncoder(w).Encode(results)
	}).Methods("POST")

	// GET /api/executions - Get execution history
	router.HandleFunc("/api/executions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(executionHistory.List())
	}).Methods("GET")

	// POST /api/execute-script - Execute script async (for wizard)
	router.HandleFunc("/api/execute-script", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var req struct {
			ScriptPath string   `json:"script_path"`
			MachineIDs []string `json:"machine_ids"`
			Args       string   `json:"args"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Check user role to determine sudo access
		// Admin users run with sudo (as root), operators run as regular user
		useSudo := false
		claims := getClaimsFromRequest(r)
		if claims != nil && (claims.Role == "admin" || HasPermission(claims.Permissions, "sudo:enabled")) {
			useSudo = true
		}

		execID := fmt.Sprintf("exec-%d", time.Now().UnixNano())
		execution := execTracker.Create(execID, req.ScriptPath, req.Args, req.MachineIDs)

		// Return immediately
		json.NewEncoder(w).Encode(execution)

		// Execute in background with appropriate sudo level
		go executeScriptAsync(execID, req.ScriptPath, req.MachineIDs, req.Args, useSudo)
	}).Methods("POST")

	// GET /api/script-executions - List all running executions
	router.HandleFunc("/api/script-executions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Check for ?running=true query param
		if r.URL.Query().Get("running") == "true" {
			json.NewEncoder(w).Encode(execTracker.ListRunning())
		} else {
			json.NewEncoder(w).Encode(execTracker.List())
		}
	}).Methods("GET")

	// GET /api/script-executions/{id} - Get execution status
	router.HandleFunc("/api/script-executions/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		execID := mux.Vars(r)["id"]

		execution, exists := execTracker.Get(execID)
		if !exists {
			http.Error(w, "Execution not found", http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(execution)
	}).Methods("GET")

	// POST /api/script-executions/{id}/cancel - Cancel a running execution
	router.HandleFunc("/api/script-executions/{id}/cancel", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		execID := mux.Vars(r)["id"]

		execution, exists := execTracker.Get(execID)
		if !exists {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Execution not found",
			})
			return
		}

		// Get machine IDs from the execution to send stop signal
		for _, result := range execution.Results {
			if machine, ok := machineRepo.Get(result.MachineID); ok {
				// Create stop file on the remote machine (use sudo for system operations)
				go runCommandOnMachine(machine, "touch /tmp/.build_stop", true)
			}
		}

		// If no results yet, try to get machines from the request context
		// For now, just mark as cancelled
		execTracker.Cancel(execID)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Cancellation signal sent",
		})
	}).Methods("POST")

	// POST /api/run-command - Execute ad-hoc command on a machine using Porter
	router.HandleFunc("/api/run-command", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var req struct {
			MachineID    string `json:"machine_id"`
			Command      string `json:"command"`
			Confirmed    bool   `json:"confirmed"`     // User confirmed dangerous command
			SkipValidate bool   `json:"skip_validate"` // Skip validation for internal calls
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid request body",
			})
			return
		}

		// Validate command
		validatedCmd, err := ValidateCommand(req.Command)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}
		req.Command = validatedCmd

		// Check for dangerous commands (only for user input, not internal system commands)
		if !req.SkipValidate && !req.Confirmed && IsDangerousCommand(req.Command) {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":           false,
				"error":             "This command appears to be potentially dangerous",
				"dangerous":         true,
				"requires_confirm":  true,
				"dangerous_pattern": "Detected: rm -rf, dd, mkfs, shutdown, reboot, or similar",
			})
			return
		}

		// Rate limiting
		if !commandRateLimiter.Allow(req.MachineID) {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":      false,
				"error":        "Rate limit exceeded. Please wait before sending more commands.",
				"rate_limited": true,
			})
			return
		}

		machine, exists := machineRepo.Get(req.MachineID)
		if !exists {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Machine not found",
			})
			return
		}

		// Check user role to determine sudo access
		useSudo := false
		claims := getClaimsFromRequest(r)
		if claims != nil && (claims.Role == "admin" || HasPermission(claims.Permissions, "sudo:enabled")) {
			useSudo = true
		}

		// Execute command using Porter manifest structure
		result := runCommandOnMachine(machine, req.Command, useSudo)

		// Record to command history
		executionHistory.Add(result)
		RecordExecution(result, "ad-hoc-command", req.Command, "")

		if !result.Success {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":   false,
				"error":     result.Error,
				"output":    result.Output,
				"exit_code": -1,
			})
			return
		}

		// Parse exit code from output and strip it from the output
		exitCode := 0
		cleanOutput := result.Output
		if strings.Contains(result.Output, "EXIT_CODE:") {
			parts := strings.Split(result.Output, "EXIT_CODE:")
			if len(parts) > 1 {
				fmt.Sscanf(strings.TrimSpace(parts[len(parts)-1]), "%d", &exitCode)
				// Remove the EXIT_CODE line from output
				cleanOutput = strings.TrimSpace(parts[0])
			}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   result.Success,
			"output":    cleanOutput,
			"exit_code": exitCode,
		})
	}).Methods("POST")

	// POST /api/upload-file - Upload file to remote machine using Porter SFTP (multipart form)
	router.HandleFunc("/api/upload-file", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Parse multipart form - allow up to 5GB files
		if err := r.ParseMultipartForm(5 << 30); err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to parse form: " + err.Error(),
			})
			return
		}

		machineID := r.FormValue("machine_id")
		destPath := r.FormValue("path")
		permissions := r.FormValue("permissions")
		owner := r.FormValue("owner")
		makeExecutable := r.FormValue("make_executable") == "true"
		createDirs := r.FormValue("create_dirs") == "true"

		// Validate inputs
		if machineID == "" || destPath == "" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "machine_id and path are required",
			})
			return
		}

		// Get uploaded file
		file, header, err := r.FormFile("file")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "No file uploaded: " + err.Error(),
			})
			return
		}
		defer file.Close()

		// Sanitize path
		cleanPath := SanitizeFilePath(destPath)
		if cleanPath == "" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid file path",
			})
			return
		}

		// Rate limiting
		if !commandRateLimiter.Allow(machineID) {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":      false,
				"error":        "Rate limit exceeded. Please wait before uploading more files.",
				"rate_limited": true,
			})
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Machine not found",
			})
			return
		}

		// Save file to temp location
		tempFile, err := os.CreateTemp("", "upload-*-"+header.Filename)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to create temp file: " + err.Error(),
			})
			return
		}
		tempPath := tempFile.Name()
		defer os.Remove(tempPath) // Clean up temp file

		// Copy uploaded file to temp
		_, err = io.Copy(tempFile, file)
		tempFile.Close()
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to save uploaded file: " + err.Error(),
			})
			return
		}

		// Upload using Porter SFTP
		result := uploadFileWithPorter(machine, tempPath, cleanPath, permissions, owner, makeExecutable, createDirs)

		json.NewEncoder(w).Encode(result)
	}).Methods("POST")
}

// runCommandOnMachine executes an ad-hoc command on a machine using Porter
// useSudo: if true, runs command with sudo (admin users); if false, runs as regular user (operators)
func runCommandOnMachine(m *Machine, command string, useSudo bool) ExecutionResult {
	result := ExecutionResult{
		MachineID:   m.ID,
		MachineName: m.Name,
		ScriptPath:  "command:" + command,
		StartedAt:   time.Now(),
	}

	// Connect using Porter
	client, err := porter.Connect(m.IP, porter.DefaultConfig(m.Username, m.Password))
	if err != nil {
		result.Success = false
		result.Error = fmt.Sprintf("Connection failed: %v", err)
		result.FinishedAt = time.Now()
		return result
	}
	defer client.Close()

	// Build Porter task for command execution with exit code capture
	var cmdWithExitCode string
	if useSudo {
		// Admin users run with sudo (as root)
		cmdWithExitCode = fmt.Sprintf("echo '%s' | sudo -S %s 2>&1; echo \"EXIT_CODE:$?\"", m.Password, command)
	} else {
		// Operator users run as regular user (no sudo)
		cmdWithExitCode = fmt.Sprintf("%s 2>&1; echo \"EXIT_CODE:$?\"", command)
	}
	tasks := porter.Tasks(
		porter.Capture(cmdWithExitCode).
			Name("Execute command").
			Register("cmd_output"),
	)

	// Execute using Porter
	executor := porter.NewExecutor(client, m.Password)
	vars := porter.NewVars()
	stats, err := executor.Run("ad-hoc-command", tasks, vars)

	result.FinishedAt = time.Now()

	if err != nil {
		result.Success = false
		result.Error = fmt.Sprintf("Execution failed: %v", err)
		result.Output = vars.Get("cmd_output")
		return result
	}

	result.Output = vars.Get("cmd_output")
	result.Success = stats.Failed == 0

	return result
}

// uploadFileWithPorter uploads a file using rsync (Linux) or SCP (Windows)
func uploadFileWithPorter(m *Machine, localPath, destPath, permissions, owner string, makeExecutable, createDirs bool) map[string]interface{} {
	result := map[string]interface{}{
		"success": false,
		"path":    destPath,
	}

	dir := filepath.Dir(destPath)

	// Check if we're on Linux (can use rsync) or Windows (use SCP)
	useRsync := runtime.GOOS == "linux" || runtime.GOOS == "darwin"

	// Connect using Porter for directory creation and post-upload tasks
	client, err := porter.Connect(m.IP, porter.DefaultConfig(m.Username, m.Password))
	if err != nil {
		result["error"] = fmt.Sprintf("Connection failed: %v", err)
		return result
	}
	defer client.Close()

	executor := porter.NewExecutor(client, m.Password)
	vars := porter.NewVars()

	// Create parent directories if needed (via SSH)
	if createDirs {
		preTasks := porter.Tasks(
			porter.Run(fmt.Sprintf("mkdir -p '%s' 2>/dev/null || sudo mkdir -p '%s'", dir, dir)).
				Name("Create directories").
				Ignore(),
		)
		executor.Run("create-dirs", preTasks, vars)
	}

	// Upload file using rsync (Linux/Mac) or SCP (Windows)
	if useRsync {
		// Build task list for rsync
		var tasks []porter.Task
		tasks = append(tasks, porter.RsyncEnsure()...)

		rsyncTask := porter.Tasks(
			porter.Rsync(localPath, destPath).
				Local().   // Run rsync locally, push to remote
				Partial(). // Keep partial transfers for resume
				Name("Upload file via rsync").
				Build(),
		)
		tasks = append(tasks, rsyncTask...)

		stats, err := executor.Run("file-upload-rsync", tasks, vars)
		if err != nil {
			result["error"] = fmt.Sprintf("Rsync upload failed: %v", err)
			return result
		}
		if stats.Failed > 0 {
			result["error"] = "Rsync upload failed"
			return result
		}
	} else {
		// Windows: Use SCP command directly
		// scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null localfile user@host:remotepath
		scpCmd := exec.Command("scp",
			"-o", "StrictHostKeyChecking=no",
			"-o", "UserKnownHostsFile=NUL",
			localPath,
			fmt.Sprintf("%s@%s:%s", m.Username, m.IP, destPath),
		)

		// For password auth, we need sshpass or expect, but Windows SCP typically uses keys
		// If password is needed, we'll fall back to SFTP via Porter
		output, err := scpCmd.CombinedOutput()
		if err != nil {
			// SCP failed (likely needs password), fall back to Porter SFTP
			var taskBuilders []porter.TaskBuilder
			taskBuilders = append(taskBuilders,
				porter.Upload(localPath, destPath).
					Name("Upload file via SFTP"),
			)
			tasks := porter.Tasks(taskBuilders...)
			stats, sftpErr := executor.Run("file-upload-sftp", tasks, vars)
			if sftpErr != nil {
				result["error"] = fmt.Sprintf("Upload failed: SCP error: %v, SFTP error: %v", err, sftpErr)
				return result
			}
			if stats.Failed > 0 {
				result["error"] = fmt.Sprintf("SFTP upload failed. SCP output: %s", string(output))
				return result
			}
		}
	}

	// Build post-upload tasks
	var taskBuilders []porter.TaskBuilder

	// Set permissions
	if permissions != "" {
		taskBuilders = append(taskBuilders,
			porter.Run(fmt.Sprintf("chmod %s '%s' 2>/dev/null || sudo chmod %s '%s'", permissions, destPath, permissions, destPath)).
				Name("Set permissions").
				Ignore(),
		)
	} else if makeExecutable {
		taskBuilders = append(taskBuilders,
			porter.Run(fmt.Sprintf("chmod +x '%s' 2>/dev/null || sudo chmod +x '%s'", destPath, destPath)).
				Name("Make executable").
				Ignore(),
		)
	}

	// Set ownership if specified
	if owner != "" {
		taskBuilders = append(taskBuilders,
			porter.Run(fmt.Sprintf("chown %s '%s' 2>/dev/null || sudo chown %s '%s'", owner, destPath, owner, destPath)).
				Name("Set ownership").
				Ignore(),
		)
	}

	// Verify upload
	taskBuilders = append(taskBuilders,
		porter.Capture(fmt.Sprintf("ls -la '%s'", destPath)).
			Name("Verify upload").
			Register("upload_result"),
	)

	// Run post-upload tasks (permissions, ownership, verify)
	if len(taskBuilders) > 0 {
		postTasks := porter.Tasks(taskBuilders...)
		stats, err := executor.Run("post-upload", postTasks, vars)

		if err != nil {
			result["error"] = fmt.Sprintf("Post-upload tasks failed: %v", err)
			result["output"] = vars.Get("upload_result")
			return result
		}

		if stats.Failed > 0 {
			result["error"] = "Post-upload tasks failed - check permissions"
			result["output"] = vars.Get("upload_result")
			return result
		}
	}

	result["success"] = true
	result["output"] = vars.Get("upload_result")
	result["message"] = fmt.Sprintf("File uploaded successfully to %s", destPath)

	return result
}

// uploadFileToMachine uploads a file to a remote machine with smart permission handling (legacy base64 method)
func uploadFileToMachine(m *Machine, destPath, base64Content, permissions, owner string, makeExecutable, createDirs bool) map[string]interface{} {
	result := map[string]interface{}{
		"success": false,
		"path":    destPath,
	}

	// Connect using Porter
	client, err := porter.Connect(m.IP, porter.DefaultConfig(m.Username, m.Password))
	if err != nil {
		result["error"] = fmt.Sprintf("Connection failed: %v", err)
		return result
	}
	defer client.Close()

	executor := porter.NewExecutor(client, m.Password)
	vars := porter.NewVars()

	// Build the upload script that handles permissions smartly
	// Strategy:
	// 1. Write to temp file first (always works)
	// 2. Create parent dirs if needed (with sudo if necessary)
	// 3. Move to destination (with sudo if necessary)
	// 4. Set permissions and ownership (with sudo if necessary)

	dir := filepath.Dir(destPath)
	filename := filepath.Base(destPath)
	tempPath := fmt.Sprintf("/tmp/.upload_%d_%s", time.Now().UnixNano(), filename)

	// Build command sequence
	var cmdParts []string

	// Step 1: Decode base64 content to temp file
	cmdParts = append(cmdParts, fmt.Sprintf("echo '%s' | base64 -d > '%s'", base64Content, tempPath))

	// Step 2: Create parent directories if needed
	if createDirs {
		// Try without sudo first, then with sudo
		cmdParts = append(cmdParts, fmt.Sprintf("mkdir -p '%s' 2>/dev/null || sudo mkdir -p '%s'", dir, dir))
	}

	// Step 3: Move file to destination (try without sudo, then with sudo)
	cmdParts = append(cmdParts, fmt.Sprintf("mv '%s' '%s' 2>/dev/null || sudo mv '%s' '%s'", tempPath, destPath, tempPath, destPath))

	// Step 4: Set permissions
	if permissions != "" {
		cmdParts = append(cmdParts, fmt.Sprintf("chmod %s '%s' 2>/dev/null || sudo chmod %s '%s'", permissions, destPath, permissions, destPath))
	} else if makeExecutable {
		cmdParts = append(cmdParts, fmt.Sprintf("chmod +x '%s' 2>/dev/null || sudo chmod +x '%s'", destPath, destPath))
	}

	// Step 5: Set ownership if specified
	if owner != "" {
		cmdParts = append(cmdParts, fmt.Sprintf("chown %s '%s' 2>/dev/null || sudo chown %s '%s'", owner, destPath, owner, destPath))
	}

	// Step 6: Verify file exists and get info
	cmdParts = append(cmdParts, fmt.Sprintf("ls -la '%s' && echo 'UPLOAD_SUCCESS'", destPath))

	// Join all commands
	fullCmd := strings.Join(cmdParts, " && ")

	tasks := porter.Tasks(
		porter.Capture(fullCmd).
			Name("Upload file").
			Register("upload_output"),
	)

	stats, err := executor.Run("file-upload", tasks, vars)
	output := vars.Get("upload_output")

	if err != nil {
		result["error"] = fmt.Sprintf("Upload failed: %v", err)
		result["output"] = output
		return result
	}

	if stats.Failed > 0 || !strings.Contains(output, "UPLOAD_SUCCESS") {
		result["error"] = "Upload failed - check permissions or path"
		result["output"] = output
		return result
	}

	result["success"] = true
	result["output"] = output
	result["message"] = fmt.Sprintf("File uploaded successfully to %s", destPath)

	return result
}

// executeScriptAsync runs script execution in background with streaming
// useSudo: if true, runs scripts with sudo (admin users); if false, runs as regular user (operators)
func executeScriptAsync(execID, scriptPath string, machineIDs []string, args string, useSudo bool) {
	var wg sync.WaitGroup

	for _, machineID := range machineIDs {
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			continue
		}

		wg.Add(1)
		go func(m *Machine) {
			defer wg.Done()
			// Use streaming execution for real-time output
			result := RunScriptWithStreaming(m, scriptPath, args, execID, useSudo)
			executionHistory.Add(result)
			execTracker.AddResult(execID, result)
			// Record to persistent history
			RecordExecution(result, scriptPath, args, "")
			// Send notification
			NotifyExecutionComplete(result, filepath.Base(scriptPath))
			// If agent install was successful, update machine's has_agent flag
			if result.Success && strings.Contains(args, "--agent") {
				machineRepo.UpdateAgentStatus(m.ID, true, 8083)
			}
		}(machine)
	}

	wg.Wait()

	// Determine final status
	exec, _ := execTracker.Get(execID)
	status := "completed"
	for _, r := range exec.Results {
		if !r.Success {
			status = "failed"
			break
		}
	}
	execTracker.SetStatus(execID, status)
}

// ScriptDeployConfig holds configuration for script deployment
type ScriptDeployConfig struct {
	LocalTempDir    string
	RemoteBase      string
	RemoteScriptDir string
	ScriptName      string
	LibDir          string
	HasLib          bool
	Args            string
	Password        string
}

// BuildSetupManifest creates the directory setup manifest
func BuildSetupManifest(cfg ScriptDeployConfig) []porter.Task {
	tasks := []porter.TaskBuilder{
		porter.Run(fmt.Sprintf("mkdir -p %s", cfg.RemoteScriptDir)).Name("Create script directory"),
	}
	if cfg.HasLib {
		tasks = append(tasks, porter.Run(fmt.Sprintf("mkdir -p %s/lib", cfg.RemoteBase)).Name("Create lib directory"))
	}
	return porter.Tasks(tasks...)
}

// BuildUploadManifest creates the file upload manifest
func BuildUploadManifest(cfg ScriptDeployConfig) []porter.Task {
	var tasks []porter.TaskBuilder

	// Upload script files
	files, _ := os.ReadDir(cfg.LocalTempDir)
	for _, f := range files {
		if !f.IsDir() {
			localFile := filepath.Join(cfg.LocalTempDir, f.Name())
			remoteFile := fmt.Sprintf("%s/%s", cfg.RemoteScriptDir, f.Name())
			tasks = append(tasks, porter.Upload(localFile, remoteFile).Name("Upload "+f.Name()))
		}
	}

	// Upload lib files
	if cfg.HasLib {
		libFiles, _ := os.ReadDir(cfg.LibDir)
		for _, f := range libFiles {
			if !f.IsDir() {
				localFile := filepath.Join(cfg.LibDir, f.Name())
				remoteFile := fmt.Sprintf("%s/lib/%s", cfg.RemoteBase, f.Name())
				tasks = append(tasks, porter.Upload(localFile, remoteFile).Name("Upload lib/"+f.Name()))
			}
		}
	}

	return porter.Tasks(tasks...)
}

// BuildExecuteManifest creates the script execution manifest
func BuildExecuteManifest(cfg ScriptDeployConfig) []porter.Task {
	remotePath := fmt.Sprintf("%s/%s", cfg.RemoteScriptDir, cfg.ScriptName)
	scriptCmd := fmt.Sprintf("cd ~ && echo '%s' | sudo -S bash %s %s 2>&1; echo \"EXIT_CODE:$?\"", cfg.Password, remotePath, cfg.Args)

	return porter.Tasks(
		porter.Chmod(remotePath).Mode("755").Name("Make script executable"),
		porter.Run(fmt.Sprintf("chmod 755 %s/lib/*.sh 2>/dev/null || true", cfg.RemoteBase)).
			Name("Make lib scripts executable").
			Ignore(),
		porter.Capture(scriptCmd).
			Name("Execute script").
			Register("script_output").
			Ignore(),
		porter.Rm(cfg.RemoteBase).
			Name("Cleanup temp files"),
	)
}

// runScriptOnMachine executes a script on a remote machine using Porter manifests
func runScriptOnMachine(m *Machine, scriptPath, args string) ExecutionResult {
	result := ExecutionResult{
		MachineID:   m.ID,
		MachineName: m.Name,
		ScriptPath:  scriptPath,
		StartedAt:   time.Now(),
	}

	var localTempDir string
	var scriptName string
	var scriptDir string
	var libTempDir string
	var libErr error = fmt.Errorf("no lib")

	// Check if this is a custom script
	if strings.HasPrefix(scriptPath, "custom:") {
		customID := strings.TrimPrefix(scriptPath, "custom:")

		// Get custom script from store
		if customScriptStore == nil {
			result.Error = "Custom script store not initialized"
			result.FinishedAt = time.Now()
			return result
		}

		customScript, ok := customScriptStore.Get(customID)
		if !ok || customScript == nil {
			result.Error = fmt.Sprintf("Custom script not found: %s", customID)
			result.FinishedAt = time.Now()
			return result
		}

		// Create temp directory and copy custom script there
		var err error
		localTempDir, err = os.MkdirTemp("", "script-runner-custom-")
		if err != nil {
			result.Error = fmt.Sprintf("Failed to create temp dir: %v", err)
			result.FinishedAt = time.Now()
			return result
		}

		// Read custom script content and write to temp dir
		content, err := customScriptStore.GetContent(customID)
		if err != nil {
			os.RemoveAll(localTempDir)
			result.Error = fmt.Sprintf("Failed to read custom script: %v", err)
			result.FinishedAt = time.Now()
			return result
		}

		scriptName = customScript.FileName
		if scriptName == "" {
			scriptName = customID + ".sh"
		}

		// Write script to temp dir with executable permissions
		scriptFile := filepath.Join(localTempDir, scriptName)
		if err := os.WriteFile(scriptFile, []byte(content), 0755); err != nil {
			os.RemoveAll(localTempDir)
			result.Error = fmt.Sprintf("Failed to write script: %v", err)
			result.FinishedAt = time.Now()
			return result
		}

		scriptDir = "custom"
	} else {
		// Embedded script - use existing logic
		scriptName = filepath.Base(scriptPath)
		scriptDir = filepath.Dir(scriptPath)

		// Extract embedded scripts to local temp
		var err error
		localTempDir, err = ExtractEmbeddedScripts(scriptDir)
		if err != nil {
			result.Error = fmt.Sprintf("Failed to extract scripts: %v", err)
			result.FinishedAt = time.Now()
			return result
		}

		// Also extract lib directory if it exists (for common.sh etc)
		libSourceDir := filepath.Join(filepath.Dir(scriptDir), "lib")
		libTempDir, libErr = ExtractEmbeddedScripts(libSourceDir)
	}

	defer os.RemoveAll(localTempDir)
	if libErr == nil {
		defer os.RemoveAll(libTempDir)
	}

	// Build deployment config
	remoteBase := fmt.Sprintf("/tmp/idx-deploy-%d", time.Now().UnixNano())

	cfg := ScriptDeployConfig{
		LocalTempDir:    localTempDir,
		RemoteBase:      remoteBase,
		RemoteScriptDir: fmt.Sprintf("%s/%s", remoteBase, filepath.Base(scriptDir)),
		ScriptName:      scriptName,
		LibDir:          libTempDir,
		HasLib:          libErr == nil,
		Args:            args,
		Password:        m.Password,
	}

	// Connect using Porter
	client, err := porter.Connect(m.IP, porter.DefaultConfig(m.Username, m.Password))
	if err != nil {
		result.Error = fmt.Sprintf("Failed to connect: %v", err)
		result.FinishedAt = time.Now()
		return result
	}
	defer client.Close()

	executor := porter.NewExecutor(client, m.Password)
	vars := porter.NewVars()

	// Execute setup manifest
	if _, err := executor.Run("Setup Directories", BuildSetupManifest(cfg), vars); err != nil {
		result.Error = fmt.Sprintf("Failed to create directories: %v", err)
		result.FinishedAt = time.Now()
		return result
	}

	// Execute upload manifest
	uploadTasks := BuildUploadManifest(cfg)
	if len(uploadTasks) > 0 {
		if _, err := executor.Run("Upload Files", uploadTasks, vars); err != nil {
			result.Error = fmt.Sprintf("Failed to upload files: %v", err)
			result.FinishedAt = time.Now()
			return result
		}
	}

	// Execute script manifest
	stats, err := executor.Run("Execute Script", BuildExecuteManifest(cfg), vars)
	result.FinishedAt = time.Now()

	// Process results
	if output := vars.Get("script_output"); output != "" {
		result.Output = output
		if strings.Contains(output, "EXIT_CODE:0") {
			result.Success = true
		}
	} else {
		result.Output = fmt.Sprintf("Tasks: %d total, %d ok, %d failed, %d skipped", stats.Total, stats.OK, stats.Failed, stats.Skipped)
	}

	if err != nil {
		result.Error = fmt.Sprintf("Execution failed: %v", err)
	} else if stats.Failed > 0 && result.Output == "" {
		result.Error = fmt.Sprintf("%d tasks failed", stats.Failed)
	} else if !result.Success && result.Output != "" {
		result.Error = "Script returned non-zero exit code"
	} else {
		result.Success = true
	}

	return result
}
