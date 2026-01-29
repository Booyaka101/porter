package porterui

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// WakeOnLAN sends a magic packet to wake a machine
func WakeOnLAN(macAddress string, broadcastIP string) error {
	// Parse MAC address
	mac := strings.ReplaceAll(macAddress, ":", "")
	mac = strings.ReplaceAll(mac, "-", "")
	macBytes, err := hex.DecodeString(mac)
	if err != nil {
		return fmt.Errorf("invalid MAC address: %v", err)
	}

	if len(macBytes) != 6 {
		return fmt.Errorf("MAC address must be 6 bytes")
	}

	// Build magic packet: 6 bytes of 0xFF followed by MAC address repeated 16 times
	packet := make([]byte, 102)
	for i := 0; i < 6; i++ {
		packet[i] = 0xFF
	}
	for i := 0; i < 16; i++ {
		copy(packet[6+i*6:], macBytes)
	}

	// Send to broadcast address
	if broadcastIP == "" {
		broadcastIP = "255.255.255.255"
	}

	addr, err := net.ResolveUDPAddr("udp", broadcastIP+":9")
	if err != nil {
		return err
	}

	conn, err := net.DialUDP("udp", nil, addr)
	if err != nil {
		return err
	}
	defer conn.Close()

	_, err = conn.Write(packet)
	return err
}

// MachineGroup represents a group of machines
type MachineGroup struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	Icon      string    `json:"icon"`
	CreatedAt time.Time `json:"created_at"`
}

var (
	machineGroups   = make(map[string]*MachineGroup)
	machineGroupsMu sync.RWMutex
	machineToGroups = make(map[string][]string) // machineID -> groupIDs
	machineTagsMu   sync.RWMutex
)

