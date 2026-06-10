// Package porter provides a declarative deployment system for Go.
//
// Porter "carries" files and commands to remote servers over SSH,
// using a fluent DSL for defining deployment tasks.
//
// # Quick Start
//
//	client, err := porter.Connect("192.168.1.100", porter.DefaultConfig("user", "pass"))
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer client.Close()
//
//	tasks := porter.Tasks(
//	    porter.Upload("./app", "/home/app/bin"),
//	    porter.Chmod("/home/app/bin").Mode("755"),
//	    porter.Svc("app").Restart(),
//	)
//
//	executor := porter.NewExecutor(client, "pass")
//	stats, err := executor.Run("Deploy", tasks, porter.NewVars())
//
// # Shipping a Docker image
//
// Upload pushes a local file to the host (SFTP); StdinFile pipes a local file
// straight into a remote command without staging it on the target's disk:
//
//	tasks := []porter.Task{
//	    // stage the tar on the host, then load it
//	    porter.Upload("build/app.tar", "/tmp/app.tar").Build(),
//	    porter.Run("docker load -i /tmp/app.tar").Sudo().Build(),
//
//	    // or, zero-disk: pipe the local tar into `docker load` over stdin
//	    porter.Run("docker load").StdinFile("build/app.tar").Sudo().Build(),
//	}
//
// # Features
//
//   - Declarative DSL for defining deployment tasks
//   - SSH/SFTP file transfers and command execution
//   - Verified host keys (TOFU/strict) plus SSH-certificate auth
//     (ConnectWithCert), bastion/ProxyJump (ConnectViaJump) and keepalives
//   - Idempotent state primitives (EnsureFile, EnsureService, EnsureCron, ...)
//     that gather a fact, diff, and no-op when already converged
//   - Goss-style health assertions (AssertServiceActive, AssertHTTPStatus, ...)
//   - Atomic releases with health-gated cutover and rollback (NewRelease, Rollback)
//   - Deploy-as-a-trace via NewTracer (OpenTelemetry-shaped spans) and slog
//   - Secrets: SOPS+age (Secret) and pluggable backends (SecretCommand)
//   - Supply-chain gate: cosign verification (VerifyBlob, VerifyImage)
//   - Retry/loop/conditional execution, health checks, variable expansion
//   - A real --dry-run that previews exactly what would change
//
// The optional web dashboard lives under web/ and ships as the cmd/porter-ui
// binary; it is not part of this library's public API.
package porter
