# Contributing to Porter

Thanks for your interest in improving Porter! This guide covers everything you
need to get a change merged.

## Development setup

```bash
git clone https://github.com/booyaka101/porter
cd porter
go build ./...
go test ./...
```

Porter targets the Go version in [`go.mod`](go.mod). No CGo, no system
dependencies for the core library.

## Project layout

- **`*.go` (module root)** — the public library (package `porter`): the fluent
  DSL, the executor, SSH transport, and all action handlers.
- **`cmd/porter`** — the CLI.
- **`cmd/porter-ui`** — the optional web dashboard server.
- **`internal/`** — implementation detail, not part of the public API.
- **`web/`** — the optional React frontend for the dashboard.
- **`examples/`** — runnable end-to-end examples.
- **`docs/`** — guides and reference material.

See [`docs/architecture.md`](docs/architecture.md) for how the pieces fit.

## Making a change

1. **Open an issue first** for anything non-trivial so we can agree on the
   approach before you invest time.
2. **Branch** from `main`.
3. **Keep the build green.** Before pushing:
   ```bash
   make check      # build + vet + test + gofmt check
   ```
4. **Add tests.** New actions need a builder test and, where they touch the
   executor, a runtime test using the fake runner (see `runtime_test.go`).
5. **Document public API.** Exported funcs/types need a doc comment.
6. **Match the surrounding style** — flat, early-return, errors handled next to
   the call. Run `gofmt`/`goimports`.

## Adding a new action

Porter actions are small handlers registered in a dispatch table:

1. Add the fluent builder in the relevant `*.go` file (e.g. `docker.go`).
2. Add the handler and register it in the action table (see
   [`docs/architecture.md`](docs/architecture.md)).
3. If the action is read-only (a query/assertion), mark it so it isn't counted
   as a change.
4. Quote every interpolated value with `shellEscape` — never concatenate raw
   user input into a shell command.
5. Add tests.

## Commit messages

Write imperative, descriptive subject lines (e.g. "Add EnsureCron idempotent
crontab action"). Explain the *why* in the body when it isn't obvious.

## Reporting security issues

Please do **not** open public issues for vulnerabilities. See
[SECURITY.md](SECURITY.md).
