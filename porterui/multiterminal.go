package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// MultiTerminalExecution represents a command run on multiple machines
type MultiTerminalExecution struct {
	ID         string                `json:"id"`
	Command    string                `json:"command"`
	MachineIDs []string              `json:"machine_ids"`
	StartedAt  time.Time             `json:"started_at"`
	Status     string                `json:"status"`
	Results    []MultiTerminalResult `json:"results"`
}

type MultiTerminalResult struct {
	MachineID   string     `json:"machine_id"`
	MachineName string     `json:"machine_name"`
	MachineIP   string     `json:"machine_ip"`
	Status      string     `json:"status"` // pending, running, success, failed
	Output      string     `json:"output"`
	Error       string     `json:"error,omitempty"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`
}

var (
	multiTerminalExecs   = make(map[string]*MultiTerminalExecution)
	multiTerminalExecsMu sync.RWMutex
)

// MultiTerminalRoutes sets up multi-machine terminal API routes
func MultiTerminalRoutes(r *mux.Router) {
	// Execute command on multiple machines
	r.HandleFunc("/api/multi-terminal/execute", func(w http.ResponseWriter, req *http.Request) {
		var reqBody struct {
			Command    string   `json:"command"`
			MachineIDs []string `json:"machine_ids"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if len(reqBody.MachineIDs) == 0 {
			http.Error(w, "No machines specified", http.StatusBadRequest)
			return
		}

		exec := &MultiTerminalExecution{
			ID:         fmt.Sprintf("multi-%d", time.Now().UnixNano()),
			Command:    reqBody.Command,
			MachineIDs: reqBody.MachineIDs,
			StartedAt:  time.Now(),
			Status:     "running",
			Results:    make([]MultiTerminalResult, len(reqBody.MachineIDs)),
		}

		// Initialize results
		for i, machineID := range reqBody.MachineIDs {
			machine, exists := machineRepo.Get(machineID)
			if exists {
				exec.Results[i] = MultiTerminalResult{
					MachineID:   machineID,
					MachineName: machine.Name,
					MachineIP:   machine.IP,
					Status:      "pending",
				}
			} else {
				exec.Results[i] = MultiTerminalResult{
					MachineID: machineID,
					Status:    "failed",
					Error:     "Machine not found",
				}
			}
		}

		multiTerminalExecsMu.Lock()
		multiTerminalExecs[exec.ID] = exec
		multiTerminalExecsMu.Unlock()

		// Check user role to determine sudo access
		useSudo := false
		claims := getClaimsFromRequest(req)
		if claims != nil && (claims.Role == "admin" || HasPermission(claims.Permissions, "sudo:enabled")) {
			useSudo = true
		}

		// Execute on all machines in parallel
		var wg sync.WaitGroup
		for i, machineID := range reqBody.MachineIDs {
			machine, exists := machineRepo.Get(machineID)
			if !exists {
				continue
			}

			wg.Add(1)
			go func(idx int, m *Machine, runAsSudo bool) {
				defer wg.Done()

				now := time.Now()
				exec.Results[idx].StartedAt = &now
				exec.Results[idx].Status = "running"

				client, err := porter.Connect(m.IP, porter.DefaultConfig(m.Username, m.Password))
				if err != nil {
					endTime := time.Now()
					exec.Results[idx].EndedAt = &endTime
					exec.Results[idx].Status = "failed"
					exec.Results[idx].Error = "Connection failed: " + err.Error()
					return
				}
				defer client.Close()

				// Build command - admin users run with sudo
				cmd := reqBody.Command
				if runAsSudo {
					password := GetDecryptedPassword(m)
					cmd = fmt.Sprintf("echo '%s' | sudo -S %s", password, reqBody.Command)
				}

				output, err := client.Run(cmd)
				endTime := time.Now()
				exec.Results[idx].EndedAt = &endTime
				exec.Results[idx].Output = string(output)

				if err != nil {
					exec.Results[idx].Status = "failed"
					exec.Results[idx].Error = err.Error()
				} else {
					exec.Results[idx].Status = "success"
				}
			}(i, machine, useSudo)
		}

		// Wait for completion in background and update status
		go func() {
			wg.Wait()

			allSuccess := true
			for _, r := range exec.Results {
				if r.Status == "failed" {
					allSuccess = false
					break
				}
			}

			if allSuccess {
				exec.Status = "completed"
			} else {
				exec.Status = "partial"
			}

			AddAuditLog("multi_terminal_execute", "terminal", "", "", map[string]interface{}{
				"command":       reqBody.Command,
				"machine_count": len(reqBody.MachineIDs),
			}, allSuccess, "")
		}()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(exec)
	}).Methods("POST")

	// Get execution status
	r.HandleFunc("/api/multi-terminal/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		multiTerminalExecsMu.RLock()
		exec, exists := multiTerminalExecs[id]
		multiTerminalExecsMu.RUnlock()

		if !exists {
			http.Error(w, "Execution not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(exec)
	}).Methods("GET")

	// List recent executions
	r.HandleFunc("/api/multi-terminal", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		multiTerminalExecsMu.RLock()
		defer multiTerminalExecsMu.RUnlock()

		execs := make([]*MultiTerminalExecution, 0, len(multiTerminalExecs))
		for _, e := range multiTerminalExecs {
			execs = append(execs, e)
		}

		json.NewEncoder(w).Encode(execs)
	}).Methods("GET")
}
