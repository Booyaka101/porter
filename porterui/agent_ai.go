package porterui

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// AIAgentConfig holds configuration for the AI agent
type AIAgentConfig struct {
	// Provider is the LLM provider: "openai", "anthropic", "ollama", or "custom"
	Provider string `json:"provider"`
	// APIKey for the LLM provider (can also be set via env: PORTER_AI_API_KEY)
	APIKey string `json:"api_key,omitempty"`
	// Model to use (e.g., "gpt-4", "claude-3-opus", "llama2")
	Model string `json:"model"`
	// BaseURL for custom/ollama providers
	BaseURL string `json:"base_url,omitempty"`
	// SystemPrompt is prepended to all conversations
	SystemPrompt string `json:"system_prompt,omitempty"`
	// ScriptDescriptions maps script names to detailed descriptions for context
	ScriptDescriptions map[string]ScriptDescription `json:"script_descriptions,omitempty"`
	// MaxTokens for response
	MaxTokens int `json:"max_tokens,omitempty"`
	// Temperature for response randomness (0-1)
	Temperature float64 `json:"temperature,omitempty"`
}

// ScriptDescription provides detailed context about a script for the AI
type ScriptDescription struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Usage        string   `json:"usage,omitempty"`
	Examples     []string `json:"examples,omitempty"`
	Flags        []string `json:"flags,omitempty"`
	Category     string   `json:"category,omitempty"`
	RequiresTags []string `json:"requires_tags,omitempty"`
}

// ChatMessage represents a message in the conversation
type ChatMessage struct {
	Role      string    `json:"role"` // "user", "assistant", "system"
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp,omitempty"`
}

// ChatRequest is the request body for chat endpoint
type ChatRequest struct {
	Message    string        `json:"message"`
	History    []ChatMessage `json:"history,omitempty"`
	MachineIDs []string      `json:"machine_ids,omitempty"`
	SessionID  string        `json:"session_id,omitempty"`
}

// ChatResponse is the response from the AI agent
type ChatResponse struct {
	Message    string        `json:"message"`
	Actions    []AgentAction `json:"actions,omitempty"`
	SessionID  string        `json:"session_id"`
	Timestamp  time.Time     `json:"timestamp"`
	TokensUsed int           `json:"tokens_used,omitempty"`
}

// AgentAction represents an action the AI wants to perform
type AgentAction struct {
	Type       string            `json:"type"` // "execute_script", "run_command", "info"
	ScriptPath string            `json:"script_path,omitempty"`
	Command    string            `json:"command,omitempty"`
	MachineIDs []string          `json:"machine_ids,omitempty"`
	Args       map[string]string `json:"args,omitempty"`
	Confirmed  bool              `json:"confirmed"`
	Message    string            `json:"message,omitempty"`
}

// ActionConfirmRequest confirms an action to execute
type ActionConfirmRequest struct {
	SessionID string      `json:"session_id"`
	ActionID  int         `json:"action_id"`
	Confirmed bool        `json:"confirmed"`
	Action    AgentAction `json:"action"`
}

// Global AI agent configuration
var (
	aiAgentConfig      *AIAgentConfig
	aiAgentConfigLock  sync.RWMutex
	chatSessions       = make(map[string][]ChatMessage)
	chatSessionsLock   sync.RWMutex
	chatSessionsAccess = make(map[string]time.Time) // last access time per session
)

// startSessionCleanup runs a background goroutine that evicts stale sessions and cache entries.
func startSessionCleanup() {
	cleanupOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				now := time.Now()

				// Evict chat sessions idle for > 30 minutes
				chatSessionsLock.Lock()
				for id, lastAccess := range chatSessionsAccess {
					if now.Sub(lastAccess) > 30*time.Minute {
						delete(chatSessions, id)
						delete(chatSessionsAccess, id)
					}
				}
				chatSessionsLock.Unlock()

				// Evict stale context cache entries (> 5 minutes old)
				liveContextCacheLock.Lock()
				for id, ts := range liveContextCacheTTL {
					if now.Sub(ts) > 5*time.Minute {
						delete(liveContextCache, id)
						delete(liveContextCacheTTL, id)
					}
				}
				liveContextCacheLock.Unlock()
			}
		}()
	})
}

// SetAIAgentConfig sets the AI agent configuration (called by wrappers)
func SetAIAgentConfig(config *AIAgentConfig) {
	aiAgentConfigLock.Lock()
	defer aiAgentConfigLock.Unlock()
	aiAgentConfig = config
}

// GetAIAgentConfig returns the current AI agent configuration
func GetAIAgentConfig() *AIAgentConfig {
	aiAgentConfigLock.RLock()
	defer aiAgentConfigLock.RUnlock()
	return aiAgentConfig
}

// liveContextCache stores gathered machine context with TTL
var (
	liveContextCache     = make(map[string]string)
	liveContextCacheLock sync.RWMutex
	liveContextCacheTTL  = make(map[string]time.Time)
	ipRegex              = regexp.MustCompile(`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`)
	sshSemaphore         = make(chan struct{}, 10) // limit concurrent SSH connections
	cleanupOnce          sync.Once
)

