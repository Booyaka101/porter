# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.16.0] - 2026-06-24

### Fixed
- **Bounded SSH handshake — no more indefinite hangs or leaked connections.**
  `goph`/`crypto-ssh` honoured `Config.Timeout` only for the TCP dial; once the
  socket connected, a server that stalled mid-handshake (sshd shedding load,
  sitting at `MaxStartups`, or slow to answer the key exchange) made
  `ssh.NewClientConn` block forever **and** never closed the socket, leaking an
  unauthenticated connection that held a server slot until `LoginGraceTime`. A
  caller wrapping the connect in its own deadline (e.g. a retry loop) abandoned
  the goroutine but could not reclaim the socket, so repeated attempts piled up
  against `MaxStartups` and turned a brief server hiccup into a self-sustaining
  stall. `Connect`, `ConnectWithKey`, `ConnectWithKeyAndPassphrase`,
  `ConnectWithAgent` and `ConnectWithCert` now route through a single dialer
  (`dialBounded`) that bounds the **entire** handshake — TCP, KEX and auth — by
  `Config.Timeout` and closes the socket on failure, then clears the deadline so
  the live session is never interrupted.

## [0.15.0] - 2026-06-15

### Fixed
- Compound `.Sudo()` commands now run fully as root. `Executor.sudo` appended
  the command raw after `sudo -S -p ''`, so a shell operator (`&&`, `;`, `|`)
  bound at the top level and only the first segment ran as root. The command is
  now wrapped in `sh -c <shell-escaped>` so the whole compound runs under sudo.

## [0.14.0] - 2026-06-12

### Added
- `EnsureSystemdKey(path, section, key, value)` — idempotently ensure a
  `key=value` directive under a systemd unit's `[section]` (Unit/Service/Timer/
  Install). Inserts the line directly after the section header (where
  `EnsureLine` would only append a stray line at EOF), no-ops when the key is
  already present (operator edits win), preserves CRLF, and preserves the
  unit's mode/owner on rewrite. `.Sudo()` for units under /etc/systemd/system.

## [0.13.0] - 2026-06-12

### Added
- `AssertCertValid(path, within)` — Goss-style read-only assertion that fails a
  deploy unless the X.509 cert at `path` stays valid for at least `within` from
  now. Runs on the remote via `openssl x509 -checkend` (no new Go deps); use as
  a pre-flight guard or post-renewal smoke test, `.Sudo()` for a root-only path.

## [0.12.0] - 2026-06-10

### Added
- `Upload(localPath, remotePath)` — stream a LOCAL file to the host over SFTP
  (binaries, image tars, keys), honoring `.Sudo()`/`.Mode()`/`.Owner()` with a
  private 0600 staging temp so secrets are never world-readable mid-transfer.
- `Run(cmd).StdinFile(localPath)` — pipe a LOCAL file into a remote command's
  stdin with zero disk staging (e.g. `docker load`); the sudo password is
  consumed as the first stdin line so the file bytes reach the command intact.

## [0.11.0] - 2026-06-10

### Added
- `TrustCAContent(pem).As(anchor)` — install an in-memory PEM CA into the OS
  trust store in one step (writes it into `/usr/local/share/ca-certificates`
  atomically at 0644 + runs `update-ca-certificates`), so callers holding a CA
  root in memory no longer stage a file and run `update-ca-certificates` by hand.

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

[Unreleased]: https://github.com/booyaka101/porter/compare/v0.12.0...HEAD
[0.12.0]: https://github.com/booyaka101/porter/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/booyaka101/porter/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/booyaka101/porter/compare/v0.1.0...v0.10.0
[0.1.0]: https://github.com/booyaka101/porter/releases/tag/v0.1.0
