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

// TaskType represents the type of Porter task
type TaskType string

const (
	TaskUpload       TaskType = "upload"
	TaskCopy         TaskType = "copy"
	TaskMove         TaskType = "move"
	TaskWrite        TaskType = "write"
	TaskMkdir        TaskType = "mkdir"
	TaskRm           TaskType = "rm"
	TaskChmod        TaskType = "chmod"
	TaskChown        TaskType = "chown"
	TaskSymlink      TaskType = "symlink"
	TaskTemplate     TaskType = "template"
	TaskRun          TaskType = "run"
	TaskCapture      TaskType = "capture"
	TaskSvcStart     TaskType = "svc_start"
	TaskSvcStop      TaskType = "svc_stop"
	TaskSvcRestart   TaskType = "svc_restart"
	TaskSvcEnable    TaskType = "svc_enable"
	TaskDaemonReload TaskType = "daemon_reload"
	TaskDockerStart  TaskType = "docker_start"
	TaskDockerStop   TaskType = "docker_stop"
	TaskDockerPull   TaskType = "docker_pull"
	TaskComposeUp    TaskType = "compose_up"
	TaskComposeDown  TaskType = "compose_down"
	TaskComposePull  TaskType = "compose_pull"
	TaskWaitPort     TaskType = "wait_port"
	TaskWaitHTTP     TaskType = "wait_http"
	TaskScript       TaskType = "script"
)

// TaskDefinition represents a single task in a manifest
type TaskDefinition struct {
	ID          string            `json:"id"`
	Type        TaskType          `json:"type"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Params      map[string]string `json:"params"`
	Options     TaskOptions       `json:"options,omitempty"`
}

// TaskOptions represents optional task configuration
type TaskOptions struct {
	Sudo     bool   `json:"sudo,omitempty"`
	User     bool   `json:"user,omitempty"`
	Retry    int    `json:"retry,omitempty"`
	Ignore   bool   `json:"ignore,omitempty"`
	Creates  string `json:"creates,omitempty"`
	When     string `json:"when,omitempty"`
	Register string `json:"register,omitempty"`
	Timeout  string `json:"timeout,omitempty"`
}

// Manifest represents a deployment manifest
type Manifest struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Variables   map[string]string `json:"variables,omitempty"`
	Tasks       []TaskDefinition  `json:"tasks"`
	CreatedAt   time.Time         `json:"created_at"`
}

// ManifestExecution represents an execution of a manifest
type ManifestExecution struct {
	ID           string                   `json:"id"`
	ManifestID   string                   `json:"manifest_id"`
	ManifestName string                   `json:"manifest_name"`
	MachineIDs   []string                 `json:"machine_ids"`
	Variables    map[string]string        `json:"variables"`
	Status       string                   `json:"status"` // pending, running, completed, failed
	StartedAt    time.Time                `json:"started_at"`
	FinishedAt   *time.Time               `json:"finished_at,omitempty"`
	Results      []MachineExecutionResult `json:"results,omitempty"`
}

// MachineExecutionResult represents execution result for a single machine
type MachineExecutionResult struct {
	MachineID   string       `json:"machine_id"`
	MachineName string       `json:"machine_name"`
	MachineIP   string       `json:"machine_ip"`
	Status      string       `json:"status"` // running, success, failed
	TaskResults []TaskResult `json:"task_results"`
	Error       string       `json:"error,omitempty"`
	StartedAt   time.Time    `json:"started_at"`
	FinishedAt  *time.Time   `json:"finished_at,omitempty"`
}

// TaskResult represents the result of a single task execution
type TaskResult struct {
	TaskID     string     `json:"task_id"`
	TaskName   string     `json:"task_name"`
	Status     string     `json:"status"` // pending, running, ok, changed, failed, skipped
	Output     string     `json:"output,omitempty"`
	Error      string     `json:"error,omitempty"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}

var (
	manifests       = make(map[string]*Manifest)
	manifestsMu     sync.RWMutex
	manifestExecs   = make(map[string]*ManifestExecution)
	manifestExecsMu sync.RWMutex
)

