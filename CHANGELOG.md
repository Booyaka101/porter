# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.0] - 2026-06-10

### Added
- Verified SSH host keys (TOFU/strict modes; `TrustHostCA` for an SSH host CA)
- SSH-certificate auth (`ConnectWithCert`), bastion/ProxyJump (`ConnectViaJump`),
  keepalives (`StartKeepalive`), and non-default ports (`Config.Port`)
- Declarative state primitives (`EnsureFile`, `EnsureDir`, `EnsureSymlink`,
  `EnsurePackage`, `EnsureLine`, `EnsureService*`, `EnsureCron`, `EnsureUser`,
  `EnsureMode`, `EnsureOwner`, `EnsureAbsent`, `EnsureGitRepo`) with no-op when
  converged, plus a real `SetDryRun(true)` preview
- Goss-style health assertions (`AssertServiceActive`, `AssertHTTPStatus`, ...)
- Atomic releases with health-gated cutover and rollback (`NewRelease`, `Rollback`)
- Deploy-as-an-OpenTelemetry-trace (`NewTracer`) and structured logging (`SetLogger`)
- Secrets via SOPS+age (`Secret`) and pluggable CLI backends (`SecretCommand`)
- Supply-chain verification gate (`VerifyBlob`, `VerifyImage`) using cosign
- Dashboard: optional agent-channel auth (`PORTER_AGENT_TOKEN`) and a deploy
  trace waterfall viewer at `/traces`
- Docker run opt-in service-hardening modifiers: `.Restart(policy)`, `.Init()`,
  `.LogRotate(maxSize, maxFiles)` (defaults unchanged)

### Changed
- The action dispatcher is now a registry of small handlers (`actions_*.go`)
  instead of one monolithic switch
- Repository restructured: the importable library is the front door; the
  optional dashboard moved to `web/` (package `web`) and `cmd/porter-ui`
- Dashboard authentication is **on by default** (`PORTER_AUTH=0` to disable);
  the first-boot admin password is randomly generated (or `PORTER_ADMIN_PASSWORD`)
- `Changed` accounting now reflects real mutations (read-only/converged tasks
  report `ok`, not `changed`)
- 2026 command audit (safe defaults): `DEBIAN_FRONTEND=noninteractive` on all
  apt mutations, quiet `tar` (no `-v`) in automation, and curl
  `--proto-redir =https --tlsv1.2` to block https→http downgrade on redirect
- Action dispatch internals modernized (`gopls modernize`: `any`, `errors.As`,
  `strings.SplitSeq`); the whole module is `staticcheck`-clean

### Security
- AES credential storage fails closed on decryption errors
- WebSocket and SSE endpoints are origin-checked
- Sudo passwords are fed via stdin, never the process argv

### Older entries
- Initial public release
- Declarative DSL for deployment tasks
- SSH/SFTP file transfers and command execution
- Retry logic with configurable delays
- Conditional task execution with `When()`, `If()`, `IfEquals()`, etc.
- Loop support for iterating over items
- Health checks (port, HTTP, file)
- Systemd service management (user and system services)
- Journalctl log retrieval with shell injection protection
- Docker and Docker Compose support
- Rsync file synchronization
- Variable expansion in commands and files
- Idempotent operations with `Creates()`
- Progress tracking with callbacks
- Service file management helpers (`ManageServiceFile`, `ManageServiceFileWithReload`)

### Security
- Shell injection protection for journalctl grep patterns
- Sed escape helper for safe string replacement

## [0.1.0] - 2024-01-01

### Added
- Initial development release
- Core SSH connection handling
- Basic file operations (Upload, Copy, Move, Write, Mkdir, Rm, Chmod, Chown, Symlink)
- Command execution (Run, Capture)
- Service management (Svc)
- Variable system (Vars)
- Task executor with progress reporting

[Unreleased]: https://github.com/booyaka101/porter/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/booyaka101/porter/compare/v0.1.0...v0.10.0
[0.1.0]: https://github.com/booyaka101/porter/releases/tag/v0.1.0
