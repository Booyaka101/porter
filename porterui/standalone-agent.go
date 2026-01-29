package porterui

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// StandaloneAgentMetrics represents metrics from a standalone agent
type StandaloneAgentMetrics struct {
	Hostname      string   `json:"hostname"`
	Timestamp     int64    `json:"timestamp"`
	Online        bool     `json:"online"`
	Uptime        string   `json:"uptime"`
	LoadAverage   string   `json:"load_average"`
	CPUUsage      float64  `json:"cpu_usage"`
	MemoryUsage   float64  `json:"memory_usage"`
	MemoryTotal   string   `json:"memory_total"`
	MemoryUsed    string   `json:"memory_used"`
	DiskUsage     float64  `json:"disk_usage"`
	DiskTotal     string   `json:"disk_total"`
	DiskUsed      string   `json:"disk_used"`
	ProcessCount  int      `json:"process_count"`
	LoggedInUsers []string `json:"logged_in_users"`
	KernelVersion string   `json:"kernel_version"`
	OSInfo        string   `json:"os_info"`
	NetworkRX     string   `json:"network_rx"`
	NetworkTX     string   `json:"network_tx"`
	CPUModel      string   `json:"cpu_model"`
	CPUCores      int      `json:"cpu_cores"`
}

// StandaloneAgentConnection represents a WebSocket connection to a standalone agent
type StandaloneAgentConnection struct {
	MachineID string
	Conn      *websocket.Conn
	LastSeen  time.Time
	Metrics   StandaloneAgentMetrics
}

type StandaloneAgentManager struct {
	connections map[string]*StandaloneAgentConnection // machineID -> connection
	mu          sync.RWMutex
}

var standaloneAgentManager = &StandaloneAgentManager{
	connections: make(map[string]*StandaloneAgentConnection),
}

var standaloneUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for agent connections
	},
}

// SetupStandaloneAgentRoutes sets up the standalone agent-related routes
func SetupStandaloneAgentRoutes(r *mux.Router) {
	r.HandleFunc("/api/standalone-agent/connect/{machineId}", handleStandaloneAgentConnect).Methods("GET")
	r.HandleFunc("/api/standalone-agent/metrics/{machineId}", getStandaloneAgentMetrics).Methods("GET")
	r.HandleFunc("/api/standalone-agent/status", getStandaloneAgentStatus).Methods("GET")
}

