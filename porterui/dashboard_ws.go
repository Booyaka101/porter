package porterui

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// DashboardUpdate represents a real-time update for the dashboard
type DashboardUpdate struct {
	Type      string      `json:"type"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// DashboardClient represents a connected WebSocket client
type DashboardClient struct {
	conn   *websocket.Conn
	send   chan []byte
	closed bool
	mu     sync.Mutex
}

// DashboardHub manages WebSocket connections for dashboard updates
type DashboardHub struct {
	clients    map[*DashboardClient]bool
	broadcast  chan []byte
	register   chan *DashboardClient
	unregister chan *DashboardClient
	mu         sync.RWMutex
}

var (
	dashboardHub      *DashboardHub
	dashboardHubOnce  sync.Once
	dashboardUpgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

// GetDashboardHub returns the singleton dashboard hub
func GetDashboardHub() *DashboardHub {
	dashboardHubOnce.Do(func() {
		dashboardHub = &DashboardHub{
			clients:    make(map[*DashboardClient]bool),
			broadcast:  make(chan []byte, 256),
			register:   make(chan *DashboardClient),
			unregister: make(chan *DashboardClient),
		}
		go dashboardHub.run()
		go dashboardHub.startHealthBroadcast()
	})
	return dashboardHub
}

// run handles client registration and message broadcasting
func (h *DashboardHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			LogDebug("Dashboard client connected", map[string]interface{}{
				"total_clients": len(h.clients),
			})

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			LogDebug("Dashboard client disconnected", map[string]interface{}{
				"total_clients": len(h.clients),
			})

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// startHealthBroadcast periodically broadcasts health updates
func (h *DashboardHub) startHealthBroadcast() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		h.mu.RLock()
		clientCount := len(h.clients)
		h.mu.RUnlock()

		// Only broadcast if there are connected clients
		if clientCount == 0 {
			continue
		}

		// Get all machine health statuses
		machines := machineRepo.List()
		healthData := make([]*MachineHealth, 0, len(machines))

		for _, m := range machines {
			if health := healthStore.Get(m.ID); health != nil {
				healthData = append(healthData, health)
			}
		}

		update := DashboardUpdate{
			Type:      "health_update",
			Timestamp: time.Now(),
			Data:      healthData,
		}

		data, err := json.Marshal(update)
		if err == nil {
			h.broadcast <- data
		}
	}
}

// Broadcast sends an update to all connected clients
func (h *DashboardHub) Broadcast(updateType string, data interface{}) {
	update := DashboardUpdate{
		Type:      updateType,
		Timestamp: time.Now(),
		Data:      data,
	}

	jsonData, err := json.Marshal(update)
	if err != nil {
		LogError("Failed to marshal dashboard update", map[string]interface{}{
			"type":  updateType,
			"error": err.Error(),
		})
		return
	}

	h.broadcast <- jsonData
}

// BroadcastMachineStatus broadcasts a machine status change
func BroadcastMachineStatus(machineID string, status string) {
	GetDashboardHub().Broadcast("machine_status", map[string]interface{}{
		"machine_id": machineID,
		"status":     status,
	})
}

// BroadcastExecutionUpdate broadcasts an execution status update
func BroadcastExecutionUpdate(executionID string, status string, progress int) {
	GetDashboardHub().Broadcast("execution_update", map[string]interface{}{
		"execution_id": executionID,
		"status":       status,
		"progress":     progress,
	})
}

// BroadcastNotification broadcasts a notification to all clients
func BroadcastNotification(level string, title string, message string) {
	GetDashboardHub().Broadcast("notification", map[string]interface{}{
		"level":   level,
		"title":   title,
		"message": message,
	})
}

// writePump pumps messages from the hub to the websocket connection
func (c *DashboardClient) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump pumps messages from the websocket connection to the hub
func (c *DashboardClient) readPump(hub *DashboardHub) {
	defer func() {
		hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// DashboardWSRoutes sets up WebSocket routes for dashboard updates
func DashboardWSRoutes(r *mux.Router) {
	hub := GetDashboardHub()

	r.HandleFunc("/api/dashboard/ws", func(w http.ResponseWriter, req *http.Request) {
		conn, err := dashboardUpgrader.Upgrade(w, req, nil)
		if err != nil {
			LogError("Dashboard WebSocket upgrade failed", map[string]interface{}{
				"error": err.Error(),
			})
			return
		}

		client := &DashboardClient{
			conn: conn,
			send: make(chan []byte, 256),
		}

		hub.register <- client

		// Send initial state
		machines := machineRepo.List()
		healthData := make([]*MachineHealth, 0, len(machines))
		for _, m := range machines {
			if health := healthStore.Get(m.ID); health != nil {
				healthData = append(healthData, health)
			}
		}

		initialUpdate := DashboardUpdate{
			Type:      "initial_state",
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"machines":      machines,
				"health":        healthData,
				"machine_count": len(machines),
			},
		}

		if data, err := json.Marshal(initialUpdate); err == nil {
			client.send <- data
		}

		go client.writePump()
		go client.readPump(hub)
	})

	// Endpoint to get connection pool stats
	r.HandleFunc("/api/pool/stats", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(GetConnectionPool().Stats())
	}).Methods("GET")
}