// resolveMachinesFromMessage parses user message for IPs or machine names
// and returns matching machines from the repo
func resolveMachinesFromMessage(message string, allMachines []*Machine) []*Machine {
	var resolved []*Machine
	seen := make(map[string]bool)

	// Extract IPs from message
	ips := ipRegex.FindAllString(message, -1)
	for _, ip := range ips {
		for _, m := range allMachines {
			if m.IP == ip && !seen[m.ID] {
				resolved = append(resolved, m)
				seen[m.ID] = true
			}
		}
	}

	// Match machine names (case-insensitive)
	msgLower := strings.ToLower(message)
	for _, m := range allMachines {
		if seen[m.ID] {
			continue
		}
		nameLower := strings.ToLower(m.Name)
		if nameLower != "" && strings.Contains(msgLower, nameLower) {
			resolved = append(resolved, m)
			seen[m.ID] = true
		}
	}

	return resolved
}

// gatherMachineContext SSHes into a machine and gathers live service info
func gatherMachineContext(m *Machine) string {
	// Check cache (60s TTL)
	liveContextCacheLock.RLock()
	if cached, ok := liveContextCache[m.ID]; ok {
		if time.Since(liveContextCacheTTL[m.ID]) < 60*time.Second {
			liveContextCacheLock.RUnlock()
			return cached
		}
	}
	liveContextCacheLock.RUnlock()

	// Gather health metrics + service list in one SSH call
	cmd := `echo "HEALTH:"; uptime | sed 's/.*up/up/'; free -h | awk '/^Mem:/{print "Memory: "$3"/"$2" used ("$7" available)"}'; df -h / | awk 'NR==2{print "Disk /: "$3"/"$2" used ("$5")"}'; echo ""; echo "DOCKER:"; docker ps -a --format '{{.Names}}\t{{.Status}}' 2>/dev/null; echo ""; echo "SERVICES:"; docker ps --format '{{.Names}} [docker] -> logs: docker logs {{.Names}} --tail 100' 2>/dev/null; systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | grep -v -E 'snap\.|dbus|polkit|rtkit|fwupd|avahi|bluetooth|cups|colord|kerneloops|power-profiles|accounts-daemon|gnome|gdm|cron|rsyslog|networkd-dispatcher|NetworkManager|chrony|udisks|switcheroo|upower|wpa_supplicant|thermald|irqbalance|whoopsie|bolt|apparmor|multipathd|systemd-|user@|unattended|ModemManager|packagekit|secureboot|ubuntu-advantage|containerd|ssh\.' | awk '{gsub(/\.service/,"",$1); print $1 " [system] -> logs: journalctl -u " $1 " -n 100 --no-pager"}' | head -20; systemctl --user list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | grep -v -E 'at-spi|dbus|dconf|evolution|filter-chain|gcr-|glib|gnome|gsd-|org.freedesktop|org.gnome|pipewire|pulseaudio|snap|speech|tracker|wireplumber|xdg-|gvfs' | awk '{gsub(/\.service/,"",$1); print $1 " [user] -> logs: journalctl --user -u " $1 " -n 100 --no-pager"}' | head -20`

	result := runCommandOnMachine(m, cmd, false)
	if !result.Success || result.Output == "" {
		return ""
	}

	// Clean up output - remove EXIT_CODE line
	output := result.Output
	if idx := strings.LastIndex(output, "EXIT_CODE:"); idx != -1 {
		output = strings.TrimSpace(output[:idx])
	}

	// Cache it
	liveContextCacheLock.Lock()
	liveContextCache[m.ID] = output
	liveContextCacheTTL[m.ID] = time.Now()
	liveContextCacheLock.Unlock()

	return output
}

// gatherContextForMachines gathers context for multiple machines concurrently.
// Uses a semaphore to limit concurrent SSH connections and respects timeouts.
func gatherContextForMachines(machines []*Machine) map[string]string {
	results := make(map[string]string)
	var mu sync.Mutex
	var wg sync.WaitGroup

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, m := range machines {
		if m.Status != "online" && m.Status != "" {
			continue
		}
		wg.Add(1)
		go func(machine *Machine) {
			defer wg.Done()

			// Acquire semaphore (or bail if timeout)
			select {
			case sshSemaphore <- struct{}{}:
				defer func() { <-sshSemaphore }()
			case <-ctx.Done():
				return
			}

			// Check if we've already timed out before starting SSH
			if ctx.Err() != nil {
				return
			}

			machineCtx := gatherMachineContext(machine)
			if machineCtx != "" {
				mu.Lock()
				results[machine.ID] = machineCtx
				mu.Unlock()
			}
		}(m)
	}

	// Wait for all goroutines to finish (they will either complete or bail on ctx.Done)
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
		// Timeout: goroutines that already acquired the semaphore will finish
		// naturally (SSH has its own 20s connect timeout). Goroutines waiting
		// on the semaphore will bail via ctx.Done. We don't abandon goroutines —
		// the wg.Wait goroutine will clean up when they finish.
	}

	return results
}

// healthSummary holds parsed health data for a machine
type healthSummary struct {
	Uptime string
	Memory string
	Disk   string
	Docker string
}

