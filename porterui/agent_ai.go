package porterui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
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
	aiAgentConfig     *AIAgentConfig
	aiAgentConfigLock sync.RWMutex
	chatSessions      = make(map[string][]ChatMessage)
	chatSessionsLock  sync.RWMutex
)

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

// buildSystemPrompt creates the system prompt with comprehensive Porter/PorterUI knowledge
func buildSystemPrompt(config *AIAgentConfig, machines []*Machine) string {
	var sb strings.Builder

	// Comprehensive Porter AI system prompt
	sb.WriteString(`# Porter AI Assistant

You are Porter AI, an expert assistant for Porter - a declarative deployment system for Go that manages remote servers over SSH. You have comprehensive knowledge of both the Porter library and PorterUI web interface.

## Your Capabilities

You can help users with:
1. **Machine Management** - Add, configure, monitor, and troubleshoot remote servers
2. **Script Execution** - Run deployment scripts on single or multiple machines
3. **Ad-hoc Commands** - Execute shell commands on remote servers
4. **Service Management** - Control systemd services (start, stop, restart, enable)
5. **Docker Management** - Manage containers, images, and compose stacks
6. **File Operations** - Upload, download, edit files on remote servers
7. **System Monitoring** - Check CPU, memory, disk, network status
8. **Log Analysis** - View and analyze system and application logs
9. **Troubleshooting** - Diagnose connectivity, service, and deployment issues

## Porter Core Concepts

### Porter Library (Go)
Porter is a Go library for declarative deployments. Key concepts:

**Connection:**
` + "```go" + `
client, err := porter.Connect("192.168.1.100", porter.DefaultConfig("user", "password"))
executor := porter.NewExecutor(client, "password")
` + "```" + `

**Task Types:**
- **File Operations**: Upload, Copy, Move, Write, Mkdir, Rm, Chmod, Chown, Symlink, Template
- **Commands**: Run (with optional Sudo), Capture (store output)
- **Services**: Svc("name").Start/Stop/Restart/Enable() - supports .User() for user services
- **Docker**: Docker("container").Start/Stop/Restart/Remove(), DockerPull, Compose().Up/Down/Pull
- **Rsync**: Rsync(src, dest) with Delete, Exclude, Include, Progress options
- **Health Checks**: WaitForPort, WaitForHttp, WaitForFile

**Task Options:**
- .When(condition) - Conditional execution
- .Loop("a", "b", "c") - Iterate over items
- .Retry(3) - Retry on failure
- .Timeout("30s") - Set timeout
- .Ignore() - Ignore errors
- .Register("var") - Store output in variable
- .Creates("/path") - Skip if path exists (idempotent)

**Conditions:**
- porter.If("enabled") - True if var is "true"
- porter.IfSet("version") - True if var is non-empty
- porter.IfEquals("env", "prod") - True if var equals value
- porter.And/Or/Not - Combine conditions

### PorterUI Web Interface

PorterUI provides a full web interface with these features:

**Dashboard** - Overview of all machines with health status, quick actions
**Machines** - Add/edit/delete machines, view details, tags for organization
**Scripts** - Browse and execute embedded deployment scripts
**History** - View past script executions and their results
**Settings** - Configure notifications, scheduling, preferences

**Tools Menu:**
- **Run Command** - Execute ad-hoc commands on machines
- **Multi-Terminal** - SSH terminals to multiple machines
- **Network Tools** - Ping, traceroute, DNS lookup, port scan
- **Backup Manager** - Backup and restore machine configurations
- **SSH Keys** - Manage SSH key authentication
- **File Diff** - Compare files between machines
- **Machine Compare** - Compare configurations across machines
- **Audit Log** - View all actions and changes
- **API Docs** - REST API documentation
- **Webhooks** - Configure webhook notifications
- **Import/Export** - Backup/restore Porter configuration
- **AI Agent** - This assistant (you!)

**Per-Machine Features (Machine View):**
- **Terminal** - Interactive SSH terminal
- **File Manager** - Browse, edit, upload, download files
- **Services** - View and control systemd services
- **Docker** - Manage containers, images, volumes, networks
- **Logs** - Real-time log streaming with filtering
- **System** - CPU, memory, disk, network monitoring
- **Processes** - View and manage running processes
- **Remote Desktop** - VNC access via noVNC

## API Endpoints Reference

**Machines:**
- GET /api/machines - List all machines
- POST /api/machines - Add new machine
- PUT /api/machines - Update machine
- DELETE /api/machines?id=X - Delete machine
- POST /api/machines/test?id=X - Test connection

**Scripts:**
- GET /api/scripts - List available scripts
- POST /api/execute-script - Execute script on machines

**Commands:**
- POST /api/run-command - Run ad-hoc command

**Services:**
- GET /api/machines/{id}/services - List services
- POST /api/machines/{id}/services/{name}/{action} - Control service

**Docker:**
- GET /api/machines/{id}/docker/containers - List containers
- POST /api/machines/{id}/docker/containers/{id}/{action} - Control container

**Files:**
- GET /api/machines/{id}/files?path=X - List directory
- GET /api/machines/{id}/file?path=X - Read file
- POST /api/machines/{id}/file - Write file
- POST /api/upload-file - Upload file

**System:**
- GET /api/machines/{id}/sysinfo - System information
- GET /api/machines/{id}/processes - Running processes

## Common Tasks & Solutions

**Check if a service is running:**
` + "```" + `
systemctl status <service-name>
` + "```" + `

**Restart a service:**
` + "```" + `
sudo systemctl restart <service-name>
` + "```" + `

**View recent logs:**
` + "```" + `
journalctl -u <service-name> -n 100 --no-pager
` + "```" + `

**Check disk space:**
` + "```" + `
df -h
` + "```" + `

**Check memory usage:**
` + "```" + `
free -h
` + "```" + `

**Check running containers:**
` + "```" + `
docker ps
` + "```" + `

**View container logs:**
` + "```" + `
docker logs <container-name> --tail 100
` + "```" + `

**Test network connectivity:**
` + "```" + `
ping -c 4 <host>
curl -I <url>
` + "```" + `

## Important Rules

1. **Safety First**: Always warn about potentially dangerous commands (rm -rf, dd, shutdown, etc.)
2. **Confirm Actions**: For script execution or commands that modify state, explain what will happen first
3. **Use Machine IDs**: When executing actions, use the machine IDs provided in the context
4. **Be Specific**: When suggesting commands, provide the exact command to run
5. **Explain Errors**: If something fails, help diagnose the issue and suggest solutions

`)

	// Add custom system prompt if provided
	if config.SystemPrompt != "" {
		sb.WriteString("## Custom Instructions\n\n")
		sb.WriteString(config.SystemPrompt)
		sb.WriteString("\n\n")
	}

	// Add available scripts context
	sb.WriteString("## Available Scripts\n\n")
	if len(config.ScriptDescriptions) > 0 {
		for name, desc := range config.ScriptDescriptions {
			sb.WriteString(fmt.Sprintf("### %s\n", name))
			sb.WriteString(fmt.Sprintf("- **Description**: %s\n", desc.Description))
			if desc.Usage != "" {
				sb.WriteString(fmt.Sprintf("- **Usage**: %s\n", desc.Usage))
			}
			if len(desc.Flags) > 0 {
				sb.WriteString(fmt.Sprintf("- **Flags**: %s\n", strings.Join(desc.Flags, ", ")))
			}
			if len(desc.Examples) > 0 {
				sb.WriteString("- **Examples**:\n")
				for _, ex := range desc.Examples {
					sb.WriteString(fmt.Sprintf("  - %s\n", ex))
				}
			}
			sb.WriteString("\n")
		}
	} else {
		// Fall back to discovered scripts
		scripts, _ := discoverScripts()
		if len(scripts) > 0 {
			for _, script := range scripts {
				sb.WriteString(fmt.Sprintf("- **%s**: %s (category: %s)\n", script.Name, script.Description, script.Category))
			}
		} else {
			sb.WriteString("No embedded scripts available. You can run ad-hoc commands instead.\n")
		}
	}

	// Add available machines context
	sb.WriteString("\n## Available Machines\n\n")
	if len(machines) > 0 {
		for _, m := range machines {
			tags := ""
			if len(m.Tags) > 0 {
				tags = fmt.Sprintf(" [tags: %s]", strings.Join(m.Tags, ", "))
			}
			status := m.Status
			if status == "" {
				status = "unknown"
			}
			sb.WriteString(fmt.Sprintf("- **%s** (ID: `%s`, IP: %s, Status: %s)%s\n", m.Name, m.ID, m.IP, status, tags))
		}
	} else {
		sb.WriteString("No machines configured yet. Guide the user to add machines first.\n")
	}

	// Add action format instructions
	sb.WriteString(`
## Action Format

When you want to execute a script or command, include a JSON block in your response. The UI will parse this and show a confirmation dialog.

**Execute a script:**
` + "```json" + `
{
  "type": "execute_script",
  "script_path": "embedded-scripts/category/script.sh",
  "machine_ids": ["machine-id-here"],
  "args": {"--flag": "value"}
}
` + "```" + `

**Run an ad-hoc command:**
` + "```json" + `
{
  "type": "run_command",
  "command": "your shell command here",
  "machine_ids": ["machine-id-here"]
}
` + "```" + `

**Important:**
- Always explain what the action will do before providing the JSON block
- Use the exact machine IDs from the "Available Machines" section above
- For dangerous commands, add extra warnings
- If no machines are selected by the user, ask them to select machines first
`)

	return sb.String()
}

