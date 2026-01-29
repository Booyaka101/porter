# Docker Deployment Example

This example demonstrates how to manage Docker containers and Docker Compose with Porter.

## What it Does

### Container Management
1. Pulls the latest nginx image
2. Stops and removes existing container
3. Runs a new container with port mappings and volumes
4. Waits for the container to be healthy

### Docker Compose
1. Uploads a compose file
2. Pulls images
3. Starts services with build
4. Checks service status

## Usage

```bash
go run main.go -host 192.168.1.100 -user admin -pass secret
```

## Key Concepts

- **`porter.Docker()`** - Manage individual containers
- **`porter.DockerPull()`** - Pull Docker images
- **`porter.Compose()`** - Manage Docker Compose stacks

## Tasks Used

| Task | Description |
|------|-------------|
| `DockerPull` | Pull a Docker image |
| `Docker().Stop()` | Stop a container |
| `Docker().Remove()` | Remove a container |
| `Docker().Run()` | Run a new container |
| `Compose().Pull()` | Pull compose images |
| `Compose().Up()` | Start compose services |
| `Compose().Ps()` | List compose services |

## Container Options

```go
porter.Docker("web").Run("nginx:latest").
    Ports("80:80,443:443").      // Port mappings
    Volumes("/data:/etc/nginx"). // Volume mounts
    Env("KEY=value")             // Environment variables
```
