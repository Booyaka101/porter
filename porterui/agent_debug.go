package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
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

// isReadOnlyCommand checks if a command is safe to auto-execute (no mutations)
func isReadOnlyCommand(cmd string) bool {
	readOnlyPrefixes := []string{
		"journalctl", "systemctl status", "systemctl --user status",
		"systemctl list-units", "systemctl --user list-units",
		"docker logs", "docker ps", "docker inspect", "docker stats",
		"cat ", "head ", "tail ", "grep ", "less ", "more ",
		"ls ", "find ", "stat ", "file ", "wc ",
		"top -b", "free ", "df ", "uptime", "uname",
		"ps ", "pgrep ", "pidof ",
		"ip addr", "ip route", "ss ", "netstat ", "ping ",
		"curl -s", "wget -q",
		"date", "hostname", "whoami", "id ",
		"du ", "lsof ", "dmesg",
	}
	trimmed := strings.TrimSpace(cmd)
	for _, prefix := range readOnlyPrefixes {
		if strings.HasPrefix(trimmed, prefix) {
			return true
		}
	}
	return false
}

// debugInvestigate is a single-pass JSON list response from the LLM
type debugCommand struct {
	Command   string `json:"command"`
	MachineID string `json:"machine_id"`
	Reason    string `json:"reason"`
}

// buildDebugPrompt creates the system prompt for debug mode
func buildDebugPrompt(config *AIAgentConfig, machines []*Machine, liveContext map[string]string) string {
	var sb strings.Builder

	sb.WriteString(`You are Porter AI in DEBUG MODE. You investigate infrastructure issues.

Given the user's problem and LIVE STATUS below, output a JSON array of commands to investigate.
Each command object has: command, machine_id, reason.

Pick the EXACT log command from LIVE STATUS. Also check:
- Service status: systemctl status <name> OR systemctl --user status <name>
- Recent errors in logs (use grep -i error or grep -i fail)
- Resource usage: free -h; df -h
- Process state: ps aux | grep <name>

Output ONLY a JSON array. Example:
[
  {"command":"journalctl --user -u trendboard -n 200 --no-pager","machine_id":"machine-123","reason":"Get recent trendboard logs"},
  {"command":"systemctl --user status trendboard","machine_id":"machine-123","reason":"Check service status"},
  {"command":"free -h; df -h","machine_id":"machine-123","reason":"Check system resources"}
]

`)

	// Add machines with live context
	if len(machines) > 0 {
		sb.WriteString("MACHINES AND LIVE STATUS:\n")
		for _, m := range machines {
			status := m.Status
			if status == "" {
				status = "unknown"
			}
			sb.WriteString(fmt.Sprintf("\n[%s] IP:%s ID:%s Status:%s\n", m.Name, m.IP, m.ID, status))
			if ctx, ok := liveContext[m.ID]; ok && ctx != "" {
				sb.WriteString(ctx)
				sb.WriteString("\n")
			}
		}
	}

	return sb.String()
}

// buildAnalysisPrompt creates the prompt for analyzing collected data
func buildAnalysisPrompt() string {
	return `You are Porter AI analyzing debug data. Given the investigation results below, provide:

1. **Status**: Is the service healthy or unhealthy?
2. **Issues Found**: List any errors, warnings, or problems found in the logs/output
3. **Root Cause**: What is likely causing the issue?
4. **Recommendation**: What should be done to fix it?

Be specific - reference actual error messages and log lines. Be concise but thorough.`
}

// parseDebugCommands extracts the JSON command array from LLM response
func parseDebugCommands(response string, allMachines []*Machine) []debugCommand {
	// Try to find JSON array in response
	response = strings.TrimSpace(response)

	// Find array boundaries
	start := strings.Index(response, "[")
	end := strings.LastIndex(response, "]")
	if start == -1 || end == -1 || end <= start {
		return nil
	}

	jsonStr := response[start : end+1]

	var commands []debugCommand
	if err := json.Unmarshal([]byte(jsonStr), &commands); err != nil {
		return nil
	}

	// Fix machine IDs
	for i := range commands {
		fixed := fixMachineIDs([]string{commands[i].MachineID}, allMachines)
		if len(fixed) > 0 {
			commands[i].MachineID = fixed[0]
		}
	}

	return commands
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

		// Get all machines
		machines := machineRepo.List()

		// Resolve machines from request + message
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
		mentioned := resolveMachinesFromMessage(debugReq.Message, machines)
		for _, m := range mentioned {
			if !seen[m.ID] {
				targetMachines = append(targetMachines, m)
				seen[m.ID] = true
			}
		}
		if len(targetMachines) == 0 {
			targetMachines = machines
		}

		// Gather live context
		liveContext := gatherContextForMachines(targetMachines)

		// PHASE 1: Ask LLM what commands to run
		debugSystemPrompt := buildDebugPrompt(config, targetMachines, liveContext)
		planMessages := []ChatMessage{
			{Role: "system", Content: debugSystemPrompt},
			{Role: "user", Content: debugReq.Message},
		}

		planResponse, _, err := callLLM(config, planMessages)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": fmt.Sprintf("LLM error: %v", err),
			})
			return
		}

		commands := parseDebugCommands(planResponse, machines)
		if len(commands) == 0 {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Could not generate investigation plan",
				"raw":     planResponse,
			})
			return
		}

		// Cap at 8 commands to avoid runaway
		if len(commands) > 8 {
			commands = commands[:8]
		}

		// PHASE 2: Execute commands and collect results
		var steps []DebugStep
		var investigationLog strings.Builder
		investigationLog.WriteString(fmt.Sprintf("Investigation: %s\n\n", debugReq.Message))

		for i, cmd := range commands {
			step := DebugStep{
				Step:    i + 1,
				Action:  cmd.Reason,
				Command: cmd.Command,
			}

			// Only auto-execute read-only commands
			if !isReadOnlyCommand(cmd.Command) {
				step.Error = "Skipped: command is not read-only"
				steps = append(steps, step)
				continue
			}

			machine, exists := machineRepo.Get(cmd.MachineID)
			if !exists {
				step.Error = "Machine not found: " + cmd.MachineID
				steps = append(steps, step)
				continue
			}
			step.Machine = machine.Name

			// Detect user-scoped commands
			useSudo := false
			if strings.Contains(cmd.Command, "--user") {
				useSudo = false
			}

			result := runCommandOnMachine(machine, cmd.Command, useSudo)

			output := result.Output
			if idx := strings.LastIndex(output, "EXIT_CODE:"); idx != -1 {
				output = strings.TrimSpace(output[:idx])
			}
			// Remove sudo password prompts
			if idx := strings.Index(output, "[sudo] password for"); idx != -1 {
				if nl := strings.Index(output[idx:], "\n"); nl != -1 {
					output = strings.TrimSpace(output[idx+nl:])
				}
			}

			// Truncate very long outputs
			if len(output) > 3000 {
				output = output[len(output)-3000:]
			}

			step.Output = output
			if !result.Success {
				step.Error = result.Error
			}
			steps = append(steps, step)

			investigationLog.WriteString(fmt.Sprintf("--- Step %d: %s ---\nCommand: %s\nMachine: %s\n%s\n\n",
				i+1, cmd.Reason, cmd.Command, machine.Name, output))
		}

		// PHASE 3: Feed results to LLM for analysis
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
