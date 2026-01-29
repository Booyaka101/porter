package porterui

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/robfig/cron/v3"
)

// ScheduledJob represents a scheduled script execution
type ScheduledJob struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	ScriptPath   string    `json:"script_path"`
	Args         string    `json:"args,omitempty"`
	MachineIDs   []string  `json:"machine_ids"`
	CronExpr     string    `json:"cron_expr"`
	Enabled      bool      `json:"enabled"`
	CreatedAt    time.Time `json:"created_at"`
	LastRun      time.Time `json:"last_run,omitempty"`
	NextRun      time.Time `json:"next_run,omitempty"`
	LastStatus   string    `json:"last_status,omitempty"`
	LastError    string    `json:"last_error,omitempty"`
	RunCount     int       `json:"run_count"`
	SuccessCount int       `json:"success_count"`
	FailCount    int       `json:"fail_count"`
	// Advanced options
	TimeoutMins     int  `json:"timeout_mins,omitempty"`    // Job timeout in minutes (0 = no timeout)
	RetryCount      int  `json:"retry_count,omitempty"`     // Number of retries on failure
	RetryDelayMin   int  `json:"retry_delay_min,omitempty"` // Delay between retries in minutes
	NotifyOnFail    bool `json:"notify_on_fail"`            // Send notification on failure
	NotifyOnSuccess bool `json:"notify_on_success"`         // Send notification on success
}

// Scheduler manages scheduled jobs
type Scheduler struct {
	mu       sync.RWMutex
	jobs     map[string]*ScheduledJob
	cron     *cron.Cron
	entryIDs map[string]cron.EntryID
	filePath string
}

var scheduler *Scheduler

// InitScheduler initializes the scheduler
func InitScheduler() error {
	dataDir := getDataDir()
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	scheduler = &Scheduler{
		jobs:     make(map[string]*ScheduledJob),
		cron:     cron.New(cron.WithSeconds()),
		entryIDs: make(map[string]cron.EntryID),
		filePath: filepath.Join(dataDir, "scheduled_jobs.json"),
	}

	if err := scheduler.load(); err != nil {
		return err
	}

	// Start the cron scheduler
	scheduler.cron.Start()

	// Re-schedule all enabled jobs
	for _, job := range scheduler.jobs {
		if job.Enabled {
			scheduler.scheduleJob(job)
		}
	}

	return nil
}

func (s *Scheduler) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}

	var jobs []*ScheduledJob
	if err := json.Unmarshal(data, &jobs); err != nil {
		return err
	}

	for _, job := range jobs {
		s.jobs[job.ID] = job
	}
	return nil
}