// parseHealthFromContext extracts structured health info from raw SSH context
func parseHealthFromContext(ctx string) healthSummary {
	var h healthSummary
	inHealth := false
	inDocker := false
	var dockerLines []string
	for _, line := range strings.Split(ctx, "\n") {
		line = strings.TrimSpace(line)
		if line == "HEALTH:" {
			inHealth = true
			inDocker = false
			continue
		}
		if line == "DOCKER:" {
			inHealth = false
			inDocker = true
			continue
		}
		if line == "SERVICES:" {
			inDocker = false
			break
		}
		if inHealth && line != "" {
			if strings.HasPrefix(line, "up ") || strings.Contains(line, "load average") {
				h.Uptime = line
			} else if strings.HasPrefix(line, "Memory:") {
				h.Memory = line
			} else if strings.HasPrefix(line, "Disk") {
				h.Disk = line
			}
		}
		if inDocker && line != "" {
			dockerLines = append(dockerLines, line)
		}
	}
	if len(dockerLines) > 0 {
		healthy := 0
		unhealthy := 0
		stopped := 0
		for _, dl := range dockerLines {
			lower := strings.ToLower(dl)
			if strings.Contains(lower, "(healthy)") || strings.Contains(lower, "up ") {
				healthy++
			}
			if strings.Contains(lower, "(unhealthy)") {
				unhealthy++
			}
			if strings.Contains(lower, "exited") {
				stopped++
			}
		}
		parts := []string{fmt.Sprintf("%d running", healthy)}
		if unhealthy > 0 {
			parts = append(parts, fmt.Sprintf("%d unhealthy", unhealthy))
		}
		if stopped > 0 {
			parts = append(parts, fmt.Sprintf("%d stopped", stopped))
		}
		h.Docker = strings.Join(parts, ", ")
	}
	return h
}

// isHealthOverviewQuery detects broad health/status queries about all machines
func isHealthOverviewQuery(message string) bool {
	msg := strings.ToLower(message)
	healthWords := []string{"health", "status", "overview", "how are", "check all", "all machines", "every machine", "machine status", "system status"}
	broadWords := []string{"all", "every", "general", "overall", "machines", "fleet", "infrastructure"}
	hasHealth := false
	hasBroad := false
	for _, w := range healthWords {
		if strings.Contains(msg, w) {
			hasHealth = true
			break
		}
	}
	for _, w := range broadWords {
		if strings.Contains(msg, w) {
			hasBroad = true
			break
		}
	}
	return hasHealth && hasBroad
}

// parseServiceAction detects service management patterns like "restart X", "stop X", "start X"
func parseServiceAction(message string) (action string, serviceName string) {
	msg := strings.ToLower(message)
	actions := []string{"restart", "stop", "start", "status"}
	for _, a := range actions {
		idx := strings.Index(msg, a)
		if idx == -1 {
			continue
		}
		// Extract words after the action
		rest := strings.TrimSpace(msg[idx+len(a):])
		words := strings.Fields(rest)
		// Skip common filler words
		for len(words) > 0 {
			w := words[0]
			if w == "the" || w == "service" || w == "on" || w == "for" {
				words = words[1:]
				continue
			}
			break
		}
		if len(words) > 0 {
			// The first meaningful word is the service name (skip IPs and "on")
			svc := words[0]
			if svc != "on" && svc != "all" && !ipRegex.MatchString(svc) {
				return a, svc
			}
			// Maybe service name is after "on <machine>" pattern - try second word
			if len(words) > 1 && !ipRegex.MatchString(words[1]) && words[1] != "on" {
				return a, words[1]
			}
		}
	}
	return "", ""
}

// detectServiceType checks the live context to determine if a service is docker, system, or user
func detectServiceType(ctx string, serviceName string) string {
	svcLower := strings.ToLower(serviceName)
	inServices := false
	for _, line := range strings.Split(ctx, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "SERVICES:" {
			inServices = true
			continue
		}
		if !inServices {
			continue
		}
		lineLower := strings.ToLower(trimmed)
		if strings.Contains(lineLower, svcLower) {
			if strings.Contains(trimmed, "[docker]") {
				return "docker"
			}
			if strings.Contains(trimmed, "[user]") {
				return "user"
			}
			if strings.Contains(trimmed, "[system]") {
				return "system"
			}
			// Fallback: check by log command pattern
			if strings.Contains(trimmed, "docker logs") {
				return "docker"
			}
			if strings.Contains(trimmed, "journalctl --user") {
				return "user"
			}
			if strings.Contains(trimmed, "journalctl -u") {
				return "system"
			}
		}
	}
	return "system"
}

// buildServiceCommand generates the correct command for a service action based on service type
func buildServiceCommand(action, serviceName, serviceType string) string {
	switch serviceType {
	case "docker":
		return fmt.Sprintf("docker %s %s", action, serviceName)
	case "user":
		return fmt.Sprintf("systemctl --user %s %s", action, serviceName)
	default:
		return fmt.Sprintf("sudo systemctl %s %s", action, serviceName)
	}
}

// isTimeQuery detects time/date related queries
func isTimeQuery(message string) bool {
	msg := strings.ToLower(message)
	timePatterns := []string{"what time", "what is the time", "current time", "server time", "date and time", "datetime", "datetimectl", "timedatectl", "tell me the time", "tell me the date", "what date"}
	for _, p := range timePatterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	return false
}

// needsMachineContext returns true if the message appears to be about infrastructure,
// machines, services, or anything that would benefit from live SSH context.
// Returns false for general knowledge questions, greetings, etc.
func needsMachineContext(message string) bool {
	msg := strings.ToLower(message)
	infraWords := []string{
		"machine", "server", "docker", "container", "service", "systemd", "systemctl",
		"memory", "disk", "cpu", "load", "uptime", "restart", "deploy", "log", "logs",
		"health", "status", "running", "stopped", "failed", "error", "crash",
		"network", "port", "ssh", "process", "kill", "install", "update", "upgrade",
		"nginx", "apache", "postgres", "mysql", "redis", "mongo",
	}
	for _, w := range infraWords {
		if strings.Contains(msg, w) {
			return true
		}
	}
	if ipRegex.MatchString(msg) {
		return true
	}
	return false
}

