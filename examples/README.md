# Porter Examples

This directory contains working examples demonstrating Porter's capabilities.

## Examples

| Example | Description |
|---------|-------------|
| [basic](./basic) | Simple deployment workflow with file uploads and service management |
| [docker](./docker) | Docker container and Docker Compose management |
| [conditional](./conditional) | Conditions, loops, and variable expansion |
| [rsync](./rsync) | File synchronization with rsync |
| [systemd](./systemd) | Systemd service file management |

## Running Examples

Each example can be run with:

```bash
cd examples/<name>
go run main.go -host <IP> -user <USER> -pass <PASSWORD>
```

## Prerequisites

- Go 1.21 or later
- SSH access to a remote server
- For Docker examples: Docker installed on remote server
- For rsync examples: rsync installed (or Porter will install it)

## Notes

- Examples use password authentication for simplicity
- For production, use SSH key authentication
- Modify the examples to match your environment
