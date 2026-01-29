package porterui

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// AgentMetrics represents metrics received from an agent
type AgentMetrics struct {
	Hostname      string `json:"hostname"`
	MachineID     string `json:"machine_id"`
	Timestamp     int64  `json:"timestamp"`
	Online        bool   `json:"online"`
	Uptime        string `json:"uptime"`
	LoadAvg       string `json:"load_avg"`
	CPUUsage      string `json:"cpu_usage"`
	CPUCores      string `json:"cpu_cores"`
	CPUModel      string `json:"cpu_model"`
	MemoryUsage   string `json:"memory_usage"`
	MemoryTotal   string `json:"memory_total"`
	MemoryFree    string `json:"memory_free"`
	SwapUsage     string `json:"swap_usage"`
	DiskUsage     string `json:"disk_usage"`
	DiskTotal     string `json:"disk_total"`
	DiskFree      string `json:"disk_free"`
	ProcessCount  string `json:"process_count"`
	LoggedUsers   string `json:"logged_users"`
	KernelVersion string `json:"kernel_version"`
	OSInfo        string `json:"os_info"`
	NetworkRX     string `json:"network_rx"`
	NetworkTX     string `json:"network_tx"`
}

// AgentConnection represents a connected agent
type AgentConnection struct {
	MachineID string
	Conn      *websocket.Conn
	LastSeen  time.Time
	Connected bool
}

// AgentStore manages connected agents
type AgentStore struct {
	mu       sync.RWMutex
	agents   map[string]*AgentConnection
	upgrader websocket.Upgrader
}

var agentStore = &AgentStore{
	agents: make(map[string]*AgentConnection),
	upgrader: websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for agents
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	},
}

// SetupAgentRoutes sets up the agent WebSocket routes
func SetupAgentRoutes(r *mux.Router) {
	r.HandleFunc("/api/agent/ws", handleAgentWebSocket)
	r.HandleFunc("/api/agent/status", handleAgentStatus).Methods("GET")
	r.HandleFunc("/api/agent/download", handleAgentDownload).Methods("GET")
}

func handleAgentWebSocket(w http.ResponseWriter, r *http.Request) {
	machineID := r.URL.Query().Get("id")
	if machineID == "" {
		http.Error(w, "Machine ID required", http.StatusBadRequest)
		return
	}

	// Upgrade to WebSocket
	conn, err := agentStore.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Agent] WebSocket upgrade failed for %s: %v", machineID, err)
		return
	}

	log.Printf("[Agent] Connected: %s", machineID)

	// Register agent
	agentStore.mu.Lock()
	agentStore.agents[machineID] = &AgentConnection{
		MachineID: machineID,
		Conn:      conn,
		LastSeen:  time.Now(),
		Connected: true,
	}
	agentStore.mu.Unlock()

	// Handle incoming messages
	defer func() {
		conn.Close()
		agentStore.mu.Lock()
		if agent, exists := agentStore.agents[machineID]; exists {
			agent.Connected = false
		}
		agentStore.mu.Unlock()
		log.Printf("[Agent] Disconnected: %s", machineID)

		// Mark machine as offline in health store
		healthStore.mu.Lock()
		if health, exists := healthStore.status[machineID]; exists {
			health.Online = false
			health.LastChecked = time.Now()
		}
		healthStore.mu.Unlock()
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Agent] Error reading from %s: %v", machineID, err)
			}
			break
		}

		// Parse metrics
		var metrics AgentMetrics
		if err := json.Unmarshal(message, &metrics); err != nil {
			log.Printf("[Agent] Error parsing metrics from %s: %v", machineID, err)
			continue
		}

		// Update last seen
		agentStore.mu.Lock()
		if agent, exists := agentStore.agents[machineID]; exists {
			agent.LastSeen = time.Now()
		}
		agentStore.mu.Unlock()

		// Update health store with agent metrics
		updateHealthFromAgent(machineID, &metrics)
	}
}

func updateHealthFromAgent(machineID string, metrics *AgentMetrics) {
	healthStore.mu.Lock()
	defer healthStore.mu.Unlock()

	health, exists := healthStore.status[machineID]
	if !exists {
		health = &MachineHealth{
			MachineID: machineID,
		}
		healthStore.status[machineID] = health
	}

	// Update all fields from agent metrics
	health.Online = true
	health.LastChecked = time.Now()
	health.LastOnline = time.Now()
	health.ResponseTime = 0 // Agent-based, no SSH latency
	health.Uptime = metrics.Uptime
	health.LoadAvg = metrics.LoadAvg
	health.CPUUsage = metrics.CPUUsage
	health.CPUCores = metrics.CPUCores
	health.CPUModel = metrics.CPUModel
	health.MemoryUsage = metrics.MemoryUsage
	health.MemoryTotal = metrics.MemoryTotal
	health.MemoryFree = metrics.MemoryFree
	health.SwapUsage = metrics.SwapUsage
	health.DiskUsage = metrics.DiskUsage
	health.DiskTotal = metrics.DiskTotal
	health.DiskFree = metrics.DiskFree
	health.ProcessCount = metrics.ProcessCount
	health.LoggedUsers = metrics.LoggedUsers
	health.KernelVersion = metrics.KernelVersion
	health.OSInfo = metrics.OSInfo
	health.NetworkRX = metrics.NetworkRX
	health.NetworkTX = metrics.NetworkTX
	health.Hostname = metrics.Hostname

	// Get machine name from machines list
	machines, _ := LoadMachines()
	for _, m := range machines {
		if m.ID == machineID {
			health.MachineName = m.Name
			health.IP = m.IP
			break
		}
	}
}

func handleAgentStatus(w http.ResponseWriter, r *http.Request) {
	agentStore.mu.RLock()
	defer agentStore.mu.RUnlock()

	status := make(map[string]interface{})
	for id, agent := range agentStore.agents {
		status[id] = map[string]interface{}{
			"connected": agent.Connected,
			"last_seen": agent.LastSeen,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// IsAgentConnected checks if an agent is connected for a machine
func IsAgentConnected(machineID string) bool {
	agentStore.mu.RLock()
	defer agentStore.mu.RUnlock()

	if agent, exists := agentStore.agents[machineID]; exists {
		return agent.Connected
	}
	return false
}

// GetConnectedAgentCount returns the number of connected agents
func GetConnectedAgentCount() int {
	agentStore.mu.RLock()
	defer agentStore.mu.RUnlock()

	count := 0
	for _, agent := range agentStore.agents {
		if agent.Connected {
			count++
		}
	}
	return count
}

func handleAgentDownload(w http.ResponseWriter, r *http.Request) {
	// Serve the pre-built agent binary
	agentPath := "agent/idx-agent"

	// Check if file exists
	data, err := os.ReadFile(agentPath)
	if err != nil {
		http.Error(w, "Agent binary not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=idx-agent")
	w.Write(data)
}
