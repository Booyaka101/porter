package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// DebugRequest is the request body for the debug endpoint
type DebugRequest struct {
	Message    string   `json:"message"`
	MachineIDs []string `json:"machine_ids,omitempty"`
	SessionID  string   `json:"session_id,omitempty"`
}

// DebugStep represents one investigation step
type DebugStep struct {
	Step    int    `json:"step"`
	Action  string `json:"action"`
	Command string `json:"command,omitempty"`
	Machine string `json:"machine,omitempty"`
	Output  string `json:"output,omitempty"`
	Error   string `json:"error,omitempty"`
}

// DebugResponse is the response from the debug endpoint
type DebugResponse struct {
	Summary   string      `json:"summary"`
	Steps     []DebugStep `json:"steps"`
	SessionID string      `json:"session_id"`
	Timestamp time.Time   `json:"timestamp"`
}

// serviceInfo parsed from live context
type serviceInfo struct {
	Name       string
	LogCommand string
	Type       string // "docker", "system", "user"
}

// debugCategory represents a type of investigation
type debugCategory string

const (
	catService  debugCategory = "service"
	catNetwork  debugCategory = "network"
	catDisk     debugCategory = "disk"
	catMemory   debugCategory = "memory"
	catCPU      debugCategory = "cpu"
	catDocker   debugCategory = "docker"
	catSecurity debugCategory = "security"
	catSystem   debugCategory = "system"
	catGeneral  debugCategory = "general"
)

// debugCmd is a command with a reason
type debugCmd struct {
	Command string
	Reason  string
	Sudo    bool
}

// detectCategories analyzes the user message and returns relevant diagnostic categories
func detectCategories(message string) []debugCategory {
	msg := strings.ToLower(message)
	var cats []debugCategory

	networkWords := []string{"network", "dns", "ping", "port", "connect", "firewall", "latency", "timeout", "unreachable", "refused", "route", "interface", "ip address", "bandwidth", "packet", "socket", "tcp", "udp", "http", "curl", "wget", "resolve", "nslookup", "iptables", "ufw", "nftables", "slow network", "can't connect", "connection"}
	for _, w := range networkWords {
		if strings.Contains(msg, w) {
			cats = append(cats, catNetwork)
			break
		}
	}

	diskWords := []string{"disk", "storage", "space", "full", "inode", "mount", "partition", "filesystem", "io", "i/o", "smart", "nvme", "ssd", "hdd", "fstab", "lvm", "raid", "no space", "df", "du", "block"}
	for _, w := range diskWords {
		if strings.Contains(msg, w) {
			cats = append(cats, catDisk)
			break
		}
	}

	memWords := []string{"memory", "ram", "swap", "oom", "out of memory", "leak", "cache", "buffer", "free", "available memory", "high memory"}
	for _, w := range memWords {
		if strings.Contains(msg, w) {
			cats = append(cats, catMemory)
			break
		}
	}

	cpuWords := []string{"cpu", "load", "slow", "performance", "process", "hang", "freeze", "unresponsive", "high load", "load average", "top", "htop", "thermal", "temperature", "throttl"}
	for _, w := range cpuWords {
		if strings.Contains(msg, w) {
			cats = append(cats, catCPU)
			break
		}
	}

	dockerWords := []string{"docker", "container", "compose", "image", "volume", "restart", "exited", "unhealthy container", "docker logs", "docker ps"}
	for _, w := range dockerWords {
		if strings.Contains(msg, w) {
			cats = append(cats, catDocker)
			break
		}
	}

	secWords := []string{"security", "ssh", "login", "auth", "fail2ban", "brute", "intrusion", "failed login", "permission denied", "unauthorized", "certificate", "ssl", "tls", "password", "locked out", "suspicious", "attack", "vulnerability", "update", "upgrade", "patch", "cve"}
	for _, w := range secWords {
		if strings.Contains(msg, w) {
			cats = append(cats, catSecurity)
			break
		}
	}

	sysWords := []string{"uptime", "reboot", "boot", "kernel", "systemd", "failed unit", "journal", "dmesg", "cron", "time", "ntp", "timezone", "hostname", "os version", "ubuntu version"}
	for _, w := range sysWords {
		if strings.Contains(msg, w) {
			cats = append(cats, catSystem)
			break
		}
	}

	if len(cats) == 0 {
		cats = append(cats, catGeneral)
	}

	return cats
}

