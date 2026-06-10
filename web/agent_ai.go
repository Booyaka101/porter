package web

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

type AIAgentConfig struct {
	Provider           string                       `json:"provider"`
	APIKey             string                       `json:"api_key,omitempty"`
	Model              string                       `json:"model"`
	BaseURL            string                       `json:"base_url,omitempty"`
	SystemPrompt       string                       `json:"system_prompt,omitempty"`
	ScriptDescriptions map[string]ScriptDescription `json:"script_descriptions,omitempty"`
	MaxTokens          int                          `json:"max_tokens,omitempty"`
	Temperature        float64                      `json:"temperature,omitempty"`
}

type ScriptDescription struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Usage        string   `json:"usage,omitempty"`
	Examples     []string `json:"examples,omitempty"`
	Flags        []string `json:"flags,omitempty"`
	Category     string   `json:"category,omitempty"`
	RequiresTags []string `json:"requires_tags,omitempty"`
}

type ChatMessage struct {
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp,omitempty"`
}

type ChatRequest struct {
	Message    string        `json:"message"`
	History    []ChatMessage `json:"history,omitempty"`
	MachineIDs []string      `json:"machine_ids,omitempty"`
	SessionID  string        `json:"session_id,omitempty"`
}

type ChatResponse struct {
	Message    string        `json:"message"`
	Actions    []AgentAction `json:"actions,omitempty"`
	SessionID  string        `json:"session_id"`
	Timestamp  time.Time     `json:"timestamp"`
	TokensUsed int           `json:"tokens_used,omitempty"`
}

type AgentAction struct {
	Type       string            `json:"type"`
	ScriptPath string            `json:"script_path,omitempty"`
	Command    string            `json:"command,omitempty"`
	MachineIDs []string          `json:"machine_ids,omitempty"`
	Args       map[string]string `json:"args,omitempty"`
	Confirmed  bool              `json:"confirmed"`
	Message    string            `json:"message,omitempty"`
}

type ActionConfirmRequest struct {
	SessionID string      `json:"session_id"`
	ActionID  int         `json:"action_id"`
	Confirmed bool        `json:"confirmed"`
	Action    AgentAction `json:"action"`
}

// ---------- Ollama native tool calling types ----------

type OllamaToolFunction struct {
	Name        string                       `json:"name"`
	Description string                       `json:"description"`
	Parameters  OllamaToolFunctionParameters `json:"parameters"`
}

type OllamaToolFunctionParameters struct {
	Type       string                        `json:"type"`
	Required   []string                      `json:"required"`
	Properties map[string]OllamaToolProperty `json:"properties"`
}

type OllamaToolProperty struct {
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Enum        []string `json:"enum,omitempty"`
}

type OllamaTool struct {
	Type     string             `json:"type"`
	Function OllamaToolFunction `json:"function"`
}

type OllamaToolCall struct {
	Function struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	} `json:"function"`
}

// ---------- Global state ----------

var (
	aiAgentConfig      *AIAgentConfig
	aiAgentConfigLock  sync.RWMutex
	chatSessions       = make(map[string][]ChatMessage)
	chatSessionsLock   sync.RWMutex
	chatSessionsAccess = make(map[string]time.Time)
)

func startBackgroundTasks() {
	cleanupOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				now := time.Now()
				chatSessionsLock.Lock()
				for id, lastAccess := range chatSessionsAccess {
					if now.Sub(lastAccess) > 30*time.Minute {
						delete(chatSessions, id)
						delete(chatSessionsAccess, id)
					}
				}
				chatSessionsLock.Unlock()
			}
		}()

		go func() {
			time.Sleep(10 * time.Second)
			warmContextCache()

			ticker := time.NewTicker(45 * time.Second)
			defer ticker.Stop()
			for range ticker.C {
				warmContextCache()
			}
		}()
	})
}

func warmContextCache() {
	if machineRepo == nil {
		return
	}
	machines := machineRepo.List()
	if len(machines) == 0 {
		return
	}
	gatherContextForMachinesWithPriority(machines, false)
}

func SetAIAgentConfig(config *AIAgentConfig) {
	aiAgentConfigLock.Lock()
	defer aiAgentConfigLock.Unlock()
	aiAgentConfig = config
}

func GetAIAgentConfig() *AIAgentConfig {
	aiAgentConfigLock.RLock()
	defer aiAgentConfigLock.RUnlock()
	return aiAgentConfig
}

// ---------- Context gathering ----------

var (
	liveContextCache     = make(map[string]string)
	liveContextCacheLock sync.RWMutex
	liveContextCacheTTL  = make(map[string]time.Time)
	ipRegex              = regexp.MustCompile(`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`)
	sshSemaphore         = make(chan struct{}, 10) // High-priority for HTTP handlers
	bgSshSemaphore       = make(chan struct{}, 2)  // Low-priority for background tasks
	cleanupOnce          sync.Once
)