// buildPorterTask converts a TaskDefinition to a Porter TaskBuilder
func buildPorterTask(td TaskDefinition) porter.TaskBuilder {
	var task porter.TaskBuilder

	switch td.Type {
	case TaskUpload:
		task = porter.Upload(td.Params["src"], td.Params["dest"])
	case TaskCopy:
		task = porter.Copy(td.Params["src"], td.Params["dest"])
	case TaskMove:
		task = porter.Move(td.Params["src"], td.Params["dest"])
	case TaskWrite:
		task = porter.Write(td.Params["dest"], td.Params["content"])
	case TaskMkdir:
		task = porter.Mkdir(td.Params["path"])
	case TaskRm:
		task = porter.Rm(td.Params["path"])
	case TaskChmod:
		t := porter.Chmod(td.Params["path"])
		if mode := td.Params["mode"]; mode != "" {
			t = t.Mode(mode)
		}
		task = t
	case TaskChown:
		t := porter.Chown(td.Params["path"])
		if owner := td.Params["owner"]; owner != "" {
			t = t.Owner(owner)
		}
		task = t
	case TaskSymlink:
		task = porter.Symlink(td.Params["src"], td.Params["dest"])
	case TaskTemplate:
		task = porter.Template(td.Params["dest"], td.Params["content"])
	case TaskRun:
		t := porter.Run(td.Params["command"])
		if td.Options.Sudo {
			t = t.Sudo()
		}
		task = t
	case TaskCapture:
		t := porter.Capture(td.Params["command"])
		if td.Options.Register != "" {
			t = t.Register(td.Options.Register)
		}
		task = t
	case TaskSvcStart:
		t := porter.Svc(td.Params["name"]).Start()
		if td.Options.User {
			t = t.User()
		}
		task = t
	case TaskSvcStop:
		t := porter.Svc(td.Params["name"]).Stop()
		if td.Options.User {
			t = t.User()
		}
		task = t
	case TaskSvcRestart:
		t := porter.Svc(td.Params["name"]).Restart()
		if td.Options.User {
			t = t.User()
		}
		task = t
	case TaskSvcEnable:
		t := porter.Svc(td.Params["name"]).Enable()
		if td.Options.User {
			t = t.User()
		}
		task = t
	case TaskDaemonReload:
		t := porter.DaemonReload()
		if td.Options.User {
			t = t.User()
		}
		task = t
	case TaskDockerStart:
		task = porter.Docker(td.Params["name"]).Start()
	case TaskDockerStop:
		task = porter.Docker(td.Params["name"]).Stop()
	case TaskDockerPull:
		task = porter.DockerPull(td.Params["image"])
	case TaskComposeUp:
		task = porter.Compose(td.Params["path"]).Up()
	case TaskComposeDown:
		task = porter.Compose(td.Params["path"]).Down()
	case TaskComposePull:
		task = porter.Compose(td.Params["path"]).Pull()
	case TaskWaitPort:
		t := porter.WaitForPort(td.Params["host"], td.Params["port"])
		if td.Options.Timeout != "" {
			t = t.Timeout(td.Options.Timeout)
		}
		task = t
	case TaskWaitHTTP:
		t := porter.WaitForHttp(td.Params["url"])
		if td.Options.Timeout != "" {
			t = t.Timeout(td.Options.Timeout)
		}
		task = t
	case TaskScript:
		t := porter.Run(fmt.Sprintf("bash %s", td.Params["path"]))
		if td.Options.Sudo {
			t = t.Sudo()
		}
		task = t
	default:
		task = porter.Run(fmt.Sprintf("echo 'Unknown task type: %s'", td.Type))
	}

	// Apply common options
	if td.Options.Retry > 0 {
		task = task.Retry(td.Options.Retry)
	}
	if td.Options.Ignore {
		task = task.Ignore()
	}
	if td.Options.Creates != "" {
		task = task.Creates(td.Options.Creates)
	}

	return task
}