// handleStandaloneAgentConnect creates a WebSocket proxy to the standalone agent
func handleStandaloneAgentConnect(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	machineId := vars["machineId"]

	// Get machine details
	machines := machineRepo.List()
	var targetMachine *Machine
	for _, m := range machines {
		if m.ID == machineId {
			targetMachine = m
			break
		}
	}

	if targetMachine == nil {
		http.Error(w, "Machine not found", http.StatusNotFound)
		return
	}

	// Connect to the agent's WebSocket
	agentURL := fmt.Sprintf("ws://%s:8083/ws", targetMachine.IP)
	agentConn, _, err := websocket.DefaultDialer.Dial(agentURL, nil)
	if err != nil {
		log.Printf("Failed to connect to agent %s: %v", machineId, err)
		http.Error(w, "Failed to connect to agent", http.StatusBadGateway)
		return
	}
	defer agentConn.Close()

	// Upgrade client connection
	clientConn, err := standaloneUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade client connection: %v", err)
		return
	}
	defer clientConn.Close()

	// Store connection
	standaloneAgentManager.mu.Lock()
	standaloneAgentManager.connections[machineId] = &StandaloneAgentConnection{
		MachineID: machineId,
		Conn:      agentConn,
		LastSeen:  time.Now(),
	}
	standaloneAgentManager.mu.Unlock()

	// Update machine agent status
	machineRepo.UpdateAgentStatus(machineId, true, 8083)

	log.Printf("Proxying WebSocket connection for machine %s", machineId)

	// Bidirectional proxy
	done := make(chan struct{})
	var closeOnce sync.Once

	// Agent -> Client
	go func() {
		defer closeOnce.Do(func() { close(done) })
		for {
			_, message, err := agentConn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Agent connection error for %s: %v", machineId, err)
				}
				break
			}

			// Update last seen and metrics
			standaloneAgentManager.mu.Lock()
			if conn := standaloneAgentManager.connections[machineId]; conn != nil {
				conn.LastSeen = time.Now()
				if err := json.Unmarshal(message, &conn.Metrics); err == nil {
					// Update health store with agent metrics
					updateHealthStoreFromStandaloneAgent(machineId, conn.Metrics)
				}
			}
			standaloneAgentManager.mu.Unlock()

			// Forward to client
			err = clientConn.WriteMessage(websocket.TextMessage, message)
			if err != nil {
				break
			}
		}
	}()

	// Client -> Agent (keepalive)
	go func() {
		defer closeOnce.Do(func() { close(done) })
		for {
			_, _, err := clientConn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()

	// Wait for either side to close
	<-done

	// Clean up
	standaloneAgentManager.mu.Lock()
	delete(standaloneAgentManager.connections, machineId)
	standaloneAgentManager.mu.Unlock()

	machineRepo.UpdateAgentStatus(machineId, false, 0)
	log.Printf("WebSocket connection closed for machine %s", machineId)
}

// getStandaloneAgentMetrics returns the latest metrics from a standalone agent
func getStandaloneAgentMetrics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	machineId := vars["machineId"]

	standaloneAgentManager.mu.RLock()
	conn, exists := standaloneAgentManager.connections[machineId]
	standaloneAgentManager.mu.RUnlock()

	if !exists || conn == nil {
		http.Error(w, "Agent not connected", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conn.Metrics)
}

// getStandaloneAgentStatus returns the status of all standalone agent connections
func getStandaloneAgentStatus(w http.ResponseWriter, r *http.Request) {
	standaloneAgentManager.mu.RLock()
	status := make(map[string]interface{})
	for machineId, conn := range standaloneAgentManager.connections {
		status[machineId] = map[string]interface{}{
			"connected": true,
			"last_seen": conn.LastSeen,
			"metrics":   conn.Metrics,
		}
	}
	standaloneAgentManager.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// updateHealthStoreFromStandaloneAgent updates the health store with metrics from a standalone agent
func updateHealthStoreFromStandaloneAgent(machineId string, metrics StandaloneAgentMetrics) {
	// Convert agent metrics to MachineHealth format
	health := &MachineHealth{
		MachineID:     machineId,
		Online:        true,
		LastChecked:   time.Now(),
		LastOnline:    time.Now(),
		ResponseTime:  0, // Agent mode - no response time
		Uptime:        metrics.Uptime,
		CPUUsage:      fmt.Sprintf("%.1f", metrics.CPUUsage),
		CPUCores:      fmt.Sprintf("%d", metrics.CPUCores),
		CPUModel:      metrics.CPUModel,
		MemoryUsage:   fmt.Sprintf("%.1f", metrics.MemoryUsage),
		MemoryTotal:   metrics.MemoryTotal,
		DiskUsage:     fmt.Sprintf("%.1f", metrics.DiskUsage),
		DiskTotal:     metrics.DiskTotal,
		ProcessCount:  fmt.Sprintf("%d", metrics.ProcessCount),
		LoggedUsers:   strings.Join(metrics.LoggedInUsers, ", "),
		KernelVersion: metrics.KernelVersion,
		OSInfo:        metrics.OSInfo,
		NetworkRX:     metrics.NetworkRX,
		NetworkTX:     metrics.NetworkTX,
	}

	healthStore.mu.Lock()
	healthStore.status[machineId] = health
	healthStore.mu.Unlock()
}

// CheckStandaloneAgentStatus checks if a standalone agent is running on a machine
func CheckStandaloneAgentStatus(machine *Machine) bool {
	if !machine.HasAgent || machine.AgentPort == 0 {
		return false
	}

	client := &http.Client{
		Timeout: 3 * time.Second,
	}

	resp, err := client.Get(fmt.Sprintf("http://%s:%d/", machine.IP, machine.AgentPort))
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == 200
}
