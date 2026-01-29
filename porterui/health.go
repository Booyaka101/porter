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

// MachineHealth represents the health status of a machine
type MachineHealth struct {
	MachineID     string    `json:"machine_id"`
	MachineName   string    `json:"machine_name"`
	IP            string    `json:"ip"`
	Online        bool      `json:"online"`
	LastChecked   time.Time `json:"last_checked"`
	LastOnline    time.Time `json:"last_online,omitempty"`
	LastExecution time.Time `json:"last_execution,omitempty"`
	ResponseTime  int64     `json:"response_time_ms"`
	Error         string    `json:"error,omitempty"`
	// Basic stats
	Uptime      string `json:"uptime,omitempty"`
	LoadAvg     string `json:"load_avg,omitempty"`
	DiskUsage   string `json:"disk_usage,omitempty"`
	MemoryUsage string `json:"memory_usage,omitempty"`
	// Extended stats
	CPUUsage      string `json:"cpu_usage,omitempty"`
	CPUCores      string `json:"cpu_cores,omitempty"`
	CPUModel      string `json:"cpu_model,omitempty"`
	MemoryTotal   string `json:"memory_total,omitempty"`
	MemoryFree    string `json:"memory_free,omitempty"`
	SwapUsage     string `json:"swap_usage,omitempty"`
	DiskTotal     string `json:"disk_total,omitempty"`
	DiskFree      string `json:"disk_free,omitempty"`
	ProcessCount  string `json:"process_count,omitempty"`
	LoggedUsers   string `json:"logged_users,omitempty"`
	Hostname      string `json:"hostname,omitempty"`
	KernelVersion string `json:"kernel_version,omitempty"`
	OSInfo        string `json:"os_info,omitempty"`
	NetworkRX     string `json:"network_rx,omitempty"`
	NetworkTX     string `json:"network_tx,omitempty"`
}

// HealthStore manages machine health status
type HealthStore struct {
	mu     sync.RWMutex
	status map[string]*MachineHealth
}

var healthStore = &HealthStore{
	status: make(map[string]*MachineHealth),
}