// buildHealthOverview creates a server-side formatted health report (no LLM needed)
func buildHealthOverview(machines []*Machine, liveContext map[string]string) string {
	var sb strings.Builder

	var online, offline, unknown int
	type machineHealth struct {
		Name   string
		Status string
		Health healthSummary
	}
	var onlineMachines, offlineMachines, unknownMachines []machineHealth

	for _, m := range machines {
		status := m.Status
		if status == "" {
			status = "unknown"
		}
		mh := machineHealth{Name: m.Name, Status: status}

		if ctx, ok := liveContext[m.ID]; ok && ctx != "" {
			mh.Health = parseHealthFromContext(ctx)
		}

		switch status {
		case "online":
			online++
			onlineMachines = append(onlineMachines, mh)
		case "offline":
			offline++
			offlineMachines = append(offlineMachines, mh)
		default:
			unknown++
			unknownMachines = append(unknownMachines, mh)
		}
	}

	sb.WriteString(fmt.Sprintf("## Machine Health Overview\n\n**%d online** | **%d offline** | **%d unknown** (of %d total)\n\n",
		online, offline, unknown, len(machines)))

	if len(onlineMachines) > 0 {
		sb.WriteString("### Online Machines\n")
		for _, mh := range onlineMachines {
			sb.WriteString(fmt.Sprintf("- **%s**", mh.Name))
			if mh.Health.Memory != "" {
				sb.WriteString(" | " + mh.Health.Memory)
			}
			if mh.Health.Disk != "" {
				sb.WriteString(" | " + mh.Health.Disk)
			}
			if mh.Health.Uptime != "" {
				sb.WriteString(" | " + mh.Health.Uptime)
			}
			if mh.Health.Docker != "" {
				sb.WriteString(" | Docker: " + mh.Health.Docker)
			}
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
	}

	if len(offlineMachines) > 0 {
		sb.WriteString("### Offline Machines\n")
		for _, mh := range offlineMachines {
			sb.WriteString(fmt.Sprintf("- **%s**\n", mh.Name))
		}
		sb.WriteString("\n")
	}

	if len(unknownMachines) > 0 {
		sb.WriteString("### Unknown Status\n")
		for _, mh := range unknownMachines {
			sb.WriteString(fmt.Sprintf("- **%s**\n", mh.Name))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// buildSystemPrompt creates a context-aware system prompt with live machine data
// focusedMachineIDs: machines the user specifically asked about (get full context)
// If empty, all machines get compact summary only
func buildSystemPrompt(config *AIAgentConfig, machines []*Machine, liveContext map[string]string, focusedMachineIDs map[string]bool) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf(`You are Porter AI, an infrastructure assistant. Be concise and direct.
Do NOT include IP addresses in your responses. Use machine display names only.
Current server time: %s

WHEN TO USE JSON ACTION BLOCKS:
- ONLY when the user explicitly asks to run a command, check logs, restart something, or execute an action on a specific machine.
- NEVER for questions, explanations, time, health status, or general chat.

WHEN NOT TO USE JSON:
- "what time is it" -> answer with the server time shown above
- "what is running on X" -> describe what you see in the machine data
- "how much disk space" -> answer from the machine data
- Any general question -> answer directly in plain text

SYSTEMD SERVICES:
- The SERVICES section below shows exact log commands. User-level services use "journalctl --user -u", system services use "journalctl -u". Copy the exact command shown.

EXAMPLE - user says "show me logs for myapp on ServerA" (ServerA has ID abc123):
`+"```"+`json
{"type":"run_command","command":"docker logs myapp --tail 100","machine_ids":["abc123"]}
`+"```"+`

EXAMPLE - user says "what time is it":
The current server time is %s
`, time.Now().Format("Mon Jan 2 15:04:05 MST 2006"), time.Now().Format("Mon Jan 2 15:04:05 MST 2006")) + `
`)

	// Add scripts
	if len(config.ScriptDescriptions) > 0 {
		sb.WriteString("SCRIPTS: ")
		names := make([]string, 0, len(config.ScriptDescriptions))
		for name := range config.ScriptDescriptions {
			names = append(names, name)
		}
		sb.WriteString(strings.Join(names, ", "))
		sb.WriteString("\n\n")
	}

	// Add machines
	if len(machines) > 0 {
		sb.WriteString("MACHINES:\n")
		for _, m := range machines {
			status := m.Status
			if status == "" {
				status = "unknown"
			}

			ctx, hasCtx := liveContext[m.ID]
			isFocused := focusedMachineIDs[m.ID]

			if isFocused && hasCtx {
				// Full context for specifically mentioned machines
				sb.WriteString(fmt.Sprintf("\n[%s] ID:%s Status:%s\n", m.Name, m.ID, status))
				if len(m.Tags) > 0 {
					sb.WriteString(fmt.Sprintf("  Tags: %s\n", strings.Join(m.Tags, ", ")))
				}
				sb.WriteString(ctx)
				sb.WriteString("\n")
			} else if hasCtx {
				// Compact one-line summary for other machines
				h := parseHealthFromContext(ctx)
				sb.WriteString(fmt.Sprintf("[%s] ID:%s Status:%s", m.Name, m.ID, status))
				if h.Uptime != "" {
					sb.WriteString(" | " + h.Uptime)
				}
				if h.Memory != "" {
					sb.WriteString(" | " + h.Memory)
				}
				if h.Disk != "" {
					sb.WriteString(" | " + h.Disk)
				}
				if h.Docker != "" {
					sb.WriteString(" | Docker: " + h.Docker)
				}
				sb.WriteString("\n")
			} else {
				// No context (offline/unreachable)
				sb.WriteString(fmt.Sprintf("[%s] ID:%s Status:%s\n", m.Name, m.ID, status))
			}
		}
	}

	// Add custom context
	if config.SystemPrompt != "" {
		sb.WriteString("\n")
		sb.WriteString(config.SystemPrompt)
		sb.WriteString("\n")
	}

	return sb.String()
}

// callLLM sends a request to the configured LLM provider
func callLLM(ctx context.Context, config *AIAgentConfig, messages []ChatMessage) (string, int, error) {
	apiKey := config.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("PORTER_AI_API_KEY")
	}

	switch config.Provider {
	case "openai":
		if apiKey == "" {
			return "", 0, fmt.Errorf("AI API key not configured. Set PORTER_AI_API_KEY environment variable or configure in wrapper")
		}
		return callOpenAI(ctx, config, messages, apiKey)
	case "anthropic":
		if apiKey == "" {
			return "", 0, fmt.Errorf("AI API key not configured. Set PORTER_AI_API_KEY environment variable or configure in wrapper")
		}
		return callAnthropic(ctx, config, messages, apiKey)
	case "ollama":
		return callOllama(ctx, config, messages)
	default:
		return "", 0, fmt.Errorf("unsupported AI provider: %s", config.Provider)
	}
}

// callOpenAI calls the OpenAI API
func callOpenAI(ctx context.Context, config *AIAgentConfig, messages []ChatMessage, apiKey string) (string, int, error) {
	model := config.Model
	if model == "" {
		model = "gpt-4"
	}

	maxTokens := config.MaxTokens
	if maxTokens == 0 {
		maxTokens = 2048
	}

	temperature := config.Temperature
	if temperature == 0 {
		temperature = 0.7
	}

	// Convert messages to OpenAI format
	openaiMessages := make([]map[string]string, len(messages))
	for i, msg := range messages {
		openaiMessages[i] = map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		}
	}

	reqBody := map[string]interface{}{
		"model":       model,
		"messages":    openaiMessages,
		"max_tokens":  maxTokens,
		"temperature": temperature,
	}

	jsonBody, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", 0, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", 0, fmt.Errorf("OpenAI API error: %s", string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", 0, err
	}

	if len(result.Choices) == 0 {
		return "", 0, fmt.Errorf("no response from OpenAI")
	}

	return result.Choices[0].Message.Content, result.Usage.TotalTokens, nil
}

