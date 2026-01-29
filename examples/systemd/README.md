# Systemd Service Management Example

This example demonstrates idempotent systemd service file management with Porter.

## What it Does

1. Updates individual service parameters
2. Creates service files if missing, updates if exists
3. Manages both system and user services
4. Handles daemon-reload and service restart automatically

## Usage

```bash
go run main.go -host 192.168.1.100 -user admin -pass secret -port 8080 -mode production
```

## Key Concepts

- **`porter.UpdateServiceParamTask()`** - Update a single parameter in a service file
- **`porter.ManageServiceFile()`** - Create or update service files idempotently
- **`porter.ManageServiceFileWithReload()`** - Same as above, plus daemon-reload and restart

## Service File Config

```go
porter.ManageServiceFile(porter.ServiceFileConfig{
    Name:     "myapp",           // Service name
    Template: serviceTemplate,    // Full service file template
    IsUser:   false,             // false = system, true = user service
    Params: map[string]string{   // Parameters to update
        "port": "8080",
        "mode": "production",
    },
    When: porter.If("deploy"),   // Optional condition
})
```

## Service Locations

| Type | Location |
|------|----------|
| System | `/etc/systemd/system/` |
| User | `~/.config/systemd/user/` |

## Parameter Updates

The `UpdateServiceParamTask` preserves quote style:

```go
// Updates -port=3099 to -port=8080
// Or -port="3099" to -port="8080"
porter.UpdateServiceParamTask("/etc/systemd/system/myapp.service", "port", "8080")
```

## With Automatic Reload

```go
porter.ManageServiceFileWithReload(porter.ServiceFileConfig{
    Name:     "myapp",
    Template: template,
    Params:   map[string]string{"port": "8080"},
})
// Automatically runs: daemon-reload + service restart
```