// HealthCheckManifest returns the Porter manifest for health checks
func HealthCheckManifest() []porter.Task {
	return porter.Tasks(
		// Basic stats
		porter.Capture("uptime -p 2>/dev/null || uptime").
			Name("Get Uptime").
			Register("uptime").
			Ignore(),
		porter.Capture("cat /proc/loadavg | awk '{print $1, $2, $3}'").
			Name("Get Load Average").
			Register("load").
			Ignore(),
		porter.Capture("df -h / | tail -1 | awk '{print $5}'").
			Name("Get Disk Usage").
			Register("disk").
			Ignore(),
		porter.Capture("free -m | awk 'NR==2{printf \"%.1f%%\", $3*100/$2}'").
			Name("Get Memory Usage").
			Register("memory").
			Ignore(),
		// Extended stats
		porter.Capture("top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}' | xargs printf '%.1f%%'").
			Name("Get CPU Usage").
			Register("cpu_usage").
			Ignore(),
		porter.Capture("nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo").
			Name("Get CPU Cores").
			Register("cpu_cores").
			Ignore(),
		porter.Capture("cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2 | xargs").
			Name("Get CPU Model").
			Register("cpu_model").
			Ignore(),
		porter.Capture("free -h | awk 'NR==2{print $2}'").
			Name("Get Memory Total").
			Register("mem_total").
			Ignore(),
		porter.Capture("free -h | awk 'NR==2{print $4}'").
			Name("Get Memory Free").
			Register("mem_free").
			Ignore(),
		porter.Capture("free -m | awk 'NR==3{if($2>0) printf \"%.1f%%\", $3*100/$2; else print \"0%\"}'").
			Name("Get Swap Usage").
			Register("swap").
			Ignore(),
		porter.Capture("df -h / | tail -1 | awk '{print $2}'").
			Name("Get Disk Total").
			Register("disk_total").
			Ignore(),
		porter.Capture("df -h / | tail -1 | awk '{print $4}'").
			Name("Get Disk Free").
			Register("disk_free").
			Ignore(),
		porter.Capture("ps aux | wc -l").
			Name("Get Process Count").
			Register("proc_count").
			Ignore(),
		porter.Capture("who | wc -l").
			Name("Get Logged Users").
			Register("users").
			Ignore(),
		porter.Capture("hostname").
			Name("Get Hostname").
			Register("hostname").
			Ignore(),
		porter.Capture("uname -r").
			Name("Get Kernel Version").
			Register("kernel").
			Ignore(),
		porter.Capture("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"' || uname -s").
			Name("Get OS Info").
			Register("os_info").
			Ignore(),
		porter.Capture("cat /proc/net/dev | awk 'NR>2{rx+=$2; tx+=$10} END{printf \"%.1f GB\", rx/1024/1024/1024}'").
			Name("Get Network RX").
			Register("net_rx").
			Ignore(),
		porter.Capture("cat /proc/net/dev | awk 'NR>2{rx+=$2; tx+=$10} END{printf \"%.1f GB\", tx/1024/1024/1024}'").
			Name("Get Network TX").
			Register("net_tx").
			Ignore(),
	)
}

// CheckMachineHealth checks if a machine is reachable and gets basic stats
func CheckMachineHealth(m *Machine) *MachineHealth {
	log := Log().WithField("machine", m.ID).WithField("ip", m.IP)
	log.Debug("Health check started")

	health := &MachineHealth{
		MachineID:   m.ID,
		MachineName: m.Name,
		IP:          m.IP,
		LastChecked: time.Now(),
	}

	start := time.Now()

	// Connect to machine
	client, err := porter.Connect(m.IP, porter.DefaultConfig(m.Username, m.Password))
	if err != nil {
		health.Online = false
		health.Error = fmt.Sprintf("Connection failed: %v", err)
		health.ResponseTime = time.Since(start).Milliseconds()
		log.WithField("error", err.Error()).Warn("Health check failed - connection error")
		return health
	}
	defer client.Close()

	health.Online = true
	health.LastOnline = time.Now()
	health.ResponseTime = time.Since(start).Milliseconds()

	log.WithField("response_time_ms", health.ResponseTime).Debug("Machine online, collecting stats")

	// Execute health check manifest
	executor := porter.NewExecutor(client, m.Password)
	vars := porter.NewVars()
	executor.Run("Health Check", HealthCheckManifest(), vars)

	// Extract results from variables - Basic stats
	if uptime := vars.Get("uptime"); uptime != "" {
		health.Uptime = uptime
	}
	if load := vars.Get("load"); load != "" {
		health.LoadAvg = load
	}
	if disk := vars.Get("disk"); disk != "" {
		health.DiskUsage = disk
	}
	if mem := vars.Get("memory"); mem != "" {
		health.MemoryUsage = mem
	}

	// Extended stats
	if cpuUsage := vars.Get("cpu_usage"); cpuUsage != "" {
		health.CPUUsage = cpuUsage
	}
	if cpuCores := vars.Get("cpu_cores"); cpuCores != "" {
		health.CPUCores = cpuCores
	}
	if cpuModel := vars.Get("cpu_model"); cpuModel != "" {
		health.CPUModel = cpuModel
	}
	if memTotal := vars.Get("mem_total"); memTotal != "" {
		health.MemoryTotal = memTotal
	}
	if memFree := vars.Get("mem_free"); memFree != "" {
		health.MemoryFree = memFree
	}
	if swap := vars.Get("swap"); swap != "" {
		health.SwapUsage = swap
	}
	if diskTotal := vars.Get("disk_total"); diskTotal != "" {
		health.DiskTotal = diskTotal
	}
	if diskFree := vars.Get("disk_free"); diskFree != "" {
		health.DiskFree = diskFree
	}
	if procCount := vars.Get("proc_count"); procCount != "" {
		health.ProcessCount = procCount
	}
	if users := vars.Get("users"); users != "" {
		health.LoggedUsers = users
	}
	if hostname := vars.Get("hostname"); hostname != "" {
		health.Hostname = hostname
	}
	if kernel := vars.Get("kernel"); kernel != "" {
		health.KernelVersion = kernel
	}
	if osInfo := vars.Get("os_info"); osInfo != "" {
		health.OSInfo = osInfo
	}
	if netRx := vars.Get("net_rx"); netRx != "" {
		health.NetworkRX = netRx
	}
	if netTx := vars.Get("net_tx"); netTx != "" {
		health.NetworkTX = netTx
	}

	return health
}

// UpdateHealth updates the health status for a machine
func (h *HealthStore) Update(health *MachineHealth) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.status[health.MachineID] = health
}

