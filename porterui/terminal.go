package porterui

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

var terminalUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// TerminalRecordingEvent represents a single event in a terminal recording
type TerminalRecordingEvent struct {
	Time float64 `json:"time"` // Seconds since start
	Type string  `json:"type"` // "o" for output, "i" for input
	Data string  `json:"data"` // The actual data
}

// TerminalRecording represents a recorded terminal session
type TerminalRecording struct {
	ID          string                   `json:"id"`
	MachineID   string                   `json:"machineId"`
	MachineName string                   `json:"machineName"`
	StartTime   time.Time                `json:"startTime"`
	Duration    float64                  `json:"duration"`
	Events      []TerminalRecordingEvent `json:"events"`
}

// TerminalSession represents an active terminal session
type TerminalSession struct {
	ID           string
	MachineID    string
	SSHClient    *ssh.Client
	Session      *ssh.Session
	StdinPipe    io.WriteCloser
	WSConn       *websocket.Conn
	mu           sync.Mutex
	closed       bool
	recording    bool
	recordStart  time.Time
	recordEvents []TerminalRecordingEvent
}

// TerminalManager manages active terminal sessions
type TerminalManager struct {
	sessions map[string]*TerminalSession
	mu       sync.RWMutex
}

var terminalManager = &TerminalManager{
	sessions: make(map[string]*TerminalSession),
}

func (tm *TerminalManager) Add(session *TerminalSession) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.sessions[session.ID] = session
}

func (tm *TerminalManager) Get(id string) (*TerminalSession, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	s, ok := tm.sessions[id]
	return s, ok
}

func (tm *TerminalManager) Remove(id string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	if s, ok := tm.sessions[id]; ok {
		s.Close()
		delete(tm.sessions, id)
	}
}

func (ts *TerminalSession) Close() {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if ts.closed {
		return
	}
	ts.closed = true
	if ts.StdinPipe != nil {
		ts.StdinPipe.Close()
	}
	if ts.Session != nil {
		ts.Session.Close()
	}
	if ts.SSHClient != nil {
		ts.SSHClient.Close()
	}
	if ts.WSConn != nil {
		ts.WSConn.Close()
	}
}

