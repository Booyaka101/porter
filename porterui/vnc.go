package porterui

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// VNCSession represents an active VNC session
type VNCSession struct {
	MachineID   string    `json:"machine_id"`
	MachineName string    `json:"machine_name"`
	MachineIP   string    `json:"machine_ip"`
	VNCPort     int       `json:"vnc_port"`
	Display     string    `json:"display"`
	StartedAt   time.Time `json:"started_at"`
	Active      bool      `json:"active"`
}

// VNCCapability represents whether a machine supports VNC
type VNCCapability struct {
	Available     bool   `json:"available"`
	Installed     bool   `json:"installed"`
	ServiceExists bool   `json:"service_exists"`
	ServiceActive bool   `json:"service_active"`
	Display       string `json:"display"`
	Error         string `json:"error,omitempty"`
}

// CheckVNCCapability checks if x11vnc is available on a machine
func CheckVNCCapability(machine *Machine) *VNCCapability {
	cap := &VNCCapability{}

	// Check if x11vnc is installed
	output, err := ExecuteSSHCommandOnMachine(machine, "which x11vnc 2>/dev/null || command -v x11vnc 2>/dev/null")
	if err != nil || output == "" {
		cap.Error = "x11vnc not installed"
		return cap
	}
	cap.Installed = true

	// Check if there's an X display available
	displayOutput, _ := ExecuteSSHCommandOnMachine(machine, "echo $DISPLAY")
	if displayOutput != "" {
		cap.Display = displayOutput
	} else {
		// Try to detect display
		cap.Display = ":0"
	}

	// Check if x11vnc service exists
	serviceCheck, _ := ExecuteSSHCommandOnMachine(machine, "systemctl list-unit-files | grep -q x11vnc && echo 'exists'")
	cap.ServiceExists = strings.Contains(serviceCheck, "exists")

	// Check if x11vnc is currently running
	runningCheck, _ := ExecuteSSHCommandOnMachine(machine, "pgrep -x x11vnc >/dev/null && echo 'running'")
	cap.ServiceActive = strings.Contains(runningCheck, "running")

	cap.Available = true
	return cap
}

// EnsureVNCReady ensures x11vnc is running, enabling/starting service if needed
func EnsureVNCReady(machine *Machine, display string) error {
	if display == "" {
		display = ":0"
	}

	// First check if already running
	runningCheck, _ := ExecuteSSHCommandOnMachine(machine, "pgrep -x x11vnc >/dev/null && echo 'running'")
	if strings.Contains(runningCheck, "running") {
		return nil // Already running
	}

	// Try to enable and start via systemd if service exists
	serviceCheck, _ := ExecuteSSHCommandOnMachine(machine, "systemctl list-unit-files | grep -q x11vnc && echo 'exists'")
	if strings.Contains(serviceCheck, "exists") {
		// Enable the service
		ExecuteSSHCommandOnMachine(machine, "sudo systemctl enable x11vnc 2>/dev/null")
		// Start the service
		_, err := ExecuteSSHCommandOnMachine(machine, "sudo systemctl start x11vnc 2>/dev/null")
		if err == nil {
			// Verify it started
			time.Sleep(500 * time.Millisecond)
			runningCheck, _ := ExecuteSSHCommandOnMachine(machine, "pgrep -x x11vnc >/dev/null && echo 'running'")
			if strings.Contains(runningCheck, "running") {
				return nil
			}
		}
	}

	// Fallback: start x11vnc manually
	vncPort := 5900
	var displayNum int
	fmt.Sscanf(display, ":%d", &displayNum)
	vncPort = 5900 + displayNum

	// Kill any existing instance first
	ExecuteSSHCommandOnMachine(machine, "pkill -9 x11vnc 2>/dev/null")
	time.Sleep(200 * time.Millisecond)

	// Start x11vnc with common options
	startCmd := fmt.Sprintf("x11vnc -display %s -forever -shared -nopw -rfbport %d -bg -o /tmp/x11vnc.log -xkb 2>&1", display, vncPort)
	_, err := ExecuteSSHCommandOnMachine(machine, startCmd)
	if err != nil {
		// Try alternative displays
		for _, tryDisplay := range []string{":0", ":1", ":10"} {
			if tryDisplay == display {
				continue
			}
			tryPort := 5900
			fmt.Sscanf(tryDisplay, ":%d", &displayNum)
			tryPort = 5900 + displayNum

			altCmd := fmt.Sprintf("x11vnc -display %s -forever -shared -nopw -rfbport %d -bg -o /tmp/x11vnc.log -xkb 2>&1", tryDisplay, tryPort)
			_, altErr := ExecuteSSHCommandOnMachine(machine, altCmd)
			if altErr == nil {
				return nil
			}
		}
		return fmt.Errorf("failed to start x11vnc: %v", err)
	}

	return nil
}

