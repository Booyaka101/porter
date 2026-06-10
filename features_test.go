package porter

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestEnsureBuilders(t *testing.T) {
	cases := []struct {
		b      TaskBuilder
		action string
		dest   string
	}{
		{EnsureFile("/etc/app.conf", "x=1"), "ensure_file", "/etc/app.conf"},
		{EnsureDir("/opt/app"), "ensure_dir", "/opt/app"},
		{EnsureSymlink("/opt/app/current", "/usr/bin/app"), "ensure_symlink", "/usr/bin/app"},
		{EnsurePackage("nginx"), "ensure_package", "nginx"},
		{EnsureLine("/etc/hosts", "10.0.0.1 db"), "ensure_line", "/etc/hosts"},
		{EnsureServiceRunning("nginx"), "ensure_service_running", "nginx"},
		{EnsureServiceEnabled("nginx"), "ensure_service_enabled", "nginx"},
	}
	for _, c := range cases {
		task := c.b.Build()
		if task.Action != c.action {
			t.Errorf("%s: action = %q, want %q", c.action, task.Action, c.action)
		}
		if task.Dest != c.dest {
			t.Errorf("%s: dest = %q, want %q", c.action, task.Dest, c.dest)
		}
	}
	// EnsureFile content goes in Body; mode/owner compose via modifiers.
	f := EnsureFile("/etc/app.conf", "secret").Mode("0640").Owner("app:app").Build()
	if f.Body != "secret" || f.Perm != "0640" || f.Own != "app:app" {
		t.Errorf("EnsureFile compose: %+v", f)
	}
}

func TestEnsureExtendedBuilders(t *testing.T) {
	cases := []struct {
		b      TaskBuilder
		action string
	}{
		{EnsureCron("0 * * * *", "/usr/bin/backup.sh"), "ensure_cron"},
		{EnsureUser("deploy"), "ensure_user"},
		{EnsureMode("/etc/app.conf", "0640"), "ensure_mode"},
		{EnsureOwner("/etc/app.conf", "app:app"), "ensure_owner"},
		{EnsureAbsent("/tmp/stale"), "ensure_absent"},
		{EnsureGitRepo("https://example.com/r.git", "/opt/r"), "ensure_git_repo"},
	}
	for _, c := range cases {
		if got := c.b.Build().Action; got != c.action {
			t.Errorf("action = %q, want %q", got, c.action)
		}
		// All are mutating (not read-only) — they change state when not converged.
		if readOnlyActions[c.action] {
			t.Errorf("%q should be mutating", c.action)
		}
	}
	if b := EnsureCron("0 0 * * *", "/x.sh").Build(); b.Body != "0 0 * * * /x.sh" {
		t.Errorf("EnsureCron body = %q", b.Body)
	}
	if b := EnsureMode("/f", "0600").Build(); b.Perm != "0600" || b.Dest != "/f" {
		t.Errorf("EnsureMode fields: %+v", b)
	}
	if b := EnsureOwner("/f", "u:g").Build(); b.Own != "u:g" {
		t.Errorf("EnsureOwner owner: %+v", b)
	}
	if b := EnsureGitRepo("url", "/d").Build(); b.Src != "url" || b.Dest != "/d" {
		t.Errorf("EnsureGitRepo fields: %+v", b)
	}
}

func TestSha256HexMatchesSha256sum(t *testing.T) {
	// echo -n "hello" | sha256sum
	const want = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
	if got := sha256Hex("hello"); got != want {
		t.Errorf("sha256Hex(hello) = %s, want %s", got, want)
	}
}

func TestParseFileMode(t *testing.T) {
	if m := parseFileMode("0600", 0o644); m != 0o600 {
		t.Errorf("0600 -> %o", m)
	}
	if m := parseFileMode("640", 0o644); m != 0o640 {
		t.Errorf("640 -> %o", m)
	}
	if m := parseFileMode("", 0o600); m != 0o600 {
		t.Errorf("empty -> %o, want default 0600", m)
	}
	if m := parseFileMode("notoctal", 0o600); m != 0o600 {
		t.Errorf("bad -> %o, want default", m)
	}
}

func TestTracerEmitsRootAndChildSpans(t *testing.T) {
	var buf bytes.Buffer
	tr := NewTracer(&buf, "production", "myapp")
	if tr.TraceID() == "" {
		t.Fatal("trace id should be set")
	}
	root := tr.StartSpan("deploy myapp", "")
	child := tr.StartSpan("run step", root.ID())
	child.SetAttribute("porter.action", "run")
	child.End(nil)
	root.End(nil)

	var spans []Span
	for line := range strings.SplitSeq(strings.TrimSpace(buf.String()), "\n") {
		var s Span
		if err := json.Unmarshal([]byte(line), &s); err != nil {
			t.Fatalf("decode span: %v (line %q)", err, line)
		}
		spans = append(spans, s)
	}
	if len(spans) != 2 {
		t.Fatalf("got %d spans, want 2", len(spans))
	}
	// child emitted first (ended first), then root.
	if spans[0].ParentID != root.ID() {
		t.Errorf("child parent = %q, want root %q", spans[0].ParentID, root.ID())
	}
	if spans[1].ParentID != "" {
		t.Errorf("root should have no parent, got %q", spans[1].ParentID)
	}
	if spans[0].Attributes["deployment.environment.name"] != "production" {
		t.Errorf("missing stable deployment.environment.name attr: %+v", spans[0].Attributes)
	}
	if spans[0].Status != "ok" {
		t.Errorf("status = %q, want ok", spans[0].Status)
	}
	if spans[0].TraceID != tr.TraceID() {
		t.Errorf("span trace id mismatch")
	}
}

