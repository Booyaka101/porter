# Rsync Example

This example demonstrates file synchronization using Porter's rsync functionality.

## What it Does

1. Checks if rsync is installed, installs if missing
2. Gets rsync version for logging
3. Demonstrates various rsync options:
   - Basic sync
   - Delete mode (remove extraneous files)
   - Exclusion patterns
   - Bandwidth limiting
   - Checksum verification
   - Custom flags
   - Sudo mode
   - Dry run preview
   - Include patterns

## Usage

```bash
go run main.go -host 192.168.1.100 -user admin -pass secret
```

## Key Concepts

- **`porter.Rsync()`** - Sync files between local and remote
- **`porter.RsyncCheck()`** - Check if rsync is installed
- **`porter.RsyncInstall()`** - Install rsync
- **`porter.RsyncEnsure()`** - Install only if missing

## Rsync Options

| Method | Description |
|--------|-------------|
| `.Delete()` | Remove files in dest not in src |
| `.Exclude("*.log")` | Exclude patterns |
| `.Include("*.go")` | Include patterns |
| `.Progress()` | Show transfer progress |
| `.Checksum()` | Use checksum verification |
| `.Partial()` | Keep partial files for resume |
| `.BwLimit("1000")` | Bandwidth limit (KB/s) |
| `.DryRun()` | Preview only, no changes |
| `.Sudo()` | Run with sudo |
| `.Flags("-rlptD")` | Custom rsync flags |

## Example

```go
porter.Rsync("./src/", "/dest/").
    Delete().
    Exclude("*.log,*.tmp,.git").
    Progress().
    Build()
```