// callAnthropic calls the Anthropic API
func callAnthropic(ctx context.Context, config *AIAgentConfig, messages []ChatMessage, apiKey string) (string, int, error) {
	model := config.Model
	if model == "" {
		model = "claude-3-sonnet-20240229"
	}

	maxTokens := config.MaxTokens
	if maxTokens == 0 {
		maxTokens = 2048
	}

	// Extract system message and convert others to Anthropic format
	var systemPrompt string
	anthropicMessages := []map[string]string{}

	for _, msg := range messages {
		if msg.Role == "system" {
			systemPrompt = msg.Content
		} else {
			anthropicMessages = append(anthropicMessages, map[string]string{
				"role":    msg.Role,
				"content": msg.Content,
			})
		}
	}

	reqBody := map[string]interface{}{
		"model":      model,
		"max_tokens": maxTokens,
		"messages":   anthropicMessages,
	}
	if systemPrompt != "" {
		reqBody["system"] = systemPrompt
	}

	jsonBody, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", 0, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", 0, fmt.Errorf("Anthropic API error: %s", string(body))
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", 0, err
	}

	if len(result.Content) == 0 {
		return "", 0, fmt.Errorf("no response from Anthropic")
	}

	return result.Content[0].Text, result.Usage.InputTokens + result.Usage.OutputTokens, nil
}

// callOllama calls a local Ollama instance
func callOllama(ctx context.Context, config *AIAgentConfig, messages []ChatMessage) (string, int, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}

	model := config.Model
	if model == "" {
		model = "llama2"
	}

	// Convert to Ollama format
	ollamaMessages := make([]map[string]string, len(messages))
	for i, msg := range messages {
		ollamaMessages[i] = map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		}
	}

	maxTokens := config.MaxTokens
	if maxTokens == 0 {
		maxTokens = 2048
	}

	reqBody := map[string]interface{}{
		"model":    model,
		"messages": ollamaMessages,
		"stream":   false,
		"options": map[string]interface{}{
			"num_predict": maxTokens,
			"num_ctx":     4096,
		},
	}

	jsonBody, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/api/chat", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", 0, err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", 0, fmt.Errorf("Ollama API error: %s", string(body))
	}

	var result struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", 0, err
	}

	return result.Message.Content, 0, nil
}

