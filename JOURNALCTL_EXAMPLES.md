# Journalctl Support in Porter

Porter includes support for `journalctl` to retrieve systemd logs for troubleshooting and monitoring with a type-safe, fluent API.

## Features

- **Type-safe fluent API** - Chainable methods with consistent return types
- **Shell injection protection** - Automatic escaping of user input
- **Comprehensive flag support** - All common journalctl options covered
- **Seamless integration** - Works with `.Register()`, `.When()`, `.Sudo()`, etc.

## Basic Usage

### Get logs for a specific service

```go
tasks := porter.Tasks(
    porter.JournalUnit("nginx").Lines("100").Sudo().Register("nginx_logs"),
)
```

### Get all system logs

```go
tasks := porter.Tasks(
    porter.Journal().Lines("50").Sudo().Register("system_logs"),
)
```

## Common Troubleshooting Patterns

### Check recent errors for a service

```go
tasks := porter.Tasks(
    porter.JournalUnit("myapp").
        Priority("err").
        Lines("50").
        Sudo().
        Register("app_errors"),
)
```

### Get logs since a specific time

```go
tasks := porter.Tasks(
    porter.JournalUnit("nginx").
        Since("2024-12-11 10:00:00").
        Sudo().
        Register("recent_logs"),
)
```

### Get logs from current boot

```go
tasks := porter.Tasks(
    porter.JournalUnit("docker").
        Boot("").
        Lines("100").
        Sudo().
        Register("boot_logs"),
)
```

### Search logs for a pattern

```go
tasks := porter.Tasks(
    porter.JournalUnit("myapp").
        Grep("error|failed|panic").
        Lines("200").
        Sudo().
        Register("error_logs"),
)
```

### Get kernel logs

```go
tasks := porter.Tasks(
    porter.Journal().
        Kernel().
        Lines("50").
        Sudo().
        Register("kernel_logs"),
)
```

## Advanced Examples

### Time-range query

```go
tasks := porter.Tasks(
    porter.JournalUnit("nginx").
        Since("2024-12-11 00:00:00").
        Until("2024-12-11 23:59:59").
        Priority("warning").
        Sudo().
        Register("daily_warnings"),
)
```

### Reverse chronological order

```go
tasks := porter.Tasks(
    porter.JournalUnit("myapp").
        Lines("100").
        Reverse().
        Sudo().
        Register("latest_first"),
)
```

### JSON output format

```go
tasks := porter.Tasks(
    porter.JournalUnit("myapp").
        Output("json").
        Lines("10").
        Sudo().
        Register("logs_json"),
)
```

### User-level systemd logs

```go
tasks := porter.Tasks(
    porter.JournalUnit("myapp").
        User().
        Lines("50").
        Register("user_logs"),
)
```

## Complete Troubleshooting Workflow

```go
package main

import (
    "fmt"
    "log"
    "github.com/yourusername/porter"
)

func main() {
    // Connect to server
    client, err := porter.Connect("user@host", "password", "keypath")
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    vars := porter.NewVars()
    executor := porter.NewExecutor(client, "password")

    // Troubleshooting playbook
    tasks := porter.Tasks(
        // Check if service is running
        porter.ServiceRunning("myapp").Register("is_running"),
        
        // Get recent logs if service is down
        porter.JournalUnit("myapp").
            Lines("100").
            Priority("err").
            Sudo().
            Register("error_logs").
            When(porter.IfEquals("is_running", "false")),
        
        // Get full logs for analysis
        porter.JournalUnit("myapp").
            Since("1 hour ago").
            Sudo().
            Register("recent_logs"),
        
        // Check for OOM kills
        porter.Journal().
            Grep("Out of memory").
            Since("1 day ago").
            Sudo().
            Register("oom_logs"),
        
        // Get system resource logs
        porter.Journal().
            Kernel().
            Lines("50").
            Sudo().
            Register("kernel_logs"),
    )

    stats, err := executor.Run("Troubleshoot myapp", tasks, vars)
    if err != nil {
        log.Fatal(err)
    }

    // Print collected logs
    fmt.Println("=== Error Logs ===")
    fmt.Println(vars.Get("error_logs"))
    
    fmt.Println("\n=== Recent Logs ===")
    fmt.Println(vars.Get("recent_logs"))
    
    fmt.Println("\n=== Stats ===")
    fmt.Printf("OK: %d, Changed: %d, Failed: %d\n", 
        stats.OK, stats.Changed, stats.Failed)
}
```

