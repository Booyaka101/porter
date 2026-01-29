package porterui

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/ssh"
)

// StreamEvent represents a real-time execution event
type StreamEvent struct {
	Type      string    `json:"type"` // output, status, error, complete
	MachineID string    `json:"machine_id"`
	Machine   string    `json:"machine"`
	Data      string    `json:"data"`
	Timestamp time.Time `json:"timestamp"`
}

// ExecutionStream manages real-time output streaming
type ExecutionStream struct {
	mu        sync.RWMutex
	listeners map[string][]chan StreamEvent
}

var execStream = &ExecutionStream{
	listeners: make(map[string][]chan StreamEvent),
}

// Subscribe creates a new listener for an execution
func (e *ExecutionStream) Subscribe(execID string) chan StreamEvent {
	e.mu.Lock()
	defer e.mu.Unlock()

	ch := make(chan StreamEvent, 100)
	e.listeners[execID] = append(e.listeners[execID], ch)
	return ch
}

// Unsubscribe removes a listener
func (e *ExecutionStream) Unsubscribe(execID string, ch chan StreamEvent) {
	e.mu.Lock()
	defer e.mu.Unlock()

	listeners := e.listeners[execID]
	for i, listener := range listeners {
		if listener == ch {
			e.listeners[execID] = append(listeners[:i], listeners[i+1:]...)
			close(ch)
			break
		}
	}

	if len(e.listeners[execID]) == 0 {
		delete(e.listeners, execID)
	}
}

// Broadcast sends an event to all listeners for an execution
func (e *ExecutionStream) Broadcast(execID string, event StreamEvent) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	for _, ch := range e.listeners[execID] {
		select {
		case ch <- event:
		default:
			// Channel full, skip
		}
	}
}

// broadcastStatus sends a status event to stream listeners
func broadcastStatus(execID, machineID, machineName, data string) {
	execStream.Broadcast(execID, StreamEvent{
		Type:      "status",
		MachineID: machineID,
		Machine:   machineName,
		Data:      data,
		Timestamp: time.Now(),
	})
}

// broadcastError sends an error event to stream listeners
func broadcastError(execID, machineID, machineName, data string) {
	execStream.Broadcast(execID, StreamEvent{
		Type:      "error",
		MachineID: machineID,
		Machine:   machineName,
		Data:      data,
		Timestamp: time.Now(),
	})
}

// RunScriptWithStreaming executes a script with real-time output streaming using Porter manifests
// useSudo: if true, runs script with sudo (for admin users); if false, runs as regular user (for operators)
func RunScriptWithStreaming(m *Machine, scriptPath, args, execID string, useSudo bool) ExecutionResult {
	result := ExecutionResult{
		MachineID:   m.ID,
		MachineName: m.Name,
		ScriptPath:  scriptPath,
		StartedAt:   time.Now(),
	}

	broadcastStatus(execID, m.ID, m.Name, "Connecting...")

	scriptName := filepath.Base(scriptPath)
	scriptDir := filepath.Dir(scriptPath)

	// Extract embedded scripts
	localTempDir, err := ExtractEmbeddedScripts(scriptDir)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to extract scripts: %v", err)
		result.FinishedAt = time.Now()
		broadcastError(execID, m.ID, m.Name, result.Error)
		return result
	}
	defer os.RemoveAll(localTempDir)

	// Also extract lib directory if it exists (for common.sh etc)
	libSourceDir := filepath.Join(filepath.Dir(scriptDir), "lib")
	libTempDir, libErr := ExtractEmbeddedScripts(libSourceDir)
	if libErr == nil {
		defer os.RemoveAll(libTempDir)
	}

	// Build deployment config (reuse from machines.go)
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

	broadcastStatus(execID, m.ID, m.Name, fmt.Sprintf("Connecting to %s...", m.IP))

	// Connect using Porter
	client, err := porter.Connect(m.IP, porter.DefaultConfig(m.Username, m.Password))
	if err != nil {
		result.Error = fmt.Sprintf("Failed to connect: %v", err)
		result.FinishedAt = time.Now()
		broadcastError(execID, m.ID, m.Name, result.Error)
		return result
	}
	defer client.Close()

	broadcastStatus(execID, m.ID, m.Name, "Connected. Uploading files...")

	executor := porter.NewExecutor(client, m.Password)
	vars := porter.NewVars()

	// Execute setup manifest
	executor.Run("Setup Directories", BuildSetupManifest(cfg), vars)

	// Execute upload manifest
	uploadTasks := BuildUploadManifest(cfg)
	if len(uploadTasks) > 0 {
		executor.Run("Upload Files", uploadTasks, vars)
	}

	broadcastStatus(execID, m.ID, m.Name, "Files uploaded. Executing script...")

	// Execute script with real-time streaming using direct SSH session
	remotePath := fmt.Sprintf("%s/%s", cfg.RemoteScriptDir, cfg.ScriptName)

	// Make script executable first
	executor.Run("Prepare Script", porter.Tasks(
		porter.Chmod(remotePath).Mode("755").Name("Make script executable"),
		porter.Run(fmt.Sprintf("chmod 755 %s/lib/*.sh 2>/dev/null || true", cfg.RemoteBase)).
			Name("Make lib scripts executable").
			Ignore(),
	), vars)

	// Now execute with real-time streaming
	var scriptCmd string
	if useSudo {
		// Admin users run as root with sudo
		scriptCmd = fmt.Sprintf("cd ~ && echo '%s' | sudo -S bash %s %s 2>&1; echo \"EXIT_CODE:$?\"", cfg.Password, remotePath, cfg.Args)
	} else {
		// Operator users run as regular user (no sudo)
		scriptCmd = fmt.Sprintf("cd ~ && bash %s %s 2>&1; echo \"EXIT_CODE:$?\"", remotePath, cfg.Args)
	}

	output, err := executeWithStreamingSSH(m, scriptCmd, execID)

	result.Output = output
	result.FinishedAt = time.Now()

	// Check exit code from output
	if strings.Contains(output, "EXIT_CODE:0") {
		result.Success = true
	}

	if err != nil {
		result.Error = fmt.Sprintf("Script error: %v", err)
		result.Success = false
	} else if !result.Success {
		result.Error = "Script returned non-zero exit code"
	}

	// Cleanup remote temp files
	executor.Run("Cleanup", porter.Tasks(
		porter.Rm(cfg.RemoteBase).Name("Cleanup temp files"),
	), vars)

	// Send complete event
	execStream.Broadcast(execID, StreamEvent{
		Type:      "complete",
		MachineID: m.ID,
		Machine:   m.Name,
		Data:      fmt.Sprintf("Completed: %v", result.Success),
		Timestamp: time.Now(),
	})

	return result
}

