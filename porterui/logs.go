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

// LogStreamSession represents an active log streaming session
type LogStreamSession struct {
	ID        string    `json:"id"`
	MachineID string    `json:"machine_id"`
	Type      string    `json:"type"`   // "journalctl", "tail", "docker", "compose"
	Target    string    `json:"target"` // unit name, file path, or container name
	StartedAt time.Time `json:"started_at"`
	stream    *porter.LogStream
}

// LogStreamManager manages active log streaming sessions
type LogStreamManager struct {
	sessions map[string]*LogStreamSession
	mu       sync.RWMutex
}

var logStreamManager = &LogStreamManager{
	sessions: make(map[string]*LogStreamSession),
}

// StartSession starts a new log streaming session
func (m *LogStreamManager) StartSession(session *LogStreamSession) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[session.ID] = session
}

// GetSession retrieves a session by ID
func (m *LogStreamManager) GetSession(id string) (*LogStreamSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[id]
	return s, ok
}

// StopSession stops and removes a session
func (m *LogStreamManager) StopSession(id string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if session, ok := m.sessions[id]; ok {
		if session.stream != nil {
			session.stream.Stop()
		}
		delete(m.sessions, id)
		return true
	}
	return false
}

// ListSessions returns all active sessions
func (m *LogStreamManager) ListSessions() []*LogStreamSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	list := make([]*LogStreamSession, 0, len(m.sessions))
	for _, s := range m.sessions {
		list = append(list, s)
	}
	return list
}

// StopByMachineID stops all sessions for a given machine
func (m *LogStreamManager) StopByMachineID(machineID string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	count := 0
	for id, session := range m.sessions {
		if session.MachineID == machineID {
			if session.stream != nil {
				session.stream.Stop()
			}
			delete(m.sessions, id)
			count++
		}
	}
	return count
}

