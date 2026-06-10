# Architecture

Porter is a Go library for declarative, idempotent deployment over SSH. This
document explains how it's put together so you can extend it confidently.

## Repository layout

```
.                      module root — the public library (package porter)
├── *.go               DSL builders, the executor, SSH transport, helpers
├── actions.go         the action registry (dispatch)
├── actions_*.go       action handlers grouped by domain
├── cmd/
│   ├── porter-ui/      the optional web dashboard server binary
│   └── porter-idx/     a thin distribution wrapper
├── web/               the optional dashboard (package web) + web/ui React app
├── examples/          runnable end-to-end examples
└── docs/              guides and reference
```

The **library** (root package `porter`) is the product: you `import` it and
build a deploy program. The **dashboard** under `web/` is optional and is not
part of the library's public API.

## Core flow

A deploy is just data plus an executor:

1. **Builders** (`Tasks(...)`, `Run`, `Svc`, `EnsureFile`, ...) construct a
   flat `[]Task`. Each `Task` is a plain struct (`task.go`) — `Action` is a
   string naming the operation, with fields like `Src`/`Dest`/`Body`/`Perm`.
2. **`Connect*`** (`ssh.go`, `connection.go`, `sshcert.go`, `bastion.go`)
   establishes a verified SSH connection (`*goph.Client`).
3. **`Executor.Run`** (`executor.go`) iterates the tasks: evaluates `When`,
   expands `{{vars}}`, runs each task with retry, records progress, and emits a
   trace span per task when a `Tracer` is attached.

```
Tasks() -> []Task        Connect() -> *goph.Client
                 \              /
                  Executor.Run(name, tasks, vars)
                        |
                   per task: When? -> dispatch -> retry -> stats/trace
```

## The action registry

Every `Task.Action` is handled by a small function registered by name, rather
than one large switch:

- `actions.go` defines `actionHandler` and the `actionHandlers` map, plus
  `dispatch`, which expands the task's fields and looks up the handler.
- Each `actions_<domain>.go` file holds the handlers for one domain and
  registers them in `init()` via `register("name", handler)`.
- `register` panics on a duplicate name, so a copy-paste mistake is caught at
  startup.

### Adding an action

1. Add a fluent builder (in the relevant domain file, e.g. `docker.go`) that
   returns a `TaskBuilder` with the right `Action` string.
2. Add a handler with the standard signature and register it:

   ```go
   func init() { register("my_action", actMyAction) }

   func actMyAction(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
       return e.runMaybeSudo(t.Sudo, "do-something "+shellEscape(dest))
   }
   ```
3. Always `shellEscape` interpolated values — never concatenate raw input into a
   shell command.
4. If the action only queries state (a check or assertion), add it to
   `readOnlyActions` so it isn't counted as a change.

## Idempotency and change accounting

`Executor.exec` wraps `dispatch` and reports whether a task changed state:

- A handler that finds the host already in the desired state sets `e.noOp`.
- Read-only actions are listed in `readOnlyActions`.
- Everything else is treated as a change.

This makes the RECAP `changed=` count meaningful and powers a real
`SetDryRun(true)`, which runs the read-only fact checks and reports what *would*
change without mutating anything.

The `Ensure*` builders are the declarative front end to this: each gathers a
fact, diffs against the desired state, and no-ops when already converged.

## Transport and security

- **Host keys are verified** (`hostkey.go`): trust-on-first-use by default,
  strict mode, or an SSH host CA via `TrustHostCA`. `HostKeyInsecure` exists
  only for tests.
- **Auth**: password, key, agent, or short-lived **certificates**
  (`ConnectWithCert`). Passwords are fed over stdin / the `SSHPASS` env var,
  never the process argv.
- **Bastions**: `ConnectViaJump` tunnels hop-by-hop without forwarding an agent.
- **Secrets** are decrypted locally and written over SFTP at `0600`, never in a
  shell command and never logged.

See [SECURITY.md](../SECURITY.md) for the full posture.

## Observability

Attach a `Tracer` (`tracer.go`) to record a deploy as an OpenTelemetry-shaped
span tree (root span per deploy, child span per task), emitted as JSONL. Attach
a `*slog.Logger` for structured logs carrying the `trace_id`. The dashboard
writes a trace per deploy under `<dataDir>/traces/` and renders a waterfall at
`/traces`.

## The dashboard (optional)

`web/` is a self-contained dashboard: an HTTP/WebSocket server (package `web`)
plus a React frontend (`web/ui`). It is **off the library's critical path** —
the library has no dependency on it. Authentication is on by default
(`PORTER_AUTH=0` to disable on a trusted network). Build it with `make ui`.
