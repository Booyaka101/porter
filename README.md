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
- **Journalctl Support** - Retrieve and analyze systemd logs with shell injection protection
- **Docker Support** - Container and Compose management
- **Template Expansion** - Variable substitution in files and commands
- **Idempotent Operations** - Skip tasks when target path exists with `Creates()`

### Modern (2026) capabilities

- **Verified host keys** - TOFU by default (pins on first use, rejects changed keys as MITM); `SetHostKeyMode(HostKeyStrict)` and `TrustHostCA()` for step-ca host certificates. No more `InsecureIgnoreHostKey`.
- **SSH certificate auth** - `ConnectWithCert()` for short-lived certs (step-ca / Vault SSH / Teleport); keepalives via `StartKeepalive()`; non-default `Config.Port`.
- **Bastion / ProxyJump** - `ConnectViaJump(target, jumps...)` tunnels through one or more bastions without exposing an SSH agent on intermediate hosts; host keys verified at every hop.
- **Local→host file transfer** - `Upload(local, remote)` streams a control-machine file (binary, image tar, key) over SFTP with `.Mode()/.Owner()/.Sudo()`; `Run(cmd).StdinFile(local)` pipes a local file into a remote command's stdin with zero disk staging (e.g. `docker load`).
- **Trust-store install** - `TrustCA(path).As(name)` installs a CA already on the host; `TrustCAContent(pem).As(name)` installs an in-memory PEM CA in one step (write + `update-ca-certificates`) for fleets that distribute their own root.
- **Declarative state** - `EnsureFile/EnsureDir/EnsureSymlink/EnsurePackage/EnsureLine/EnsureServiceRunning/EnsureServiceEnabled/EnsureCron/EnsureUser/EnsureMode/EnsureOwner/EnsureAbsent/EnsureGitRepo` gather a fact, diff, and **no-op when already converged** (pyinfra-style; `EnsureCron`/`EnsureUser` fix the duplicate-append / non-idempotent gaps of `CronAdd`/`UserAdd`). A real `SetDryRun(true)` previews exactly what would change.
- **Health assertions (Goss-style)** - `AssertServiceActive/AssertServiceEnabled/AssertProcessRunning/AssertPortListening/AssertFileExists/AssertFileContains/AssertPackageInstalled/AssertHTTPStatus/AssertCommandSucceeds` fail the deploy if reality doesn't match (post-deploy smoke test or pre-flight guard).
- **Post-quantum SSH** - the underlying `x/crypto/ssh` negotiates `mlkem768x25519-sha256` (ML-KEM hybrid) by default when both ends support it (OpenSSH ≥ 10.0).
- **Atomic releases & rollback** - `NewRelease(base).HealthCheck(cmd).Deploy(...)` deploys into a timestamped dir, health-checks, then flips `current` via an atomic `rename(2)`; `Rollback(base)` reverts in one step. (Kamal-style, but for plain systemd/VM targets.)
- **Deploy-as-a-trace** - `SetTracer(NewTracer(w, env, service))` records each deploy as an OpenTelemetry-shaped span tree (JSONL); `SetLogger()` adds structured logs with `trace_id` correlation. The web UI records every deploy to `<dataDir>/traces/` and serves a waterfall viewer at **`/traces`**.
- **Secrets (SOPS+age + pluggable)** - `Secret(sopsFile, dest)` decrypts locally and ships the plaintext over SFTP at `0600` — never in a shell command, never logged. `SecretCommand(fetchCmd, dest)` does the same for any backend with a CLI (Vault, OpenBao, 1Password, Infisical).
- **Supply-chain gate** - `VerifyBlob`/`VerifyImage` run `cosign verify` as a pre-deploy admission gate; an unsigned/untampered-failed artifact aborts the deploy.
- **Meaningful change accounting** - the RECAP `changed=` count now reflects real mutations (read-only and converged tasks report `ok`, not `changed`).
- **Audited commands** - the shell each action emits is reviewed against 2026 practice: `apt` runs non-interactively, `tar` is quiet in automation, `curl` blocks https→http downgrade on redirect. Docker runs can opt into service hardening with `.Restart()`, `.Init()`, `.LogRotate()`.

See [`examples/modern/main.go`](examples/modern/main.go) for an end-to-end deploy using all of the above.

### Web UI security

