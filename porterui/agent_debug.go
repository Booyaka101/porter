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

// parseServicesFromContext extracts service names and their log commands from live context
func parseServicesFromContext(ctx string) []serviceInfo {
	var services []serviceInfo
	for _, line := range strings.Split(ctx, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || line == "RUNNING:" {
			continue
		}
		// Format: "name -> logs: command"
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

// buildDebugCommands programmatically generates investigation commands
func buildDebugCommands(targetService *serviceInfo, machine *Machine) []struct {
	Command string
	Reason  string
} {
	var cmds []struct {
		Command string
		Reason  string
	}

	if targetService != nil {
		// Service-specific investigation
		cmds = append(cmds, struct {
			Command string
			Reason  string
		}{targetService.LogCommand, fmt.Sprintf("Get recent %s logs", targetService.Name)})

		switch targetService.Type {
		case "docker":
			cmds = append(cmds, struct {
				Command string
				Reason  string
			}{fmt.Sprintf("docker inspect --format '{{.State.Status}} started:{{.State.StartedAt}}' %s", targetService.Name),
				fmt.Sprintf("Check %s container state", targetService.Name)})
			cmds = append(cmds, struct {
				Command string
				Reason  string
			}{fmt.Sprintf("docker stats --no-stream --format 'CPU:{{.CPUPerc}} MEM:{{.MemUsage}}' %s", targetService.Name),
				fmt.Sprintf("Check %s resource usage", targetService.Name)})
		case "user":
			cmds = append(cmds, struct {
				Command string
				Reason  string
			}{fmt.Sprintf("systemctl --user status %s", targetService.Name),
				fmt.Sprintf("Check %s service status", targetService.Name)})
			cmds = append(cmds, struct {
				Command string
				Reason  string
			}{fmt.Sprintf("journalctl --user -u %s --since '1 hour ago' --no-pager | grep -i -E 'error|fail|panic|fatal|exception' | tail -20", targetService.Name),
				fmt.Sprintf("Find errors in %s logs", targetService.Name)})
		case "system":
			cmds = append(cmds, struct {
				Command string
				Reason  string
			}{fmt.Sprintf("systemctl status %s", targetService.Name),
				fmt.Sprintf("Check %s service status", targetService.Name)})
			cmds = append(cmds, struct {
				Command string
				Reason  string
			}{fmt.Sprintf("journalctl -u %s --since '1 hour ago' --no-pager | grep -i -E 'error|fail|panic|fatal|exception' | tail -20", targetService.Name),
				fmt.Sprintf("Find errors in %s logs", targetService.Name)})
		}
	}

	// General health checks
	cmds = append(cmds, struct {
		Command string
		Reason  string
	}{"free -h; df -h /", "Check memory and disk usage"})

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
	return `Analyze these debug results. Be concise and specific. Format:

**Status**: healthy/unhealthy
**Issues**: list errors found in logs (quote actual lines)
**Cause**: likely root cause
**Fix**: recommended action

If no errors found, say the service appears healthy.`
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
				"error": "No target machines identified. Mention a machine IP or name.",
			})
			return
		}

		// PHASE 1: Gather live context (fast, cached)
		liveContext := gatherContextForMachines(targetMachines)

		// PHASE 2: Build investigation commands programmatically (no LLM needed)
		type machineCmd struct {
			Machine *Machine
			Command string
			Reason  string
		}
		var allCmds []machineCmd

		for _, m := range targetMachines {
			ctx := liveContext[m.ID]
			services := parseServicesFromContext(ctx)
			targetSvc := extractServiceName(debugReq.Message, services)

			cmds := buildDebugCommands(targetSvc, m)
			for _, cmd := range cmds {
				allCmds = append(allCmds, machineCmd{Machine: m, Command: cmd.Command, Reason: cmd.Reason})
			}
		}

		if len(allCmds) == 0 {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Could not determine what to investigate. Please be more specific.",
			})
			return
		}

		// PHASE 3: Execute commands concurrently
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
			go func(idx int, m *Machine, cmd string) {
				defer wg.Done()
				useSudo := !strings.Contains(cmd, "--user")
				result := runCommandOnMachine(m, cmd, useSudo)
				steps[idx].Output = cleanCommandOutput(result.Output)
				if !result.Success {
					steps[idx].Error = result.Error
				}
			}(i, mc.Machine, mc.Command)
		}

		// Wait with timeout
		done := make(chan struct{})
		go func() { wg.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(30 * time.Second):
		}

		// PHASE 4: Build investigation log and send to LLM for analysis
		var investigationLog strings.Builder
		investigationLog.WriteString(fmt.Sprintf("Debug: %s\n\n", debugReq.Message))
		for _, step := range steps {
			investigationLog.WriteString(fmt.Sprintf("--- %s (%s) ---\n$ %s\n%s\n\n",
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
