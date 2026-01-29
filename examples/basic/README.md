# Basic Deployment Example

This example demonstrates a simple deployment workflow using Porter.

## What it Does

1. Creates a directory on the remote server
2. Uploads an application binary
3. Sets executable permissions
4. Writes a configuration file with variable expansion
5. Restarts the service
6. Waits for the application to be ready

## Usage

```bash
go run main.go -host 192.168.1.100 -user admin -pass secret
```

## Key Concepts

- **`porter.Connect()`** - Establish SSH connection
- **`porter.Tasks()`** - Group multiple tasks
- **`porter.NewVars()`** - Create variables for template expansion
- **`porter.NewExecutor()`** - Execute tasks on remote server

## Tasks Used

| Task | Description |
|------|-------------|
| `Mkdir` | Create directory |
| `Upload` | Upload local file to remote |
| `Chmod` | Set file permissions |
| `Write` | Write content to file |
| `Svc().Restart()` | Restart systemd service |
| `WaitForPort` | Wait for port to be available |

## Variable Expansion

The example uses `{{port}}` and `{{env}}` placeholders that are expanded at runtime:

```go
vars.Set("port", "8080")
vars.Set("env", "production")
```
