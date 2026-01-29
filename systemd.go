package porter

import "strings"

// =============================================================================
// SYSTEMD SERVICES
// =============================================================================

// SvcBuilder provides a fluent API for systemd service operations.
type SvcBuilder struct{ t Task }

// Svc creates a service builder for the named systemd unit.
func Svc(name string) SvcBuilder {
	return SvcBuilder{Task{Action: "service", Dest: name}}
}

// Start starts the service.
func (s SvcBuilder) Start() TaskBuilder {
	s.t.State = "start"
	s.t.Name = "Start " + s.t.Dest
	return TaskBuilder(s)
}

// Stop stops the service.
func (s SvcBuilder) Stop() TaskBuilder {
	s.t.State = "stop"
	s.t.Name = "Stop " + s.t.Dest
	return TaskBuilder(s)
}

// Restart restarts the service.
func (s SvcBuilder) Restart() TaskBuilder {
	s.t.State = "restart"
	s.t.Name = "Restart " + s.t.Dest
	return TaskBuilder(s)
}

// Enable enables the service to start on boot.
func (s SvcBuilder) Enable() TaskBuilder {
	s.t.State = "enable"
	s.t.Name = "Enable " + s.t.Dest
	return TaskBuilder(s)
}

// Disable disables the service from starting on boot.
func (s SvcBuilder) Disable() TaskBuilder {
	s.t.State = "disable"
	s.t.Name = "Disable " + s.t.Dest
	return TaskBuilder(s)
}

// Status gets the status of the service.
func (s SvcBuilder) Status() TaskBuilder {
	s.t.State = "status"
	s.t.Name = "Status " + s.t.Dest
	return TaskBuilder(s)
}

// DaemonReload reloads systemd configuration.
func DaemonReload() TaskBuilder {
	return TaskBuilder{Task{Action: "daemon_reload", Name: "Reload systemd"}}
}

// SvcList lists all systemd services. Use .User() for user services.
func SvcList() TaskBuilder {
	return TaskBuilder{Task{Action: "service_list", Name: "List services"}}
}

// SvcTimers lists all systemd timers. Use .User() for user timers.
func SvcTimers() TaskBuilder {
	return TaskBuilder{Task{Action: "timer_list", Name: "List timers"}}
}

// =============================================================================
// JOURNALCTL (SYSTEMD LOGS)
// =============================================================================

// Journal returns a TaskBuilder for retrieving all system journal logs.
func Journal() TaskBuilder {
	return TaskBuilder{Task{Action: "journal", Name: "Journal logs"}}
}

// JournalUnit returns a TaskBuilder for retrieving logs for a specific systemd unit.
func JournalUnit(unit string) TaskBuilder {
	return TaskBuilder{Task{Action: "journal", Dest: unit, Name: "Journal logs for " + unit}}
}

// Lines limits the number of log lines to retrieve.
func (b TaskBuilder) Lines(n string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-n "+n)
	return b
}

// Follow enables real-time log following (use with caution in automation).
func (b TaskBuilder) Follow() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-f")
	return b
}

// Since filters logs from a specific time (e.g., "2024-12-11 10:00:00", "1 hour ago").
func (b TaskBuilder) Since(time string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--since="+shellEscape(time))
	return b
}

// Until filters logs until a specific time.
func (b TaskBuilder) Until(time string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--until="+shellEscape(time))
	return b
}

// Priority filters logs by priority level (emerg, alert, crit, err, warning, notice, info, debug).
func (b TaskBuilder) Priority(level string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-p "+level)
	return b
}

// Grep filters logs matching a pattern.
func (b TaskBuilder) Grep(pattern string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--grep="+shellEscape(pattern))
	return b
}

// Reverse shows newest entries first.
func (b TaskBuilder) Reverse() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-r")
	return b
}

// NoPager disables pager output.
func (b TaskBuilder) NoPager() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--no-pager")
	return b
}

// Output sets the output format (short, json, json-pretty, verbose, cat, etc.).
func (b TaskBuilder) Output(format string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-o "+format)
	return b
}

