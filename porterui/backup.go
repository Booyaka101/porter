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

// BackupJob represents a backup configuration
type BackupJob struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	MachineID   string     `json:"machine_id"`
	MachineName string     `json:"machine_name"`
	SourcePath  string     `json:"source_path"`
	DestPath    string     `json:"dest_path"`
	Schedule    string     `json:"schedule"` // cron expression or "manual"
	Compress    bool       `json:"compress"`
	Enabled     bool       `json:"enabled"`
	LastRun     *time.Time `json:"last_run,omitempty"`
	LastStatus  string     `json:"last_status,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// BackupHistory represents a backup execution record
type BackupHistory struct {
	ID        string     `json:"id"`
	JobID     string     `json:"job_id"`
	JobName   string     `json:"job_name"`
	MachineID string     `json:"machine_id"`
	StartedAt time.Time  `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`
	Status    string     `json:"status"` // running, success, failed
	Size      int64      `json:"size,omitempty"`
	Error     string     `json:"error,omitempty"`
	Output    string     `json:"output,omitempty"`
}

var (
	backupJobs      = make(map[string]*BackupJob)
	backupJobsMu    sync.RWMutex
	backupHistory   []BackupHistory
	backupHistoryMu sync.RWMutex
)

// BackupRoutes sets up backup management API routes
func BackupRoutes(r *mux.Router) {
	// List all backup jobs
	r.HandleFunc("/api/backups", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		backupJobsMu.RLock()
		defer backupJobsMu.RUnlock()

		jobs := make([]*BackupJob, 0, len(backupJobs))
		for _, j := range backupJobs {
			jobs = append(jobs, j)
		}
		json.NewEncoder(w).Encode(jobs)
	}).Methods("GET")

	// Create a backup job
	r.HandleFunc("/api/backups", func(w http.ResponseWriter, req *http.Request) {
		var job BackupJob
		if err := json.NewDecoder(req.Body).Decode(&job); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		job.ID = fmt.Sprintf("backup-%d", time.Now().UnixNano())
		job.CreatedAt = time.Now()
		job.Enabled = true

		// Get machine name
		if machine, exists := machineRepo.Get(job.MachineID); exists {
			job.MachineName = machine.Name
		}

		backupJobsMu.Lock()
		backupJobs[job.ID] = &job
		backupJobsMu.Unlock()

		AddAuditLog("create_backup_job", "backup", job.MachineID, job.MachineName, map[string]interface{}{
			"name":   job.Name,
			"source": job.SourcePath,
		}, true, "")

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(job)
	}).Methods("POST")

	// Delete a backup job
	r.HandleFunc("/api/backups/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		backupJobsMu.Lock()
		delete(backupJobs, id)
		backupJobsMu.Unlock()

		w.WriteHeader(http.StatusOK)
	}).Methods("DELETE")

	// Run a backup job manually
	r.HandleFunc("/api/backups/{id}/run", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		backupJobsMu.RLock()
		job, exists := backupJobs[id]
		backupJobsMu.RUnlock()

		if !exists {
			http.Error(w, "Backup job not found", http.StatusNotFound)
			return
		}

		machine, machineExists := machineRepo.Get(job.MachineID)
		if !machineExists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Create history entry
		history := BackupHistory{
			ID:        fmt.Sprintf("bh-%d", time.Now().UnixNano()),
			JobID:     job.ID,
			JobName:   job.Name,
			MachineID: job.MachineID,
			StartedAt: time.Now(),
			Status:    "running",
		}

		backupHistoryMu.Lock()
		backupHistory = append(backupHistory, history)
		backupHistoryMu.Unlock()

		// Run backup using Porter's task-based approach
		go func() {
			password := GetDecryptedPassword(machine)
			client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
			if err != nil {
				updateBackupHistory(history.ID, "failed", 0, err.Error(), "")
				return
			}
			defer client.Close()

			// Build Porter manifest for backup
			timestamp := time.Now().Format("20060102-150405")
			destFile := fmt.Sprintf("%s/%s-%s", job.DestPath, job.Name, timestamp)

			// Create backup tasks using Porter's Ansible-like DSL
			var tasks []porter.Task

			// Ensure destination directory exists
			tasks = append(tasks, porter.Mkdir(job.DestPath).Name("Create backup directory").Build())

			if job.Compress {
				destFile += ".tar.gz"
				// Use tar for compressed backup
				tasks = append(tasks,
					porter.Run(fmt.Sprintf("tar -czf '%s' -C '%s' .", destFile, job.SourcePath)).
						Name("Create compressed backup").
						Build(),
				)
			} else {
				// Use cp for uncompressed backup
				tasks = append(tasks,
					porter.Run(fmt.Sprintf("cp -r '%s' '%s'", job.SourcePath, destFile)).
						Name("Copy backup files").
						Build(),
				)
			}

			// Capture backup size
			tasks = append(tasks,
				porter.Capture(fmt.Sprintf("du -sb '%s' 2>/dev/null | cut -f1", destFile)).
					Name("Get backup size").
					Register("backup_size").
					Ignore().
					Build(),
			)

			// Execute the backup manifest
			vars := porter.NewVars()
			vars.Set("backup_name", job.Name)
			vars.Set("source", job.SourcePath)
			vars.Set("dest", destFile)

			executor := porter.NewExecutor(client, password)
			executor.SetVerbose(false)

			var outputBuilder string
			executor.OnProgress(func(p porter.TaskProgress) {
				outputBuilder += fmt.Sprintf("[%s] %s: %s\n", p.Status, p.Name, p.Action)
			})

			stats, execErr := executor.Run(fmt.Sprintf("Backup: %s", job.Name), tasks, vars)

			// Get backup size from captured variable
			var size int64
			if sizeStr := vars.Get("backup_size"); sizeStr != "" {
				fmt.Sscanf(sizeStr, "%d", &size)
			}

			status := "success"
			errMsg := ""
			if execErr != nil || stats.Failed > 0 {
				status = "failed"
				if execErr != nil {
					errMsg = execErr.Error()
				} else {
					errMsg = fmt.Sprintf("%d task(s) failed", stats.Failed)
				}
			}

			outputBuilder += fmt.Sprintf("\nStats: OK=%d, Changed=%d, Failed=%d, Skipped=%d",
				stats.OK, stats.Changed, stats.Failed, stats.Skipped)

			updateBackupHistory(history.ID, status, size, errMsg, outputBuilder)

			// Update job last run
			backupJobsMu.Lock()
			if j, ok := backupJobs[job.ID]; ok {
				now := time.Now()
				j.LastRun = &now
				j.LastStatus = status
			}
			backupJobsMu.Unlock()

			AddAuditLog("run_backup", "backup", job.MachineID, machine.Name, map[string]interface{}{
				"job_name": job.Name,
				"status":   status,
				"stats":    fmt.Sprintf("ok=%d changed=%d failed=%d", stats.OK, stats.Changed, stats.Failed),
			}, status == "success", errMsg)
		}()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    true,
			"history_id": history.ID,
		})
	}).Methods("POST")

	// Get backup history
	r.HandleFunc("/api/backups/history", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		jobID := req.URL.Query().Get("job_id")
		limit := 50

		backupHistoryMu.RLock()
		defer backupHistoryMu.RUnlock()

		var filtered []BackupHistory
		for i := len(backupHistory) - 1; i >= 0 && len(filtered) < limit; i-- {
			h := backupHistory[i]
			if jobID != "" && h.JobID != jobID {
				continue
			}
			filtered = append(filtered, h)
		}

		json.NewEncoder(w).Encode(filtered)
	}).Methods("GET")
}

func updateBackupHistory(id, status string, size int64, errMsg, output string) {
	backupHistoryMu.Lock()
	defer backupHistoryMu.Unlock()

	for i := range backupHistory {
		if backupHistory[i].ID == id {
			now := time.Now()
			backupHistory[i].EndedAt = &now
			backupHistory[i].Status = status
			backupHistory[i].Size = size
			backupHistory[i].Error = errMsg
			backupHistory[i].Output = output
			break
		}
	}
}