// CommandBookmark represents a saved command for a machine
type CommandBookmark struct {
	ID          string    `json:"id"`
	MachineID   string    `json:"machine_id"`
	Name        string    `json:"name"`
	Command     string    `json:"command"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

var (
	commandBookmarks   = make(map[string]*CommandBookmark)
	commandBookmarksMu sync.RWMutex
)

// AuditLogEntry represents an action taken in the system
type AuditLogEntry struct {
	ID          string                 `json:"id"`
	Timestamp   time.Time              `json:"timestamp"`
	Action      string                 `json:"action"`
	Category    string                 `json:"category"`
	MachineID   string                 `json:"machine_id,omitempty"`
	MachineName string                 `json:"machine_name,omitempty"`
	Details     map[string]interface{} `json:"details,omitempty"`
	Success     bool                   `json:"success"`
	Error       string                 `json:"error,omitempty"`
}

var (
	auditLog   []AuditLogEntry
	auditLogMu sync.RWMutex
)

// AddAuditLog adds an entry to the audit log
func AddAuditLog(action, category, machineID, machineName string, details map[string]interface{}, success bool, errMsg string) {
	auditLogMu.Lock()
	defer auditLogMu.Unlock()

	entry := AuditLogEntry{
		ID:          fmt.Sprintf("audit-%d", time.Now().UnixNano()),
		Timestamp:   time.Now(),
		Action:      action,
		Category:    category,
		MachineID:   machineID,
		MachineName: machineName,
		Details:     details,
		Success:     success,
		Error:       errMsg,
	}

	// Keep last 1000 entries
	if len(auditLog) >= 1000 {
		auditLog = auditLog[1:]
	}
	auditLog = append(auditLog, entry)
}

// WOLRoutes sets up Wake-on-LAN and related API routes
func WOLRoutes(r *mux.Router) {
	// Wake machine via WOL
	r.HandleFunc("/api/machines/{id}/wake", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		if machine.MAC == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "MAC address not configured for this machine",
			})
			return
		}

		// Get broadcast IP from request or use default
		var reqBody struct {
			BroadcastIP string `json:"broadcast_ip"`
		}
		json.NewDecoder(req.Body).Decode(&reqBody)

		err := WakeOnLAN(machine.MAC, reqBody.BroadcastIP)

		AddAuditLog("wake", "power", machineID, machine.Name, nil, err == nil, "")

		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"message": fmt.Sprintf("Wake-on-LAN packet sent to %s", machine.MAC),
			})
		}
	}).Methods("POST")

	// Machine Groups CRUD
	r.HandleFunc("/api/groups", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		machineGroupsMu.RLock()
		defer machineGroupsMu.RUnlock()

		groups := make([]*MachineGroup, 0, len(machineGroups))
		for _, g := range machineGroups {
			groups = append(groups, g)
		}
		json.NewEncoder(w).Encode(groups)
	}).Methods("GET")

	r.HandleFunc("/api/groups", func(w http.ResponseWriter, req *http.Request) {
		var group MachineGroup
		if err := json.NewDecoder(req.Body).Decode(&group); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		group.ID = fmt.Sprintf("group-%d", time.Now().UnixNano())
		group.CreatedAt = time.Now()

		machineGroupsMu.Lock()
		machineGroups[group.ID] = &group
		machineGroupsMu.Unlock()

		AddAuditLog("create_group", "groups", "", "", map[string]interface{}{"name": group.Name}, true, "")

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(group)
	}).Methods("POST")

	r.HandleFunc("/api/groups/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		machineGroupsMu.Lock()
		delete(machineGroups, id)
		machineGroupsMu.Unlock()

		AddAuditLog("delete_group", "groups", "", "", map[string]interface{}{"id": id}, true, "")

		w.WriteHeader(http.StatusOK)
	}).Methods("DELETE")

	// Assign machine to groups
	r.HandleFunc("/api/machines/{id}/groups", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		var reqBody struct {
			GroupIDs []string `json:"group_ids"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		machineTagsMu.Lock()
		machineToGroups[machineID] = reqBody.GroupIDs
		machineTagsMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("PUT")

	r.HandleFunc("/api/machines/{id}/groups", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		machineTagsMu.RLock()
		groups := machineToGroups[machineID]
		machineTagsMu.RUnlock()

		if groups == nil {
			groups = []string{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(groups)
	}).Methods("GET")

	// Command Bookmarks
	r.HandleFunc("/api/machines/{id}/bookmarks", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		commandBookmarksMu.RLock()
		defer commandBookmarksMu.RUnlock()

		bookmarks := make([]*CommandBookmark, 0)
		for _, b := range commandBookmarks {
			if b.MachineID == machineID {
				bookmarks = append(bookmarks, b)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(bookmarks)
	}).Methods("GET")

	r.HandleFunc("/api/machines/{id}/bookmarks", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		var bookmark CommandBookmark
		if err := json.NewDecoder(req.Body).Decode(&bookmark); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		bookmark.ID = fmt.Sprintf("bookmark-%d", time.Now().UnixNano())
		bookmark.MachineID = machineID
		bookmark.CreatedAt = time.Now()

		commandBookmarksMu.Lock()
		commandBookmarks[bookmark.ID] = &bookmark
		commandBookmarksMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(bookmark)
	}).Methods("POST")

	r.HandleFunc("/api/bookmarks/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		commandBookmarksMu.Lock()
		delete(commandBookmarks, id)
		commandBookmarksMu.Unlock()

		w.WriteHeader(http.StatusOK)
	}).Methods("DELETE")

	// Audit Log
	r.HandleFunc("/api/audit-log", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		limit := 100
		if l := req.URL.Query().Get("limit"); l != "" {
			fmt.Sscanf(l, "%d", &limit)
		}

		category := req.URL.Query().Get("category")
		machineID := req.URL.Query().Get("machine_id")

		auditLogMu.RLock()
		defer auditLogMu.RUnlock()

		var filtered []AuditLogEntry
		for i := len(auditLog) - 1; i >= 0 && len(filtered) < limit; i-- {
			entry := auditLog[i]
			if category != "" && entry.Category != category {
				continue
			}
			if machineID != "" && entry.MachineID != machineID {
				continue
			}
			filtered = append(filtered, entry)
		}

		json.NewEncoder(w).Encode(filtered)
	}).Methods("GET")

	// Quick Actions - common operations
	r.HandleFunc("/api/machines/{id}/quick-action", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var reqBody struct {
			Action string `json:"action"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Connection failed: " + err.Error(),
			})
			return
		}
		defer client.Close()

		var cmd string
		switch reqBody.Action {
		case "reboot":
			cmd = "sudo reboot"
		case "shutdown":
			cmd = "sudo shutdown -h now"
		case "update":
			cmd = "sudo apt-get update && sudo apt-get upgrade -y"
		case "clear-cache":
			cmd = "sudo sync && sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'"
		case "clear-logs":
			cmd = "sudo journalctl --vacuum-time=1d"
		case "restart-network":
			cmd = "sudo systemctl restart NetworkManager || sudo systemctl restart networking"
		default:
			http.Error(w, "Unknown action", http.StatusBadRequest)
			return
		}

		output, err := client.Run(cmd)

		AddAuditLog("quick_action_"+reqBody.Action, "system", machineID, machine.Name, nil, err == nil, "")

		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   err.Error(),
				"output":  string(output),
			})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"output":  string(output),
			})
		}
	}).Methods("POST")
}