func resolveMachinesFromMessage(message string, allMachines []*Machine) []*Machine {
	var resolved []*Machine
	seen := make(map[string]bool)

	ips := ipRegex.FindAllString(message, -1)
	for _, ip := range ips {
		for _, m := range allMachines {
			if m.IP == ip && !seen[m.ID] {
				resolved = append(resolved, m)
				seen[m.ID] = true
			}
		}
	}

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

func resolveTargetMachines(message string, requestMachineIDs []string, allMachines []*Machine) []*Machine {
	seen := make(map[string]bool)
	var targets []*Machine

	for _, id := range requestMachineIDs {
		if m, ok := machineRepo.Get(id); ok && !seen[m.ID] {
			targets = append(targets, m)
			seen[m.ID] = true
		}
	}

	for _, m := range resolveMachinesFromMessage(message, allMachines) {
		if !seen[m.ID] {
			targets = append(targets, m)
			seen[m.ID] = true
		}
	}

	return targets
}

func gatherMachineContext(m *Machine) string {
	liveContextCacheLock.RLock()
	if cached, ok := liveContextCache[m.ID]; ok {
		if time.Since(liveContextCacheTTL[m.ID]) < 60*time.Second {
			liveContextCacheLock.RUnlock()
			return cached
		}
	}
	liveContextCacheLock.RUnlock()

	cmd := `echo "HEALTH:"; uptime | sed 's/.*up/up/'; free -h | awk '/^Mem:/{print "Memory: "$3"/"$2" used ("$7" available)"}'; df -h / | awk 'NR==2{print "Disk /: "$3"/"$2" used ("$5")"}'; echo ""; echo "DOCKER:"; docker ps -a --format '{{.Names}}\t{{.Status}}' 2>/dev/null; echo ""; echo "SERVICES:"; docker ps --format '{{.Names}} [docker] -> logs: docker logs {{.Names}} --tail 100' 2>/dev/null; systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | grep -v -E 'snap\.|dbus|polkit|rtkit|fwupd|avahi|bluetooth|cups|colord|kerneloops|power-profiles|accounts-daemon|gnome|gdm|cron|rsyslog|networkd-dispatcher|NetworkManager|chrony|udisks|switcheroo|upower|wpa_supplicant|thermald|irqbalance|whoopsie|bolt|apparmor|multipathd|systemd-|user@|unattended|ModemManager|packagekit|secureboot|ubuntu-advantage|containerd|ssh\.' | awk '{gsub(/\.service/,"",$1); print $1 " [system] -> logs: journalctl -u " $1 " -n 100 --no-pager"}' | head -20; systemctl --user list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | grep -v -E 'at-spi|dbus|dconf|evolution|filter-chain|gcr-|glib|gnome|gsd-|org.freedesktop|org.gnome|pipewire|pulseaudio|snap|speech|tracker|wireplumber|xdg-|gvfs' | awk '{gsub(/\.service/,"",$1); print $1 " [user] -> logs: journalctl --user -u " $1 " -n 100 --no-pager"}' | head -20`

	result := runCommandOnMachine(m, cmd, false)
	if !result.Success || result.Output == "" {
		return ""
	}

	output := result.Output
	if idx := strings.LastIndex(output, "EXIT_CODE:"); idx != -1 {
		output = strings.TrimSpace(output[:idx])
	}

	liveContextCacheLock.Lock()
	liveContextCache[m.ID] = output
	liveContextCacheTTL[m.ID] = time.Now()
	liveContextCacheLock.Unlock()

	return output
}

func gatherContextForMachines(machines []*Machine) map[string]string {
	return gatherContextForMachinesWithPriority(machines, true)
}

func gatherContextForMachinesWithPriority(machines []*Machine, highPriority bool) map[string]string {
	results := make(map[string]string)
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Use shorter timeout to prevent hangs
	var timeout time.Duration
	if highPriority {
		timeout = 5 * time.Second
	} else {
		timeout = 3 * time.Second // Background tasks get even shorter timeout
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var sem chan struct{}
	if highPriority {
		sem = sshSemaphore
	} else {
		sem = bgSshSemaphore
	}

	for _, m := range machines {
		if m.Status != "online" && m.Status != "" {
			continue
		}
		wg.Add(1)
		go func(machine *Machine) {
			defer wg.Done()

			// Non-blocking semaphore acquire
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				return
			default:
				// Semaphore full, skip to prevent hang
				return
			}

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

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
	}

	return results
}

func getCachedContext() map[string]string {
	liveContextCacheLock.RLock()
	defer liveContextCacheLock.RUnlock()
	result := make(map[string]string, len(liveContextCache))
	for k, v := range liveContextCache {
		result[k] = v
	}
	return result
}

// ---------- Health parsing ----------

type healthSummary struct {
	Uptime string
	Memory string
	Disk   string
	Docker string
}

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

// ---------- Tier 1: Server-side intent detection ----------

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

func isScriptsQuery(message string) bool {
	msg := strings.ToLower(message)
	return strings.Contains(msg, "script") && (strings.Contains(msg, "available") ||
		strings.Contains(msg, "list") || strings.Contains(msg, "what") ||
		strings.Contains(msg, "show") || strings.Contains(msg, "which") ||
		strings.Contains(msg, "have") || strings.Contains(msg, "can i"))
}

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

func isMachineInfoQuery(message string) bool {
	msg := strings.ToLower(message)
	infoPatterns := []string{
		"tell me about", "tell me more about",
		"info on", "info about", "info of", "info for",
		"give me info", "give info", "get info",
		"information on", "information about", "information of", "information for",
		"details on", "details about", "details of", "details for",
		"what is running on", "what's running on", "whats running on",
		"what is on", "what's on",
		"show me", "describe", "more about", "full info",
		"check on", "check the", "look at",
		"status of", "health of",
		"how is the", "how's the",
	}
	for _, p := range infoPatterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	hasRef := ipRegex.MatchString(msg) || strings.Contains(msg, "machine")
	infoWords := []string{"info", "detail", "status", "health", "about", "running", "check"}
	if hasRef {
		for _, w := range infoWords {
			if strings.Contains(msg, w) {
				return true
			}
		}
	}
	return false
}

func isListMachinesQuery(message string) bool {
	msg := strings.ToLower(message)
	patterns := []string{
		"list machines", "list all machines", "show machines", "show all machines",
		"show me machines", "show me all machines", "show me the machines",
		"what machines", "which machines", "our machines",
		"list servers", "list all servers", "show servers", "show all servers",
		"what servers", "which servers", "our servers",
		"how many machines", "how many servers",
		"machine list", "server list",
	}
	for _, p := range patterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	return false
}

func isListServicesQuery(message string) bool {
	msg := strings.ToLower(message)
	patterns := []string{
		"list services", "show services", "what services",
		"which services", "running services", "active services",
		"services running", "services on",
	}
	for _, p := range patterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	return false
}

func isListProcessesQuery(message string) bool {
	msg := strings.ToLower(message)
	patterns := []string{
		"list processes", "show processes", "what processes",
		"running processes", "active processes", "top processes",
		"processes running", "processes on",
	}
	for _, p := range patterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	return false
}

func isScheduledJobsQuery(message string) bool {
	msg := strings.ToLower(message)
	patterns := []string{
		"scheduled jobs", "show scheduled", "list scheduled",
		"cron jobs", "show cron", "list cron",
		"scheduled tasks", "show scheduled tasks", "list scheduled tasks",
		"what's scheduled", "what is scheduled",
		"upcoming jobs", "recurring jobs",
	}
	for _, p := range patterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	return false
}

func isBackupsQuery(message string) bool {
	msg := strings.ToLower(message)
	patterns := []string{
		"backup jobs", "show backups", "list backups",
		"backup status", "backup schedule",
		"what backups", "which backups",
	}
	for _, p := range patterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	return false
}

func isHistoryQuery(message string) bool {
	msg := strings.ToLower(message)
	patterns := []string{
		"execution history", "recent executions", "show history",
		"list history", "last executions", "recent runs",
		"what was run", "what was executed", "what ran",
		"past executions", "previous runs",
	}
	for _, p := range patterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	return false
}

func isNotificationsQuery(message string) bool {
	msg := strings.ToLower(message)
	patterns := []string{
		"notifications", "show notifications", "list notifications",
		"alerts", "show alerts", "list alerts",
		"unread notifications", "any notifications",
		"any alerts", "new notifications",
	}
	for _, p := range patterns {
		if strings.Contains(msg, p) {
			return true
		}
	}
	return false
}

func needsMachineContext(message string) bool {
	msg := strings.ToLower(message)
	infraPhrases := []string{
		"how is", "how are", "check on", "what's running",
		"machine health", "machine status", "server health", "server status",
		"all machines", "all servers", "every machine", "every server",
		"docker", "container", "systemd", "systemctl",
		"memory usage", "disk usage", "disk space", "cpu usage", "cpu load",
		"uptime", "restart service", "restart container",
		"which machine", "which server", "on the server", "on the machine",
		"is it running", "is it down", "is it up", "is it online",
		"show me the logs", "check logs", "view logs",
		"nginx", "apache", "postgres", "mysql", "redis", "mongo",
	}
	for _, p := range infraPhrases {
		if strings.Contains(msg, p) {
			return true
		}
	}
	if ipRegex.MatchString(msg) {
		return true
	}
	return false
}

// ---------- Tier 1: Server-side response builders ----------

func buildListMachinesResponse(machines []*Machine) string {
	if len(machines) == 0 {
		return "No machines are currently configured."
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Machines (%d total)\n\n", len(machines)))

	var online, offline, unknown int
	for _, m := range machines {
		switch m.Status {
		case "online":
			online++
		case "offline":
			offline++
		default:
			unknown++
		}
	}
	sb.WriteString(fmt.Sprintf("**%d online** | **%d offline** | **%d unknown**\n\n", online, offline, unknown))

	for _, m := range machines {
		status := m.Status
		if status == "" {
			status = "unknown"
		}
		icon := "🔴"
		if status == "online" {
			icon = "🟢"
		}
		sb.WriteString(fmt.Sprintf("- %s **%s** — %s", icon, m.Name, status))
		if m.Category != "" {
			sb.WriteString(fmt.Sprintf(" | %s", m.Category))
		}
		if len(m.Tags) > 0 {
			sb.WriteString(fmt.Sprintf(" | tags: %s", strings.Join(m.Tags, ", ")))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func buildListServicesResponse(machines []*Machine, liveContext map[string]string) string {
	var sb strings.Builder

	for _, m := range machines {
		ctx, ok := liveContext[m.ID]
		if !ok || ctx == "" {
			sb.WriteString(fmt.Sprintf("## %s\n*No live data available*\n\n", m.Name))
			continue
		}

		sb.WriteString(fmt.Sprintf("## %s\n", m.Name))

		inServices := false
		var docker, system, user []string
		for _, line := range strings.Split(ctx, "\n") {
			trimmed := strings.TrimSpace(line)
			if trimmed == "SERVICES:" {
				inServices = true
				continue
			}
			if !inServices || trimmed == "" {
				continue
			}
			name := trimmed
			if idx := strings.Index(trimmed, " ["); idx != -1 {
				name = trimmed[:idx]
			}
			if strings.Contains(trimmed, "[docker]") {
				docker = append(docker, name)
			} else if strings.Contains(trimmed, "[user]") {
				user = append(user, name)
			} else if strings.Contains(trimmed, "[system]") {
				system = append(system, name)
			}
		}

		if len(docker) > 0 {
			sb.WriteString("**Docker:** " + strings.Join(docker, ", ") + "\n")
		}
		if len(system) > 0 {
			sb.WriteString("**System:** " + strings.Join(system, ", ") + "\n")
		}
		if len(user) > 0 {
			sb.WriteString("**User:** " + strings.Join(user, ", ") + "\n")
		}
		if len(docker)+len(system)+len(user) == 0 {
			sb.WriteString("*No services detected*\n")
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func buildListProcessesResponse(machines []*Machine) string {
	var sb strings.Builder

	for _, m := range machines {
		sb.WriteString(fmt.Sprintf("## %s\n", m.Name))
		result := runCommandOnMachine(m, "ps aux --sort=-%cpu | head -16", false)
		if !result.Success {
			sb.WriteString("*Could not retrieve processes*\n\n")
			continue
		}
		output := result.Output
		if idx := strings.LastIndex(output, "EXIT_CODE:"); idx != -1 {
			output = strings.TrimSpace(output[:idx])
		}
		sb.WriteString("```\n" + output + "\n```\n\n")
	}

	return sb.String()
}

func buildScheduledJobsResponse() string {
	if scheduler == nil {
		return "Scheduler is not initialized."
	}

	jobs := scheduler.GetJobs()
	if len(jobs) == 0 {
		return "No scheduled jobs configured."
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Scheduled Jobs (%d total)\n\n", len(jobs)))

	for _, j := range jobs {
		status := "disabled"
		if j.Enabled {
			status = "enabled"
		}
		sb.WriteString(fmt.Sprintf("- **%s** — %s\n", j.Name, status))
		sb.WriteString(fmt.Sprintf("  Schedule: `%s`", j.CronExpr))
		if j.Description != "" {
			sb.WriteString(fmt.Sprintf(" | %s", j.Description))
		}
		sb.WriteString("\n")
		if j.ScriptPath != "" {
			sb.WriteString(fmt.Sprintf("  Script: `%s`", j.ScriptPath))
			if j.Args != "" {
				sb.WriteString(fmt.Sprintf(" %s", j.Args))
			}
			sb.WriteString("\n")
		}
		if !j.LastRun.IsZero() {
			sb.WriteString(fmt.Sprintf("  Last run: %s (%s) | Runs: %d (%d ok, %d fail)\n",
				j.LastRun.Format("Jan 2 15:04"), j.LastStatus, j.RunCount, j.SuccessCount, j.FailCount))
		}
		if !j.NextRun.IsZero() {
			sb.WriteString(fmt.Sprintf("  Next run: %s\n", j.NextRun.Format("Jan 2 15:04")))
		}
	}

	return sb.String()
}

func buildBackupsResponse() string {
	backupJobsMu.RLock()
	jobs := make([]*BackupJob, 0, len(backupJobs))
	for _, j := range backupJobs {
		jobs = append(jobs, j)
	}
	backupJobsMu.RUnlock()

	if len(jobs) == 0 {
		return "No backup jobs configured."
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Backup Jobs (%d total)\n\n", len(jobs)))

	for _, j := range jobs {
		status := "disabled"
		if j.Enabled {
			status = "enabled"
		}
		sb.WriteString(fmt.Sprintf("- **%s** — %s\n", j.Name, status))
		sb.WriteString(fmt.Sprintf("  %s → %s\n", j.SourcePath, j.DestPath))
		if j.Schedule != "" {
			sb.WriteString(fmt.Sprintf("  Schedule: `%s`\n", j.Schedule))
		}
		if j.LastRun != nil {
			sb.WriteString(fmt.Sprintf("  Last run: %s (%s)\n", j.LastRun.Format("Jan 2 15:04"), j.LastStatus))
		}
	}

	return sb.String()
}

func buildHistoryResponse() string {
	if historyStore == nil {
		return "Execution history is not available."
	}

	records := historyStore.GetRecent(15)
	if len(records) == 0 {
		return "No execution history found."
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Recent Executions (last %d)\n\n", len(records)))

	for _, r := range records {
		icon := "✅"
		if !r.Success {
			icon = "❌"
		}
		sb.WriteString(fmt.Sprintf("- %s **%s** on **%s** — %s\n",
			icon, r.ScriptName, r.MachineName, r.StartedAt.Format("Jan 2 15:04")))
		if r.Duration != "" {
			sb.WriteString(fmt.Sprintf("  Duration: %s", r.Duration))
		}
		if r.Error != "" {
			sb.WriteString(fmt.Sprintf(" | Error: %s", r.Error))
		}
		sb.WriteString("\n")
	}

	stats := historyStore.GetStats()
	if total, ok := stats["total"].(int); ok && total > 0 {
		successRate := 0.0
		if sr, ok := stats["success_rate"].(float64); ok {
			successRate = sr
		}
		sb.WriteString(fmt.Sprintf("\n**Stats:** %d total | %.0f%% success rate\n", total, successRate))
	}

	return sb.String()
}

func buildNotificationsResponse() string {
	if notificationStore == nil {
		return "Notifications are not available."
	}

	unread := notificationStore.GetUnread()
	all := notificationStore.GetAll()

	var sb strings.Builder

	if len(unread) > 0 {
		sb.WriteString(fmt.Sprintf("## Unread Notifications (%d)\n\n", len(unread)))
		for _, n := range unread {
			icon := "ℹ️"
			switch n.Type {
			case "success":
				icon = "✅"
			case "failure":
				icon = "❌"
			case "warning":
				icon = "⚠️"
			}
			sb.WriteString(fmt.Sprintf("- %s **%s** — %s\n", icon, n.Title, n.Timestamp.Format("Jan 2 15:04")))
			if n.Message != "" {
				sb.WriteString(fmt.Sprintf("  %s\n", n.Message))
			}
		}
	} else {
		sb.WriteString("No unread notifications.\n")
	}

	if len(all) > len(unread) && len(all) > 0 {
		sb.WriteString(fmt.Sprintf("\n*%d total notifications*\n", len(all)))
	}

	return sb.String()
}

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

func buildMachineDetail(m *Machine, ctx string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## %s\n\n", m.Name))

	status := m.Status
	if status == "" {
		status = "unknown"
	}
	sb.WriteString(fmt.Sprintf("**Status:** %s\n", status))
	if len(m.Tags) > 0 {
		sb.WriteString(fmt.Sprintf("**Tags:** %s\n", strings.Join(m.Tags, ", ")))
	}
	sb.WriteString("\n")

	if ctx == "" {
		sb.WriteString("*No live data available — machine may be offline or unreachable.*\n")
		return sb.String()
	}

	inHealth := false
	inDocker := false
	inServices := false
	var healthLines, dockerLines, serviceLines []string

	for _, line := range strings.Split(ctx, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "HEALTH:" {
			inHealth = true
			inDocker = false
			inServices = false
			continue
		}
		if trimmed == "DOCKER:" {
			inHealth = false
			inDocker = true
			inServices = false
			continue
		}
		if trimmed == "SERVICES:" {
			inHealth = false
			inDocker = false
			inServices = true
			continue
		}
		if trimmed == "" {
			continue
		}
		if inHealth {
			healthLines = append(healthLines, trimmed)
		}
		if inDocker {
			dockerLines = append(dockerLines, trimmed)
		}
		if inServices {
			serviceLines = append(serviceLines, trimmed)
		}
	}

	if len(healthLines) > 0 {
		sb.WriteString("### Health\n")
		for _, l := range healthLines {
			sb.WriteString(fmt.Sprintf("- %s\n", l))
		}
		sb.WriteString("\n")
	}

	if len(dockerLines) > 0 {
		sb.WriteString("### Docker Containers\n")
		for _, l := range dockerLines {
			parts := strings.SplitN(l, "\t", 2)
			if len(parts) == 2 {
				sb.WriteString(fmt.Sprintf("- **%s** — %s\n", parts[0], parts[1]))
			} else {
				sb.WriteString(fmt.Sprintf("- %s\n", l))
			}
		}
		sb.WriteString("\n")
	}

	if len(serviceLines) > 0 {
		sb.WriteString("### Services\n")
		for _, l := range serviceLines {
			name := l
			svcType := ""
			if idx := strings.Index(l, " ["); idx != -1 {
				name = l[:idx]
				endIdx := strings.Index(l[idx:], "]")
				if endIdx != -1 {
					svcType = l[idx+2 : idx+endIdx]
				}
			}
			if svcType != "" {
				sb.WriteString(fmt.Sprintf("- **%s** (%s)\n", name, svcType))
			} else {
				sb.WriteString(fmt.Sprintf("- %s\n", name))
			}
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// ---------- Service management helpers ----------

func parseServiceAction(message string) (action string, serviceName string) {
	msg := strings.ToLower(message)
	actions := []string{"restart", "stop", "start", "status"}
	for _, a := range actions {
		idx := strings.Index(msg, a)
		if idx == -1 {
			continue
		}
		rest := strings.TrimSpace(msg[idx+len(a):])
		words := strings.Fields(rest)
		for len(words) > 0 {
			w := words[0]
			if w == "the" || w == "service" || w == "on" || w == "for" {
				words = words[1:]
				continue
			}
			break
		}
		if len(words) > 0 {
			svc := words[0]
			if svc != "on" && svc != "all" && !ipRegex.MatchString(svc) {
				return a, svc
			}
			if len(words) > 1 && !ipRegex.MatchString(words[1]) && words[1] != "on" {
				return a, words[1]
			}
		}
	}
	return "", ""
}

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

// ---------- Ollama native tool calling ----------

func buildToolDefinitions() []OllamaTool {
	return []OllamaTool{
		{
			Type: "function",
			Function: OllamaToolFunction{
				Name:        "run_command",
				Description: "Execute a shell command on one or more machines. Use for ad-hoc commands, checking logs, inspecting state, or any operation that requires running a command remotely.",
				Parameters: OllamaToolFunctionParameters{
					Type:     "object",
					Required: []string{"command", "machine_names"},
					Properties: map[string]OllamaToolProperty{
						"command":       {Type: "string", Description: "The shell command to execute"},
						"machine_names": {Type: "string", Description: "Comma-separated list of machine display names to run the command on"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: OllamaToolFunction{
				Name:        "execute_script",
				Description: "Run a Porter script with specific flags on machines. Use when the user wants to run a known setup/deploy script.",
				Parameters: OllamaToolFunctionParameters{
					Type:     "object",
					Required: []string{"script_name", "machine_names"},
					Properties: map[string]OllamaToolProperty{
						"script_name":   {Type: "string", Description: "Name of the script (e.g., setupUbuntu_v2.sh)"},
						"machine_names": {Type: "string", Description: "Comma-separated list of machine display names"},
						"flags":         {Type: "string", Description: "Space-separated flags to pass to the script (e.g., '-f -r -d --role cam')"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: OllamaToolFunction{
				Name:        "restart_service",
				Description: "Restart a systemd service or docker container on a machine.",
				Parameters: OllamaToolFunctionParameters{
					Type:     "object",
					Required: []string{"service_name", "machine_names"},
					Properties: map[string]OllamaToolProperty{
						"service_name":  {Type: "string", Description: "Name of the service or container to restart"},
						"machine_names": {Type: "string", Description: "Comma-separated list of machine display names"},
						"action":        {Type: "string", Description: "Action to perform", Enum: []string{"start", "stop", "restart", "status"}},
					},
				},
			},
		},
		{
			Type: "function",
			Function: OllamaToolFunction{
				Name:        "kill_process",
				Description: "Kill a process by PID on a machine.",
				Parameters: OllamaToolFunctionParameters{
					Type:     "object",
					Required: []string{"pid", "machine_names"},
					Properties: map[string]OllamaToolProperty{
						"pid":           {Type: "string", Description: "Process ID to kill"},
						"machine_names": {Type: "string", Description: "Machine display name where the process is running"},
						"signal":        {Type: "string", Description: "Signal to send (default: TERM)", Enum: []string{"TERM", "KILL", "HUP", "INT"}},
					},
				},
			},
		},
		{
			Type: "function",
			Function: OllamaToolFunction{
				Name:        "check_health",
				Description: "Get detailed health information for specific machines including CPU, memory, disk, and services.",
				Parameters: OllamaToolFunctionParameters{
					Type:     "object",
					Required: []string{"machine_names"},
					Properties: map[string]OllamaToolProperty{
						"machine_names": {Type: "string", Description: "Comma-separated list of machine display names to check"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: OllamaToolFunction{
				Name:        "ping_from_machine",
				Description: "Ping a host from a specific machine to test network connectivity.",
				Parameters: OllamaToolFunctionParameters{
					Type:     "object",
					Required: []string{"target", "machine_names"},
					Properties: map[string]OllamaToolProperty{
						"target":        {Type: "string", Description: "Hostname or IP to ping"},
						"machine_names": {Type: "string", Description: "Machine display name to ping from"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: OllamaToolFunction{
				Name:        "wake_machine",
				Description: "Send a Wake-on-LAN magic packet to wake up an offline machine.",
				Parameters: OllamaToolFunctionParameters{
					Type:     "object",
					Required: []string{"machine_names"},
					Properties: map[string]OllamaToolProperty{
						"machine_names": {Type: "string", Description: "Machine display name to wake up"},
					},
				},
			},
		},
	}
}

func resolveNamesToMachines(nameStr string, allMachines []*Machine) []*Machine {
	names := strings.Split(nameStr, ",")
	var resolved []*Machine
	seen := make(map[string]bool)

	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		nameLower := strings.ToLower(name)
		for _, m := range allMachines {
			if seen[m.ID] {
				continue
			}
			if strings.ToLower(m.Name) == nameLower || strings.Contains(strings.ToLower(m.Name), nameLower) {
				resolved = append(resolved, m)
				seen[m.ID] = true
				break
			}
		}
	}

	return resolved
}

func executeToolCall(toolCall OllamaToolCall, allMachines []*Machine, useSudo bool) (string, []AgentAction) {
	name := toolCall.Function.Name
	args := toolCall.Function.Arguments

	getStr := func(key string) string {
		if v, ok := args[key].(string); ok {
			return v
		}
		return ""
	}

	machineNames := getStr("machine_names")
	machines := resolveNamesToMachines(machineNames, allMachines)

	switch name {
	case "run_command":
		command := getStr("command")
		if command == "" {
			return "Error: no command specified", nil
		}
		if len(machines) == 0 {
			return fmt.Sprintf("Error: could not find machines matching '%s'", machineNames), nil
		}

		var ids []string
		for _, m := range machines {
			ids = append(ids, m.ID)
		}
		var mNames []string
		for _, m := range machines {
			mNames = append(mNames, m.Name)
		}

		return fmt.Sprintf("I'll run `%s` on %s. Please confirm the action.", command, strings.Join(mNames, ", ")),
			[]AgentAction{{
				Type:       "run_command",
				Command:    command,
				MachineIDs: ids,
			}}

	case "execute_script":
		scriptName := getStr("script_name")
		flags := getStr("flags")
		if scriptName == "" {
			return "Error: no script name specified", nil
		}
		if len(machines) == 0 {
			return fmt.Sprintf("Error: could not find machines matching '%s'", machineNames), nil
		}

		var ids []string
		for _, m := range machines {
			ids = append(ids, m.ID)
		}
		var mNames []string
		for _, m := range machines {
			mNames = append(mNames, m.Name)
		}

		scriptPath := ""
		scripts, _ := discoverScripts()
		for _, s := range scripts {
			if strings.EqualFold(s.Name, scriptName) || strings.Contains(strings.ToLower(s.Name), strings.ToLower(scriptName)) {
				scriptPath = s.Path
				break
			}
		}
		if scriptPath == "" {
			scriptPath = scriptName
		}

		flagArgs := make(map[string]string)
		if flags != "" {
			flagArgs["_raw"] = flags
		}

		return fmt.Sprintf("I'll run **%s** %s on %s. Please confirm.", scriptName, flags, strings.Join(mNames, ", ")),
			[]AgentAction{{
				Type:       "execute_script",
				ScriptPath: scriptPath,
				MachineIDs: ids,
				Args:       flagArgs,
			}}

	case "restart_service":
		svcName := getStr("service_name")
		action := getStr("action")
		if action == "" {
			action = "restart"
		}
		if svcName == "" {
			return "Error: no service name specified", nil
		}
		if len(machines) == 0 {
			return fmt.Sprintf("Error: could not find machines matching '%s'", machineNames), nil
		}

		liveContext := gatherContextForMachines(machines)
		var sb strings.Builder
		var actions []AgentAction

		for _, m := range machines {
			ctx := liveContext[m.ID]
			svcType := detectServiceType(ctx, svcName)
			cmd := buildServiceCommand(action, svcName, svcType)
			sb.WriteString(fmt.Sprintf("**%s %s** on **%s**: `%s`\n", strings.ToUpper(action[:1])+action[1:], svcName, m.Name, cmd))
			actions = append(actions, AgentAction{
				Type:       "run_command",
				Command:    cmd,
				MachineIDs: []string{m.ID},
			})
		}

		return sb.String(), actions

	case "kill_process":
		pid := getStr("pid")
		signal := getStr("signal")
		if signal == "" {
			signal = "TERM"
		}
		if pid == "" {
			return "Error: no PID specified", nil
		}
		if len(machines) == 0 {
			return fmt.Sprintf("Error: could not find machines matching '%s'", machineNames), nil
		}

		m := machines[0]
		cmd := fmt.Sprintf("kill -%s %s", signal, pid)

		return fmt.Sprintf("I'll send signal %s to PID %s on **%s**: `%s`. Please confirm.", signal, pid, m.Name, cmd),
			[]AgentAction{{
				Type:       "run_command",
				Command:    cmd,
				MachineIDs: []string{m.ID},
			}}

	case "check_health":
		if len(machines) == 0 {
			return fmt.Sprintf("Error: could not find machines matching '%s'", machineNames), nil
		}
		liveContext := gatherContextForMachines(machines)
		var sb strings.Builder
		for _, m := range machines {
			sb.WriteString(buildMachineDetail(m, liveContext[m.ID]))
		}
		return sb.String(), nil

	case "ping_from_machine":
		target := getStr("target")
		if target == "" {
			return "Error: no target specified", nil
		}
		if len(machines) == 0 {
			return fmt.Sprintf("Error: could not find machines matching '%s'", machineNames), nil
		}

		m := machines[0]
		cmd := fmt.Sprintf("ping -c 4 -W 3 %s", target)

		return fmt.Sprintf("I'll ping **%s** from **%s**. Please confirm.", target, m.Name),
			[]AgentAction{{
				Type:       "run_command",
				Command:    cmd,
				MachineIDs: []string{m.ID},
			}}

	case "wake_machine":
		if len(machines) == 0 {
			return fmt.Sprintf("Could not find a machine matching '%s'", machineNames), nil
		}
		m := machines[0]
		if m.MAC == "" {
			return fmt.Sprintf("Machine **%s** does not have a MAC address configured for Wake-on-LAN.", m.Name), nil
		}

		return fmt.Sprintf("I'll send a Wake-on-LAN packet to **%s**. Please confirm.", m.Name),
			[]AgentAction{{
				Type:       "wake_machine",
				MachineIDs: []string{m.ID},
				Message:    "Wake-on-LAN",
			}}

	default:
		return fmt.Sprintf("Unknown tool: %s", name), nil
	}
}

// ---------- LLM communication ----------

var allowedLocalHosts = map[string]bool{
	"localhost":            true,
	"127.0.0.1":            true,
	"host.docker.internal": true,
	"0.0.0.0":              true,
	"::1":                  true,
}

func isLocalURL(rawURL string) bool {
	if rawURL == "" {
		return true
	}
	host := rawURL
	if idx := strings.Index(host, "://"); idx != -1 {
		host = host[idx+3:]
	}
	if idx := strings.Index(host, "/"); idx != -1 {
		host = host[:idx]
	}
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	if allowedLocalHosts[host] {
		return true
	}
	if strings.HasPrefix(host, "10.") || strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "172.") {
		return true
	}
	return false
}

func callLLM(ctx context.Context, config *AIAgentConfig, messages []ChatMessage) (string, int, error) {
	switch config.Provider {
	case "ollama":
		if !isLocalURL(config.BaseURL) {
			return "", 0, fmt.Errorf("security: Ollama BaseURL %q is not a local address", config.BaseURL)
		}
		return callOllama(ctx, config, messages)
	case "openai", "anthropic":
		return "", 0, fmt.Errorf("security: external LLM providers (%s) are disabled — only local Ollama is allowed", config.Provider)
	default:
		return "", 0, fmt.Errorf("unsupported AI provider: %s", config.Provider)
	}
}

func callLLMWithTools(ctx context.Context, config *AIAgentConfig, messages []ChatMessage, tools []OllamaTool) (string, []OllamaToolCall, int, error) {
	if config.Provider != "ollama" {
		content, tokens, err := callLLM(ctx, config, messages)
		return content, nil, tokens, err
	}
	if !isLocalURL(config.BaseURL) {
		return "", nil, 0, fmt.Errorf("security: Ollama BaseURL %q is not a local address", config.BaseURL)
	}
	return callOllamaWithTools(ctx, config, messages, tools)
}

func callOllama(ctx context.Context, config *AIAgentConfig, messages []ChatMessage) (string, int, error) {
	content, _, tokens, err := callOllamaWithTools(ctx, config, messages, nil)
	return content, tokens, err
}

func callOllamaWithTools(ctx context.Context, config *AIAgentConfig, messages []ChatMessage, tools []OllamaTool) (string, []OllamaToolCall, int, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}

	model := config.Model
	if model == "" {
		model = "llama2"
	}

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
			"num_ctx":     8192,
		},
	}

	if len(tools) > 0 {
		reqBody["tools"] = tools
	}

	jsonBody, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/api/chat", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", nil, 0, err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", nil, 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", nil, 0, fmt.Errorf("Ollama API error: %s", string(body))
	}

	var result struct {
		Message struct {
			Content   string           `json:"content"`
			ToolCalls []OllamaToolCall `json:"tool_calls,omitempty"`
		} `json:"message"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", nil, 0, err
	}

	return result.Message.Content, result.Message.ToolCalls, 0, nil
}

// callOpenAI calls the OpenAI API (kept for compatibility but blocked by security policy)
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

func callAnthropic(ctx context.Context, config *AIAgentConfig, messages []ChatMessage, apiKey string) (string, int, error) {
	model := config.Model
	if model == "" {
		model = "claude-3-sonnet-20240229"
	}

	maxTokens := config.MaxTokens
	if maxTokens == 0 {
		maxTokens = 2048
	}

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

// ---------- Response sanitization ----------

func sanitizeLLMResponse(response string, machines []*Machine) string {
	for _, m := range machines {
		if m.ID != "" && strings.Contains(response, m.ID) {
			parts := strings.Split(response, "```")
			for i := range parts {
				if i%2 == 0 {
					parts[i] = strings.ReplaceAll(parts[i], m.ID, m.Name)
				}
			}
			response = strings.Join(parts, "```")
		}
		if m.IP != "" && strings.Contains(response, m.IP) {
			parts := strings.Split(response, "```")
			for i := range parts {
				if i%2 == 0 {
					parts[i] = strings.ReplaceAll(parts[i], m.IP, m.Name)
				}
			}
			response = strings.Join(parts, "```")
		}
	}
	return response
}

// ---------- Action parsing (fallback for non-tool-calling models) ----------

func fixMachineIDs(ids []string, allMachines []*Machine) []string {
	var fixed []string
	for _, id := range ids {
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
		idLower := strings.ToLower(strings.TrimSpace(id))
		for _, m := range allMachines {
			if strings.ToLower(m.Name) == idLower {
				fixed = append(fixed, m.ID)
				found = true
				break
			}
		}
		if found {
			continue
		}
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
		for _, m := range allMachines {
			if strings.Contains(strings.ToLower(m.Name), idLower) {
				fixed = append(fixed, m.ID)
				found = true
				break
			}
		}
		if found {
			continue
		}
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

	if t, ok := raw["type"].(string); ok {
		action.Type = t
	} else if _, ok := raw["command"]; ok {
		action.Type = "run_command"
	}

	if cmd, ok := raw["command"].(string); ok {
		action.Command = cmd
	}

	if ids, ok := raw["machine_ids"].([]interface{}); ok {
		for _, id := range ids {
			if s, ok := id.(string); ok {
				action.MachineIDs = append(action.MachineIDs, s)
			}
		}
	}

	if ip, ok := raw["machine_ip"].(string); ok && len(action.MachineIDs) == 0 {
		for _, m := range allMachines {
			if m.IP == ip {
				action.MachineIDs = append(action.MachineIDs, m.ID)
				break
			}
		}
	}

	if id, ok := raw["machine_id"].(string); ok && len(action.MachineIDs) == 0 {
		action.MachineIDs = append(action.MachineIDs, id)
	}

	if len(action.MachineIDs) > 0 {
		action.MachineIDs = fixMachineIDs(action.MachineIDs, allMachines)
	}

	if action.Type != "" && action.Command != "" {
		return action
	}
	return nil
}

func parseActions(response string, allMachines []*Machine) []AgentAction {
	var actions []AgentAction

	start := 0
	for {
		jsonStart := strings.Index(response[start:], "```json")
		if jsonStart == -1 {
			break
		}
		jsonStart += start + 7

		jsonEnd := strings.Index(response[jsonStart:], "```")
		if jsonEnd == -1 {
			break
		}
		jsonEnd += jsonStart

		jsonStr := strings.TrimSpace(response[jsonStart:jsonEnd])

		var action AgentAction
		if err := json.Unmarshal([]byte(jsonStr), &action); err == nil && action.Type != "" && len(action.MachineIDs) > 0 {
			action.MachineIDs = fixMachineIDs(action.MachineIDs, allMachines)
			actions = append(actions, action)
		} else {
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

// ---------- System prompt ----------

func buildSystemPrompt(config *AIAgentConfig, machines []*Machine, liveContext map[string]string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf(`You are Porter AI, a powerful infrastructure assistant that manages a fleet of %d servers. You help users monitor, configure, and control their machines.

Current time: %s

PERSONALITY:
- Be warm, helpful, and conversational
- Give direct, useful answers — not vague suggestions
- When you have data about a machine, USE IT to answer directly
- If you truly don't know something, say so honestly

RULES:
- NEVER show internal machine IDs (they look like "machine-1769...")
- NEVER show IP addresses
- ALWAYS refer to machines by their display name
- When describing machine health, use the actual data provided

YOU HAVE ACCESS TO THESE TOOLS:
- run_command: Execute any shell command on machines
- execute_script: Run Porter scripts with flags on machines
- restart_service: Start/stop/restart systemd services or docker containers
- kill_process: Kill a process by PID
- check_health: Get detailed health for machines
- ping_from_machine: Test network connectivity from a machine
- wake_machine: Wake-on-LAN for offline machines

WHEN THE USER ASKS TO DO SOMETHING (run, restart, check, execute), use the appropriate tool.
DO NOT output raw JSON. Use the tool calling mechanism instead.

THINGS YOU CANNOT DO (do not pretend otherwise):
- You cannot browse files on machines (suggest using the Files tab)
- You cannot stream logs in real-time (suggest using the Logs tab)
- You cannot open interactive terminals (suggest using the Terminal tab)
- You cannot manage users or SSH keys through chat (suggest the Settings page)
- You cannot create or edit scripts (suggest the Custom Scripts page)
`, len(machines), time.Now().Format("Mon Jan 2 15:04:05 MST 2006")))

	if len(config.ScriptDescriptions) > 0 {
		sb.WriteString("\n--- AVAILABLE SCRIPTS ---\n")
		for _, desc := range config.ScriptDescriptions {
			sb.WriteString(fmt.Sprintf("\n**%s** — %s\n", desc.Name, desc.Description))
			if len(desc.Flags) > 0 {
				sb.WriteString("Flags:\n")
				for _, f := range desc.Flags {
					sb.WriteString("  " + f + "\n")
				}
			}
			if len(desc.Examples) > 0 {
				sb.WriteString("Examples:\n")
				for _, e := range desc.Examples {
					sb.WriteString("  " + e + "\n")
				}
			}
		}
	}

	if len(machines) > 0 && liveContext != nil {
		sb.WriteString(fmt.Sprintf("\n--- INFRASTRUCTURE (%d machines) ---\n", len(machines)))
		for _, m := range machines {
			status := m.Status
			if status == "" {
				status = "unknown"
			}

			ctx, hasCtx := liveContext[m.ID]
			if hasCtx && ctx != "" {
				h := parseHealthFromContext(ctx)
				sb.WriteString(fmt.Sprintf("\n## %s [%s]", m.Name, status))
				if h.Uptime != "" {
					sb.WriteString(" | " + h.Uptime)
				}
				if h.Memory != "" {
					sb.WriteString(" | " + h.Memory)
				}
				if h.Disk != "" {
					sb.WriteString(" | " + h.Disk)
				}
				sb.WriteString("\n")

				if h.Docker != "" {
					sb.WriteString("Docker: " + h.Docker + "\n")
				}

				inServices := false
				for _, line := range strings.Split(ctx, "\n") {
					trimmed := strings.TrimSpace(line)
					if trimmed == "SERVICES:" {
						inServices = true
						continue
					}
					if inServices && trimmed != "" {
						sb.WriteString("  " + trimmed + "\n")
					}
				}
			} else {
				sb.WriteString(fmt.Sprintf("\n## %s [%s]\n", m.Name, status))
			}
			if len(m.Tags) > 0 {
				sb.WriteString("Tags: " + strings.Join(m.Tags, ", ") + "\n")
			}
		}
	}

	if config.SystemPrompt != "" {
		sb.WriteString("\n")
		sb.WriteString(config.SystemPrompt)
		sb.WriteString("\n")
	}

	return sb.String()
}

// buildFallbackSystemPrompt creates a prompt for models that don't support native tool calling.
// It instructs the LLM to output JSON code blocks instead.
func buildFallbackSystemPrompt(config *AIAgentConfig, machines []*Machine, liveContext map[string]string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf(`You are Porter AI, a powerful infrastructure assistant that manages a fleet of %d servers. You help users monitor, configure, and control their machines.

Current time: %s

PERSONALITY:
- Be warm, helpful, and conversational
- Give direct, useful answers — not vague suggestions
- When you have data about a machine, USE IT to answer directly
- If you truly don't know something, say so honestly

RULES:
- NEVER show internal machine IDs (they look like "machine-1769...")
- NEVER show IP addresses
- ALWAYS refer to machines by their display name
- When describing machine health, use the actual data provided

WHEN TO SUGGEST COMMANDS:
Only when the user explicitly asks to DO something (run, restart, check logs, execute).
Use this exact JSON format inside a code block:
`+"```"+`json
{"type":"run_command","command":"actual_command_here","machine_ids":["Machine Display Name"]}
`+"```"+`
The system resolves display names automatically. For systemd services, use the exact command from the SERVICES section.

THINGS YOU CANNOT DO (do not pretend otherwise):
- You cannot browse files on machines (suggest using the Files tab)
- You cannot stream logs in real-time (suggest using the Logs tab)
- You cannot open interactive terminals (suggest using the Terminal tab)
- You cannot manage users or SSH keys through chat (suggest the Settings page)
- You cannot create or edit scripts (suggest the Custom Scripts page)
`, len(machines), time.Now().Format("Mon Jan 2 15:04:05 MST 2006")))

	if len(config.ScriptDescriptions) > 0 {
		sb.WriteString("\n--- AVAILABLE SCRIPTS ---\n")
		for _, desc := range config.ScriptDescriptions {
			sb.WriteString(fmt.Sprintf("\n**%s** — %s\n", desc.Name, desc.Description))
			if len(desc.Flags) > 0 {
				sb.WriteString("Flags:\n")
				for _, f := range desc.Flags {
					sb.WriteString("  " + f + "\n")
				}
			}
			if len(desc.Examples) > 0 {
				sb.WriteString("Examples:\n")
				for _, e := range desc.Examples {
					sb.WriteString("  " + e + "\n")
				}
			}
		}
	}

	if len(machines) > 0 && liveContext != nil {
		sb.WriteString(fmt.Sprintf("\n--- INFRASTRUCTURE (%d machines) ---\n", len(machines)))
		for _, m := range machines {
			status := m.Status
			if status == "" {
				status = "unknown"
			}

			ctx, hasCtx := liveContext[m.ID]
			if hasCtx && ctx != "" {
				h := parseHealthFromContext(ctx)
				sb.WriteString(fmt.Sprintf("\n## %s [%s]", m.Name, status))
				if h.Uptime != "" {
					sb.WriteString(" | " + h.Uptime)
				}
				if h.Memory != "" {
					sb.WriteString(" | " + h.Memory)
				}
				if h.Disk != "" {
					sb.WriteString(" | " + h.Disk)
				}
				sb.WriteString("\n")
				if h.Docker != "" {
					sb.WriteString("Docker: " + h.Docker + "\n")
				}
				inServices := false
				for _, line := range strings.Split(ctx, "\n") {
					trimmed := strings.TrimSpace(line)
					if trimmed == "SERVICES:" {
						inServices = true
						continue
					}
					if inServices && trimmed != "" {
						sb.WriteString("  " + trimmed + "\n")
					}
				}
			} else {
				sb.WriteString(fmt.Sprintf("\n## %s [%s]\n", m.Name, status))
			}
			if len(m.Tags) > 0 {
				sb.WriteString("Tags: " + strings.Join(m.Tags, ", ") + "\n")
			}
		}
	}

	if config.SystemPrompt != "" {
		sb.WriteString("\n")
		sb.WriteString(config.SystemPrompt)
		sb.WriteString("\n")
	}

	return sb.String()
}

// ---------- HTTP Route Handlers ----------

func AIAgentRoutes(r *mux.Router) {
	startBackgroundTasks()

	r.HandleFunc("/api/ai-agent/config", handleAIConfig).Methods("GET")
	r.HandleFunc("/api/ai-agent/chat", handleAIChat).Methods("POST")
	r.HandleFunc("/api/ai-agent/execute", handleAIExecute).Methods("POST")
	r.HandleFunc("/api/ai-agent/session/{id}", handleAISessionDelete).Methods("DELETE")
	r.HandleFunc("/api/ai-agent/scripts", handleAIScripts).Methods("GET")
}

func handleAIConfig(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	config := GetAIAgentConfig()
	if config == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"configured": false,
			"message":    "AI Agent not configured. Configure in your wrapper or set PORTER_AI_API_KEY.",
		})
		return
	}

	safeConfig := map[string]interface{}{
		"configured":   true,
		"provider":     config.Provider,
		"model":        config.Model,
		"has_api_key":  config.APIKey != "" || os.Getenv("PORTER_AI_API_KEY") != "",
		"script_count": len(config.ScriptDescriptions),
	}
	json.NewEncoder(w).Encode(safeConfig)
}

func handleAIChat(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	config := GetAIAgentConfig()
	if config == nil {
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

	sessionID := chatReq.SessionID
	if sessionID == "" {
		sessionID = fmt.Sprintf("session-%d", time.Now().UnixNano())
	}

	machines := machineRepo.List()

	// ========== TIER 1: Server-side fast paths (no LLM needed) ==========

	if resp := tryFastPath(chatReq, config, machines, sessionID); resp != nil {
		json.NewEncoder(w).Encode(resp)
		return
	}

	// ========== TIER 2: LLM-assisted actions ==========

	var liveContext map[string]string
	if needsMachineContext(chatReq.Message) || len(chatReq.MachineIDs) > 0 {
		liveContext = getCachedContext()
	}

	tools := buildToolDefinitions()

	var messages []ChatMessage
	systemPrompt := buildSystemPrompt(config, machines, liveContext)
	messages = append(messages, ChatMessage{
		Role:    "system",
		Content: systemPrompt,
	})

	chatSessionsLock.RLock()
	if history, ok := chatSessions[sessionID]; ok {
		if len(history) > 6 {
			messages = append(messages, history[len(history)-6:]...)
		} else {
			messages = append(messages, history...)
		}
	}
	chatSessionsLock.RUnlock()

	historyToAdd := chatReq.History
	if len(historyToAdd) > 6 {
		historyToAdd = historyToAdd[len(historyToAdd)-6:]
	}
	for _, msg := range historyToAdd {
		messages = append(messages, msg)
	}

	enrichedMessage := chatReq.Message
	if ips := ipRegex.FindAllString(chatReq.Message, -1); len(ips) > 0 {
		for _, ip := range ips {
			for _, m := range machines {
				if m.IP == ip {
					enrichedMessage = strings.ReplaceAll(enrichedMessage, ip, m.Name)
					break
				}
			}
		}
	}

	userMessage := ChatMessage{
		Role:      "user",
		Content:   enrichedMessage,
		Timestamp: time.Now(),
	}
	messages = append(messages, userMessage)

	log.Printf("AI chat: sending to LLM (tool-calling), prompt_len=%d, history=%d, needs_context=%v, tools=%d",
		len(systemPrompt), len(messages)-2, liveContext != nil, len(tools))

	response, toolCalls, tokens, err := callLLMWithTools(req.Context(), config, messages, tools)
	if err != nil {
		log.Printf("AI chat: tool-calling failed (%v), falling back to plain LLM", err)
		response, tokens, err = callLLMFallback(req.Context(), config, machines, liveContext, messages, chatReq)
		if err != nil {
			log.Printf("AI chat error: %v", err)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":      err.Error(),
				"session_id": sessionID,
			})
			return
		}
		toolCalls = nil
	}

	var actions []AgentAction

	if len(toolCalls) > 0 {
		var sb strings.Builder
		if response != "" {
			sb.WriteString(response + "\n\n")
		}
		for _, tc := range toolCalls {
			toolResponse, toolActions := executeToolCall(tc, machines, false)
			sb.WriteString(toolResponse)
			sb.WriteString("\n")
			actions = append(actions, toolActions...)
		}
		response = sb.String()
	} else {
		response = sanitizeLLMResponse(response, machines)
		actions = parseActions(response, machines)
	}

	assistantMessage := ChatMessage{
		Role:      "assistant",
		Content:   response,
		Timestamp: time.Now(),
	}

	chatSessionsLock.Lock()
	chatSessions[sessionID] = append(chatSessions[sessionID], userMessage, assistantMessage)
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
}

func callLLMFallback(ctx context.Context, config *AIAgentConfig, machines []*Machine, liveContext map[string]string, messages []ChatMessage, chatReq ChatRequest) (string, int, error) {
	fallbackMessages := make([]ChatMessage, 0, len(messages))
	fallbackPrompt := buildFallbackSystemPrompt(config, machines, liveContext)
	fallbackMessages = append(fallbackMessages, ChatMessage{Role: "system", Content: fallbackPrompt})
	for _, m := range messages[1:] {
		fallbackMessages = append(fallbackMessages, m)
	}
	return callLLM(ctx, config, fallbackMessages)
}

func tryFastPath(chatReq ChatRequest, config *AIAgentConfig, machines []*Machine, sessionID string) *ChatResponse {
	msg := chatReq.Message

	if isTimeQuery(msg) {
		return handleTimeFastPath(chatReq, machines, sessionID)
	}

	if isScriptsQuery(msg) {
		return handleScriptsFastPath(config, sessionID)
	}

	if isListMachinesQuery(msg) {
		return &ChatResponse{
			Message:   buildListMachinesResponse(machines),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if isHealthOverviewQuery(msg) {
		liveContext := gatherContextForMachines(machines)
		return &ChatResponse{
			Message:   buildHealthOverview(machines, liveContext),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if isScheduledJobsQuery(msg) {
		return &ChatResponse{
			Message:   buildScheduledJobsResponse(),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if isBackupsQuery(msg) {
		return &ChatResponse{
			Message:   buildBackupsResponse(),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if isHistoryQuery(msg) {
		return &ChatResponse{
			Message:   buildHistoryResponse(),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if isNotificationsQuery(msg) {
		return &ChatResponse{
			Message:   buildNotificationsResponse(),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if isListServicesQuery(msg) {
		targets := resolveTargetMachines(msg, chatReq.MachineIDs, machines)
		if len(targets) == 0 {
			targets = machines
		}
		liveContext := gatherContextForMachines(targets)
		return &ChatResponse{
			Message:   buildListServicesResponse(targets, liveContext),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if isListProcessesQuery(msg) {
		targets := resolveTargetMachines(msg, chatReq.MachineIDs, machines)
		if len(targets) == 0 {
			return nil
		}
		return &ChatResponse{
			Message:   buildListProcessesResponse(targets),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if action, svcName := parseServiceAction(msg); action != "" && svcName != "" {
		return handleServiceFastPath(chatReq, machines, sessionID, action, svcName)
	}

	if isMachineInfoQuery(msg) {
		targets := resolveTargetMachines(msg, chatReq.MachineIDs, machines)
		if len(targets) > 0 {
			liveContext := gatherContextForMachines(targets)
			var sb strings.Builder
			for _, m := range targets {
				sb.WriteString(buildMachineDetail(m, liveContext[m.ID]))
			}
			return &ChatResponse{
				Message:   sb.String(),
				SessionID: sessionID,
				Timestamp: time.Now(),
			}
		}
	}

	return nil
}

func handleTimeFastPath(chatReq ChatRequest, machines []*Machine, sessionID string) *ChatResponse {
	msg := strings.ToLower(chatReq.Message)
	targets := resolveTargetMachines(chatReq.Message, chatReq.MachineIDs, machines)

	if len(targets) > 0 {
		var sb strings.Builder
		for _, m := range targets {
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
		return &ChatResponse{
			Message:   sb.String(),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	if !strings.Contains(msg, "server") || strings.Contains(msg, "all") {
		return &ChatResponse{
			Message:   fmt.Sprintf("The current server time is **%s**", time.Now().Format("Mon Jan 2 15:04:05 MST 2006")),
			SessionID: sessionID,
			Timestamp: time.Now(),
		}
	}

	return nil
}

func handleScriptsFastPath(config *AIAgentConfig, sessionID string) *ChatResponse {
	var sb strings.Builder
	sb.WriteString("Here are the available scripts:\n\n")
	if len(config.ScriptDescriptions) > 0 {
		for _, desc := range config.ScriptDescriptions {
			sb.WriteString(fmt.Sprintf("### %s\n%s\n", desc.Name, desc.Description))
			if len(desc.Flags) > 0 {
				sb.WriteString("\n**Flags:**\n")
				for _, f := range desc.Flags {
					sb.WriteString(fmt.Sprintf("- `%s`\n", f))
				}
			}
			if len(desc.Examples) > 0 {
				sb.WriteString("\n**Examples:**\n```\n")
				for _, e := range desc.Examples {
					sb.WriteString(e + "\n")
				}
				sb.WriteString("```\n")
			}
			sb.WriteString("\n")
		}
	} else {
		scripts, _ := discoverScripts()
		if len(scripts) > 0 {
			for _, s := range scripts {
				sb.WriteString(fmt.Sprintf("- **%s** — %s\n", s.Name, s.Description))
			}
		} else {
			sb.WriteString("No scripts are currently configured.\n")
		}
	}
	sb.WriteString("Would you like to know more about any of these, or run one?")
	return &ChatResponse{
		Message:   sb.String(),
		SessionID: sessionID,
		Timestamp: time.Now(),
	}
}

func handleServiceFastPath(chatReq ChatRequest, machines []*Machine, sessionID string, action string, svcName string) *ChatResponse {
	targets := resolveTargetMachines(chatReq.Message, chatReq.MachineIDs, machines)

	if len(targets) == 0 {
		return nil
	}

	liveContext := gatherContextForMachines(targets)
	var sb strings.Builder
	var actions []AgentAction
	for _, m := range targets {
		ctx := liveContext[m.ID]
		svcType := detectServiceType(ctx, svcName)
		cmd := buildServiceCommand(action, svcName, svcType)
		sb.WriteString(fmt.Sprintf("**%s** on **%s**: `%s`\n", strings.ToUpper(action[:1])+action[1:], m.Name, cmd))
		actions = append(actions, AgentAction{
			Type:       "run_command",
			Command:    cmd,
			MachineIDs: []string{m.ID},
		})
	}
	return &ChatResponse{
		Message:   sb.String(),
		SessionID: sessionID,
		Timestamp: time.Now(),
		Actions:   actions,
	}
}

// ---------- Execute endpoint ----------

func handleAIExecute(w http.ResponseWriter, req *http.Request) {
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

	useSudo := false
	claims := getClaimsFromRequest(req)
	if claims != nil && (claims.Role == "admin" || HasPermission(claims.Permissions, "sudo:enabled")) {
		useSudo = true
	}

	switch action.Type {
	case "execute_script":
		handleExecuteScript(w, action, useSudo)

	case "run_command":
		handleRunCommand(w, action, useSudo)

	case "wake_machine":
		handleWakeMachine(w, action)

	default:
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Unknown action type: " + action.Type,
		})
	}
}

func handleExecuteScript(w http.ResponseWriter, action AgentAction, useSudo bool) {
	if action.ScriptPath == "" || len(action.MachineIDs) == 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Missing script_path or machine_ids",
		})
		return
	}

	var args []string
	if rawArgs, ok := action.Args["_raw"]; ok {
		args = append(args, rawArgs)
	} else {
		for flag, value := range action.Args {
			if value == "true" {
				args = append(args, flag)
			} else if value != "" && value != "false" {
				args = append(args, fmt.Sprintf("%s=%s", flag, value))
			}
		}
	}

	execID := fmt.Sprintf("ai-exec-%d", time.Now().UnixNano())
	execution := execTracker.Create(execID, action.ScriptPath, strings.Join(args, " "), action.MachineIDs)

	go executeScriptAsync(execID, action.ScriptPath, action.MachineIDs, strings.Join(args, " "), useSudo)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"execution_id": execID,
		"execution":    execution,
	})
}

func handleRunCommand(w http.ResponseWriter, action AgentAction, useSudo bool) {
	if action.Command == "" || len(action.MachineIDs) == 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Missing command or machine_ids",
		})
		return
	}

	validatedCmd, err := ValidateCommand(action.Command)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	if IsDangerousCommand(validatedCmd) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   false,
			"error":     "This command is potentially dangerous and requires explicit confirmation",
			"dangerous": true,
		})
		return
	}

	cmdSudo := useSudo
	if strings.Contains(validatedCmd, "--user") {
		cmdSudo = false
	}

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
}

func handleWakeMachine(w http.ResponseWriter, action AgentAction) {
	if len(action.MachineIDs) == 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No machine specified",
		})
		return
	}

	var results []map[string]interface{}
	for _, machineID := range action.MachineIDs {
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			results = append(results, map[string]interface{}{
				"machine_id": machineID,
				"success":    false,
				"error":      "Machine not found",
			})
			continue
		}
		if machine.MAC == "" {
			results = append(results, map[string]interface{}{
				"machine_id": machineID,
				"machine":    machine.Name,
				"success":    false,
				"error":      "No MAC address configured",
			})
			continue
		}
		err := WakeOnLAN(machine.MAC, "255.255.255.255")
		if err != nil {
			results = append(results, map[string]interface{}{
				"machine_id": machineID,
				"machine":    machine.Name,
				"success":    false,
				"error":      err.Error(),
			})
		} else {
			results = append(results, map[string]interface{}{
				"machine_id": machineID,
				"machine":    machine.Name,
				"success":    true,
			})
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"results": results,
	})
}

func handleAISessionDelete(w http.ResponseWriter, req *http.Request) {
	sessionID := mux.Vars(req)["id"]

	chatSessionsLock.Lock()
	delete(chatSessions, sessionID)
	delete(chatSessionsAccess, sessionID)
	chatSessionsLock.Unlock()

	w.WriteHeader(http.StatusOK)
}

func handleAIScripts(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	config := GetAIAgentConfig()

	var scriptList []ScriptDescription

	if config != nil && len(config.ScriptDescriptions) > 0 {
		for _, desc := range config.ScriptDescriptions {
			scriptList = append(scriptList, desc)
		}
	} else {
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
}
