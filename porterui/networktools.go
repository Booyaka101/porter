package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// NetworkToolsRoutes sets up network diagnostic API routes
func NetworkToolsRoutes(r *mux.Router) {
	// Ping from machine - uses Porter's Capture task
	r.HandleFunc("/api/machines/{id}/network/ping", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var reqBody struct {
			Target string `json:"target"`
			Count  int    `json:"count"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if reqBody.Count <= 0 || reqBody.Count > 10 {
			reqBody.Count = 4
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

		// Use Porter's Capture task for ping
		tasks := porter.Tasks(
			porter.Capture(fmt.Sprintf("ping -c %d %s 2>&1", reqBody.Count, reqBody.Target)).
				Name("Ping target").
				Register("ping_result"),
		)

		vars := porter.NewVars()
		vars.Set("target", reqBody.Target)

		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)
		executor.Run("Network Ping", tasks, vars)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"output":  vars.Get("ping_result"),
		})
	}).Methods("POST")

	// Traceroute from machine - uses Porter's Capture task
	r.HandleFunc("/api/machines/{id}/network/traceroute", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var reqBody struct {
			Target string `json:"target"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
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

		// Use Porter's Capture task for traceroute
		tasks := porter.Tasks(
			porter.Capture(fmt.Sprintf("traceroute -m 20 %s 2>&1 || tracepath %s 2>&1", reqBody.Target, reqBody.Target)).
				Name("Traceroute to target").
				Register("traceroute_result"),
		)

		vars := porter.NewVars()
		vars.Set("target", reqBody.Target)

		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)
		executor.Run("Network Traceroute", tasks, vars)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"output":  vars.Get("traceroute_result"),
		})
	}).Methods("POST")

	// Port scan (basic) - uses Porter's task loop
	r.HandleFunc("/api/machines/{id}/network/portscan", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var reqBody struct {
			Target string `json:"target"`
			Ports  string `json:"ports"` // e.g., "22,80,443" or "1-1000"
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if reqBody.Ports == "" {
			reqBody.Ports = "22,80,443,3306,5432,6379,8080,8443"
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

		// Use Porter's Capture task for each port scan
		ports := strings.Split(reqBody.Ports, ",")
		var results []map[string]interface{}

		vars := porter.NewVars()
		vars.Set("target", reqBody.Target)

		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)

		for _, port := range ports {
			port = strings.TrimSpace(port)
			portNum, _ := strconv.Atoi(port)

			tasks := porter.Tasks(
				porter.Capture(fmt.Sprintf("timeout 2 bash -c 'echo > /dev/tcp/%s/%s' 2>/dev/null && echo 'open' || echo 'closed'", reqBody.Target, port)).
					Name(fmt.Sprintf("Scan port %s", port)).
					Register("port_status").
					Ignore(),
			)

			executor.Run(fmt.Sprintf("Port Scan: %s", port), tasks, vars)
			status := strings.TrimSpace(vars.Get("port_status"))

			results = append(results, map[string]interface{}{
				"port":   portNum,
				"status": status,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"results": results,
		})
	}).Methods("POST")

	// DNS lookup - uses Porter's Capture task
	r.HandleFunc("/api/machines/{id}/network/dns", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var reqBody struct {
			Domain string `json:"domain"`
			Type   string `json:"type"` // A, AAAA, MX, NS, TXT, etc.
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if reqBody.Type == "" {
			reqBody.Type = "A"
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

		// Use Porter's Capture task for DNS lookup
		tasks := porter.Tasks(
			porter.Capture(fmt.Sprintf("dig +short %s %s 2>&1 || nslookup %s 2>&1", reqBody.Type, reqBody.Domain, reqBody.Domain)).
				Name("DNS Lookup").
				Register("dns_result"),
		)

		vars := porter.NewVars()
		vars.Set("domain", reqBody.Domain)
		vars.Set("type", reqBody.Type)

		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)
		executor.Run("DNS Lookup", tasks, vars)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"output":  vars.Get("dns_result"),
		})
	}).Methods("POST")

	// Network interfaces info - uses Porter's Capture task
	r.HandleFunc("/api/machines/{id}/network/interfaces", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
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

		// Use Porter's Capture task for network interfaces
		tasks := porter.Tasks(
			porter.Capture("ip -j addr show 2>/dev/null || ip addr show").
				Name("Get network interfaces").
				Register("interfaces"),
		)

		vars := porter.NewVars()
		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)
		executor.Run("Network Interfaces", tasks, vars)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"output":  vars.Get("interfaces"),
		})
	}).Methods("GET")

	// Network connections - uses Porter's Capture task
	r.HandleFunc("/api/machines/{id}/network/connections", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
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

		// Use Porter's Capture task for network connections
		tasks := porter.Tasks(
			porter.Capture("ss -tuln 2>/dev/null || netstat -tuln").
				Name("Get network connections").
				Register("connections"),
		)

		vars := porter.NewVars()
		executor := porter.NewExecutor(client, password)
		executor.SetVerbose(false)
		executor.Run("Network Connections", tasks, vars)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"output":  vars.Get("connections"),
		})
	}).Methods("GET")
}