// GetHealth returns health status for a machine
func (h *HealthStore) Get(machineID string) *MachineHealth {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.status[machineID]
}

// GetAll returns all health statuses
func (h *HealthStore) GetAll() map[string]*MachineHealth {
	h.mu.RLock()
	defer h.mu.RUnlock()

	result := make(map[string]*MachineHealth)
	for k, v := range h.status {
		result[k] = v
	}
	return result
}

// GetAggregateStats returns aggregate statistics across all online machines
func (h *HealthStore) GetAggregateStats() map[string]interface{} {
	h.mu.RLock()
	defer h.mu.RUnlock()

	online := 0
	offline := 0
	var totalCPU, totalMem, totalDisk float64
	cpuCount, memCount, diskCount := 0, 0, 0

	for _, health := range h.status {
		if health.Online {
			online++
			if health.CPUUsage != "" {
				var cpu float64
				fmt.Sscanf(strings.TrimSuffix(health.CPUUsage, "%"), "%f", &cpu)
				totalCPU += cpu
				cpuCount++
			}
			if health.MemoryUsage != "" {
				var mem float64
				fmt.Sscanf(strings.TrimSuffix(health.MemoryUsage, "%"), "%f", &mem)
				totalMem += mem
				memCount++
			}
			if health.DiskUsage != "" {
				var disk float64
				fmt.Sscanf(strings.TrimSuffix(health.DiskUsage, "%"), "%f", &disk)
				totalDisk += disk
				diskCount++
			}
		} else {
			offline++
		}
	}

	avgCPU, avgMem, avgDisk := 0.0, 0.0, 0.0
	if cpuCount > 0 {
		avgCPU = totalCPU / float64(cpuCount)
	}
	if memCount > 0 {
		avgMem = totalMem / float64(memCount)
	}
	if diskCount > 0 {
		avgDisk = totalDisk / float64(diskCount)
	}

	return map[string]interface{}{
		"online":       online,
		"offline":      offline,
		"total":        online + offline,
		"avg_cpu":      fmt.Sprintf("%.1f%%", avgCPU),
		"avg_memory":   fmt.Sprintf("%.1f%%", avgMem),
		"avg_disk":     fmt.Sprintf("%.1f%%", avgDisk),
		"cpu_warning":  avgCPU > 80,
		"mem_warning":  avgMem > 85,
		"disk_warning": avgDisk > 90,
	}
}

// CheckAllMachines checks health of all machines concurrently
func CheckAllMachines(machines []*Machine) map[string]*MachineHealth {
	var wg sync.WaitGroup
	results := make(map[string]*MachineHealth)
	var mu sync.Mutex

	for _, m := range machines {
		wg.Add(1)
		go func(machine *Machine) {
			defer wg.Done()
			health := CheckMachineHealth(machine)
			mu.Lock()
			results[machine.ID] = health
			healthStore.Update(health)
			mu.Unlock()
		}(m)
	}

	wg.Wait()
	return results
}

// HealthPollerConfig holds configuration for background health polling
type HealthPollerConfig struct {
	Enabled      bool `json:"enabled"`
	IntervalMins int  `json:"interval_mins"` // How often to poll all machines
	DelayBetween int  `json:"delay_between"` // Seconds between each machine check
	TimeoutSecs  int  `json:"timeout_secs"`  // Timeout for each check
}