var (
	vncSessions   = make(map[string]*VNCSession)
	vncSessionsMu sync.RWMutex
	vncUpgrader   = websocket.Upgrader{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		CheckOrigin:     func(r *http.Request) bool { return true },
	}
)

// StartVNCServer starts x11vnc on the remote machine via SSH
func StartVNCServer(machine *Machine, display string) (*VNCSession, error) {
	if display == "" {
		display = ":0"
	}

	// First check capability
	cap := CheckVNCCapability(machine)
	if !cap.Installed {
		return nil, fmt.Errorf("x11vnc is not installed on this machine")
	}

	// Use detected display if available
	if cap.Display != "" {
		display = cap.Display
	}

	// Ensure VNC is ready (enables/starts service if needed)
	if err := EnsureVNCReady(machine, display); err != nil {
		return nil, err
	}

	// Determine VNC port
	vncPort := 5900
	var displayNum int
	fmt.Sscanf(display, ":%d", &displayNum)
	vncPort = 5900 + displayNum

	// Give x11vnc a moment to fully start
	time.Sleep(500 * time.Millisecond)

	// Verify it's running and get the actual port
	portCheck, _ := ExecuteSSHCommandOnMachine(machine, "ss -tlnp 2>/dev/null | grep x11vnc | awk '{print $4}' | grep -oE '[0-9]+$' | head -1")
	if portCheck != "" {
		fmt.Sscanf(portCheck, "%d", &vncPort)
	}

	session := &VNCSession{
		MachineID:   machine.ID,
		MachineName: machine.Name,
		MachineIP:   machine.IP,
		VNCPort:     vncPort,
		Display:     display,
		StartedAt:   time.Now(),
		Active:      true,
	}

	vncSessionsMu.Lock()
	vncSessions[machine.ID] = session
	vncSessionsMu.Unlock()

	return session, nil
}

// StopVNCServer stops x11vnc on the remote machine
func StopVNCServer(machine *Machine) error {
	cmd := "pkill -f x11vnc"
	_, _ = ExecuteSSHCommandOnMachine(machine, cmd)

	vncSessionsMu.Lock()
	delete(vncSessions, machine.ID)
	vncSessionsMu.Unlock()

	return nil
}

// GetVNCSession returns the active VNC session for a machine
func GetVNCSession(machineID string) *VNCSession {
	vncSessionsMu.RLock()
	defer vncSessionsMu.RUnlock()
	return vncSessions[machineID]
}