// executeWithStreamingSSH runs a command and streams output in real-time using direct SSH
func executeWithStreamingSSH(m *Machine, cmd, execID string) (string, error) {
	// Create SSH config with extended timeout for long-running operations
	sshConfig := &ssh.ClientConfig{
		User: m.Username,
		Auth: []ssh.AuthMethod{
			ssh.Password(m.Password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Minute,
	}

	// Connect
	sshClient, err := ssh.Dial("tcp", fmt.Sprintf("%s:22", m.IP), sshConfig)
	if err != nil {
		return "", fmt.Errorf("failed to connect: %w", err)
	}
	defer sshClient.Close()

	// Start keepalive goroutine to prevent connection timeout during long operations
	done := make(chan struct{})
	defer close(done)
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				// Send keepalive request
				_, _, _ = sshClient.SendRequest("keepalive@openssh.com", true, nil)
			}
		}
	}()

	session, err := sshClient.NewSession()
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	// Get stdout and stderr pipes
	stdout, err := session.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("failed to get stdout pipe: %w", err)
	}
	stderr, err := session.StderrPipe()
	if err != nil {
		return "", fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	// Start the command
	if err := session.Start(cmd); err != nil {
		return "", fmt.Errorf("failed to start command: %w", err)
	}

	// Collect output while streaming
	var outputBuilder strings.Builder
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Stream stdout
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			mu.Lock()
			outputBuilder.WriteString(line + "\n")
			mu.Unlock()
			execStream.Broadcast(execID, StreamEvent{
				Type:      "output",
				MachineID: m.ID,
				Machine:   m.Name,
				Data:      line,
				Timestamp: time.Now(),
			})
		}
	}()

	// Stream stderr
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			mu.Lock()
			outputBuilder.WriteString(line + "\n")
			mu.Unlock()
			execStream.Broadcast(execID, StreamEvent{
				Type:      "output",
				MachineID: m.ID,
				Machine:   m.Name,
				Data:      line,
				Timestamp: time.Now(),
			})
		}
	}()

	// Wait for output streaming to complete
	wg.Wait()

	// Wait for command to finish
	err = session.Wait()

	return outputBuilder.String(), err
}

// StreamingRoutes sets up SSE streaming routes
func StreamingRoutes(r *mux.Router) {
	// SSE endpoint for execution streaming
	r.HandleFunc("/api/stream/{execId}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		execID := vars["execId"]

		// Set SSE headers
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "SSE not supported", http.StatusInternalServerError)
			return
		}

		// Subscribe to events
		ch := execStream.Subscribe(execID)
		defer execStream.Unsubscribe(execID, ch)

		// Send initial connection event
		fmt.Fprintf(w, "event: connected\ndata: {\"execId\": \"%s\"}\n\n", execID)
		flusher.Flush()

		// Stream events
		for {
			select {
			case event, ok := <-ch:
				if !ok {
					return
				}
				data, _ := json.Marshal(event)
				fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
				flusher.Flush()

				if event.Type == "complete" {
					return
				}

			case <-req.Context().Done():
				return

			case <-time.After(30 * time.Second):
				// Send keepalive
				fmt.Fprintf(w, ": keepalive\n\n")
				flusher.Flush()
			}
		}
	}).Methods("GET")
}