func TestNilTracerIsNoOp(t *testing.T) {
	var tr *Tracer
	// None of these should panic on a nil tracer.
	s := tr.StartSpan("x", "")
	s.SetAttribute("k", "v")
	s.End(nil)
	if tr.TraceID() != "" {
		t.Error("nil tracer trace id should be empty")
	}
}

func TestReleaseDeploySequence(t *testing.T) {
	rel := NewRelease("/opt/app").Keep(3).HealthCheck("./app --check")
	steps := []TaskBuilder{Run("echo deploy").Name("payload")}
	tasks := rel.Deploy(steps...)

	// prepare(3) + payload(1) + health(1) + activate(1) + prune(1) = 7
	if len(tasks) != 7 {
		t.Fatalf("got %d tasks, want 7: %+v", len(tasks), tasks)
	}
	// The activation must be an atomic rename (mv -Tf), never a bare rm+ln.
	var foundSwap, foundHealth, foundPrune bool
	for _, tk := range tasks {
		if tk.Action == "run" && strings.Contains(tk.Body, "mv -Tf") && strings.Contains(tk.Body, "current") {
			foundSwap = true
		}
		if strings.Contains(tk.Body, "./app --check") {
			foundHealth = true
		}
		if strings.Contains(tk.Body, "rm -rf") && strings.Contains(tk.Body, "tail -n +4") {
			foundPrune = true // keep 3 => tail -n +4
		}
	}
	if !foundSwap {
		t.Error("activation should use atomic mv -Tf swap")
	}
	if !foundHealth {
		t.Error("health check task missing")
	}
	if !foundPrune {
		t.Error("prune task missing or wrong keep count")
	}
	if rel.Dir() != "/opt/app/releases/"+strings.TrimPrefix(rel.Dir(), "/opt/app/releases/") {
		t.Error("release dir shape wrong")
	}
}

func TestRollbackBuilder(t *testing.T) {
	tk := Rollback("/opt/app").Build()
	if tk.Action != "run" {
		t.Fatalf("rollback action = %q", tk.Action)
	}
	if !strings.Contains(tk.Body, "mv -Tf") || !strings.Contains(tk.Body, "sed -n 2p") {
		t.Errorf("rollback should repoint current to previous release atomically: %q", tk.Body)
	}
}

func TestSecretAndVerifyBuilders(t *testing.T) {
	s := Secret("secrets/app.enc.yaml", "/etc/app/secret.env").Build()
	if s.Action != "secret" || s.Src != "secrets/app.enc.yaml" || s.Dest != "/etc/app/secret.env" {
		t.Errorf("Secret builder: %+v", s)
	}
	if s.Perm != "0600" {
		t.Errorf("Secret default mode = %q, want 0600", s.Perm)
	}
	vb := VerifyBlob("dist/app", "--key cosign.pub").Build()
	if vb.Action != "verify_blob" || vb.Src != "dist/app" || vb.Body != "--key cosign.pub" {
		t.Errorf("VerifyBlob builder: %+v", vb)
	}
	vi := VerifyImage("ghcr.io/org/app:1.2.3", "--certificate-identity=ci@org").Build()
	if vi.Action != "verify_image" || vi.Src != "ghcr.io/org/app:1.2.3" {
		t.Errorf("VerifyImage builder: %+v", vi)
	}
}

func TestAssertBuilders(t *testing.T) {
	cases := []struct {
		b      TaskBuilder
		action string
	}{
		{AssertServiceActive("nginx"), "assert_service_active"},
		{AssertServiceEnabled("nginx"), "assert_service_enabled"},
		{AssertProcessRunning("myapp"), "assert_process"},
		{AssertPortListening("8080"), "assert_port_listening"},
		{AssertFileExists("/etc/app.conf"), "assert_file_exists"},
		{AssertFileContains("/etc/app.conf", "x=1"), "assert_file_contains"},
		{AssertPackageInstalled("nginx"), "assert_package"},
		{AssertHTTPStatus("http://localhost/health", "200"), "assert_http_status"},
		{AssertCommandSucceeds("test -f /tmp/ok"), "assert_command"},
	}
	for _, c := range cases {
		if got := c.b.Build().Action; got != c.action {
			t.Errorf("action = %q, want %q", got, c.action)
		}
		// every assertion is read-only (never a "change")
		if !readOnlyActions[c.action] {
			t.Errorf("%q should be read-only", c.action)
		}
	}
	if b := AssertFileContains("/f", "needle").Build(); b.Body != "needle" || b.Dest != "/f" {
		t.Errorf("AssertFileContains fields: %+v", b)
	}
	if b := AssertHTTPStatus("http://x/h", "204").Build(); b.Body != "204" {
		t.Errorf("AssertHTTPStatus code in Body: %+v", b)
	}
}

func TestSecretCommandBuilder(t *testing.T) {
	b := SecretCommand("vault kv get -field=env secret/app", "/etc/app/env").Build()
	if b.Action != "secret_command" || b.Dest != "/etc/app/env" || b.Perm != "0600" {
		t.Errorf("SecretCommand builder: %+v", b)
	}
	if b.Body != "vault kv get -field=env secret/app" {
		t.Errorf("SecretCommand fetch cmd in Body: %q", b.Body)
	}
}

func TestReadOnlyActionsClassification(t *testing.T) {
	for _, a := range []string{"capture", "cat", "wait_http", "docker_ps", "verify_blob", "verify_image"} {
		if !readOnlyActions[a] {
			t.Errorf("%q should be classified read-only", a)
		}
	}
	for _, a := range []string{"copy", "ensure_file", "secret", "run", "write"} {
		if readOnlyActions[a] {
			t.Errorf("%q should be classified mutating", a)
		}
	}
}