// executeManifestOnMachine executes a manifest on a single machine
func executeManifestOnMachine(exec *ManifestExecution, manifest *Manifest, machine *Machine, resultIdx int) {
	result := &exec.Results[resultIdx]
	result.Status = "running"
	result.StartedAt = time.Now()

	// Connect to machine
	client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("Connection failed: %v", err)
		now := time.Now()
		result.FinishedAt = &now
		return
	}
	defer client.Close()

	// Build tasks
	var taskBuilders []porter.TaskBuilder
	for _, td := range manifest.Tasks {
		taskBuilders = append(taskBuilders, buildPorterTask(td))
	}
	tasks := porter.Tasks(taskBuilders...)

	// Set up variables
	vars := porter.NewVars()
	for k, v := range manifest.Variables {
		vars.Set(k, v)
	}
	for k, v := range exec.Variables {
		vars.Set(k, v)
	}

	// Execute
	executor := porter.NewExecutor(client, machine.Password)
	stats, err := executor.Run(manifest.Name, tasks, vars)

	now := time.Now()
	result.FinishedAt = &now

	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("Execution failed: %v", err)
	} else if stats.Failed > 0 {
		result.Status = "failed"
		result.Error = fmt.Sprintf("%d tasks failed", stats.Failed)
	} else {
		result.Status = "success"
	}

	// Update task results
	for i, td := range manifest.Tasks {
		if i < len(result.TaskResults) {
			result.TaskResults[i].Status = "ok"
			result.TaskResults[i].FinishedAt = &now
		} else {
			result.TaskResults = append(result.TaskResults, TaskResult{
				TaskID:     td.ID,
				TaskName:   td.Name,
				Status:     "ok",
				StartedAt:  result.StartedAt,
				FinishedAt: &now,
			})
		}
	}
}

