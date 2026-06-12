package porter

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"
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
		{EnsureSystemdKey("/etc/systemd/system/app.service", "Service", "Restart", "always"), "ensure_systemd_key", "/etc/systemd/system/app.service"},
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
	// EnsureSystemdKey carries section in Src and key=value in Body.
	sk := EnsureSystemdKey("/etc/systemd/system/app.service", "Service", "Restart", "always").Build()
	if sk.Src != "Service" || sk.Body != "Restart=always" {
		t.Errorf("EnsureSystemdKey compose: %+v", sk)
	}
}

func TestEnsureSystemdKeyInContent(t *testing.T) {
	const unit = "[Unit]\nDescription=app\n\n[Service]\nExecStart=/usr/bin/app\n"

	// Insert under [Service]: lands directly after the header, not at EOF.
	got, changed, err := ensureSystemdKeyInContent(unit, "Service", "Restart=always")
	if err != nil || !changed {
		t.Fatalf("insert: changed=%v err=%v", changed, err)
	}
	if want := "[Unit]\nDescription=app\n\n[Service]\nRestart=always\nExecStart=/usr/bin/app\n"; got != want {
		t.Errorf("insert placement wrong:\n got %q\nwant %q", got, want)
	}

	// Already present anywhere -> no change (operator's value wins).
	if _, changed, _ := ensureSystemdKeyInContent("[Service]\nRestart=on-failure\n", "Service", "Restart=always"); changed {
		t.Error("existing key must not be clobbered")
	}

	// Missing section -> error.
	if _, _, err := ensureSystemdKeyInContent("[Unit]\nDescription=x\n", "Service", "Restart=always"); err == nil {
		t.Error("missing section must error")
	}

	// CRLF preserved on the inserted line.
	got, _, _ = ensureSystemdKeyInContent("[Service]\r\nExecStart=/x\r\n", "Service", "Restart=always")
	if !strings.Contains(got, "Restart=always\r\n") {
		t.Errorf("CRLF not preserved: %q", got)
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
		{AssertCertValid("/c/leaf.crt", 30*24*time.Hour), "assert_cert_valid"},
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
	if b := AssertCertValid("/c/leaf.crt", 30*24*time.Hour).Build(); b.Dest != "/c/leaf.crt" || b.Body != "2592000" {
		t.Errorf("AssertCertValid fields: %+v", b)
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

func TestDockerRunServiceOptions(t *testing.T) {
	e := &Executor{}
	cmd := e.buildDockerRun("web", "nginx:1.27",
		"ports:8080:80;restart:unless-stopped;init:true;logrotate:10m,3")
	for _, want := range []string{
		"docker run -d", "--name web",
		"-p 8080:80",
		"--restart unless-stopped",
		"--init",
		"--log-opt max-size=10m", "--log-opt max-file=3",
		"nginx:1.27",
	} {
		if !strings.Contains(cmd, want) {
			t.Errorf("docker run cmd missing %q:\n  %s", want, cmd)
		}
	}
}

func TestDockerRunOptionBuilders(t *testing.T) {
	b := Docker("web").Run("nginx").Restart("always").Init().LogRotate("5m", "2").Build()
	for _, want := range []string{"restart:always", "init:true", "logrotate:5m,2"} {
		if !strings.Contains(b.Body, want) {
			t.Errorf("Body missing %q: %s", want, b.Body)
		}
	}
}

func TestTrustCAContentBuilder(t *testing.T) {
	b := TrustCAContent("-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----").As("idx-root-ca").Build()
	if b.Action != "trust_ca_content" {
		t.Fatalf("action = %q", b.Action)
	}
	if b.Src != "idx-root-ca" {
		t.Errorf("anchor (Src) = %q, want idx-root-ca", b.Src)
	}
	if !strings.Contains(b.Body, "BEGIN CERTIFICATE") {
		t.Errorf("PEM not in Body: %q", b.Body)
	}
	if readOnlyActions["trust_ca_content"] {
		t.Error("trust_ca_content should be mutating")
	}
}

func TestExecTrustCAContent(t *testing.T) {
	fr := &fakeRunner{rules: []rule{{contains: "mktemp", out: "/tmp/porter.XXXX"}}}
	e := newTestExec(fr)
	_, err := e.exec(TrustCAContent("PEMDATA").As("idx-root-ca").Build(), NewVars())
	if err != nil {
		t.Fatalf("exec: %v", err)
	}
	// Must install the anchor under the trust dir (0644) and refresh the store.
	if !fr.ran("/usr/local/share/ca-certificates/idx-root-ca.crt") {
		t.Errorf("did not install anchor into trust dir; calls=%v", fr.calls)
	}
	if !fr.ran("install -m 0644") {
		t.Errorf("anchor not written 0644; calls=%v", fr.calls)
	}
	if !fr.ran("update-ca-certificates") {
		t.Errorf("did not refresh trust store; calls=%v", fr.calls)
	}
}

func TestUploadBuilder(t *testing.T) {
	b := Upload("build/app.tar", "/tmp/app.tar").Mode("0600").Owner("app:app").Sudo().Build()
	if b.Action != "upload" || b.Src != "build/app.tar" || b.Dest != "/tmp/app.tar" {
		t.Fatalf("Upload builder: %+v", b)
	}
	if b.Perm != "0600" || b.Own != "app:app" || !b.Sudo {
		t.Errorf("Upload modifiers: perm=%q own=%q sudo=%v", b.Perm, b.Own, b.Sudo)
	}
	if readOnlyActions["upload"] {
		t.Error("upload should be mutating")
	}
}

func TestStdinFileBuilder(t *testing.T) {
	b := Run("docker load").StdinFile("build/app.tar").Sudo().Build()
	if b.Action != "run" || b.Body != "docker load" {
		t.Fatalf("Run builder: %+v", b)
	}
	if b.StdinFile != "build/app.tar" || !b.Sudo {
		t.Errorf("StdinFile/Sudo: stdin=%q sudo=%v", b.StdinFile, b.Sudo)
	}
}

func TestPlaceStaged(t *testing.T) {
	// mode + owner under sudo -> single atomic install
	fr := &fakeRunner{}
	if err := newTestExec(fr).placeStaged("/tmp/t", "/usr/bin/app", true, "0755", "root:root"); err != nil {
		t.Fatal(err)
	}
	if !fr.ran("install -m 0755 -o root -g root /tmp/t /usr/bin/app") {
		t.Errorf("expected install with mode+owner; calls=%v", fr.calls)
	}
	if !fr.ran("sudo -S") {
		t.Errorf("placement should run under sudo; calls=%v", fr.calls)
	}
	// owner only, no sudo -> cp then chown
	fr2 := &fakeRunner{}
	if err := newTestExec(fr2).placeStaged("/tmp/t", "/srv/d", false, "", "u:g"); err != nil {
		t.Fatal(err)
	}
	if !fr2.ran("cp /tmp/t /srv/d") || !fr2.ran("chown u:g /srv/d") {
		t.Errorf("expected cp+chown; calls=%v", fr2.calls)
	}
}

func TestSudoStdinCommand(t *testing.T) {
	const pw, payload = "pw123", "TARBYTES"

	// With sudo: command is wrapped and the password is the FIRST stdin line,
	// with the file bytes intact AFTER it (sudo must not consume them).
	cmd, r := sudoStdinCommand("docker load", pw, true, strings.NewReader(payload))
	if cmd != "sudo -k -S -p '' docker load" {
		t.Errorf("sudo cmd = %q", cmd)
	}
	got, _ := io.ReadAll(r)
	if string(got) != pw+"\n"+payload {
		t.Errorf("sudo stdin = %q, want password line then file bytes", got)
	}

	// Without sudo: command unchanged and stdin is exactly the file.
	cmd, r = sudoStdinCommand("docker load", pw, false, strings.NewReader(payload))
	if cmd != "docker load" {
		t.Errorf("nosudo cmd = %q", cmd)
	}
	got, _ = io.ReadAll(r)
	if string(got) != payload {
		t.Errorf("nosudo stdin = %q, want just file bytes", got)
	}
}