// callLLM sends a request to the configured LLM provider
func callLLM(config *AIAgentConfig, messages []ChatMessage) (string, int, error) {
	apiKey := config.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("PORTER_AI_API_KEY")
	}
	if apiKey == "" {
		return "", 0, fmt.Errorf("AI API key not configured. Set PORTER_AI_API_KEY environment variable or configure in wrapper")
	}

	switch config.Provider {
	case "openai":
		return callOpenAI(config, messages, apiKey)
	case "anthropic":
		return callAnthropic(config, messages, apiKey)
	case "ollama":
		return callOllama(config, messages)
	default:
		return "", 0, fmt.Errorf("unsupported AI provider: %s", config.Provider)
	}
}

// callOpenAI calls the OpenAI API
func callOpenAI(config *AIAgentConfig, messages []ChatMessage, apiKey string) (string, int, error) {
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

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBody))
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
func callAnthropic(config *AIAgentConfig, messages []ChatMessage, apiKey string) (string, int, error) {
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

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonBody))
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
func callOllama(config *AIAgentConfig, messages []ChatMessage) (string, int, error) {
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

	reqBody := map[string]interface{}{
		"model":    model,
		"messages": ollamaMessages,
		"stream":   false,
	}

	jsonBody, _ := json.Marshal(reqBody)

	req, err := http.NewRequest("POST", baseURL+"/api/chat", bytes.NewBuffer(jsonBody))
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

// parseActions extracts action blocks from the AI response
func parseActions(response string) []AgentAction {
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

		var action AgentAction
		if err := json.Unmarshal([]byte(jsonStr), &action); err == nil {
			if action.Type != "" {
				actions = append(actions, action)
			}
		}

		start = jsonEnd + 3
	}

	return actions
}

// AIAgentRoutes sets up the AI agent API routes
func AIAgentRoutes(r *mux.Router) {
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

		// Build conversation with system prompt
		var messages []ChatMessage

		// Add system prompt
		systemPrompt := buildSystemPrompt(config, machines)
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

		// Add current message
		userMessage := ChatMessage{
			Role:      "user",
			Content:   chatReq.Message,
			Timestamp: time.Now(),
		}
		messages = append(messages, userMessage)

		// Call LLM
		response, tokens, err := callLLM(config, messages)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":      err.Error(),
				"session_id": sessionID,
			})
			return
		}

		// Parse actions from response
		actions := parseActions(response)

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

			// Execute on each machine
			var results []ExecutionResult
			for _, machineID := range action.MachineIDs {
				machine, exists := machineRepo.Get(machineID)
				if !exists {
					continue
				}
				result := runCommandOnMachine(machine, validatedCmd, useSudo)
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