var (
	healthPollerRunning bool
	healthPollerStop    chan struct{}
	healthPollerConfig  = HealthPollerConfig{
		Enabled:      true,
		IntervalMins: 5,  // Check all machines every 5 minutes
		DelayBetween: 2,  // 2 seconds between each machine
		TimeoutSecs:  10, // 10 second timeout per machine
	}
)

// StartHealthPoller starts the background health polling goroutine
func StartHealthPoller() {
	if healthPollerRunning || !healthPollerConfig.Enabled {
		return
	}

	healthPollerStop = make(chan struct{})
	healthPollerRunning = true

	go func() {
		// Initial check after 30 seconds
		select {
		case <-time.After(30 * time.Second):
		case <-healthPollerStop:
			return
		}

		ticker := time.NewTicker(time.Duration(healthPollerConfig.IntervalMins) * time.Minute)
		defer ticker.Stop()

		// Run initial check
		runHealthPoll()

		for {
			select {
			case <-ticker.C:
				runHealthPoll()
			case <-healthPollerStop:
				healthPollerRunning = false
				return
			}
		}
	}()
}

// StopHealthPoller stops the background health polling
func StopHealthPoller() {
	if healthPollerRunning && healthPollerStop != nil {
		close(healthPollerStop)
	}
}

// runHealthPoll checks all machines sequentially with delays
func runHealthPoll() {
	machines, err := LoadMachines()
	if err != nil {
		return
	}

	delay := time.Duration(healthPollerConfig.DelayBetween) * time.Second

	for i := range machines {
		// Check if we should stop
		select {
		case <-healthPollerStop:
			return
		default:
		}

		// Decrypt password for health check
		password := GetDecryptedPassword(&machines[i])
		machineWithPassword := machines[i]
		machineWithPassword.Password = password

		// Run health check
		health := CheckMachineHealth(&machineWithPassword)
		healthStore.Update(health)

		// Update machine status based on health
		if health.Online {
			machines[i].Status = "online"
		} else {
			machines[i].Status = "offline"
		}

		// Delay before next machine (except for last one)
		if i < len(machines)-1 {
			select {
			case <-time.After(delay):
			case <-healthPollerStop:
				return
			}
		}
	}
}

// fetchHealthFromAgent fetches health metrics from a standalone agent via WebSocket manager
func fetchHealthFromAgent(machine *Machine) *MachineHealth {
	// Check if we have cached metrics from the WebSocket connection
	standaloneAgentManager.mu.RLock()
	conn, exists := standaloneAgentManager.connections[machine.ID]
	standaloneAgentManager.mu.RUnlock()

	if !exists || conn == nil {
		return nil
	}

	// Check if metrics are recent (within 30 seconds)
	if time.Since(conn.LastSeen) > 30*time.Second {
		return nil
	}

	metrics := conn.Metrics

	// Convert agent metrics to MachineHealth format
	health := &MachineHealth{
		MachineID:     machine.ID,
		MachineName:   machine.Name,
		IP:            machine.IP,
		Online:        true,
		LastChecked:   time.Now(),
		LastOnline:    time.Now(),
		ResponseTime:  0,
		Uptime:        metrics.Uptime,
		LoadAvg:       metrics.LoadAverage,
		CPUUsage:      fmt.Sprintf("%.1f%%", metrics.CPUUsage),
		CPUCores:      fmt.Sprintf("%d", metrics.CPUCores),
		CPUModel:      metrics.CPUModel,
		MemoryUsage:   fmt.Sprintf("%.1f%%", metrics.MemoryUsage),
		MemoryTotal:   metrics.MemoryTotal,
		MemoryFree:    metrics.MemoryUsed,
		DiskUsage:     fmt.Sprintf("%.1f%%", metrics.DiskUsage),
		DiskTotal:     metrics.DiskTotal,
		DiskFree:      metrics.DiskUsed,
		ProcessCount:  fmt.Sprintf("%d", metrics.ProcessCount),
		LoggedUsers:   fmt.Sprintf("%d", len(metrics.LoggedInUsers)),
		Hostname:      metrics.Hostname,
		KernelVersion: metrics.KernelVersion,
		OSInfo:        metrics.OSInfo,
		NetworkRX:     metrics.NetworkRX,
		NetworkTX:     metrics.NetworkTX,
	}

	return health
}

