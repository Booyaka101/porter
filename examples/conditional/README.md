# Conditional Deployment Example

This example demonstrates conditions, loops, and variable expansion in Porter.

## What it Does

1. Creates environment-specific directories
2. Writes production config only in prod environment
3. Starts monitoring agent only if enabled
4. Loops over multiple services to restart them
5. Sends alerts only when both prod AND monitoring are enabled
6. Captures command output to variables

## Usage

```bash
# Development deployment
go run main.go -host 192.168.1.100 -user admin -pass secret -env dev

# Production with monitoring
go run main.go -host 192.168.1.100 -user admin -pass secret -env prod -monitoring
```

## Key Concepts

- **Conditions** - Execute tasks based on variable values
- **Loops** - Iterate over multiple items
- **Variable Capture** - Store command output for later use

## Condition Types

| Condition | Description |
|-----------|-------------|
| `If("var")` | True if var is "true" |
| `IfNot("var")` | True if var is not "true" |
| `IfSet("var")` | True if var is non-empty |
| `IfEquals("var", "val")` | True if var equals value |
| `And(c1, c2)` | Both conditions true |
| `Or(c1, c2)` | Either condition true |
| `Not(c)` | Negate condition |

## Loop Example

```go
porter.Run("systemctl restart {{item}}").
    Loop("app", "worker", "scheduler")
```

## Capturing Output

```go
porter.Capture("hostname").Register("server_hostname")
// Later use: {{server_hostname}}
```
