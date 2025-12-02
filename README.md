# Porter

[![Go Reference](https://pkg.go.dev/badge/github.com/booyaka101/porter.svg)](https://pkg.go.dev/github.com/booyaka101/porter)
[![CI](https://github.com/booyaka101/porter/actions/workflows/ci.yml/badge.svg)](https://github.com/booyaka101/porter/actions/workflows/ci.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/booyaka101/porter)](https://goreportcard.com/report/github.com/booyaka101/porter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A declarative deployment system for Go. Porter "carries" files and commands to remote servers over SSH.

## Installation

```bash
go get github.com/booyaka101/porter
```

## Quick Start

```go
package main

import (
    "log"
    "github.com/booyaka101/porter"
)

func main() {
    // Connect to remote server
    client, err := porter.Connect("192.168.1.100", porter.DefaultConfig("user", "password"))
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // Define tasks
    tasks := porter.Tasks(
        porter.Upload("/local/app", "/remote/app"),
        porter.Chmod("/remote/app").Mode("755"),
        porter.Svc("myapp").Restart(),
        porter.WaitForPort("127.0.0.1", "8080").Timeout("30s"),
    )

    // Execute
    vars := porter.NewVars()
    vars.Set("version", "1.0.0")

    executor := porter.NewExecutor(client, "password")
    stats, err := executor.Run("Deploy App", tasks, vars)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Completed: %d OK, %d Changed, %d Failed", stats.OK, stats.Changed, stats.Failed)
}
```

## Features

- **Declarative DSL** - Fluent API for defining deployment tasks
- **SSH/SFTP** - Secure file transfers and command execution
- **Retry Logic** - Automatic retries with configurable delays
- **Conditional Tasks** - Execute tasks based on variables
- **Loop Support** - Iterate over lists of items
- **Health Checks** - Wait for ports, HTTP endpoints, or files
- **Output Capture** - Store command output in variables
- **Systemd Integration** - Manage services (user and system)
- **Docker Support** - Container and Compose management
- **Template Expansion** - Variable substitution in files and commands

## DSL Reference

### File Operations

```go
porter.Upload(src, dest)           // Upload local file to remote
porter.Copy(src, dest)             // Copy remote file
porter.Move(src, dest)             // Move remote file
porter.Write(dest, content)        // Write content to file
porter.Mkdir(path)                 // Create directory
porter.Rm(path)                    // Remove file/directory
porter.Chmod(path).Mode("755")     // Change permissions
porter.Chown(path).Owner("user")   // Change ownership
porter.Symlink(src, dest)          // Create symlink
porter.Template(dest, content)     // Write with variable expansion
```

### Commands

```go
porter.Run("echo hello")           // Run command
porter.Run("apt update").Sudo()    // Run with sudo
porter.Capture("hostname")         // Capture output to variable
```

### Services (Systemd)

```go
porter.Svc("nginx").Start()        // Start service
porter.Svc("nginx").Stop()         // Stop service
porter.Svc("nginx").Restart()      // Restart service
porter.Svc("nginx").Enable()       // Enable service
porter.Svc("app").Start().User()   // User service (systemctl --user)
porter.DaemonReload()              // Reload systemd
```

### Docker

```go
porter.Docker("nginx").Start()     // Start container
porter.Docker("nginx").Stop()      // Stop container
porter.Docker("nginx").Restart()   // Restart container
porter.Docker("nginx").Remove()    // Remove container
porter.DockerPull("nginx:latest")  // Pull image

porter.Compose("/path").Up()       // docker compose up
porter.Compose("/path").Down()     // docker compose down
porter.Compose("/path").Pull()     // docker compose pull
```

### Wait/Health Checks

```go
porter.WaitForPort("127.0.0.1", "8080").Timeout("30s")
porter.WaitForHttp("http://localhost/health").ExpectCode("200")
porter.WaitForFile("/var/run/app.pid").Timeout("10s")
```

### Conditions

```go
porter.If("enabled")               // True if var is "true"
porter.IfNot("disabled")           // True if var is not "true"
porter.IfSet("version")            // True if var is set
porter.IfEquals("env", "prod")     // True if var equals value
porter.And(cond1, cond2)           // All conditions true
porter.Or(cond1, cond2)            // Any condition true
porter.Not(cond)                   // Negate condition
```

### Task Options

```go
task.When(porter.If("enabled"))    // Conditional execution
task.Loop("a", "b", "c")           // Loop over items (use {{item}})
task.Retry(3)                      // Retry on failure
task.Timeout("30s")                // Set timeout
task.Ignore()                      // Ignore errors
task.Name("My Task")               // Set display name
task.Register("result")            // Store output in variable
```

## Variables

```go
vars := porter.NewVars()
vars.Set("key", "value")           // Set string
vars.SetBool("enabled", true)      // Set boolean
vars.SetBytes("data", []byte{})    // Set binary data

vars.Get("key")                    // Get string
vars.GetBool("enabled")            // Get boolean
vars.GetBytes("data")              // Get binary data

vars.Expand("Hello {{key}}")       // Expand variables in string
vars.Clear()                       // Clear all variables
```

## Example: Full Deployment Manifest

```go
func buildManifest() []porter.Task {
    return porter.Tasks(
        // Stop services
        porter.Svc("app").Stop().Ignore(),
        
        // Upload files
        porter.Upload("/local/app", "/home/app/bin").Retry(2),
        porter.Chmod("/home/app/bin").Mode("755"),
        
        // Configure service
        porter.Template("/etc/systemd/user/app.service", serviceTemplate),
        porter.DaemonReload().User(),
        
        // Start and verify
        porter.Svc("app").Enable().User(),
        porter.Svc("app").Start().User().Retry(2),
        porter.WaitForPort("127.0.0.1", "{{port}}").Timeout("30s"),
    )
}

func deploy(ip, user, pass string) error {
    client, err := porter.Connect(ip, porter.DefaultConfig(user, pass))
    if err != nil {
        return err
    }
    defer client.Close()

    vars := porter.NewVars()
    vars.Set("port", "8080")
    vars.Set("version", "1.2.3")

    executor := porter.NewExecutor(client, pass)
    _, err = executor.Run("Deploy", buildManifest(), vars)
    return err
}
```

## Examples

See the [examples](./examples) directory for complete working examples:

- **[basic](./examples/basic)** - Simple deployment workflow
- **[docker](./examples/docker)** - Docker and Docker Compose management
- **[conditional](./examples/conditional)** - Conditions, loops, and variable expansion

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