// parseServicesFromContext extracts service names and their log commands from live context
func parseServicesFromContext(ctx string) []serviceInfo {
	var services []serviceInfo
	for _, line := range strings.Split(ctx, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || line == "RUNNING:" {
			continue
		}
		parts := strings.SplitN(line, " -> logs: ", 2)
		if len(parts) != 2 {
			continue
		}
		name := strings.TrimSpace(parts[0])
		logCmd := strings.TrimSpace(parts[1])
		svcType := "system"
		if strings.HasPrefix(logCmd, "docker logs") {
			svcType = "docker"
		} else if strings.Contains(logCmd, "--user") {
			svcType = "user"
		}
		services = append(services, serviceInfo{Name: name, LogCommand: logCmd, Type: svcType})
	}
	return services
}

// extractServiceName tries to find a service name mentioned in the user's message
func extractServiceName(message string, services []serviceInfo) *serviceInfo {
	msgLower := strings.ToLower(message)
	for i, svc := range services {
		if strings.Contains(msgLower, strings.ToLower(svc.Name)) {
			return &services[i]
		}
	}
	return nil
}

// buildServiceCommands generates commands for investigating a specific service
func buildServiceCommands(svc *serviceInfo) []debugCmd {
	var cmds []debugCmd

	cmds = append(cmds, debugCmd{svc.LogCommand, fmt.Sprintf("Get recent %s logs", svc.Name), false})

	switch svc.Type {
	case "docker":
		cmds = append(cmds, debugCmd{
			fmt.Sprintf("docker inspect --format '{{.State.Status}} started:{{.State.StartedAt}} restarts:{{.RestartCount}}' %s", svc.Name),
			fmt.Sprintf("Check %s container state and restart count", svc.Name), true})
		cmds = append(cmds, debugCmd{
			fmt.Sprintf("docker stats --no-stream --format 'CPU:{{.CPUPerc}} MEM:{{.MemUsage}} NET:{{.NetIO}} BLOCK:{{.BlockIO}}' %s", svc.Name),
			fmt.Sprintf("Check %s resource usage", svc.Name), true})
		cmds = append(cmds, debugCmd{
			fmt.Sprintf("docker logs %s --tail 50 2>&1 | grep -i -E 'error|fail|panic|fatal|exception|warn' | tail -20", svc.Name),
			fmt.Sprintf("Find errors in %s container logs", svc.Name), true})
	case "user":
		cmds = append(cmds, debugCmd{
			fmt.Sprintf("systemctl --user status %s", svc.Name),
			fmt.Sprintf("Check %s service status", svc.Name), false})
		cmds = append(cmds, debugCmd{
			fmt.Sprintf("journalctl --user -u %s --since '1 hour ago' --no-pager | grep -i -E 'error|fail|panic|fatal|exception' | tail -20", svc.Name),
			fmt.Sprintf("Find errors in %s logs", svc.Name), false})
	case "system":
		cmds = append(cmds, debugCmd{
			fmt.Sprintf("systemctl status %s", svc.Name),
			fmt.Sprintf("Check %s service status", svc.Name), true})
		cmds = append(cmds, debugCmd{
			fmt.Sprintf("journalctl -u %s --since '1 hour ago' --no-pager | grep -i -E 'error|fail|panic|fatal|exception' | tail -20", svc.Name),
			fmt.Sprintf("Find errors in %s logs", svc.Name), true})
	}
	return cmds
}

// buildNetworkCommands generates network diagnostic commands
func buildNetworkCommands() []debugCmd {
	return []debugCmd{
		{"ip -br addr", "List network interfaces and addresses", false},
		{"ip route show default", "Show default gateway and routes", false},
		{"cat /etc/resolv.conf", "Check DNS configuration", false},
		{"ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null", "List listening TCP ports", true},
		{"ss -s", "Show socket statistics summary", false},
		{"ping -c 3 -W 2 8.8.8.8 2>&1 | tail -5", "Test internet connectivity", false},
		{"ping -c 3 -W 2 google.com 2>&1 | tail -5", "Test DNS resolution", false},
		{"sudo ufw status 2>/dev/null || sudo iptables -L -n --line-numbers 2>/dev/null | head -30", "Check firewall rules", true},
	}
}

