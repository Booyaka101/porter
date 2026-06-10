# Roadmap

Porter targets a focused niche: declarative, idempotent deployment to
long-lived Linux VMs over SSH — the space Ansible and pyinfra occupy, as a Go
library + CLI rather than YAML.

## Done

- **Transport security** — verified host keys (TOFU/strict + SSH host CA),
  SSH-certificate auth, bastion/ProxyJump, keepalives; no plaintext credentials
  in the process table.
- **Declarative state** — `Ensure*` primitives that fact-gather → diff → no-op,
  with a real `--dry-run` preview and meaningful change accounting.
- **Health assertions** — Goss-style `Assert*` gates for pre-flight and
  post-deploy smoke tests.
- **Atomic releases** — health-gated `rename(2)` symlink cutover and one-step
  rollback for systemd/VM targets.
- **Observability** — deploy-as-an-OpenTelemetry-trace plus `slog`, with a
  waterfall viewer in the dashboard.
- **Secrets** — SOPS+age and pluggable CLI backends (Vault, OpenBao, 1Password,
  Infisical); decrypt-local, ship `0600`, never logged.
- **Supply chain** — `cosign` verification as a pre-deploy admission gate.
- **Codebase** — the action dispatch is a registry of small handlers; the
  library is the front door with the dashboard as an optional component.

## Considered next

- **Progressive delivery on plain VMs** (weighted/canary cutover). This needs a
  real traffic-splitting proxy; today's atomic + health-gated release with
  instant rollback covers zero-downtime without one.
- **A dashboard view that renders the deploy traces** Porter already writes
  (the JSONL data and `/traces` waterfall exist; richer visualization is
  frontend work).
- **Post-quantum SSH** is already negotiated by default through `x/crypto`;
  staying current is a matter of routine toolchain/dependency updates.
- **Opt-in modifiers for the behavior-changing items from the 2026 command
  audit** — e.g. `apt --no-install-recommends` / `full-upgrade`, `npm ci`,
  release-grade `go build` flags (`-trimpath`, `CGO_ENABLED=0`, `-ldflags="-s -w"`),
  `rsync` without `-z` on fast LANs, `tar --zstd`, and `useradd -m`/service
  accounts. These change observable behavior, so they should be explicit options
  rather than new defaults.

## Non-goals

- Issuing/rotating SSH certificates — that belongs to a CA (step-ca, Vault SSH);
  Porter only *consumes* certificates.
- Becoming a Kubernetes deployment tool — the GitOps/controller ecosystem
  (Argo, Flux, Flagger) already owns that space.

Have an idea or a use case Porter doesn't serve well? Please open an issue.
