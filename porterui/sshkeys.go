package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// SSHKey represents a managed SSH key
type SSHKey struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	PublicKey   string    `json:"public_key"`
	Fingerprint string    `json:"fingerprint"`
	CreatedAt   time.Time `json:"created_at"`
}

var (
	sshKeys   = make(map[string]*SSHKey)
	sshKeysMu sync.RWMutex
)

// SSHKeyRoutes sets up SSH key management API routes
func SSHKeyRoutes(r *mux.Router) {
	// List all managed SSH keys
	r.HandleFunc("/api/ssh-keys", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		sshKeysMu.RLock()
		defer sshKeysMu.RUnlock()

		keys := make([]*SSHKey, 0, len(sshKeys))
		for _, k := range sshKeys {
			keys = append(keys, k)
		}
		json.NewEncoder(w).Encode(keys)
	}).Methods("GET")

	// Add a new SSH key to manage
	r.HandleFunc("/api/ssh-keys", func(w http.ResponseWriter, req *http.Request) {
		var key SSHKey
		if err := json.NewDecoder(req.Body).Decode(&key); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		key.ID = fmt.Sprintf("key-%d", time.Now().UnixNano())
		key.CreatedAt = time.Now()

		// Extract fingerprint from public key (simplified)
		parts := strings.Fields(key.PublicKey)
		if len(parts) >= 2 {
			key.Fingerprint = parts[1][:16] + "..." // Simplified fingerprint
		}

		sshKeysMu.Lock()
		sshKeys[key.ID] = &key
		sshKeysMu.Unlock()

		AddAuditLog("add_ssh_key", "security", "", "", map[string]interface{}{"name": key.Name}, true, "")

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(key)
	}).Methods("POST")

	// Delete an SSH key
	r.HandleFunc("/api/ssh-keys/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]

		sshKeysMu.Lock()
		delete(sshKeys, id)
		sshKeysMu.Unlock()

		AddAuditLog("delete_ssh_key", "security", "", "", map[string]interface{}{"id": id}, true, "")

		w.WriteHeader(http.StatusOK)
	}).Methods("DELETE")

	// Deploy SSH key to a machine - uses Porter's Ansible-like task manifest
	r.HandleFunc("/api/machines/{id}/ssh-keys/deploy", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var reqBody struct {
			KeyID string `json:"key_id"`
			User  string `json:"user"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		sshKeysMu.RLock()
		key, keyExists := sshKeys[reqBody.KeyID]
		sshKeysMu.RUnlock()

		if !keyExists {
			http.Error(w, "SSH key not found", http.StatusNotFound)
			return
		}

		if reqBody.User == "" {
			reqBody.User = machine.Username
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Connection failed: " + err.Error(),
			})
			return
		}
		defer client.Close()

		// Determine home directory
		homeDir := fmt.Sprintf("/home/%s", reqBody.User)
		if reqBody.User == "root" {
			homeDir = "/root"
		}

		// Build Porter manifest for SSH key deployment (Ansible-like approach)
		tasks := porter.Tasks(
			// Create .ssh directory with proper permissions
			porter.Mkdir(fmt.Sprintf("%s/.ssh", homeDir)).
				Name("Create .ssh directory").
				Creates(fmt.Sprintf("%s/.ssh", homeDir)),

			// Set directory permissions
			porter.Chmod(fmt.Sprintf("%s/.ssh", homeDir)).
				Mode("700").
				Name("Set .ssh directory permissions"),

			// Add key to authorized_keys (idempotent - check if key already exists)
			porter.Run(fmt.Sprintf("grep -qF '%s' %s/.ssh/authorized_keys 2>/dev/null || echo '%s' >> %s/.ssh/authorized_keys",
				key.PublicKey, homeDir, key.PublicKey, homeDir)).
				Name("Add SSH key to authorized_keys"),

			// Set authorized_keys permissions
			porter.Chmod(fmt.Sprintf("%s/.ssh/authorized_keys", homeDir)).
				Mode("600").
				Name("Set authorized_keys permissions"),

			// Set ownership
			porter.Chown(fmt.Sprintf("%s/.ssh", homeDir)).
				Owner(reqBody.User).
				Name("Set .ssh ownership"),
		)

		vars := porter.NewVars()
		vars.Set("user", reqBody.User)
		vars.Set("home", homeDir)
		vars.Set("key_name", key.Name)

		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)

		stats, execErr := executor.Run(fmt.Sprintf("Deploy SSH Key: %s", key.Name), tasks, vars)

		success := execErr == nil && stats.Failed == 0
		errMsg := ""
		if execErr != nil {
			errMsg = execErr.Error()
		} else if stats.Failed > 0 {
			errMsg = fmt.Sprintf("%d task(s) failed", stats.Failed)
		}

		AddAuditLog("deploy_ssh_key", "security", machineID, machine.Name, map[string]interface{}{
			"key_name": key.Name,
			"user":     reqBody.User,
			"stats":    fmt.Sprintf("ok=%d changed=%d failed=%d", stats.OK, stats.Changed, stats.Failed),
		}, success, errMsg)

		w.Header().Set("Content-Type", "application/json")
		if !success {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   errMsg,
			})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"message": fmt.Sprintf("SSH key deployed to %s@%s", reqBody.User, machine.Name),
				"stats":   fmt.Sprintf("ok=%d changed=%d", stats.OK, stats.Changed),
			})
		}
	}).Methods("POST")

	// List authorized keys on a machine - uses Porter's Capture task
	r.HandleFunc("/api/machines/{id}/ssh-keys", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		user := req.URL.Query().Get("user")
		if user == "" {
			user = machine.Username
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Connection failed: " + err.Error(),
			})
			return
		}
		defer client.Close()

		homeDir := fmt.Sprintf("/home/%s", user)
		if user == "root" {
			homeDir = "/root"
		}

		// Use Porter's Capture task to get authorized_keys
		tasks := porter.Tasks(
			porter.Capture(fmt.Sprintf("cat %s/.ssh/authorized_keys 2>/dev/null || echo ''", homeDir)).
				Name("Read authorized_keys").
				Register("auth_keys"),
		)

		vars := porter.NewVars()
		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)
		executor.Run("List SSH Keys", tasks, vars)

		output := vars.Get("auth_keys")

		var keys []map[string]string
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.Fields(line)
			keyInfo := map[string]string{
				"type": "",
				"key":  line,
				"name": "",
			}
			if len(parts) >= 1 {
				keyInfo["type"] = parts[0]
			}
			if len(parts) >= 3 {
				keyInfo["name"] = parts[2]
			}
			keys = append(keys, keyInfo)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"keys":    keys,
		})
	}).Methods("GET")

	// Remove an authorized key from a machine - uses Porter's Run task
	r.HandleFunc("/api/machines/{id}/ssh-keys/remove", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var reqBody struct {
			KeyPattern string `json:"key_pattern"` // Part of the key to match
			User       string `json:"user"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if reqBody.User == "" {
			reqBody.User = machine.Username
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Connection failed: " + err.Error(),
			})
			return
		}
		defer client.Close()

		homeDir := fmt.Sprintf("/home/%s", reqBody.User)
		if reqBody.User == "root" {
			homeDir = "/root"
		}

		// Use Porter's Run task to remove the key
		tasks := porter.Tasks(
			porter.Run(fmt.Sprintf("sed -i '/%s/d' %s/.ssh/authorized_keys", reqBody.KeyPattern, homeDir)).
				Name("Remove SSH key from authorized_keys"),
		)

		vars := porter.NewVars()
		vars.Set("user", reqBody.User)

		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)
		stats, execErr := executor.Run("Remove SSH Key", tasks, vars)

		success := execErr == nil && stats.Failed == 0

		AddAuditLog("remove_ssh_key", "security", machineID, machine.Name, map[string]interface{}{
			"user": reqBody.User,
		}, success, "")

		w.Header().Set("Content-Type", "application/json")
		if !success {
			errMsg := ""
			if execErr != nil {
				errMsg = execErr.Error()
			}
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   errMsg,
			})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
			})
		}
	}).Methods("POST")
}
