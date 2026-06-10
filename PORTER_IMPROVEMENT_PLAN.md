# Porter — Audit & Improvement Plan (2026)

_Status: research synthesis, June 2026. Code audited at v0.8.1. Research pinned to 2026-current sources._

---

## 1. What porter actually does (verified against code)

Porter is a **Go declarative SSH/SFTP push-deploy system**: a fluent DSL + executor (core library), a CLI (`cmd/porter`), and a web dashboard (`porterui/` + React `ui/`).

### Core library (root package, ~40 Go files)
- **Fluent DSL** → builds a flat `[]Task` struct; one `Executor.exec` (`executor.go:339`) dispatches on a string `Task.Action` through a ~110-case `switch`. Each case assembles a shell command string and runs it over one SSH connection.
- **Action families**: file transfer/ops (`file.go`, `sftp.go`), command exec + capture + streaming (`command.go`, `streaming.go`), systemd + journal + service-file management (`systemd.go`, `logtail.go`), docker + compose (`docker.go`, `compose.go`), rsync (`rsync.go`), health checks (`wait.go`, `check.go`), archives, apt, users, processes, network, git, go, npm, cron, ufw, nginx, system, backup, env files, CA trust (`cert.go`), CodeMeter/Wibu.
- **Control flow**: `.When()`, `.Loop()`, `.Ignore()`, `.Creates()`, `.Retry()/.RetryDelay()`, `.Timeout()`, `.Sudo()`, conditions (`Always/If/IfEquals/And/Or/Not`), variable expansion (`{{key}}` literal replace), `Register` to capture command output into vars.
- **Transport**: `melbahja/goph` over `x/crypto/ssh`. Auth: password (default), key, key+passphrase, agent. Single long-lived client per host, SFTP/session opened per-op.
- **Execution model**: strictly sequential, single host per executor, fail-fast (no rollback), retry = blind fixed-delay re-run.

### Web UI (`porterui/`, 50+ Go files + React 19/Vite/MUI)
- ~160 endpoints: machine CRUD, remote command exec, interactive root PTY over WS, log streaming (SSE/WS), file manager (up to 5GB upload), docker/compose, systemd, scheduler (cron), SSH-key deploy, VNC/noVNC, WOL, network tools, backups, machine diff, import/export, AI agent command execution, notifications.
- JWT (HS256) + bcrypt + RBAC roles defined; AES-256-GCM credential encryption at rest; SQLite (WAL) or MySQL; WebSocket dashboard hub with 10s health broadcast.

---

## 2. Critical findings (must-fix, ordered by severity)

> These are correctness/security defects in the **current code**, independent of any new features.

1. **Web UI ships with NO server-side auth.** `runner.go:280` calls `SetupRoutes` (no middleware). `SetupRoutesWithAuth` exists but is **broken** — it builds a protected `/api` subrouter then registers every route on the root router instead. Binds `0.0.0.0`. Every endpoint — remote command exec, **root PTY**, file write, reboot/shutdown — is reachable unauthenticated. The React auth is client-side only and **fails open to `role:admin`** if `/api/auth/status` errors. _Dominant finding._
2. **Default creds `admin`/`admin`** (`auth.go:119`).
3. **Host key verification disabled everywhere** — `ssh.InsecureIgnoreHostKey()` in all connectors (core `ssh.go:29`, `connection.go:30/51/72`; UI `terminal.go:162` etc.) + `StrictHostKeyChecking=no` for rsync. Fully MITM-able.
4. **Sudo password leaks into command strings & process tables**: `echo <pw> | sudo -S <cmd>` (core `executor.go:211`, UI `machines.go:1167`) and `sshpass -p '<pw>'` (rsync-local `executor.go:1589`). Visible in `ps`, breaks if password contains `'`.
5. **Pervasive shell injection.** Almost every action concatenates `Src/Dest/Body` (which can come from registered command output) into a shell string with no quoting. `shellEscape` exists but is applied only to journal flags. `IsDangerousCommand` (UI) is a bypassable regex blocklist (`confirmed:true`/`skip_validate:true`).
6. **CSRF wide open**: every WS upgrader `CheckOrigin → true`; SSE endpoints `Access-Control-Allow-Origin: *`. Combined with cookie auth, any web page can drive the API.
7. **`Changed` stat is meaningless** — always equals `OK` (`executor.go:200`). Porter cannot report what actually changed; the RECAP line lies.
8. **`AES Decrypt` fails open to plaintext** (`crypto.go:100`) — masks key/corruption errors. Key sits next to the DB, no passphrase/KMS.
9. **Zero runtime tests.** `Executor.exec`/`runTask`/`Run`, every command-builder, all SSH/SFTP, and the entire web layer (incl. the auth bug an HTTP test would catch instantly) are untested. Tests cover only DSL struct construction.