func (s *Scheduler) save() error {
	var jobs []*ScheduledJob
	for _, job := range s.jobs {
		jobs = append(jobs, job)
	}

	data, err := json.MarshalIndent(jobs, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *Scheduler) scheduleJob(job *ScheduledJob) error {
	// Remove existing schedule if any
	if entryID, exists := s.entryIDs[job.ID]; exists {
		s.cron.Remove(entryID)
		delete(s.entryIDs, job.ID)
	}

	if !job.Enabled {
		return nil
	}

	entryID, err := s.cron.AddFunc(job.CronExpr, func() {
		s.executeJob(job.ID)
	})
	if err != nil {
		return err
	}

	s.entryIDs[job.ID] = entryID

	// Update next run time
	entry := s.cron.Entry(entryID)
	job.NextRun = entry.Next

	return nil
}

func (s *Scheduler) executeJob(jobID string) {
	s.executeJobWithRetry(jobID, 0)
}

func (s *Scheduler) executeJobWithRetry(jobID string, attempt int) {
	s.mu.RLock()
	job, exists := s.jobs[jobID]
	s.mu.RUnlock()

	if !exists || !job.Enabled {
		return
	}

	log.Printf("[Scheduler] Executing job: %s (%s) - attempt %d", job.Name, jobID, attempt+1)

	// Load machines
	machines, err := LoadMachines()
	if err != nil {
		log.Printf("[Scheduler] Failed to load machines for job %s: %v", jobID, err)
		s.updateJobStatusWithError(jobID, "error", fmt.Sprintf("Failed to load machines: %v", err))
		return
	}

	// Filter to selected machines
	var targetMachines []*Machine
	machineSet := make(map[string]bool)
	for _, id := range job.MachineIDs {
		machineSet[id] = true
	}

	for i := range machines {
		if machineSet[machines[i].ID] {
			targetMachines = append(targetMachines, &machines[i])
		}
	}

	if len(targetMachines) == 0 {
		log.Printf("[Scheduler] No valid machines found for job %s (requested: %v)", jobID, job.MachineIDs)
		s.updateJobStatusWithError(jobID, "error", "No valid machines found")
		return
	}

	log.Printf("[Scheduler] Running job %s on %d machines", job.Name, len(targetMachines))

	// Setup timeout if configured
	timeout := time.Duration(job.TimeoutMins) * time.Minute
	if timeout == 0 {
		timeout = 30 * time.Minute // Default 30 min timeout
	}

	// Create context with timeout
	type machineResult struct {
		machine *Machine
		result  ExecutionResult
	}
	resultsChan := make(chan machineResult, len(targetMachines))

	// Execute on all target machines
	var wg sync.WaitGroup
	for _, m := range targetMachines {
		wg.Add(1)
		go func(machine *Machine) {
			defer wg.Done()

			// Decrypt password
			password := GetDecryptedPassword(machine)
			machineWithPassword := *machine
			machineWithPassword.Password = password

			// Execute with timeout
			done := make(chan ExecutionResult, 1)
			go func() {
				done <- runScriptOnMachine(&machineWithPassword, job.ScriptPath, job.Args)
			}()

			var result ExecutionResult
			select {
			case result = <-done:
				// Completed normally
			case <-time.After(timeout):
				result = ExecutionResult{
					MachineID:   machine.ID,
					MachineName: machine.Name,
					ScriptPath:  job.ScriptPath,
					StartedAt:   time.Now().Add(-timeout),
					FinishedAt:  time.Now(),
					Success:     false,
					Error:       fmt.Sprintf("Job timed out after %d minutes", job.TimeoutMins),
				}
			}

			// Record in history
			RecordExecution(result, job.ScriptPath, job.Args, job.Name)
			resultsChan <- machineResult{machine: machine, result: result}
		}(m)
	}

	// Wait for all to complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	successCount := 0
	failCount := 0
	var lastError string
	for mr := range resultsChan {
		if mr.result.Success {
			successCount++
			log.Printf("[Scheduler] Job %s succeeded on machine %s", job.Name, mr.machine.Name)
		} else {
			failCount++
			lastError = mr.result.Error
			log.Printf("[Scheduler] Job %s failed on machine %s: %s", job.Name, mr.machine.Name, mr.result.Error)
		}
	}

	status := fmt.Sprintf("%d/%d succeeded", successCount, len(targetMachines))
	if failCount > 0 {
		status = fmt.Sprintf("%d succeeded, %d failed", successCount, failCount)
	}

	// Check if we should retry
	if failCount > 0 && attempt < job.RetryCount {
		retryDelay := time.Duration(job.RetryDelayMin) * time.Minute
		if retryDelay == 0 {
			retryDelay = 1 * time.Minute // Default 1 min delay
		}
		log.Printf("[Scheduler] Job %s failed, retrying in %v (attempt %d/%d)", job.Name, retryDelay, attempt+1, job.RetryCount)
		time.AfterFunc(retryDelay, func() {
			s.executeJobWithRetry(jobID, attempt+1)
		})
		s.updateJobStatusWithError(jobID, status+" (retrying)", lastError)
		return
	}

	// Send notifications
	if failCount > 0 && job.NotifyOnFail {
		notificationStore.Add(Notification{
			Type:    "failure",
			Title:   fmt.Sprintf("❌ Scheduled job failed: %s", job.Name),
			Message: fmt.Sprintf("Status: %s\nError: %s", status, lastError),
		})
	} else if failCount == 0 && job.NotifyOnSuccess {
		notificationStore.Add(Notification{
			Type:    "success",
			Title:   fmt.Sprintf("✅ Scheduled job completed: %s", job.Name),
			Message: fmt.Sprintf("Status: %s", status),
		})
	}

	s.updateJobStatusWithError(jobID, status, lastError)
}

func (s *Scheduler) updateJobStatusWithError(jobID, status, errorMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if job, exists := s.jobs[jobID]; exists {
		job.LastRun = time.Now()
		job.LastStatus = status
		job.LastError = errorMsg
		job.RunCount++

		// Update success/fail counts
		if errorMsg == "" {
			job.SuccessCount++
		} else {
			job.FailCount++
		}

		// Update next run time
		if entryID, exists := s.entryIDs[jobID]; exists {
			entry := s.cron.Entry(entryID)
			job.NextRun = entry.Next
		}

		s.save()
	}
}

func (s *Scheduler) updateJobStatus(jobID, status, errorMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if job, exists := s.jobs[jobID]; exists {
		job.LastRun = time.Now()
		job.LastStatus = status
		job.RunCount++

		// Update next run time
		if entryID, exists := s.entryIDs[jobID]; exists {
			entry := s.cron.Entry(entryID)
			job.NextRun = entry.Next
		}

		s.save()
	}
}

// AddJob adds a new scheduled job
func (s *Scheduler) AddJob(job *ScheduledJob) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if job.ID == "" {
		job.ID = fmt.Sprintf("job-%d", time.Now().UnixNano())
	}
	job.CreatedAt = time.Now()

	// Validate cron expression
	parser := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(job.CronExpr)
	if err != nil {
		return fmt.Errorf("invalid cron expression: %v", err)
	}

	s.jobs[job.ID] = job

	if job.Enabled {
		if err := s.scheduleJob(job); err != nil {
			return err
		}
	}

	return s.save()
}