// buildDiskCommands generates disk/storage diagnostic commands
func buildDiskCommands() []debugCmd {
	return []debugCmd{
		{"df -h", "Check filesystem disk space usage", false},
		{"df -i | grep -v tmpfs", "Check inode usage", false},
		{"lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT,FSUSED%", "List block devices and usage", false},
		{"du -sh /var/log/ /tmp/ /var/cache/ 2>/dev/null", "Check common space consumers", true},
		{"find /var/log -name '*.log' -size +100M -exec ls -lh {} \\; 2>/dev/null | head -10", "Find large log files", true},
		{"iostat -x 1 2 2>/dev/null | tail -20 || cat /proc/diskstats | head -10", "Check disk I/O stats", false},
		{"cat /proc/mounts | grep -v -E 'tmpfs|cgroup|proc|sysfs|devpts'", "Show active mounts", false},
	}
}

// buildMemoryCommands generates memory diagnostic commands
func buildMemoryCommands() []debugCmd {
	return []debugCmd{
		{"free -h", "Check memory and swap usage", false},
		{"cat /proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree|Dirty|Writeback'", "Detailed memory info", false},
		{"ps aux --sort=-%mem | head -15", "Top memory-consuming processes", false},
		{"dmesg -T 2>/dev/null | grep -i -E 'oom|out of memory|killed process' | tail -10", "Check for OOM killer events", true},
		{"swapon --show 2>/dev/null", "Check swap devices", false},
		{"vmstat 1 3 2>/dev/null", "Virtual memory statistics", false},
	}
}

// buildCPUCommands generates CPU/load diagnostic commands
func buildCPUCommands() []debugCmd {
	return []debugCmd{
		{"uptime", "Check system load averages", false},
		{"nproc", "Number of CPU cores", false},
		{"ps aux --sort=-%cpu | head -15", "Top CPU-consuming processes", false},
		{"mpstat 1 2 2>/dev/null || cat /proc/stat | head -5", "CPU usage per core", false},
		{"cat /proc/loadavg", "Load average and running processes", false},
		{"dmesg -T 2>/dev/null | grep -i -E 'throttl|temperature|thermal' | tail -10", "Check thermal/throttling events", true},
		{"top -b -n1 | head -20", "System overview snapshot", false},
	}
}

// buildDockerCommands generates Docker-wide diagnostic commands
func buildDockerCommands() []debugCmd {
	return []debugCmd{
		{"docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null", "List all containers and their status", true},
		{"docker ps -a --filter 'status=exited' --format '{{.Names}} exited {{.Status}}' 2>/dev/null", "Show stopped/crashed containers", true},
		{"docker ps --filter 'health=unhealthy' --format '{{.Names}} {{.Status}}' 2>/dev/null", "Show unhealthy containers", true},
		{"docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' 2>/dev/null", "Container resource usage overview", true},
		{"docker system df 2>/dev/null", "Docker disk usage (images, containers, volumes)", true},
		{"docker network ls --format 'table {{.Name}}\t{{.Driver}}\t{{.Scope}}' 2>/dev/null", "List Docker networks", true},
		{"docker volume ls --format 'table {{.Name}}\t{{.Driver}}' 2>/dev/null | head -20", "List Docker volumes", true},
	}
}

// buildSecurityCommands generates security diagnostic commands
func buildSecurityCommands() []debugCmd {
	return []debugCmd{
		{"lastlog 2>/dev/null | grep -v 'Never' | head -20", "Recent user logins", true},
		{"last -n 15 2>/dev/null", "Last 15 login sessions", false},
		{"grep 'Failed password' /var/log/auth.log 2>/dev/null | tail -15 || journalctl -u ssh --since '24 hours ago' --no-pager 2>/dev/null | grep -i -E 'failed|invalid' | tail -15", "Failed SSH login attempts", true},
		{"sudo ufw status verbose 2>/dev/null || sudo iptables -L -n 2>/dev/null | head -30", "Firewall status and rules", true},
		{"ss -tlnp 2>/dev/null | grep -v -E '127.0.0.1|::1'", "Externally listening ports", true},
		{"apt list --upgradable 2>/dev/null | head -20", "Available security updates", false},
		{"cat /etc/ssh/sshd_config 2>/dev/null | grep -i -E 'PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|Port ' | grep -v '^#'", "SSH configuration", true},
		{"who", "Currently logged in users", false},
		{"sudo fail2ban-client status 2>/dev/null || echo 'fail2ban not installed'", "Fail2ban status", true},
	}
}