## Available Methods

### Core Methods

- **`Journal()`** - Start building a query for all system logs
- **`JournalUnit(unit string)`** - Start building a query for a specific systemd unit

### Filter Methods (chainable)

- **`Lines(n string)`** - Show last N lines (equivalent to `-n`)
- **`Since(time string)`** - Show logs since timestamp (e.g., "2024-12-11 10:00:00", "1 hour ago") - **shell-escaped**
- **`Until(time string)`** - Show logs until timestamp - **shell-escaped**
- **`Priority(level string)`** - Filter by priority (emerg, alert, crit, err, warning, notice, info, debug)
- **`Grep(pattern string)`** - Filter logs matching pattern - **shell-escaped**
- **`Boot(id string)`** - Show logs from specific boot (empty string for current boot)

### Display Methods

- **`Reverse()`** - Show newest entries first
- **`Output(format string)`** - Set output format (short, json, json-pretty, verbose, cat, etc.)
- **`NoPager()`** - Don't use pager (automatically added when not following)
- **`UTC()`** - Show timestamps in UTC
- **`Catalog()`** - Add explanatory help texts to log messages (equivalent to `-x`)

### Source Methods

- **`Kernel()`** - Show kernel logs only (equivalent to `-k`)
- **`Dmesg()`** - Show kernel ring buffer (similar to dmesg command)
- **`System()`** - Explicitly show system logs
- **`User()`** - Use user-level systemd

### Execution Methods

- **`Follow()`** - Follow logs in real-time (equivalent to `-f`) - **use with caution in automation**
- **`Sudo()`** - Run with sudo privileges
- **`Register(varName string)`** - Store output in variable
- **`When(condition)`** - Conditional execution
- **`Ignore()`** - Ignore errors
- **`Name(string)`** - Custom task name

## Priority Levels

- `emerg` (0) - System is unusable
- `alert` (1) - Action must be taken immediately
- `crit` (2) - Critical conditions
- `err` (3) - Error conditions
- `warning` (4) - Warning conditions
- `notice` (5) - Normal but significant condition
- `info` (6) - Informational messages
- `debug` (7) - Debug-level messages

## Output Formats

- `short` - Default syslog-style output
- `short-iso` - ISO 8601 timestamps
- `short-precise` - Microsecond precision
- `short-monotonic` - Monotonic timestamps
- `verbose` - All available fields
- `json` - JSON format (one object per line)
- `json-pretty` - Pretty-printed JSON
- `cat` - Only message field

## Security Improvements

The journalctl integration includes **automatic shell escaping** for user-provided values in:
- `.Since()` and `.Until()` - Time strings are safely escaped
- `.Grep()` - Search patterns are safely escaped

This prevents shell injection attacks when using dynamic values:

```go
// Safe - automatically escaped
userInput := "error'; rm -rf /; echo '"
porter.JournalUnit("myapp").Grep(userInput).Sudo()
// Produces: journalctl -u myapp --grep='error'\'; rm -rf /; echo '\'' --no-pager
```

## Tips

1. **Always use `.Sudo()`** for system services that require elevated privileges
2. **Use `.Register()`** to capture logs for later analysis or conditional logic
3. **Combine with `.When()`** for conditional log retrieval based on service status
4. **Use `.Priority("err")`** to focus on errors during troubleshooting
5. **Use `.Since()` and `.Until()`** for time-range analysis
6. **Use `.Output("json")`** for programmatic log parsing
7. **Avoid `.Follow()`** in automated scripts (it runs indefinitely)
8. **Use `.UTC()`** for consistent timestamps across timezones
9. **Use `.Catalog()`** to get helpful explanations of systemd messages
10. **Use `.Dmesg()`** as an alternative to the dmesg command for kernel logs