// TerminalRoutes sets up WebSocket terminal routes
func TerminalRoutes(r *mux.Router) {
	// WebSocket endpoint for interactive terminal
	r.HandleFunc("/api/machines/{id}/terminal/ws", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Check user role to determine connection mode
		// Admin users connect as root with fish shell
		// Operators connect as the machine's configured user
		isAdmin := false
		claims := getClaimsFromRequest(req)
		if claims != nil && (claims.Role == "admin" || HasPermission(claims.Permissions, "sudo:enabled")) {
			isAdmin = true
		}

		// Upgrade to WebSocket
		wsConn, err := terminalUpgrader.Upgrade(w, req, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		// Get shell preference from query params
		// Admin users default to fish, operators use bash
		shell := req.URL.Query().Get("shell")
		if shell == "" {
			if isAdmin {
				shell = "fish"
			} else {
				shell = "bash"
			}
		}

		// Determine SSH username and password
		// All users connect as the machine's configured user
		// Admin users will use sudo to get root shell after connecting
		sshUsername := machine.Username
		password := GetDecryptedPassword(machine)

		sshConfig := &ssh.ClientConfig{
			User: sshUsername,
			Auth: []ssh.AuthMethod{
				ssh.Password(password),
			},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			Timeout:         10 * time.Second,
		}

		sshClient, err := ssh.Dial("tcp", fmt.Sprintf("%s:22", machine.IP), sshConfig)
		if err != nil {
			wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\n\x1b[31mSSH connection failed: %v\x1b[0m\r\n", err)))
			wsConn.Close()
			return
		}

		// Create SSH session
		session, err := sshClient.NewSession()
		if err != nil {
			wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\n\x1b[31mSession creation failed: %v\x1b[0m\r\n", err)))
			sshClient.Close()
			wsConn.Close()
			return
		}

		// Request PTY
		modes := ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}

		// Get terminal size from query params
		cols := 120
		rows := 40
		if c := req.URL.Query().Get("cols"); c != "" {
			fmt.Sscanf(c, "%d", &cols)
		}
		if r := req.URL.Query().Get("rows"); r != "" {
			fmt.Sscanf(r, "%d", &rows)
		}

		if err := session.RequestPty("xterm-256color", rows, cols, modes); err != nil {
			wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\n\x1b[31mPTY request failed: %v\x1b[0m\r\n", err)))
			session.Close()
			sshClient.Close()
			wsConn.Close()
			return
		}

		// Get stdin pipe
		stdinPipe, err := session.StdinPipe()
		if err != nil {
			wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\n\x1b[31mStdin pipe failed: %v\x1b[0m\r\n", err)))
			session.Close()
			sshClient.Close()
			wsConn.Close()
			return
		}

		// Get stdout pipe
		stdoutPipe, err := session.StdoutPipe()
		if err != nil {
			wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\n\x1b[31mStdout pipe failed: %v\x1b[0m\r\n", err)))
			session.Close()
			sshClient.Close()
			wsConn.Close()
			return
		}

		// Get stderr pipe
		stderrPipe, err := session.StderrPipe()
		if err != nil {
			wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\n\x1b[31mStderr pipe failed: %v\x1b[0m\r\n", err)))
			session.Close()
			sshClient.Close()
			wsConn.Close()
			return
		}

		// Create terminal session
		sessionID := fmt.Sprintf("term-%d", time.Now().UnixNano())
		termSession := &TerminalSession{
			ID:        sessionID,
			MachineID: machineID,
			SSHClient: sshClient,
			Session:   session,
			StdinPipe: stdinPipe,
			WSConn:    wsConn,
		}
		terminalManager.Add(termSession)

		// Start shell - all users get the same shell (fish with bash fallback)
		var shellCmd string
		if shell == "fish" {
			shellCmd = "fish || bash"
		} else {
			shellCmd = shell
		}

		if err := session.Start(shellCmd); err != nil {
			wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\n\x1b[31mShell start failed: %v\x1b[0m\r\n", err)))
			terminalManager.Remove(sessionID)
			return
		}

		// Pipe stdout to WebSocket
		go func() {
			buf := make([]byte, 4096)
			for {
				n, err := stdoutPipe.Read(buf)
				if err != nil {
					break
				}
				if n > 0 {
					output := buf[:n]
					termSession.mu.Lock()
					if !termSession.closed {
						wsConn.WriteMessage(websocket.BinaryMessage, output)
						// Record output if recording is enabled
						if termSession.recording {
							termSession.recordEvents = append(termSession.recordEvents, TerminalRecordingEvent{
								Time: time.Since(termSession.recordStart).Seconds(),
								Type: "o",
								Data: string(output),
							})
						}
					}
					termSession.mu.Unlock()
				}
			}
			terminalManager.Remove(sessionID)
		}()

		// Pipe stderr to WebSocket
		go func() {
			buf := make([]byte, 4096)
			for {
				n, err := stderrPipe.Read(buf)
				if err != nil {
					break
				}
				if n > 0 {
					termSession.mu.Lock()
					if !termSession.closed {
						wsConn.WriteMessage(websocket.BinaryMessage, buf[:n])
					}
					termSession.mu.Unlock()
				}
			}
		}()

		// Read from WebSocket and write to stdin
		go func() {
			for {
				messageType, data, err := wsConn.ReadMessage()
				if err != nil {
					break
				}

				termSession.mu.Lock()
				if termSession.closed {
					termSession.mu.Unlock()
					break
				}

				if messageType == websocket.TextMessage || messageType == websocket.BinaryMessage {
					// Check for resize message
					if len(data) > 0 && data[0] == 0x01 {
						// Resize command: 0x01 + cols (2 bytes) + rows (2 bytes)
						if len(data) >= 5 {
							newCols := int(data[1])<<8 | int(data[2])
							newRows := int(data[3])<<8 | int(data[4])
							session.WindowChange(newRows, newCols)
						}
					} else {
						stdinPipe.Write(data)
					}
				}
				termSession.mu.Unlock()
			}
			terminalManager.Remove(sessionID)
		}()

		// Wait for session to complete
		session.Wait()
		terminalManager.Remove(sessionID)
	})

	// Terminal recording routes
	r.HandleFunc("/api/terminal/recordings", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		recordingsDir := filepath.Join(getDataDir(), "terminal-recordings")
		if _, err := os.Stat(recordingsDir); os.IsNotExist(err) {
			json.NewEncoder(w).Encode(map[string]interface{}{"recordings": []interface{}{}})
			return
		}

		var recordings []map[string]interface{}
		files, _ := os.ReadDir(recordingsDir)
		for _, file := range files {
			if !file.IsDir() && strings.HasSuffix(file.Name(), ".json") {
				data, err := os.ReadFile(filepath.Join(recordingsDir, file.Name()))
				if err != nil {
					continue
				}
				var rec TerminalRecording
				if err := json.Unmarshal(data, &rec); err != nil {
					continue
				}
				recordings = append(recordings, map[string]interface{}{
					"id":          rec.ID,
					"machineId":   rec.MachineID,
					"machineName": rec.MachineName,
					"startTime":   rec.StartTime,
					"duration":    rec.Duration,
					"eventCount":  len(rec.Events),
				})
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"recordings": recordings})
	}).Methods("GET")

	// Get single recording
	r.HandleFunc("/api/terminal/recordings/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]
		recordingsDir := filepath.Join(getDataDir(), "terminal-recordings")
		filePath := filepath.Join(recordingsDir, id+".json")

		data, err := os.ReadFile(filePath)
		if err != nil {
			http.Error(w, "Recording not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	}).Methods("GET")

	// Delete recording
	r.HandleFunc("/api/terminal/recordings/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]
		recordingsDir := filepath.Join(getDataDir(), "terminal-recordings")
		filePath := filepath.Join(recordingsDir, id+".json")

		if err := os.Remove(filePath); err != nil {
			http.Error(w, "Failed to delete recording", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}).Methods("DELETE")

	// Start/stop recording for a session
	r.HandleFunc("/api/terminal/sessions/{sessionId}/record", func(w http.ResponseWriter, req *http.Request) {
		sessionID := mux.Vars(req)["sessionId"]

		var request struct {
			Action      string `json:"action"` // "start" or "stop"
			MachineName string `json:"machineName"`
		}
		json.NewDecoder(req.Body).Decode(&request)

		terminalManager.mu.RLock()
		session, exists := terminalManager.sessions[sessionID]
		terminalManager.mu.RUnlock()

		if !exists {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		if request.Action == "start" {
			session.mu.Lock()
			session.recording = true
			session.recordStart = time.Now()
			session.recordEvents = []TerminalRecordingEvent{}
			session.mu.Unlock()
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "recording": true})
		} else if request.Action == "stop" {
			session.mu.Lock()
			if session.recording {
				session.recording = false
				duration := time.Since(session.recordStart).Seconds()

				// Save recording
				recording := TerminalRecording{
					ID:          fmt.Sprintf("%d", time.Now().UnixNano()),
					MachineID:   session.MachineID,
					MachineName: request.MachineName,
					StartTime:   session.recordStart,
					Duration:    duration,
					Events:      session.recordEvents,
				}

				recordingsDir := filepath.Join(getDataDir(), "terminal-recordings")
				os.MkdirAll(recordingsDir, 0755)

				data, _ := json.Marshal(recording)
				os.WriteFile(filepath.Join(recordingsDir, recording.ID+".json"), data, 0644)

				session.recordEvents = nil
				session.mu.Unlock()
				json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "recording": false, "recordingId": recording.ID})
			} else {
				session.mu.Unlock()
				json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "Not recording"})
			}
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "Invalid action"})
		}
	}).Methods("POST")
}