// ManifestRoutes sets up manifest-related API routes
func ManifestRoutes(r *mux.Router) {
	// List all task types
	r.HandleFunc("/api/task-types", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		taskTypes := []map[string]interface{}{
			{"type": "upload", "name": "Upload File", "category": "file", "params": []string{"src", "dest"}},
			{"type": "copy", "name": "Copy File", "category": "file", "params": []string{"src", "dest"}},
			{"type": "move", "name": "Move File", "category": "file", "params": []string{"src", "dest"}},
			{"type": "write", "name": "Write Content", "category": "file", "params": []string{"dest", "content"}},
			{"type": "mkdir", "name": "Create Directory", "category": "file", "params": []string{"path"}},
			{"type": "rm", "name": "Remove File/Dir", "category": "file", "params": []string{"path"}},
			{"type": "chmod", "name": "Change Permissions", "category": "file", "params": []string{"path", "mode"}},
			{"type": "chown", "name": "Change Owner", "category": "file", "params": []string{"path", "owner"}},
			{"type": "symlink", "name": "Create Symlink", "category": "file", "params": []string{"src", "dest"}},
			{"type": "template", "name": "Write Template", "category": "file", "params": []string{"dest", "content"}},
			{"type": "run", "name": "Run Command", "category": "command", "params": []string{"command"}},
			{"type": "capture", "name": "Capture Output", "category": "command", "params": []string{"command"}},
			{"type": "script", "name": "Run Script", "category": "command", "params": []string{"path"}},
			{"type": "svc_start", "name": "Start Service", "category": "service", "params": []string{"name"}},
			{"type": "svc_stop", "name": "Stop Service", "category": "service", "params": []string{"name"}},
			{"type": "svc_restart", "name": "Restart Service", "category": "service", "params": []string{"name"}},
			{"type": "svc_enable", "name": "Enable Service", "category": "service", "params": []string{"name"}},
			{"type": "daemon_reload", "name": "Daemon Reload", "category": "service", "params": []string{}},
			{"type": "docker_start", "name": "Start Container", "category": "docker", "params": []string{"name"}},
			{"type": "docker_stop", "name": "Stop Container", "category": "docker", "params": []string{"name"}},
			{"type": "docker_pull", "name": "Pull Image", "category": "docker", "params": []string{"image"}},
			{"type": "compose_up", "name": "Compose Up", "category": "docker", "params": []string{"path"}},
			{"type": "compose_down", "name": "Compose Down", "category": "docker", "params": []string{"path"}},
			{"type": "compose_pull", "name": "Compose Pull", "category": "docker", "params": []string{"path"}},
			{"type": "wait_port", "name": "Wait for Port", "category": "health", "params": []string{"host", "port"}},
			{"type": "wait_http", "name": "Wait for HTTP", "category": "health", "params": []string{"url"}},
		}
		json.NewEncoder(w).Encode(taskTypes)
	}).Methods("GET")

	// CRUD for manifests
	r.HandleFunc("/api/manifests", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		manifestsMu.RLock()
		defer manifestsMu.RUnlock()

		list := make([]*Manifest, 0, len(manifests))
		for _, m := range manifests {
			list = append(list, m)
		}
		json.NewEncoder(w).Encode(list)
	}).Methods("GET")

	r.HandleFunc("/api/manifests", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var manifest Manifest
		if err := json.NewDecoder(req.Body).Decode(&manifest); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		manifest.ID = fmt.Sprintf("manifest-%d", time.Now().UnixNano())
		manifest.CreatedAt = time.Now()

		manifestsMu.Lock()
		manifests[manifest.ID] = &manifest
		manifestsMu.Unlock()

		json.NewEncoder(w).Encode(manifest)
	}).Methods("POST")

	r.HandleFunc("/api/manifests/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id := mux.Vars(req)["id"]

		manifestsMu.RLock()
		manifest, exists := manifests[id]
		manifestsMu.RUnlock()

		if !exists {
			http.Error(w, "Manifest not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(manifest)
	}).Methods("GET")

	r.HandleFunc("/api/manifests/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		manifestsMu.Lock()
		delete(manifests, id)
		manifestsMu.Unlock()

		w.WriteHeader(http.StatusOK)
	}).Methods("DELETE")

	// Execute manifest
	r.HandleFunc("/api/manifests/{id}/execute", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id := mux.Vars(req)["id"]

		manifestsMu.RLock()
		manifest, exists := manifests[id]
		manifestsMu.RUnlock()

		if !exists {
			http.Error(w, "Manifest not found", http.StatusNotFound)
			return
		}

		var execReq struct {
			MachineIDs []string          `json:"machine_ids"`
			Variables  map[string]string `json:"variables"`
		}
		if err := json.NewDecoder(req.Body).Decode(&execReq); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Create execution
		exec := &ManifestExecution{
			ID:           fmt.Sprintf("exec-%d", time.Now().UnixNano()),
			ManifestID:   manifest.ID,
			ManifestName: manifest.Name,
			MachineIDs:   execReq.MachineIDs,
			Variables:    execReq.Variables,
			Status:       "running",
			StartedAt:    time.Now(),
			Results:      make([]MachineExecutionResult, len(execReq.MachineIDs)),
		}

		// Initialize results
		for i, machineID := range execReq.MachineIDs {
			machine, exists := machineRepo.Get(machineID)

			if exists {
				exec.Results[i] = MachineExecutionResult{
					MachineID:   machineID,
					MachineName: machine.Name,
					MachineIP:   machine.IP,
					Status:      "pending",
					TaskResults: make([]TaskResult, len(manifest.Tasks)),
				}
				for j, td := range manifest.Tasks {
					exec.Results[i].TaskResults[j] = TaskResult{
						TaskID:   td.ID,
						TaskName: td.Name,
						Status:   "pending",
					}
				}
			}
		}

		manifestExecsMu.Lock()
		manifestExecs[exec.ID] = exec
		manifestExecsMu.Unlock()

		// Execute in parallel
		var wg sync.WaitGroup
		for i, machineID := range execReq.MachineIDs {
			machine, exists := machineRepo.Get(machineID)

			if !exists {
				continue
			}

			wg.Add(1)
			go func(idx int, m *Machine) {
				defer wg.Done()
				executeManifestOnMachine(exec, manifest, m, idx)
			}(i, machine)
		}

		// Wait for completion in background
		go func() {
			wg.Wait()
			now := time.Now()
			exec.FinishedAt = &now

			// Determine overall status
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
				exec.Status = "failed"
			}
		}()

		json.NewEncoder(w).Encode(exec)
	}).Methods("POST")

	// Get execution status
	r.HandleFunc("/api/executions/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id := mux.Vars(req)["id"]

		manifestExecsMu.RLock()
		exec, exists := manifestExecs[id]
		manifestExecsMu.RUnlock()

		if !exists {
			http.Error(w, "Execution not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(exec)
	}).Methods("GET")

	// List all executions
	r.HandleFunc("/api/manifest-executions", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		manifestExecsMu.RLock()
		defer manifestExecsMu.RUnlock()

		list := make([]*ManifestExecution, 0, len(manifestExecs))
		for _, e := range manifestExecs {
			list = append(list, e)
		}
		json.NewEncoder(w).Encode(list)
	}).Methods("GET")
}