The dashboard now enforces JWT auth **by default** (set `PORTER_AUTH=0` only on a fully trusted isolated network; the wiring previously didn't apply the middleware at all); WebSocket upgrades and SSE streams are origin-checked (`PORTER_ALLOWED_ORIGINS` for cross-origin frontends); machine-to-machine agent channels take an optional shared secret (`PORTER_AGENT_TOKEN`) so they can be locked down independently of human auth; stored credentials encrypt/decrypt **fail closed**; the default admin password is random (or `PORTER_ADMIN_PASSWORD`), logged once.

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

### Service File Management

Idempotent helpers for managing systemd service files:

```go
// Escape special characters for sed replacement strings
escaped := porter.EscapeSed("/path/with&special")  // "\/path\/with\&special"

// Update a service parameter while preserving quote style
// Works with both -port=3099 and -port="3099"
porter.UpdateServiceParamTask("/etc/systemd/system/myapp.service", "port", "8080")

// Full service file management (create if missing, update params if exists)
tasks := porter.ManageServiceFile(porter.ServiceFileConfig{
    Name:     "myapp",
    Template: appServiceTemplate,
    IsUser:   true,  // ~/.config/systemd/user/ (false = /etc/systemd/system/)
    Params: map[string]string{
        "port": "8080",
        "host": "0.0.0.0",
    },
    When: porter.IfEquals("env", "production"),  // Optional: condition for all tasks
})

// With automatic daemon-reload and service restart
tasks := porter.ManageServiceFileWithReload(porter.ServiceFileConfig{
    Name:      "worker",
    Template:  workerTemplate,
    IsUser:    false,
    NeedsSudo: true,  // Use sudo for file operations (always true for system services)
    Params:    map[string]string{"workers": "4"},
    When:      porter.If("deploy_worker"),  // Only deploy if flag is set
})
```

### Logs (Journalctl)

```go
// Get logs for a specific service
porter.JournalUnit("nginx").Lines("100").Sudo().Register("logs")

// Filter by time and priority
porter.JournalUnit("myapp").
    Since("1 hour ago").
    Priority("err").
    Sudo().
    Register("errors")

// Search logs with pattern (shell-escaped)
porter.JournalUnit("docker").Grep("error|failed").Lines("200").Sudo()

// Kernel logs
porter.Journal().Kernel().Lines("50").Sudo()

// JSON output for parsing
porter.JournalUnit("app").Output("json").Lines("10").Sudo()

// Additional options
.Boot("")              // Current boot logs
.Reverse()             // Newest first
.UTC()                 // UTC timestamps
.Catalog()             // Add explanatory help texts
.Dmesg()               // Kernel ring buffer
.User()                // User-level systemd
```

See [JOURNALCTL_EXAMPLES.md](./JOURNALCTL_EXAMPLES.md) for comprehensive examples and troubleshooting patterns.

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

### Rsync

```go
// Ensure rsync is installed
porter.RsyncInstall()              // Auto-detect package manager
porter.RsyncCheck()                // Check if installed
porter.RsyncVersion()              // Get version
porter.RsyncEnsure()               // Install only if missing

// Basic sync
porter.Rsync("./src/", "/dest/").Build()

// With options
porter.Rsync("./src/", "/dest/").
    Delete().                      // Remove extraneous files
    Exclude("*.log,*.tmp,.git").   // Exclude patterns
    Include("*.go,*.mod").         // Include patterns
    Progress().                    // Show progress
    Checksum().                    // Use checksum verification
    Partial().                     // Keep partial files
    BwLimit("1000").               // Bandwidth limit (KB/s)
    DryRun().                      // Preview only
    Sudo().                        // Run with sudo
    Build()

// Local-to-remote sync (runs rsync on local machine with SSH destination)
// Useful for Docker environments where you can't SSH into the container
porter.Rsync("/local/path/", "/remote/path/").
    Local().                       // Run rsync locally, sync to remote via SSH
    SSHPort("2222").               // Custom SSH port (optional)
    SSHKey("~/.ssh/id_rsa").       // SSH key path (optional)
    Delete().
    Build()

// Custom flags
porter.Rsync("./src/", "/dest/").Flags("-rlptD").NoCompress().Build()
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
porter.IfSet("version")            // True if var is set (non-empty)
porter.IfNotSet("version")         // True if var is not set (empty)
porter.IfEquals("env", "prod")     // True if var equals value
porter.IfNotEquals("env", "dev")   // True if var does not equal value
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
task.Creates("/path/to/file")      // Skip if path exists (idempotent)
```

### Idempotent Operations with Creates

Use `Creates()` to skip tasks when a path already exists on the remote server. This keeps logs clean for idempotent operations:

```go
porter.Mkdir("/var/data").Creates("/var/data")           // Skip if dir exists
porter.Install("/tmp/app", "/usr/bin/app").Creates("/usr/bin/app")  // Skip if installed
porter.GitClone(repo, "/opt/app").Creates("/opt/app")    // Skip if already cloned
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

## Progress Tracking

Track task progress with callbacks:

```go
executor := porter.NewExecutor(client, password)

// Set progress callback
executor.OnProgress(func(p porter.TaskProgress) {
    // p.Index      - 0-based task index
    // p.Total      - Total number of tasks
    // p.Name       - Task name
    // p.Action     - Task action type
    // p.Status     - pending, running, ok, changed, skipped, failed, retrying
    // p.Attempt    - Current attempt (1-based)
    // p.MaxAttempt - Max attempts
    // p.Duration   - Time taken (on completion)
    // p.Error      - Error if failed
    
    // Built-in helpers
    fmt.Printf("%s %s\n", p.ProgressBar(30), p.String())
})

stats, err := executor.Run("Deploy", tasks, vars)
```

### TaskProgress Status Values

- **`pending`** - Task not yet started
- **`running`** - Task currently executing
- **`retrying`** - Task failed, retrying
- **`ok`** - Task completed successfully (no changes)
- **`changed`** - Task completed with changes
- **`skipped`** - Task skipped (condition not met or Creates path exists)
- **`failed`** - Task failed

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
- **[rsync](./examples/rsync)** - File synchronization with rsync
- **[systemd](./examples/systemd)** - Systemd service file management

## Porter UI (Web Interface)

Porter includes a full-featured web interface for managing remote servers. The UI provides:

- **Dashboard** - Overview of all machines with health status
- **Interactive Terminal** - SSH terminal in the browser
- **File Manager** - Browse, edit, upload, and download files
- **Service Manager** - Control systemd services
- **Docker Manager** - Manage containers, images, and compose stacks
- **Live Logs** - Real-time log streaming with filtering
- **System Monitor** - CPU, memory, disk, and network graphs
- **Remote Desktop** - VNC access via noVNC
- **Script Runner** - Execute deployment scripts with progress tracking
- **Network Tools** - Ping, traceroute, DNS lookup, port scan

### Building and Running

```bash
# Build everything (UI + Go binary)
make build

# Run the server
./porter-ui

# Or in development mode
make dev
```

See [web/ui/](./web/ui/) for the React frontend and [web/](./web/) for the dashboard backend.

### Docker Deployment

Run Porter as a complete packaged application using Docker:

```bash
# Single container with SQLite (default, includes auth)
docker compose up -d

# With MySQL instead of SQLite
docker compose --profile mysql up -d
```

Access the UI at http://localhost:8069

**Authentication is on by default.** On first boot a random `admin` password is generated and printed once in the server log (or set `PORTER_ADMIN_PASSWORD`). Set `PORTER_AUTH=0` only on a fully trusted, isolated network.

#### Docker Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8069` | Server port |
| `USE_SQLITE` | `true` | Use SQLite database (default, embedded) |
| `USE_MYSQL` | `false` | Use MySQL instead of SQLite |
| `SQLITE_PATH` | `data/porter.db` | SQLite database file path |
| `DB_HOST` | `localhost` | MySQL host (when USE_MYSQL=true) |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `porter` | MySQL username |
| `DB_PASSWORD` | - | MySQL password |
| `DB_NAME` | `porter` | MySQL database name |

#### Migrating from MySQL to SQLite

If you have an existing Porter installation using MySQL and want to switch to SQLite:

```bash
# Run migration (connects to MySQL, exports to SQLite)
docker run --rm \
  -e MIGRATE_FROM_MYSQL=true \
  -e DB_HOST=your-mysql-host \
  -e DB_USER=porter \
  -e DB_PASSWORD=your-password \
  -e DB_NAME=porter \
  -v porter-data:/app/data \
  porter:latest

# Then start Porter with SQLite
docker compose up -d
```

Or using the binary directly:
```bash
./porter-ui -migrate-mysql \
  -portable
```

This will migrate all users, machines, scheduled jobs, history, and settings from MySQL to SQLite.

## Documentation

- [Architecture](docs/architecture.md) — how the library is put together, and how to add an action
- [Roadmap](docs/ROADMAP.md) — what's done and what's planned
- [journalctl examples](docs/journalctl-examples.md)
- [MySQL auth / database notes](docs/mysql-auth.md)
- [Security policy](SECURITY.md)

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the
development setup, project layout, and how to add a new action. Please report
security issues privately per [SECURITY.md](SECURITY.md).

## License

Porter is released under the [MIT License](LICENSE).