// HealthRoutes sets up health check API routes
func HealthRoutes(r *mux.Router) {
	// Get health of a specific machine by machine ID (for MachineView)
	r.HandleFunc("/api/machines/{id}/health", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)
		machineID := vars["id"]

		// Get machine
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Check if machine has an agent and try to fetch from it first
		if machine.HasAgent && machine.AgentPort > 0 {
			health := fetchHealthFromAgent(machine)
			if health != nil {
				healthStore.Update(health)
				json.NewEncoder(w).Encode(health)
				return
			}
		}

		// Check if we have recent cached health (within 30 seconds for non-agent)
		cached := healthStore.Get(machineID)
		if cached != nil && time.Since(cached.LastChecked) < 30*time.Second {
			json.NewEncoder(w).Encode(cached)
			return
		}

		// Fall back to SSH-based health check
		password := GetDecryptedPassword(machine)
		machineWithPassword := *machine
		machineWithPassword.Password = password

		health := CheckMachineHealth(&machineWithPassword)
		healthStore.Update(health)
		json.NewEncoder(w).Encode(health)
	}).Methods("GET")

	// Check health of all machines
	r.HandleFunc("/api/health", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		machines, err := LoadMachines()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Convert to pointer slice
		var machinesPtrs []*Machine
		for i := range machines {
			machinesPtrs = append(machinesPtrs, &machines[i])
		}

		results := CheckAllMachines(machinesPtrs)
		json.NewEncoder(w).Encode(results)
	}).Methods("GET")

	// Get cached health status (no new check) - must be before {id} route
	r.HandleFunc("/api/health/cached", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(healthStore.GetAll())
	}).Methods("GET")

	// Get health summary - must be before {id} route
	r.HandleFunc("/api/health/summary", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		all := healthStore.GetAll()
		online := 0
		offline := 0
		unknown := 0

		machines, _ := LoadMachines()
		totalMachines := len(machines)

		for _, h := range all {
			if h.Online {
				online++
			} else {
				offline++
			}
		}
		unknown = totalMachines - online - offline

		json.NewEncoder(w).Encode(map[string]interface{}{
			"total":   totalMachines,
			"online":  online,
			"offline": offline,
			"unknown": unknown,
		})
	}).Methods("GET")

	// Get aggregate fleet stats - must be before {id} route
	r.HandleFunc("/api/health/aggregate", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(healthStore.GetAggregateStats())
	}).Methods("GET")

	// Check health of a single machine - parameterized route must be last
	r.HandleFunc("/api/health/{id}", func(w http.ResponseWriter, req *http.Request) {
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

		health := CheckMachineHealth(machine)
		healthStore.Update(health)
		json.NewEncoder(w).Encode(health)
	}).Methods("GET")

	// Get health poller config
	r.HandleFunc("/api/health/poller/config", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"enabled":       healthPollerConfig.Enabled,
			"interval_mins": healthPollerConfig.IntervalMins,
			"delay_between": healthPollerConfig.DelayBetween,
			"timeout_secs":  healthPollerConfig.TimeoutSecs,
			"running":       healthPollerRunning,
		})
	}).Methods("GET")

	// Update health poller config
	r.HandleFunc("/api/health/poller/config", func(w http.ResponseWriter, req *http.Request) {
		var config HealthPollerConfig
		if err := json.NewDecoder(req.Body).Decode(&config); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Update config
		healthPollerConfig = config

		// Restart poller if needed
		if config.Enabled && !healthPollerRunning {
			StartHealthPoller()
		} else if !config.Enabled && healthPollerRunning {
			StopHealthPoller()
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Health poller config updated",
		})
	}).Methods("PUT")

	// Trigger immediate health poll
	r.HandleFunc("/api/health/poller/run", func(w http.ResponseWriter, req *http.Request) {
		go runHealthPoll()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Health poll started",
		})
	}).Methods("POST")
}