// normalizeAction tries to fix common LLM format deviations into a valid AgentAction
// fixMachineIDs resolves partial/incorrect machine IDs to valid ones
func fixMachineIDs(ids []string, allMachines []*Machine) []string {
	var fixed []string
	for _, id := range ids {
		// Already valid
		found := false
		for _, m := range allMachines {
			if m.ID == id {
				fixed = append(fixed, id)
				found = true
				break
			}
		}
		if found {
			continue
		}
		// Try adding "machine-" prefix
		prefixed := "machine-" + id
		for _, m := range allMachines {
			if m.ID == prefixed {
				fixed = append(fixed, prefixed)
				found = true
				break
			}
		}
		if found {
			continue
		}
		// Try matching by IP
		for _, m := range allMachines {
			if m.IP == id {
				fixed = append(fixed, m.ID)
				found = true
				break
			}
		}
		if found {
			continue
		}
		// Try matching by suffix
		for _, m := range allMachines {
			if strings.HasSuffix(m.ID, id) {
				fixed = append(fixed, m.ID)
				found = true
				break
			}
		}
		if !found {
			fixed = append(fixed, id)
		}
	}
	return fixed
}

func normalizeAction(raw map[string]interface{}, allMachines []*Machine) *AgentAction {
	action := &AgentAction{}

	// Extract type - default to run_command if command is present
	if t, ok := raw["type"].(string); ok {
		action.Type = t
	} else if _, ok := raw["command"]; ok {
		action.Type = "run_command"
	}

	// Extract command
	if cmd, ok := raw["command"].(string); ok {
		action.Command = cmd
	}

	// Extract machine_ids (correct format)
	if ids, ok := raw["machine_ids"].([]interface{}); ok {
		for _, id := range ids {
			if s, ok := id.(string); ok {
				action.MachineIDs = append(action.MachineIDs, s)
			}
		}
	}

	// Handle LLM using "machine_ip" instead of "machine_ids"
	if ip, ok := raw["machine_ip"].(string); ok && len(action.MachineIDs) == 0 {
		for _, m := range allMachines {
			if m.IP == ip {
				action.MachineIDs = append(action.MachineIDs, m.ID)
				break
			}
		}
	}

	// Handle "machine_id" (singular) instead of "machine_ids"
	if id, ok := raw["machine_id"].(string); ok && len(action.MachineIDs) == 0 {
		action.MachineIDs = append(action.MachineIDs, id)
	}

	// Fix any malformed machine IDs
	if len(action.MachineIDs) > 0 {
		action.MachineIDs = fixMachineIDs(action.MachineIDs, allMachines)
	}

	if action.Type != "" && action.Command != "" {
		return action
	}
	return nil
}

// parseActions extracts action blocks from the AI response
func parseActions(response string, allMachines []*Machine) []AgentAction {
	var actions []AgentAction

	// Find JSON blocks in the response
	start := 0
	for {
		jsonStart := strings.Index(response[start:], "```json")
		if jsonStart == -1 {
			break
		}
		jsonStart += start + 7 // Skip "```json"

		jsonEnd := strings.Index(response[jsonStart:], "```")
		if jsonEnd == -1 {
			break
		}
		jsonEnd += jsonStart

		jsonStr := strings.TrimSpace(response[jsonStart:jsonEnd])

		// First try strict parsing
		var action AgentAction
		if err := json.Unmarshal([]byte(jsonStr), &action); err == nil && action.Type != "" && len(action.MachineIDs) > 0 {
			action.MachineIDs = fixMachineIDs(action.MachineIDs, allMachines)
			actions = append(actions, action)
		} else {
			// Fallback: parse as generic map and normalize
			var raw map[string]interface{}
			if err := json.Unmarshal([]byte(jsonStr), &raw); err == nil {
				if normalized := normalizeAction(raw, allMachines); normalized != nil {
					actions = append(actions, *normalized)
				}
			}
		}

		start = jsonEnd + 3
	}

	return actions
}