// Boot shows logs from a specific boot (empty string for current boot).
func (b TaskBuilder) Boot(id string) TaskBuilder {
	if id == "" {
		b.t.Body = appendJournalFlag(b.t.Body, "-b")
	} else {
		b.t.Body = appendJournalFlag(b.t.Body, "-b "+id)
	}
	return b
}

// Kernel shows kernel logs only.
func (b TaskBuilder) Kernel() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-k")
	return b
}

// Dmesg shows kernel ring buffer (similar to dmesg command).
func (b TaskBuilder) Dmesg() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--dmesg")
	return b
}

// System shows system logs explicitly.
func (b TaskBuilder) System() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--system")
	return b
}

// UTC shows timestamps in UTC.
func (b TaskBuilder) UTC() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--utc")
	return b
}

// Catalog adds explanatory help texts to log messages.
func (b TaskBuilder) Catalog() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-x")
	return b
}

// appendJournalFlag is a helper to append flags to the Body field.
func appendJournalFlag(current, flag string) string {
	if current == "" {
		return flag
	}
	return current + " " + flag
}

// shellEscape escapes a string for safe use in shell commands.
func shellEscape(s string) string {
	return "'" + strings.Replace(s, "'", "'\\''", -1) + "'"
}

// =============================================================================
// SYSTEMD SERVICE FILE MANAGEMENT
// =============================================================================

