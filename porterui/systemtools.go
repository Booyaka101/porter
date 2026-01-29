package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// SystemToolsRoutes sets up system tools API routes (packages, firewall, users)
func SystemToolsRoutes(r *mux.Router) {
	// Get installed packages - uses Porter's Capture task
	r.HandleFunc("/api/machines/{id}/packages", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's Capture task for package listing
		output, _ := RunPorterTask(client, password, "List packages",
			"dpkg-query -W -f='${Package}|${Version}|${Status}\n' 2>/dev/null | grep 'install ok installed' | head -500",
			"packages")

		var packages []map[string]interface{}
		lines := strings.Split(strings.TrimSpace(output), "\n")
		for _, line := range lines {
			parts := strings.Split(line, "|")
			if len(parts) >= 2 {
				packages = append(packages, map[string]interface{}{
					"name":    parts[0],
					"version": parts[1],
					"status":  "installed",
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"packages": packages})
	}).Methods("GET")

	// Install packages - uses Porter's task manifest
	r.HandleFunc("/api/machines/{id}/packages/install", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		var request struct {
			Packages []string `json:"packages"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's package install manifest
		pkgs := strings.Join(request.Packages, " ")
		stats, err := RunPorterManifest(client, password, "Install Packages", PackageInstallManifest(pkgs))

		w.Header().Set("Content-Type", "application/json")
		if err != nil || stats.Failed > 0 {
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			} else {
				errMsg = fmt.Sprintf("%d task(s) failed", stats.Failed)
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": errMsg})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Remove packages - uses Porter's task manifest
	r.HandleFunc("/api/machines/{id}/packages/remove", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		var request struct {
			Packages []string `json:"packages"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's package remove manifest
		pkgs := strings.Join(request.Packages, " ")
		stats, err := RunPorterManifest(client, password, "Remove Packages", PackageRemoveManifest(pkgs))

		w.Header().Set("Content-Type", "application/json")
		if err != nil || stats.Failed > 0 {
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			} else {
				errMsg = fmt.Sprintf("%d task(s) failed", stats.Failed)
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": errMsg})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Upgrade all packages - uses Porter's task manifest
	r.HandleFunc("/api/machines/{id}/packages/upgrade", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's package upgrade manifest
		stats, err := RunPorterManifest(client, password, "Upgrade Packages", PackageUpgradeManifest())

		w.Header().Set("Content-Type", "application/json")
		if err != nil || stats.Failed > 0 {
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			} else {
				errMsg = fmt.Sprintf("%d task(s) failed", stats.Failed)
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": errMsg})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"stats":   fmt.Sprintf("ok=%d changed=%d", stats.OK, stats.Changed),
			})
		}
	}).Methods("POST")

	// Get firewall status
	r.HandleFunc("/api/machines/{id}/firewall", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Check UFW status
		statusOutput, _ := client.Run("sudo ufw status 2>/dev/null || echo 'inactive'")
		enabled := strings.Contains(string(statusOutput), "Status: active")

		// Get rules
		var rules []map[string]interface{}
		if enabled {
			rulesOutput, _ := client.Run("sudo ufw status numbered 2>/dev/null")
			lines := strings.Split(string(rulesOutput), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "[") {
					// Parse rule like "[ 1] 22/tcp                     ALLOW IN    Anywhere"
					parts := strings.Fields(line)
					if len(parts) >= 4 {
						portProto := parts[1]
						action := strings.ToLower(parts[2])
						port := portProto
						protocol := "tcp"
						if strings.Contains(portProto, "/") {
							pp := strings.Split(portProto, "/")
							port = pp[0]
							protocol = pp[1]
						}
						rules = append(rules, map[string]interface{}{
							"port":     port,
							"protocol": protocol,
							"action":   action,
						})
					}
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"enabled": enabled,
			"rules":   rules,
		})
	}).Methods("GET")

	// Enable/disable firewall
	r.HandleFunc("/api/machines/{id}/firewall/{action}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		action := vars["action"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		var cmd string
		switch action {
		case "enable":
			cmd = "sudo ufw --force enable"
		case "disable":
			cmd = "sudo ufw disable"
		default:
			http.Error(w, "Invalid action", http.StatusBadRequest)
			return
		}

		_, err = client.Run(cmd)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Add/delete firewall rule
	r.HandleFunc("/api/machines/{id}/firewall/rule", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		var request struct {
			Port     string `json:"port"`
			Action   string `json:"action"`
			Protocol string `json:"protocol"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		protocol := request.Protocol
		if protocol == "" || protocol == "both" {
			protocol = ""
		} else {
			protocol = "/" + protocol
		}

		var cmd string
		if req.Method == "POST" {
			cmd = fmt.Sprintf("sudo ufw %s %s%s", request.Action, request.Port, protocol)
		} else {
			cmd = fmt.Sprintf("sudo ufw delete %s %s%s", request.Action, request.Port, protocol)
		}

		_, err = client.Run(cmd)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST", "DELETE")

	// Get users
	r.HandleFunc("/api/machines/{id}/users", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Get users with UID >= 1000 (regular users) plus root
		output, err := client.Run("awk -F: '($3 >= 1000 || $3 == 0) {print $1\"|\"$3\"|\"$6\"|\"$7}' /etc/passwd")
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"users": []interface{}{}})
			return
		}

		var users []map[string]interface{}
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		for _, line := range lines {
			parts := strings.Split(line, "|")
			if len(parts) >= 4 {
				username := parts[0]
				// Get groups for user
				groupsOutput, _ := client.Run(fmt.Sprintf("groups %s 2>/dev/null | cut -d: -f2", username))
				groups := strings.TrimSpace(string(groupsOutput))

				uid := 0
				fmt.Sscanf(parts[1], "%d", &uid)

				users = append(users, map[string]interface{}{
					"username": username,
					"uid":      uid,
					"home":     parts[2],
					"shell":    parts[3],
					"groups":   groups,
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"users": users})
	}).Methods("GET")

	// Add user
	r.HandleFunc("/api/machines/{id}/users", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		var request struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Groups   string `json:"groups"`
			Shell    string `json:"shell"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		shell := request.Shell
		if shell == "" {
			shell = "/bin/bash"
		}

		// Create user
		cmd := fmt.Sprintf("sudo useradd -m -s %s %s", shell, request.Username)
		_, err = client.Run(cmd)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
			return
		}

		// Set password if provided
		if request.Password != "" {
			_, _ = client.Run(fmt.Sprintf("echo '%s:%s' | sudo chpasswd", request.Username, request.Password))
		}

		// Add to groups if provided
		if request.Groups != "" {
			_, _ = client.Run(fmt.Sprintf("sudo usermod -aG %s %s", request.Groups, request.Username))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}).Methods("POST")

	// Delete user
	r.HandleFunc("/api/machines/{id}/users/{username}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		username := vars["username"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		_, err = client.Run(fmt.Sprintf("sudo userdel -r %s 2>/dev/null || sudo userdel %s", username, username))
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("DELETE")

	// Get system info
	r.HandleFunc("/api/machines/{id}/system", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		info := map[string]interface{}{}

		if output, err := client.Run("hostname"); err == nil {
			info["hostname"] = strings.TrimSpace(string(output))
		}
		if output, err := client.Run("cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'"); err == nil {
			info["os"] = strings.TrimSpace(string(output))
		}
		if output, err := client.Run("uname -r"); err == nil {
			info["kernel"] = strings.TrimSpace(string(output))
		}
		if output, err := client.Run("uptime -p"); err == nil {
			info["uptime"] = strings.TrimSpace(string(output))
		}
		if output, err := client.Run("uname -m"); err == nil {
			info["arch"] = strings.TrimSpace(string(output))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(info)
	}).Methods("GET")

	// Set hostname
	r.HandleFunc("/api/machines/{id}/hostname", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		var request struct {
			Hostname string `json:"hostname"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		_, err = client.Run(fmt.Sprintf("sudo hostnamectl set-hostname %s", request.Hostname))
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Reboot
	r.HandleFunc("/api/machines/{id}/reboot", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		go func() {
			client.Run("sudo reboot")
		}()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Reboot initiated"})
	}).Methods("POST")

	// Shutdown
	r.HandleFunc("/api/machines/{id}/shutdown", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		go func() {
			client.Run("sudo shutdown -h now")
		}()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Shutdown initiated"})
	}).Methods("POST")
}