// buildSystemCommands generates general system diagnostic commands
func buildSystemCommands() []debugCmd {
	return []debugCmd{
		{"uptime", "System uptime and load", false},
		{"lsb_release -a 2>/dev/null || cat /etc/os-release", "OS version info", false},
		{"uname -r", "Kernel version", false},
		{"systemctl --failed 2>/dev/null", "Failed systemd units", true},
		{"systemctl --user --failed 2>/dev/null", "Failed user systemd units", false},
		{"timedatectl 2>/dev/null", "Time and NTP sync status", false},
		{"dmesg -T 2>/dev/null | tail -20", "Recent kernel messages", true},
		{"journalctl -p err --since '24 hours ago' --no-pager 2>/dev/null | tail -20", "System errors in last 24h", true},
		{"last reboot | head -5", "Recent reboot history", false},
	}
}

// buildGeneralCommands generates a broad health overview
func buildGeneralCommands() []debugCmd {
	return []debugCmd{
		{"uptime", "System uptime and load", false},
		{"free -h", "Memory and swap usage", false},
		{"df -h / /home 2>/dev/null", "Disk usage on key partitions", false},
		{"systemctl --failed 2>/dev/null", "Failed systemd units", true},
		{"systemctl --user --failed 2>/dev/null", "Failed user systemd units", false},
		{"docker ps -a --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | head -20", "Docker container status", true},
		{"ps aux --sort=-%cpu | head -10", "Top CPU processes", false},
		{"journalctl -p err --since '1 hour ago' --no-pager 2>/dev/null | tail -15", "Recent system errors", true},
		{"dmesg -T 2>/dev/null | grep -i -E 'error|fail|oom|panic' | tail -10", "Recent kernel errors", true},
	}
}

// buildDebugCommands generates investigation commands based on categories and optional service target
func buildDebugCommands(categories []debugCategory, targetService *serviceInfo) []debugCmd {
	var cmds []debugCmd
	seen := make(map[string]bool)

	addUnique := func(newCmds []debugCmd) {
		for _, c := range newCmds {
			if !seen[c.Command] {
				seen[c.Command] = true
				cmds = append(cmds, c)
			}
		}
	}

	if targetService != nil {
		addUnique(buildServiceCommands(targetService))
	}

	for _, cat := range categories {
		switch cat {
		case catNetwork:
			addUnique(buildNetworkCommands())
		case catDisk:
			addUnique(buildDiskCommands())
		case catMemory:
			addUnique(buildMemoryCommands())
		case catCPU:
			addUnique(buildCPUCommands())
		case catDocker:
			addUnique(buildDockerCommands())
		case catSecurity:
			addUnique(buildSecurityCommands())
		case catSystem:
			addUnique(buildSystemCommands())
		case catGeneral:
			addUnique(buildGeneralCommands())
		case catService:
			// already handled above
		}
	}

	return cmds
}

// cleanCommandOutput removes noise from command output
func cleanCommandOutput(output string) string {
	if idx := strings.LastIndex(output, "EXIT_CODE:"); idx != -1 {
		output = strings.TrimSpace(output[:idx])
	}
	if idx := strings.Index(output, "[sudo] password for"); idx != -1 {
		if nl := strings.Index(output[idx:], "\n"); nl != -1 {
			output = strings.TrimSpace(output[idx+nl:])
		}
	}
	if len(output) > 3000 {
		output = output[len(output)-3000:]
	}
	return output
}