// VNCWebSocketProxy proxies WebSocket to VNC TCP connection
func VNCWebSocketProxy(w http.ResponseWriter, r *http.Request, machineIP string, vncPort int) {
	// Upgrade HTTP to WebSocket
	wsConn, err := vncUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer wsConn.Close()

	// Connect to VNC server
	vncAddr := net.JoinHostPort(machineIP, fmt.Sprintf("%d", vncPort))
	vncConn, err := net.DialTimeout("tcp", vncAddr, 10*time.Second)
	if err != nil {
		log.Printf("Failed to connect to VNC server at %s: %v", vncAddr, err)
		wsConn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to connect to VNC"))
		return
	}
	defer vncConn.Close()

	log.Printf("VNC proxy connected: WebSocket <-> %s", vncAddr)

	// Create channels for coordinating goroutines
	done := make(chan struct{})
	var once sync.Once

	// WebSocket -> VNC
	go func() {
		defer once.Do(func() { close(done) })
		for {
			messageType, data, err := wsConn.ReadMessage()
			if err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
					log.Printf("WebSocket read error: %v", err)
				}
				return
			}
			if messageType == websocket.BinaryMessage {
				_, err = vncConn.Write(data)
				if err != nil {
					log.Printf("VNC write error: %v", err)
					return
				}
			}
		}
	}()

	// VNC -> WebSocket
	go func() {
		defer once.Do(func() { close(done) })
		buf := make([]byte, 4096)
		for {
			n, err := vncConn.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("VNC read error: %v", err)
				}
				return
			}
			err = wsConn.WriteMessage(websocket.BinaryMessage, buf[:n])
			if err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		}
	}()

	<-done
	log.Printf("VNC proxy disconnected: %s", vncAddr)
}

// VNCRoutes sets up VNC-related API routes
func VNCRoutes(r *mux.Router) {
	// Check VNC capability for a machine
	r.HandleFunc("/api/vnc/{id}/capability", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)
		machineID := vars["id"]

		machines, err := LoadMachines()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		var machine *Machine
		for i := range machines {
			if machines[i].ID == machineID {
				machine = &machines[i]
				break
			}
		}

		if machine == nil {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		cap := CheckVNCCapability(machine)
		json.NewEncoder(w).Encode(cap)
	}).Methods("GET")

	// Start VNC session for a machine
	r.HandleFunc("/api/vnc/{id}/start", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)
		machineID := vars["id"]

		machines, err := LoadMachines()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		var machine *Machine
		for i := range machines {
			if machines[i].ID == machineID {
				machine = &machines[i]
				break
			}
		}

		if machine == nil {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Get display from query param or default to :0
		display := req.URL.Query().Get("display")
		if display == "" {
			display = ":0"
		}

		session, err := StartVNCServer(machine, display)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"session": session,
		})
	}).Methods("POST")

	// Stop VNC session for a machine
	r.HandleFunc("/api/vnc/{id}/stop", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)
		machineID := vars["id"]

		machines, err := LoadMachines()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		var machine *Machine
		for i := range machines {
			if machines[i].ID == machineID {
				machine = &machines[i]
				break
			}
		}

		if machine == nil {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		StopVNCServer(machine)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("POST")

	// Get VNC session status
	r.HandleFunc("/api/vnc/{id}/status", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)
		machineID := vars["id"]

		session := GetVNCSession(machineID)
		if session == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"active": false,
			})
			return
		}

		json.NewEncoder(w).Encode(session)
	}).Methods("GET")

	// WebSocket proxy endpoint for noVNC
	r.HandleFunc("/api/vnc/{id}/websocket", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]

		session := GetVNCSession(machineID)
		if session == nil {
			http.Error(w, "No active VNC session", http.StatusNotFound)
			return
		}

		VNCWebSocketProxy(w, req, session.MachineIP, session.VNCPort)
	})

	// List all active VNC sessions
	r.HandleFunc("/api/vnc/sessions", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		vncSessionsMu.RLock()
		sessions := make([]*VNCSession, 0, len(vncSessions))
		for _, s := range vncSessions {
			sessions = append(sessions, s)
		}
		vncSessionsMu.RUnlock()

		json.NewEncoder(w).Encode(sessions)
	}).Methods("GET")
}

// ExecuteSSHCommandOnMachine executes a command on a machine via SSH
func ExecuteSSHCommandOnMachine(machine *Machine, command string) (string, error) {
	password := GetDecryptedPassword(machine)

	sshClient := NewSSHClient(SSHConfig{
		Host:     machine.IP,
		Port:     22,
		Username: machine.Username,
		Password: password,
		Timeout:  10 * time.Second,
	})

	output, err := sshClient.RunCommand(command)
	return strings.TrimSpace(output), err
}