// AIAgentRoutes sets up the AI agent API routes
func AIAgentRoutes(r *mux.Router) {
	startSessionCleanup()

	// GET /api/ai-agent/config - Get AI agent configuration status
	r.HandleFunc("/api/ai-agent/config", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		config := GetAIAgentConfig()
		if config == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"configured": false,
				"message":    "AI Agent not configured. Configure in your wrapper or set PORTER_AI_API_KEY.",
			})
			return
		}

		// Don't expose API key
		safeConfig := map[string]interface{}{
			"configured":   true,
			"provider":     config.Provider,
			"model":        config.Model,
			"has_api_key":  config.APIKey != "" || os.Getenv("PORTER_AI_API_KEY") != "",
			"script_count": len(config.ScriptDescriptions),
		}
		json.NewEncoder(w).Encode(safeConfig)
	}).Methods("GET")

	// POST /api/ai-agent/chat - Send a message to the AI agent
	r.HandleFunc("/api/ai-agent/chat", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		config := GetAIAgentConfig()
		if config == nil {
			// Create default config if API key is set via env
			if os.Getenv("PORTER_AI_API_KEY") != "" {
				config = &AIAgentConfig{
					Provider: "openai",
					Model:    "gpt-4",
				}
			} else {
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error": "AI Agent not configured",
				})
				return
			}
		}

		var chatReq ChatRequest
		if err := json.NewDecoder(req.Body).Decode(&chatReq); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Generate or use session ID
		sessionID := chatReq.SessionID
		if sessionID == "" {
			sessionID = fmt.Sprintf("session-%d", time.Now().UnixNano())
		}

		// Get machines for context
		machines := machineRepo.List()

		// Fast path: time/date queries
		if isTimeQuery(chatReq.Message) {
			msg := strings.ToLower(chatReq.Message)
			// Resolve mentioned machines
			mentioned := resolveMachinesFromMessage(chatReq.Message, machines)
			var targetMachines []*Machine
			if len(chatReq.MachineIDs) > 0 {
				for _, id := range chatReq.MachineIDs {
					if m, ok := machineRepo.Get(id); ok {
						targetMachines = append(targetMachines, m)
					}
				}
			}
			for _, m := range mentioned {
				targetMachines = append(targetMachines, m)
			}

			if len(targetMachines) > 0 {
				// Run date on specific machines
				var sb strings.Builder
				for _, m := range targetMachines {
					result := runCommandOnMachine(m, "date", false)
					if result.Success {
						output := strings.TrimSpace(result.Output)
						if idx := strings.LastIndex(output, "EXIT_CODE:"); idx != -1 {
							output = strings.TrimSpace(output[:idx])
						}
						sb.WriteString(fmt.Sprintf("**%s**: %s\n", m.Name, output))
					} else {
						sb.WriteString(fmt.Sprintf("**%s**: Could not retrieve time\n", m.Name))
					}
				}
				json.NewEncoder(w).Encode(ChatResponse{
					Message:   sb.String(),
					SessionID: sessionID,
					Timestamp: time.Now(),
				})
				return
			} else if !strings.Contains(msg, "server") || strings.Contains(msg, "all") {
				// General time question - answer with Porter server time
				json.NewEncoder(w).Encode(ChatResponse{
					Message:   fmt.Sprintf("The current server time is **%s**", time.Now().Format("Mon Jan 2 15:04:05 MST 2006")),
					SessionID: sessionID,
					Timestamp: time.Now(),
				})
				return
			}
		}

		// Fast path: service management (restart/stop/start)
		if action, svcName := parseServiceAction(chatReq.Message); action != "" && svcName != "" {
			mentioned := resolveMachinesFromMessage(chatReq.Message, machines)
			var targetMachines []*Machine
			if len(chatReq.MachineIDs) > 0 {
				for _, id := range chatReq.MachineIDs {
					if m, ok := machineRepo.Get(id); ok {
						targetMachines = append(targetMachines, m)
					}
				}
			}
			for _, m := range mentioned {
				found := false
				for _, existing := range targetMachines {
					if existing.ID == m.ID {
						found = true
						break
					}
				}
				if !found {
					targetMachines = append(targetMachines, m)
				}
			}

			if len(targetMachines) > 0 {
				liveContext := gatherContextForMachines(targetMachines)
				var sb strings.Builder
				var actions []AgentAction
				for _, m := range targetMachines {
					ctx := liveContext[m.ID]
					svcType := detectServiceType(ctx, svcName)
					cmd := buildServiceCommand(action, svcName, svcType)
					sb.WriteString(fmt.Sprintf("**%s** on **%s**: `%s`\n", strings.Title(action), m.Name, cmd))
					actions = append(actions, AgentAction{
						Type:       "run_command",
						Command:    cmd,
						MachineIDs: []string{m.ID},
					})
				}
				json.NewEncoder(w).Encode(ChatResponse{
					Message:   sb.String(),
					SessionID: sessionID,
					Timestamp: time.Now(),
					Actions:   actions,
				})
				return
			}
		}

		// Fast path: health overview queries answered server-side (no LLM)
		if isHealthOverviewQuery(chatReq.Message) {
			liveContext := gatherContextForMachines(machines)
			summary := buildHealthOverview(machines, liveContext)
			json.NewEncoder(w).Encode(ChatResponse{
				Message:   summary,
				SessionID: sessionID,
				Timestamp: time.Now(),
			})
			return
		}

		// Determine which machines to gather context for
		var contextMachines []*Machine
		focusedIDs := make(map[string]bool)

		if len(chatReq.MachineIDs) > 0 {
			seen := make(map[string]bool)
			for _, id := range chatReq.MachineIDs {
				if m, ok := machineRepo.Get(id); ok && !seen[m.ID] {
					contextMachines = append(contextMachines, m)
					seen[m.ID] = true
					focusedIDs[m.ID] = true
				}
			}
			mentioned := resolveMachinesFromMessage(chatReq.Message, machines)
			for _, m := range mentioned {
				if !seen[m.ID] {
					contextMachines = append(contextMachines, m)
					seen[m.ID] = true
				}
				focusedIDs[m.ID] = true
			}
		} else {
			mentioned := resolveMachinesFromMessage(chatReq.Message, machines)
			if len(mentioned) > 0 {
				seen := make(map[string]bool)
				for _, m := range mentioned {
					if !seen[m.ID] {
						contextMachines = append(contextMachines, m)
						seen[m.ID] = true
						focusedIDs[m.ID] = true
					}
				}
			} else if needsMachineContext(chatReq.Message) {
				contextMachines = machines
			}
		}

		// Gather live context only if we have machines to query
		liveContext := make(map[string]string)
		if len(contextMachines) > 0 {
			liveContext = gatherContextForMachines(contextMachines)
		}

		var messages []ChatMessage
		systemPrompt := buildSystemPrompt(config, machines, liveContext, focusedIDs)
		messages = append(messages, ChatMessage{
			Role:    "system",
			Content: systemPrompt,
		})

		// Add history from session
		chatSessionsLock.RLock()
		if history, ok := chatSessions[sessionID]; ok {
			messages = append(messages, history...)
		}
		chatSessionsLock.RUnlock()

		// Add provided history (for context continuity)
		for _, msg := range chatReq.History {
			messages = append(messages, msg)
		}

		// Enrich user message: replace IPs with machine name+ID hints so the LLM can connect them
		enrichedMessage := chatReq.Message
		if ips := ipRegex.FindAllString(chatReq.Message, -1); len(ips) > 0 {
			for _, ip := range ips {
				for _, m := range machines {
					if m.IP == ip {
						enrichedMessage = strings.ReplaceAll(enrichedMessage, ip, fmt.Sprintf("%s (ID: %s)", m.Name, m.ID))
						break
					}
				}
			}
		}

		// Add current message
		userMessage := ChatMessage{
			Role:      "user",
			Content:   enrichedMessage,
			Timestamp: time.Now(),
		}
		messages = append(messages, userMessage)

		// Call LLM
		response, tokens, err := callLLM(req.Context(), config, messages)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":      err.Error(),
				"session_id": sessionID,
			})
			return
		}

		// Parse actions from response
		actions := parseActions(response, machines)

		// Store in session
		assistantMessage := ChatMessage{
			Role:      "assistant",
			Content:   response,
			Timestamp: time.Now(),
		}

		chatSessionsLock.Lock()
		chatSessions[sessionID] = append(chatSessions[sessionID], userMessage, assistantMessage)
		// Keep only last 20 messages per session
		if len(chatSessions[sessionID]) > 20 {
			chatSessions[sessionID] = chatSessions[sessionID][len(chatSessions[sessionID])-20:]
		}
		chatSessionsAccess[sessionID] = time.Now()
		chatSessionsLock.Unlock()

		json.NewEncoder(w).Encode(ChatResponse{
			Message:    response,
			Actions:    actions,
			SessionID:  sessionID,
			Timestamp:  time.Now(),
			TokensUsed: tokens,
		})
	}).Methods("POST")

	// POST /api/ai-agent/execute - Execute a confirmed action
	r.HandleFunc("/api/ai-agent/execute", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var confirmReq ActionConfirmRequest
		if err := json.NewDecoder(req.Body).Decode(&confirmReq); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if !confirmReq.Confirmed {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "Action not confirmed",
			})
			return
		}

		action := confirmReq.Action

		// Check user permissions
		useSudo := false
		claims := getClaimsFromRequest(req)
		if claims != nil && (claims.Role == "admin" || HasPermission(claims.Permissions, "sudo:enabled")) {
			useSudo = true
		}

		switch action.Type {
		case "execute_script":
			if action.ScriptPath == "" || len(action.MachineIDs) == 0 {
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"error":   "Missing script_path or machine_ids",
				})
				return
			}

			// Build args string
			var args []string
			for flag, value := range action.Args {
				if value == "true" {
					args = append(args, flag)
				} else if value != "" && value != "false" {
					args = append(args, fmt.Sprintf("%s=%s", flag, value))
				}
			}

			execID := fmt.Sprintf("ai-exec-%d", time.Now().UnixNano())
			execution := execTracker.Create(execID, action.ScriptPath, strings.Join(args, " "), action.MachineIDs)

			// Execute async
			go executeScriptAsync(execID, action.ScriptPath, action.MachineIDs, strings.Join(args, " "), useSudo)

			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":      true,
				"execution_id": execID,
				"execution":    execution,
			})

		case "run_command":
			if action.Command == "" || len(action.MachineIDs) == 0 {
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"error":   "Missing command or machine_ids",
				})
				return
			}

			// Validate command
			validatedCmd, err := ValidateCommand(action.Command)
			if err != nil {
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"error":   err.Error(),
				})
				return
			}

			// Check for dangerous commands
			if IsDangerousCommand(validatedCmd) {
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success":   false,
					"error":     "This command is potentially dangerous and requires explicit confirmation",
					"dangerous": true,
				})
				return
			}

			// User-scoped commands must not run with sudo
			cmdSudo := useSudo
			if strings.Contains(validatedCmd, "--user") {
				cmdSudo = false
			}

			// Execute on each machine
			var results []ExecutionResult
			for _, machineID := range action.MachineIDs {
				machine, exists := machineRepo.Get(machineID)
				if !exists {
					continue
				}
				result := runCommandOnMachine(machine, validatedCmd, cmdSudo)
				results = append(results, result)
			}

			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"results": results,
			})

		default:
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Unknown action type: " + action.Type,
			})
		}
	}).Methods("POST")

	// DELETE /api/ai-agent/session/{id} - Clear a chat session
	r.HandleFunc("/api/ai-agent/session/{id}", func(w http.ResponseWriter, req *http.Request) {
		sessionID := mux.Vars(req)["id"]

		chatSessionsLock.Lock()
		delete(chatSessions, sessionID)
		chatSessionsLock.Unlock()

		w.WriteHeader(http.StatusOK)
	}).Methods("DELETE")

	// GET /api/ai-agent/scripts - Get available scripts with descriptions
	r.HandleFunc("/api/ai-agent/scripts", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		config := GetAIAgentConfig()

		var scriptList []ScriptDescription

		// Use configured descriptions if available
		if config != nil && len(config.ScriptDescriptions) > 0 {
			for _, desc := range config.ScriptDescriptions {
				scriptList = append(scriptList, desc)
			}
		} else {
			// Fall back to discovered scripts
			scripts, _ := discoverScripts()
			for _, script := range scripts {
				scriptList = append(scriptList, ScriptDescription{
					Name:        script.Name,
					Description: script.Description,
					Category:    script.Category,
				})
			}
		}

		json.NewEncoder(w).Encode(scriptList)
	}).Methods("GET")
}