// buildAnalysisPrompt creates the prompt for analyzing collected data
func buildAnalysisPrompt() string {
	return `Analyze these debug results from a remote machine. Be concise and specific.
Do NOT include any IP addresses, machine IDs, or hostnames in your response.
Refer to machines only by their display name if needed.

Format:

**Status**: healthy / warning / unhealthy
**Issues**: list specific problems found (quote relevant log lines)
**Cause**: likely root cause based on evidence
**Fix**: concrete recommended actions

If everything looks normal, say the system appears healthy and mention key metrics.`
}

// AIAgentDebugRoutes sets up the debug endpoint
func AIAgentDebugRoutes(r *mux.Router) {
	r.HandleFunc("/api/ai-agent/debug", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		config := GetAIAgentConfig()
		if config == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "AI Agent not configured",
			})
			return
		}

		var debugReq DebugRequest
		if err := json.NewDecoder(req.Body).Decode(&debugReq); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		allMachines := machineRepo.List()

		// Resolve target machines
		var targetMachines []*Machine
		seen := make(map[string]bool)
		if len(debugReq.MachineIDs) > 0 {
			for _, id := range debugReq.MachineIDs {
				if m, ok := machineRepo.Get(id); ok && !seen[m.ID] {
					targetMachines = append(targetMachines, m)
					seen[m.ID] = true
				}
			}
		}
		mentioned := resolveMachinesFromMessage(debugReq.Message, allMachines)
		for _, m := range mentioned {
			if !seen[m.ID] {
				targetMachines = append(targetMachines, m)
				seen[m.ID] = true
			}
		}
		if len(targetMachines) == 0 {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "No target machines identified. Select machines or mention a machine name.",
			})
			return
		}

		// Detect investigation categories from the message
		categories := detectCategories(debugReq.Message)

		// Gather live context (fast, cached)
		liveContext := gatherContextForMachines(targetMachines)

		// Build investigation commands
		type machineCmd struct {
			Machine *Machine
			Command string
			Reason  string
			Sudo    bool
		}
		var allCmds []machineCmd

		for _, m := range targetMachines {
			ctx := liveContext[m.ID]
			services := parseServicesFromContext(ctx)
			targetSvc := extractServiceName(debugReq.Message, services)

			cmds := buildDebugCommands(categories, targetSvc)
			for _, cmd := range cmds {
				allCmds = append(allCmds, machineCmd{Machine: m, Command: cmd.Command, Reason: cmd.Reason, Sudo: cmd.Sudo})
			}
		}

		if len(allCmds) == 0 {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Could not determine what to investigate. Please be more specific.",
			})
			return
		}

		// Execute commands concurrently
		steps := make([]DebugStep, len(allCmds))
		var wg sync.WaitGroup

		for i, mc := range allCmds {
			steps[i] = DebugStep{
				Step:    i + 1,
				Action:  mc.Reason,
				Command: mc.Command,
				Machine: mc.Machine.Name,
			}
			wg.Add(1)
			go func(idx int, m *Machine, cmd string, sudo bool) {
				defer wg.Done()
				useSudo := sudo && !strings.Contains(cmd, "--user")
				result := runCommandOnMachine(m, cmd, useSudo)
				steps[idx].Output = cleanCommandOutput(result.Output)
				if !result.Success {
					steps[idx].Error = result.Error
				}
			}(i, mc.Machine, mc.Command, mc.Sudo)
		}

		// Wait with timeout
		done := make(chan struct{})
		go func() { wg.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(45 * time.Second):
		}

		// Build investigation log and send to LLM for analysis
		var investigationLog strings.Builder
		investigationLog.WriteString(fmt.Sprintf("Investigation: %s\nCategories: %v\n\n", debugReq.Message, categories))
		for _, step := range steps {
			investigationLog.WriteString(fmt.Sprintf("--- %s [%s] ---\n$ %s\n%s\n\n",
				step.Action, step.Machine, step.Command, step.Output))
		}

		analysisMessages := []ChatMessage{
			{Role: "system", Content: buildAnalysisPrompt()},
			{Role: "user", Content: investigationLog.String()},
		}

		summary, _, err := callLLM(config, analysisMessages)
		if err != nil {
			summary = "Analysis failed: " + err.Error()
		}

		json.NewEncoder(w).Encode(DebugResponse{
			Summary:   summary,
			Steps:     steps,
			SessionID: debugReq.SessionID,
			Timestamp: time.Now(),
		})
	}).Methods("POST")
}