// EscapeSed escapes special characters for sed replacement strings.
// Use this when passing dynamic values to Sed() to avoid syntax errors.
func EscapeSed(value string) string {
	v := strings.ReplaceAll(value, `\`, `\\`)
	v = strings.ReplaceAll(v, `&`, `\&`)
	v = strings.ReplaceAll(v, `/`, `\/`)
	return v
}

// UpdateServiceParam creates a sed pattern that updates a systemd service parameter
// while preserving its existing quote style (quoted vs unquoted).
// For example, updating -port=3099 or -port="3099" will preserve the original format.
// The pattern matches: -paramName="value" or -paramName=value
func UpdateServiceParam(paramName, newValue string) string {
	escaped := EscapeSed(newValue)
	// Pattern explanation:
	// s%                    - sed substitute command with % delimiter
	// -paramName=           - literal match of parameter
	// \("\{0,1\}\)          - capture group 1: optional quote (0 or 1 times)
	// \([^" ]*\)            - capture group 2: the value (non-quote, non-space chars)
	// \1                    - back-reference to match closing quote if opening existed
	// -paramName=\1...\1    - replacement preserving quote style
	// %g                    - global flag
	return `s%-` + paramName + `=\("\{0,1\}\)\([^" ]*\)\1%-` + paramName + `=\1` + escaped + `\1%g`
}

// UpdateServiceParamTask creates a TaskBuilder that updates a systemd service parameter
// in the specified file while preserving quote style.
func UpdateServiceParamTask(servicePath, paramName, newValue string) TaskBuilder {
	pattern := UpdateServiceParam(paramName, newValue)
	return Sed(pattern, servicePath).Name("Update " + paramName + " in " + servicePath)
}

// ServiceFileConfig defines configuration for managing a systemd service file.
type ServiceFileConfig struct {
	Name      string            // Service name (e.g., "myapp", "worker")
	Template  string            // Service file template content
	IsUser    bool              // true for user services (~/.config/systemd/user/), false for system (/etc/systemd/system/)
	Params    map[string]string // Parameters to update if service file exists (key=param name, value=new value)
	NeedsSudo bool              // true if template creation needs sudo (always true for system services; sed updates always use sudo)
	When      When              // Optional condition to apply to all generated tasks (combined with internal conditions via And)
}

// servicePath returns the full path to the service file based on IsUser flag.
// For user services: ~/.config/systemd/user/<name>.service
// For system services: /etc/systemd/system/<name>.service
func (c ServiceFileConfig) servicePath() string {
	if c.IsUser {
		return "~/.config/systemd/user/" + c.Name + ".service"
	}
	return "/etc/systemd/system/" + c.Name + ".service"
}

// ManageServiceFile creates a task group that idempotently manages a systemd service file:
// 1. Checks if the service file exists
// 2. Creates from template if missing
// 3. Updates parameters if the file exists
//
// The returned tasks use a variable named "<serviceName>_service_exists" to track state.
// For user services, tasks are configured with .User(). For system services, tasks use .Sudo().
//
// Example usage:
//
//	tasks := porter.ManageServiceFile(porter.ServiceFileConfig{
//	    Name:     "myapp",
//	    Template: appServiceTemplate,
//	    IsUser:   true,
//	    Params: map[string]string{
//	        "port": "8080",
//	        "host": "0.0.0.0",
//	    },
//	    When: porter.IfEquals("env", "production"), // Optional: only run in production
//	})
func ManageServiceFile(cfg ServiceFileConfig) []Task {
	servicePath := cfg.servicePath()
	existsVar := cfg.Name + "_service_exists"

	var builders []TaskBuilder

	// 1. Check if service file exists
	builders = append(builders,
		FileExists(servicePath).Register(existsVar).Name("Check if "+cfg.Name+" service exists"),
	)

	// 2. Create from template if missing
	// System services always need sudo; user services need sudo if NeedsSudo is set
	needsSudo := !cfg.IsUser || cfg.NeedsSudo
	createTask := Template(servicePath, cfg.Template).Name("Create " + cfg.Name + " service file")
	if cfg.IsUser {
		createTask = createTask.User()
	}
	if needsSudo {
		createTask = createTask.Sudo()
	}
	createTask = createTask.When(IfEquals(existsVar, "false"))
	builders = append(builders, createTask)

	// 3. Update parameters if file exists
	for paramName, paramValue := range cfg.Params {
		updateTask := UpdateServiceParamTask(servicePath, paramName, paramValue)
		if needsSudo {
			updateTask = updateTask.Sudo()
		}
		updateTask = updateTask.When(IfEquals(existsVar, "true"))
		builders = append(builders, updateTask)
	}

	tasks := Tasks(builders...)

	// Apply user's condition to all tasks if provided
	if cfg.When != nil {
		for i := range tasks {
			if tasks[i].When != nil {
				tasks[i].When = And(cfg.When, tasks[i].When)
			} else {
				tasks[i].When = cfg.When
			}
		}
	}

	return tasks
}

// ManageServiceFiles creates tasks for multiple systemd service files.
// This is a convenience wrapper that calls ManageServiceFile for each config.
func ManageServiceFiles(configs []ServiceFileConfig) []Task {
	var tasks []Task
	for _, cfg := range configs {
		tasks = append(tasks, ManageServiceFile(cfg)...)
	}
	return tasks
}

// BuildServiceTasks is an alias for ManageServiceFile that makes the conditional
// execution pattern more explicit. Use this when you want to emphasize that the
// When condition controls whether the entire service management workflow runs.
//
// Example:
//
//	tasks := porter.BuildServiceTasks(porter.ServiceFileConfig{
//	    Name:     "myapp",
//	    Template: appServiceTemplate,
//	    IsUser:   true,
//	    Params:   map[string]string{"port": "8080"},
//	    When:     porter.IfEquals("env", "production"),
//	})
func BuildServiceTasks(cfg ServiceFileConfig) []Task {
	return ManageServiceFile(cfg)
}

// ManageServiceFileWithReload is like ManageServiceFile but also adds daemon-reload
// and service restart tasks at the end.
func ManageServiceFileWithReload(cfg ServiceFileConfig) []Task {
	tasks := ManageServiceFile(cfg)

	// Add daemon-reload
	reloadTask := DaemonReload()
	if cfg.IsUser {
		reloadTask = reloadTask.User()
	} else {
		reloadTask = reloadTask.Sudo()
	}

	// Add service restart
	restartTask := Svc(cfg.Name).Restart()
	if cfg.IsUser {
		restartTask = restartTask.User()
	} else {
		restartTask = restartTask.Sudo()
	}

	allTasks := append(tasks, Tasks(reloadTask, restartTask)...)

	// Apply user's condition to reload and restart tasks if provided
	if cfg.When != nil {
		for i := len(tasks); i < len(allTasks); i++ {
			if allTasks[i].When != nil {
				allTasks[i].When = And(cfg.When, allTasks[i].When)
			} else {
				allTasks[i].When = cfg.When
			}
		}
	}

	return allTasks
}
