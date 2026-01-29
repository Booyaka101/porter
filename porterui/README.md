# Porter UI Backend

This package provides the backend API server for Porter's web-based server management interface.

## Overview

The `porterui` package implements a REST API and WebSocket server that powers the Porter web UI. It provides comprehensive server management capabilities including:

- **Machine Management** - Add, edit, and organize remote servers
- **Terminal Access** - Interactive SSH terminals via WebSocket
- **File Management** - Browse, edit, upload, and download files
- **Service Management** - Control systemd services
- **Docker Management** - Manage containers and images
- **Log Viewing** - Real-time log streaming with journalctl
- **System Monitoring** - CPU, memory, disk, and network metrics
- **Script Execution** - Run and schedule deployment scripts
- **VNC/Remote Desktop** - Remote desktop access via noVNC
- **Backup Management** - Scheduled backups and restore
- **Network Tools** - Ping, traceroute, DNS lookup, port scanning

## Architecture

```
porterui/
├── router.go          # Route setup and middleware
├── auth.go            # Authentication and JWT handling
├── machines.go        # Machine CRUD and SSH connections
├── terminal.go        # WebSocket terminal sessions
├── files.go           # File browser and editor
├── system.go          # System info and monitoring
├── logs.go            # Log retrieval and streaming
├── docker.go          # Docker container management (in system.go)
├── scheduler.go       # Cron-based job scheduling
├── backup.go          # Backup job management
├── vnc.go             # VNC proxy for remote desktop
└── ...
```

## API Routes

All routes are prefixed with `/api/` when authentication is enabled.

### Authentication
- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/logout` - Logout

### Machines
- `GET /api/machines` - List all machines
- `POST /api/machines` - Add a new machine
- `PUT /api/machines/{id}` - Update machine
- `DELETE /api/machines/{id}` - Delete machine
- `POST /api/machines/{id}/test` - Test SSH connection

### Terminal
- `GET /api/terminal/{id}` - WebSocket terminal session

### Files
- `GET /api/files/{id}` - List directory contents
- `GET /api/files/{id}/read` - Read file content
- `POST /api/files/{id}/write` - Write file content
- `POST /api/files/{id}/upload` - Upload file
- `GET /api/files/{id}/download` - Download file

### System
- `GET /api/system/{id}/info` - System information
- `GET /api/system/{id}/services` - List systemd services
- `POST /api/system/{id}/services/{name}/{action}` - Control service

### Logs
- `GET /api/logs/{id}` - Get logs with journalctl
- `GET /api/logs/{id}/stream` - WebSocket log streaming

## Usage

```go
package main

import (
    "net/http"
    "github.com/gorilla/mux"
    "github.com/booyaka101/porter/porterui"
)

func main() {
    r := mux.NewRouter()
    
    // Setup routes with authentication
    porterui.SetupRoutesWithAuth(r)
    
    // Or without authentication
    // porterui.SetupRoutes(r)
    
    http.ListenAndServe(":8080", r)
}
```

## Configuration

The backend uses environment variables and a SQLite/MySQL database for configuration:

- Machine credentials (encrypted)
- User accounts
- Scheduled jobs
- Custom scripts
- Bookmarks and history

## Security

- JWT-based authentication
- Encrypted credential storage
- SSH key management
- Audit logging
