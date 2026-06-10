// Example: the 2026 feature set — declarative state, atomic releases with
// health-gated cutover and rollback, SOPS+age secrets, cosign verify gate,
// SSH-certificate auth, and deploy-as-an-OpenTelemetry-trace.
//
// Usage:
//
//	go run main.go -host 10.0.1.50 -user deploy -key ~/.ssh/id_ed25519 -cert ~/.ssh/id_ed25519-cert.pub
package main

import (
	"flag"
	"log"
	"log/slog"
	"os"
	"time"

	"github.com/booyaka101/porter"
	"github.com/melbahja/goph"
)

// connect prefers SSH-certificate auth, then key, then password.
func connect(host, user, key, cert, pass string) (*goph.Client, error) {
	switch {
	case cert != "" && key != "":
		return porter.ConnectWithCert(host, user, key, cert, "", 0, 0)
	case key != "":
		return porter.ConnectWithKey(host, user, key, 0)
	default:
		return porter.Connect(host, porter.DefaultConfig(user, pass))
	}
}

func main() {
	host := flag.String("host", "", "Remote host IP address")
	user := flag.String("user", "deploy", "SSH username")
	key := flag.String("key", "", "SSH private key path")
	cert := flag.String("cert", "", "SSH certificate path (step-ca / Vault SSH); enables cert auth")
	pass := flag.String("pass", "", "SSH password (fallback if no key/cert)")
	env := flag.String("env", "production", "deployment environment")
	dry := flag.Bool("dry-run", false, "preview changes without applying")
	flag.Parse()

	if *host == "" {
		log.Fatal("-host is required")
	}

	// --- Connect: prefer short-lived SSH certificates, then key, then password.
	// Host keys are verified (TOFU by default; see porter.SetHostKeyMode /
	// porter.TrustHostCA for strict / step-ca host-CA verification).
	conn, err := connect(*host, *user, *key, *cert, *pass)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close()

	// Keepalives keep a long deploy alive across an idle/NAT'd link.
	defer porter.StartKeepalive(conn, 30*time.Second)()

	exec := porter.NewExecutor(conn, *pass).SetDryRun(*dry)

	// Deploy-as-a-trace: one trace per deploy, one span per task, emitted as
	// JSONL (pipe to otel-tui or render in the dashboard).
	traceFile, _ := os.Create("deploy-trace.jsonl")
	if traceFile != nil {
		defer traceFile.Close()
		tracer := porter.NewTracer(traceFile, *env, "myapp")
		tracer.SetAttribute("vcs.commit.sha", os.Getenv("GIT_SHA"))
		exec.SetTracer(tracer)
	}

	// Structured logs with trace-id correlation.
	exec.SetLogger(slog.New(slog.NewJSONHandler(os.Stderr, nil)))

	vars := porter.NewVars()

	// --- Declarative base state (idempotent: a converged host is a no-op).
	base := porter.Tasks(
		porter.EnsurePackage("rsync"),
		porter.EnsureDir("/etc/myapp"),
		porter.EnsureFile("/etc/myapp/app.toml", "log_level = \"info\"\n").Mode("0640").Sudo(),
		porter.EnsureLine("/etc/hosts", "10.0.0.10 db.internal").Sudo(),

		// Deploy-time secret: decrypted locally via SOPS+age, shipped 0600,
		// never logged. (Requires `sops` + your age key on this machine.)
		porter.Secret("secrets/myapp.enc.env", "/etc/myapp/secret.env").Owner("app:app").Sudo(),

		// Supply-chain gate: refuse to deploy an unsigned artifact.
		porter.VerifyBlob("dist/myapp", "--key cosign.pub --signature dist/myapp.sig"),
	)
	if _, err := exec.Run("base state", base, vars); err != nil {
		log.Fatalf("base state: %v", err)
	}

	// --- Atomic release: deploy into releases/<ts>, health-check, then flip the
	// `current` symlink in one rename(2). Rollback is a one-liner if needed.
	rel := porter.NewRelease("/opt/myapp").Keep(5).Sudo().
		HealthCheck("test -x ./myapp && ./myapp --version")

	release := rel.Deploy(
		porter.Upload("dist/myapp", rel.Dir()+"/myapp"),
		porter.Run("chmod +x "+rel.Dir()+"/myapp"),
	)
	if _, err := exec.Run("release", release, vars); err != nil {
		log.Printf("release failed (previous release still live): %v", err)
		// Optional explicit rollback:
		_, _ = exec.Run("rollback", porter.Tasks(porter.Rollback("/opt/myapp")), vars)
		os.Exit(1)
	}

	// Restart the service pointed at /opt/myapp/current (idempotent ensure).
	final := porter.Tasks(
		porter.EnsureServiceEnabled("myapp").Sudo(),
		porter.Svc("myapp").Restart().Sudo(),
		porter.WaitForHttp("http://localhost:8080/health").ExpectCode("200"),
	)
	if _, err := exec.Run("activate service", final, vars); err != nil {
		log.Fatalf("activate: %v", err)
	}

	log.Println("deploy complete — trace written to deploy-trace.jsonl")
}