// LogsRoutes sets up log streaming API routes
func LogsRoutes(r *mux.Router) {
	// List active log streams
	r.HandleFunc("/api/logs/streams", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(logStreamManager.ListSessions())
	}).Methods("GET")

	// Stop all streams for a machine (used by beacon on page unload)
	r.HandleFunc("/api/logs/stop/{machineId}", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["machineId"]
		count := logStreamManager.StopByMachineID(machineID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"stopped": count,
		})
	}).Methods("POST", "GET")

	// Start a new log stream
	r.HandleFunc("/api/logs/stream", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var request struct {
			MachineID string `json:"machine_id"`
			Type      string `json:"type"`              // "journalctl", "journalctl-user", "tail", "docker", "compose"
			Target    string `json:"target"`            // unit name, file path, container name
			Lines     int    `json:"lines"`             // initial lines to show
			Filters   string `json:"filters,omitempty"` // additional filters for journalctl
			Sudo      bool   `json:"sudo,omitempty"`    // use sudo for tail
		}

		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request: "+err.Error(), http.StatusBadRequest)
			return
		}

		if request.MachineID == "" || request.Type == "" {
			http.Error(w, "machine_id and type are required", http.StatusBadRequest)
			return
		}

		// Get machine
		machine, exists := machineRepo.Get(request.MachineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Connect to machine
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Connection failed: %v", err),
			})
			return
		}

		// Create session ID
		sessionID := fmt.Sprintf("log-%d", time.Now().UnixNano())

		session := &LogStreamSession{
			ID:        sessionID,
			MachineID: request.MachineID,
			Type:      request.Type,
			Target:    request.Target,
			StartedAt: time.Now(),
		}

		// Start the appropriate log stream
		var stream *porter.LogStream

		// We don't use callback here - the SSE endpoint will handle streaming
		switch request.Type {
		case "journalctl":
			stream, err = porter.JournalFollow(client, request.Target, request.Lines, request.Filters, nil)
		case "journalctl-user":
			stream, err = porter.JournalFollowUser(client, request.Target, request.Lines, request.Filters, nil)
		case "tail":
			if request.Sudo {
				stream, err = porter.TailFollowWithSudo(client, request.Target, request.Lines, machine.Password, nil)
			} else {
				stream, err = porter.TailFollow(client, request.Target, request.Lines, nil)
			}
		case "docker":
			stream, err = porter.DockerLogs(client, request.Target, request.Lines, nil)
		case "compose":
			// Target format: "compose-file:service" or just "compose-file"
			composePath := request.Target
			service := ""
			if idx := len(composePath) - 1; idx > 0 {
				for i := len(composePath) - 1; i >= 0; i-- {
					if composePath[i] == ':' {
						composePath = request.Target[:i]
						service = request.Target[i+1:]
						break
					}
				}
			}
			stream, err = porter.DockerComposeLogs(client, composePath, service, request.Lines, nil)
		default:
			http.Error(w, "Invalid stream type", http.StatusBadRequest)
			client.Close()
			return
		}

		if err != nil {
			client.Close()
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to start stream: %v", err),
			})
			return
		}

		session.stream = stream
		logStreamManager.StartSession(session)

		// Clean up when stream ends
		go func() {
			stream.Wait()
			client.Close()
			logStreamManager.StopSession(sessionID)
		}()

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    true,
			"session_id": sessionID,
			"message":    "Log stream started. Connect to /api/logs/stream/" + sessionID + " for SSE events.",
		})
	}).Methods("POST")

	// Stop a log stream
	r.HandleFunc("/api/logs/stream/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		if logStreamManager.StopSession(id) {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"message": "Stream stopped",
			})
		} else {
			http.Error(w, "Stream not found", http.StatusNotFound)
		}
	}).Methods("DELETE")

	// SSE endpoint for streaming logs
	r.HandleFunc("/api/logs/stream/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		session, exists := logStreamManager.GetSession(id)
		if !exists {
			http.Error(w, "Stream not found", http.StatusNotFound)
			return
		}

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

		// Send initial connection event
		fmt.Fprintf(w, "event: connected\ndata: {\"session_id\": \"%s\", \"type\": \"%s\", \"target\": \"%s\"}\n\n",
			session.ID, session.Type, session.Target)
		flusher.Flush()

		// Stream logs until client disconnects or stream ends
		done := session.stream.Done()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-done:
				// Stream ended
				fmt.Fprintf(w, "event: closed\ndata: {\"reason\": \"stream_ended\"}\n\n")
				flusher.Flush()
				return

			case <-req.Context().Done():
				// Client disconnected
				return

			case <-ticker.C:
				// Send keepalive
				fmt.Fprintf(w, ": keepalive\n\n")
				flusher.Flush()
			}
		}
	}).Methods("GET")

	// Direct log streaming endpoint (starts stream and immediately streams via SSE)
	r.HandleFunc("/api/logs/live/{machineId}", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["machineId"]
		streamType := req.URL.Query().Get("type")
		target := req.URL.Query().Get("target")
		linesStr := req.URL.Query().Get("lines")
		filters := req.URL.Query().Get("filters")
		sudo := req.URL.Query().Get("sudo") == "true"

		if streamType == "" {
			streamType = "journalctl"
		}

		lines := 50 // default
		if linesStr != "" {
			fmt.Sscanf(linesStr, "%d", &lines)
		}

		// Get machine
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Connect to machine
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Set SSE headers
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			client.Close()
			http.Error(w, "SSE not supported", http.StatusInternalServerError)
			return
		}

		// Callback to send log lines via SSE
		callback := func(line porter.LogLine) {
			data, _ := json.Marshal(map[string]string{
				"line":   line.Line,
				"source": line.Source,
			})
			fmt.Fprintf(w, "event: log\ndata: %s\n\n", data)
			flusher.Flush()
		}

		// Start the appropriate log stream
		var stream *porter.LogStream

		switch streamType {
		case "journalctl":
			stream, err = porter.JournalFollow(client, target, lines, filters, callback)
		case "journalctl-user":
			stream, err = porter.JournalFollowUser(client, target, lines, filters, callback)
		case "tail":
			if sudo {
				stream, err = porter.TailFollowWithSudo(client, target, lines, machine.Password, callback)
			} else {
				stream, err = porter.TailFollow(client, target, lines, callback)
			}
		case "docker":
			stream, err = porter.DockerLogs(client, target, lines, callback)
		case "compose":
			composePath := target
			service := ""
			for i := len(target) - 1; i >= 0; i-- {
				if target[i] == ':' {
					composePath = target[:i]
					service = target[i+1:]
					break
				}
			}
			stream, err = porter.DockerComposeLogs(client, composePath, service, lines, callback)
		default:
			client.Close()
			http.Error(w, "Invalid stream type", http.StatusBadRequest)
			return
		}

		if err != nil {
			client.Close()
			fmt.Fprintf(w, "event: error\ndata: {\"error\": \"%s\"}\n\n", err.Error())
			flusher.Flush()
			return
		}

		// Register this stream so it can be stopped on page unload
		sessionID := fmt.Sprintf("live-%d", time.Now().UnixNano())
		session := &LogStreamSession{
			ID:        sessionID,
			MachineID: machineID,
			Type:      streamType,
			Target:    target,
			StartedAt: time.Now(),
			stream:    stream,
		}
		logStreamManager.StartSession(session)

		// Send connected event
		fmt.Fprintf(w, "event: connected\ndata: {\"type\": \"%s\", \"target\": \"%s\", \"session_id\": \"%s\"}\n\n", streamType, target, sessionID)
		flusher.Flush()

		// Wait for client disconnect or stream end
		select {
		case <-stream.Done():
			fmt.Fprintf(w, "event: closed\ndata: {\"reason\": \"stream_ended\"}\n\n")
			flusher.Flush()
		case <-req.Context().Done():
			stream.Stop()
		}

		// Cleanup session
		logStreamManager.StopSession(sessionID)
		client.Close()
	}).Methods("GET")
}