// UpdateJob updates an existing job
func (s *Scheduler) UpdateJob(job *ScheduledJob) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.jobs[job.ID]; !exists {
		return fmt.Errorf("job not found")
	}

	s.jobs[job.ID] = job

	if err := s.scheduleJob(job); err != nil {
		return err
	}

	return s.save()
}

// DeleteJob removes a scheduled job
func (s *Scheduler) DeleteJob(jobID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if entryID, exists := s.entryIDs[jobID]; exists {
		s.cron.Remove(entryID)
		delete(s.entryIDs, jobID)
	}

	delete(s.jobs, jobID)
	return s.save()
}

// GetJobs returns all scheduled jobs
func (s *Scheduler) GetJobs() []*ScheduledJob {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var jobs []*ScheduledJob
	for _, job := range s.jobs {
		jobs = append(jobs, job)
	}
	return jobs
}

// GetJob returns a specific job
func (s *Scheduler) GetJob(jobID string) *ScheduledJob {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.jobs[jobID]
}

// SchedulerRoutes sets up scheduler API routes
func SchedulerRoutes(r *mux.Router) {
	// List all scheduled jobs
	r.HandleFunc("/api/scheduler/jobs", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(scheduler.GetJobs())
	}).Methods("GET")

	// Create a new scheduled job
	r.HandleFunc("/api/scheduler/jobs", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var job ScheduledJob
		if err := json.NewDecoder(req.Body).Decode(&job); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := scheduler.AddJob(&job); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		json.NewEncoder(w).Encode(job)
	}).Methods("POST")

	// Update a scheduled job
	r.HandleFunc("/api/scheduler/jobs/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)

		var job ScheduledJob
		if err := json.NewDecoder(req.Body).Decode(&job); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		job.ID = vars["id"]
		if err := scheduler.UpdateJob(&job); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		json.NewEncoder(w).Encode(job)
	}).Methods("PUT")

	// Delete a scheduled job
	r.HandleFunc("/api/scheduler/jobs/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)

		if err := scheduler.DeleteJob(vars["id"]); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("DELETE")

	// Toggle job enabled/disabled
	r.HandleFunc("/api/scheduler/jobs/{id}/toggle", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)

		job := scheduler.GetJob(vars["id"])
		if job == nil {
			http.Error(w, "Job not found", http.StatusNotFound)
			return
		}

		job.Enabled = !job.Enabled
		if err := scheduler.UpdateJob(job); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(job)
	}).Methods("POST")

	// Run a job immediately
	r.HandleFunc("/api/scheduler/jobs/{id}/run", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)

		job := scheduler.GetJob(vars["id"])
		if job == nil {
			http.Error(w, "Job not found", http.StatusNotFound)
			return
		}

		go scheduler.executeJob(job.ID)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Job execution started",
		})
	}).Methods("POST")
}

// StopScheduler stops the scheduler
func StopScheduler() {
	if scheduler != nil && scheduler.cron != nil {
		scheduler.cron.Stop()
	}
}
