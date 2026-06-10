# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's
[private vulnerability reporting](https://github.com/booyaka101/porter/security/advisories/new)
rather than opening a public issue. We aim to acknowledge reports within a few
business days.

When reporting, include the affected version/commit, a description, and a
reproduction if possible.

## Security posture

Porter executes commands and transfers files on remote hosts over SSH, so its
defaults matter. The current posture:

- **Host keys are verified.** The default is trust-on-first-use (pins the key on
  first connect, refuses a changed key as a possible MITM). Use
  `SetHostKeyMode(HostKeyStrict)` to require a pre-known host, and
  `TrustHostCA()` to accept hosts presenting a certificate from a trusted SSH
  CA (e.g. step-ca). `HostKeyInsecure` exists only for tests.
- **Prefer certificate or key auth.** `ConnectWithCert` (short-lived SSH
  certificates) and key/agent auth are recommended over passwords. Password and
  `sshpass` paths are supported but feed credentials over stdin / the `SSHPASS`
  env var, never the process argv.
- **Bastions via `ConnectViaJump`** tunnel without forwarding your SSH agent to
  intermediate hosts.
- **Secrets** (`Secret`, `SecretCommand`) are decrypted locally and written to
  the remote over SFTP at mode `0600` — never placed in a shell command line and
  never logged.
- **Supply chain.** `VerifyBlob`/`VerifyImage` can gate a deploy on a valid
  `cosign` signature.

### Web dashboard (optional)

The dashboard (`cmd/porter-ui`) is an optional component with a larger attack
surface. Defaults:

- **Authentication is ON by default.** Set `PORTER_AUTH=0` only on a fully
  trusted, isolated network. On first boot a strong random admin password is
  generated and logged once (or set `PORTER_ADMIN_PASSWORD`).
- WebSocket/SSE endpoints are **origin-checked**; set `PORTER_ALLOWED_ORIGINS`
  for a cross-origin frontend.
- Machine-to-machine agent channels can require a shared secret via
  `PORTER_AGENT_TOKEN`.
- Stored SSH credentials are encrypted at rest (AES-256-GCM) and fail closed on
  decryption errors.

Do not expose the dashboard directly to the public internet; place it behind a
VPN, a bastion, or an authenticating reverse proxy.