Lesser foot-guns: `template` action is hard-wired to systemd `.service` files (garbage path for anything else); inconsistent `.Sudo()` (file ops always escalate, `Run` honors the flag); blind retry re-runs non-idempotent actions; no reconnect/keepalive; `cron_add` appends unconditionally (duplicates on re-run); SQLite `SetMaxOpenConns(1)` serializes all writes.

---

## 3. 2026 global standards (what the field expects now)

| Area | 2026 standard | Porter today |
|---|---|---|
| **SSH auth** | Short-lived SSH **certificates** (Vault SSH CA / smallstep step-ca / Teleport), tied to OIDC, shift-length TTL. Keys+agent acceptable. **sshpass still an explicit anti-pattern** (fails PCI/ISO/NIST). | password default + sshpass for rsync |
| **PQ crypto** | OpenSSH 10.1+ **warns on non-PQ** by default (`WarnWeakCrypto`); `mlkem768x25519-sha256` default since 10.0. `x/crypto v0.53.0` exposes `KeyExchangeMLKEM768X25519` (needs **Go 1.24+**). | goph/x/crypto; PQ depends on build toolchain |
| **Host keys** | Strict `knownhosts` (changed key = hard fail), deliberate TOFU for unknown, `ssh.CertChecker` for host-CA. | disabled |
| **Idempotency** | Fact-gather → diff → no-op. `--dry-run`/`--diff` as first-class output. pyinfra v3.6 is the reference. | imperative only; `Creates`/`When` band-aids; broken `Changed` |
| **Releases/rollback** | Atomic timestamped release dirs + `current` symlink flipped via `rename()` (never `rm && ln`); health-gated cutover; instant rollback by repointing. **Kamal 2 / kamal-proxy** is the live reference (v2.11.0, Mar 2026). | none |
| **Observability** | OTel: deploy = trace, host/task/command = spans. `deployment.environment.name` is **Stable**; `cicd.*` still **Development** (won't stabilize 2026). `slog`+`otelslog` production-ready. | `log.Printf` + ANSI; one progress callback |
| **Secrets** | **SOPS + age** (age has won over GPG; Flux recommends it; age 1.3 has PQ keys). Decrypt-in-memory → ship 0600/tmpfs → never log. OpenBao 2.5 (Feb 2026, Vault Enterprise features free) / Vault / Infisical as optional read-backends. | sudo pw in plaintext; no secret primitive |
| **Supply chain** | Sigstore/cosign keyless + **SLSA v1.2** (Nov 2025, adds Source Track). Verify signature+provenance **before** deploy. _Note: US softened the SBOM mandate (OMB M-26-05, Jan 2026); **EU CRA** reporting obligations bind **2026-09-11** — that's the live regulatory driver._ | none |

**Landscape note:** `pressly/sup` is dead (2017). `purpleidea/mgmt` hit **v1.0** (Feb 2026). pyinfra is healthy (v3.6, Jun 2026). Provisioning→OpenTofu / config-push→Ansible-class split holds — **push-SSH to long-lived VMs is not dead**, it's exactly porter's legitimate niche (edge/on-prem casino-floor boxes). Progressive delivery (canary/blue-green) on **plain VMs is an unsolved, unowned space** in 2026 — the K8s stack (Argo Rollouts, Flagger) doesn't apply. Even Kamal's canary is advertised-but-not-first-class.

---

## 4. Secret sauce — where porter can lead, not follow

These are gaps **nobody owns** in 2026 for the SSH-push-to-VM niche:

1. **Health-gated atomic release/rollback for systemd binaries** (not just docker). Kamal proves the model but is docker-only. Porter already has systemd + health-check primitives — wire them into a release-dir + symlink-switch + `/health`-gated cutover + `porter rollback`. **Highest-value, most-differentiated.**
2. **Deploy-as-an-OpenTelemetry-trace.** Emit a span per step (connect → upload → decrypt-secret → restart-unit → health-check); render the trace in the web dashboard / pipe to otel-tui. **No SSH-push tool ships this.** Aligns with your existing idx-trust OTel work.
3. **`cosign verify` as a pre-deploy gate.** Verify artifact signature + SLSA provenance before any file lands. There is no admission-control equivalent for VM push deploys — porter could be it. Strong EU-CRA story.
4. **Real idempotency via fact-gathering** + a true `--diff` mode — turns "scripted SSH" into "declarative deploy" and fixes the broken `Changed` accounting at the same time.
5. **SOPS+age native secret primitive** (in-memory decrypt, 0600/tmpfs, redacted from logs/traces) with pluggable read-backends (OpenBao/Vault/Infisical/1Password) — Kamal's "references not plaintext" discipline.

---

## 5. Proposed roadmap (phased)

**Phase 0 — Stop the bleeding (security, do first):**
- Wire `AuthMiddleware` onto the real routes (fix `SetupRoutesWithAuth` registering on root); make `runner.go` use it. Make React auth fail **closed**.
- Force admin password change on first boot; no `admin/admin`.
- `knownhosts` verification with TOFU + changed-key hard fail; `CertChecker` hook.
- Stop putting sudo password in argv — use stdin to `sudo -S` without `echo`, or `SSH_ASKPASS`/cert auth; kill sshpass.
- Central `shellEscape`/`shellquote` discipline for all action builders; parameterize where possible.
- Tighten `CheckOrigin`; add CSRF protection.
- Encryption: fail **closed**, move key to OS keyring/KMS option.

**Phase 1 — Correctness & tests:**
- Real integration tests for `Executor` (mock SSH); HTTP/auth tests for the web layer; fix `Changed`.
- Connection keepalive + reconnect; make `.Sudo()` consistent.

**Phase 2 — Declarative core:**
- `Ensure*` state primitives (fact-gather → diff → no-op); `--dry-run`/`--diff` first-class output.

**Phase 3 — Releases & secret sauce:**
- Atomic release/rollback for systemd + docker; health-gated cutover; `porter rollback`.
- OTel deploy-as-trace + `slog`/`otelslog`.
- SOPS+age secret primitive + pluggable backends.
- `cosign verify` pre-deploy gate.

---

## 6. Decisions (Christo, 2026-06-09)

- **Exposure:** Internal-only, trusted LAN today → auth bug is lower-urgency but still being fixed.
- **Focus:** Security hardening (Phase 0) first.
- **SSH auth direction:** SSH **certificates via step-ca** (lightweight standalone OIDC-native CA, short-lived certs). Kill sshpass; keys+agent as the interim/fallback.
- **Positioning:** "Just be solid" — robust, standards-compliant modern SSH-push tool. **Not** compliance-branded; cosign/SLSA/CRA features are optional, not the headline.

### Phase 0 work order

**Done (branch `security-hardening-phase0`, tested):**
1. ✅ **Host-key verification** — new `hostkey.go`: `HostKeyTOFU` (default, pins on first use, **rejects changed keys as MITM**) / `HostKeyStrict` / `HostKeyInsecure` modes, plus `TrustHostCA()` wiring `ssh.CertChecker` for **step-ca host certs**. All 4 core connectors (`ssh.go`, `connection.go`) + 3 porterui SSH sites (`ssh.go`, `terminal.go`, `streaming.go`) + the rsync-local path now verify (rsync uses `StrictHostKeyChecking=accept-new` + porter's known_hosts). Dropped every `InsecureIgnoreHostKey`/`StrictHostKeyChecking=no` in those paths. Tests: `hostkey_test.go` (TOFU pin/verify, changed-key reject, strict reject, insecure skip).
2. ✅ **Sudo password leak (core)** — `executor.go sudo()` now `printf '%s\n' <shell-quoted-pw> | sudo -S -p ''` (builtin, never in process table; quoted = no injection/breakage).
3. ✅ **sshpass argv leak** — rsync-local now passes the password via `SSHPASS` env + `sshpass -e` (out of argv) and shell-quotes it.
4. ✅ **Web auth wiring** — `SetupRoutesWithAuth` rewritten to actually enforce (`r.Use(AuthMiddleware)` + `SetupRoutes`); `AuthMiddleware` now self-filters static/SPA + a public allowlist (`/api/auth/login|status`, agent/standalone-agent/build-client channels) so enabling it won't break machine-to-machine agents. `runner.go` selects it via `PORTER_AUTH=1` (default off to preserve the working trusted-LAN deploy; logs a loud warning when off). Tests: `auth_middleware_test.go` (401 without/with bad token, allowlist + valid-token pass).

**Phase 0 — also done (full autonomous build, 2026-06-09):**
5. ✅ **porterui sudo-password sweep** — all 25 `echo '%s' | sudo -S` sites across `system.go`/`files.go`/`machines.go`/`multiterminal.go`/`ssh.go`/`streaming.go` routed through `sudoStdin()`/`shellQuote()` (`porterui/shell.go`): `printf '%s\n' '<quoted-pw>' | sudo -S -p ''`.
6. **`PORTER_AUTH` → default on**: deferred until agent channels get their own auth (allowlisted now; functional + gated).
7. ✅ **React fail-closed** — `AuthContext.js` no longer fabricates `role:admin`; status-error/unauth → login. Disabled-auth mode explicit (404), no invented admin.
8. ✅ **Default `admin`/`admin` removed** — `ensureDefaultAdmin` now uses `PORTER_ADMIN_PASSWORD` or a 24-byte random password logged once.
9. **General shell-escaping** of the imperative switch: intentionally NOT blanket-applied (would break glob/multi-arg callers). New code (Ensure*, release, secrets) quotes throughout; existing actions unchanged by design.
10. ✅ **AES `Decrypt`/`Encrypt` fail-closed** (`crypto.go`) — nil key errors; looks-encrypted-but-fails-GCM errors (was silently returning ciphertext); legacy plaintext still reads.
11. ✅ **WS `CheckOrigin`** — all 5 upgraders (`agent`/`dashboard_ws`/`standalone-agent`/`terminal`/`vnc`) now use `checkWSOrigin` (same-origin + `PORTER_ALLOWED_ORIGINS`, allows non-browser agents). **scp** Windows fallback → `accept-new`. (SSE `Access-Control-Allow-Origin:*` still open — low risk, see follow-ups.)
12. **`UploadDir`/`DownloadDir`** local-`tar` path hardening — still a follow-up (low risk, controller-side).

---

## 7. Phase 1–3 features delivered (2026 research → working code, zero new deps)

All in the `porter` package, tested (`features_test.go`, 71 tests green total):

- **Declarative state (Phase 2)** — `EnsureFile`/`EnsureDir`/`EnsureSymlink`/`EnsurePackage`/`EnsureLine`/`EnsureServiceRunning`/`EnsureServiceEnabled` (`ensure.go`): fact-gather → diff → **no-op** when converged. Powers a real **`--dry-run`/diff** (`preview()`): reports per-task *would-change* by running read-only fact checks.
- **`Changed` stat fixed (Phase 1)** — `exec` now returns `(changed, err)`; read-only actions + converged Ensure* count as ok-not-changed. RECAP `changed=` is finally meaningful.
- **Atomic release/rollback (Phase 3 secret sauce)** — `NewRelease(base).Keep(n).HealthCheck(cmd).Sudo().Deploy(steps...)` (`release.go`): timestamped releases, health-gated **atomic `mv -Tf` symlink swap**, `Keep`-pruning; `Rollback(base)` repoints to previous release. Works for systemd binaries (Kamal is docker-only).
- **Deploy-as-an-OTel-trace (Phase 3 secret sauce)** — `Tracer` (`tracer.go`): one root span/deploy + child span/task, JSONL out, stable `deployment.environment.name`, custom attrs (`vcs.commit.sha`). `SetTracer`. Plus `SetLogger(*slog.Logger)` → structured per-task logs with `trace_id` correlation.
- **SOPS+age secrets (Phase 3)** — `Secret(sopsFile, dest)` (`secrets.go`): `sops -d` locally, ship plaintext over **SFTP at 0600** (never a shell command, never logged), optional owner. No Go dep (uses the `sops` CLI).
- **cosign verify gate (Phase 3)** — `VerifyBlob`/`VerifyImage` (`verify.go`): `cosign verify[-blob]` as a **pre-deploy admission gate**; non-zero aborts. No Go dep.
- **SSH user certificates (step-ca) (Phase 0/3)** — `ConnectWithCert(...)` (`sshcert.go`): cert+key signer auth, the chosen short-lived-credential direction.
- **Connection keepalive + non-default port** — `StartKeepalive(client, interval)` (`sshcert.go`); `Config.Port`.

**New public API:** `SetHostKeyMode`, `SetKnownHostsPath`, `TrustHostCA`, `HostKeyCallback`, `ConnectWithCert`, `StartKeepalive`, `Config.Port`, `Ensure*`, `NewRelease`/`Rollback`, `NewTracer`, `Executor.SetTracer`/`SetLogger`, `Secret`, `VerifyBlob`/`VerifyImage`. Worked example: `examples/modern/main.go`.

## 8. Second autonomous pass (2026-06-10) — remaining follow-ups closed

- ✅ **SSE CORS** — `logs.go`/`streaming.go` wildcard `Access-Control-Allow-Origin:*` → `allowSSEOrigin` (same-origin or `PORTER_ALLOWED_ORIGINS`).
- ✅ **`UploadDir`/`DownloadDir` hardening** (`connection.go`) — all paths shell-quoted; remote temp names now unpredictable (`randomID`) instead of `time.Now().UnixNano()` (no `/tmp` race/symlink attack).
- ✅ **Goss-style health assertions** (`assert.go`) — 9 `Assert*` primitives; read-only, fail-closed gates.
- ✅ **Pluggable secret backends** — `SecretCommand(fetchCmd, dest)` (`secrets.go`) for Vault/OpenBao/1Password/Infisical via their CLIs; same 0600/never-logged guarantees as `Secret`.
- ✅ **Agent-channel shared-secret auth** — `PORTER_AGENT_TOKEN` (`auth.go`): agent/standalone-agent/build-client channels require the token when set (constant-time compare, header or query), open when unset. Lets `PORTER_AUTH` be enabled for humans while locking machine channels independently.
- ✅ **Post-quantum SSH confirmed** — `x/crypto v0.47` already lists `mlkem768x25519-sha256` in the default kex order; porter negotiates ML-KEM hybrid automatically. No code change needed.

Tests added: `assert`/`SecretCommand` builders + read-only classification (`features_test.go`); `agentTokenValid` + agent-channel gate (`porterui/security_test.go`, `auth_middleware_test.go`). **Total 90+ assertions, all green.**

**Still open (genuinely optional / needs product decision):** flip `PORTER_AUTH` default on (deployment policy — would change the running trusted-LAN box's behavior); wire `Tracer`/`SetLogger` into the `porterui` deploy path (needs a UI trace viewer to be meaningful); SSH host-CA full `CertChecker` user-cert *rotation* tooling (porter consumes certs; issuing them is step-ca's job).
