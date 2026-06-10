package porter

import (
	"errors"
	"strings"
	"testing"
)

// fakeRunner is a cmdRunner that records every command and answers from a
// substring->response table, so dispatch/idempotency/assertion logic can be
// exercised without a live SSH host.
type fakeRunner struct {
	calls   []string
	rules   []rule
	fallErr error // returned when no rule matches (nil = success, empty output)
}

type rule struct {
	contains string
	out      string
	err      error
}

func (f *fakeRunner) Run(cmd string) ([]byte, error) {
	f.calls = append(f.calls, cmd)
	for _, r := range f.rules {
		if strings.Contains(cmd, r.contains) {
			return []byte(r.out), r.err
		}
	}
	return nil, f.fallErr
}

func (f *fakeRunner) ran(substr string) bool {
	for _, c := range f.calls {
		if strings.Contains(c, substr) {
			return true
		}
	}
	return false
}

func newTestExec(fr *fakeRunner) *Executor {
	return &Executor{runner: fr, verbose: false}
}

func TestExecEnsureFileNoOpWhenConverged(t *testing.T) {
	content := "log_level = info\n"
	fr := &fakeRunner{rules: []rule{
		{contains: "sha256sum", out: sha256Hex(content) + "\n"},
	}}
	e := newTestExec(fr)
	changed, err := e.exec(EnsureFile("/etc/app.conf", content).Build(), NewVars())
	if err != nil {
		t.Fatalf("exec: %v", err)
	}
	if changed {
		t.Error("converged file should be a no-op (changed=false)")
	}
	if fr.ran("cat >") || fr.ran("install ") {
		t.Error("converged file must not be rewritten")
	}
}

func TestExecEnsureFileWritesWhenDifferent(t *testing.T) {
	fr := &fakeRunner{rules: []rule{
		{contains: "sha256sum", out: "deadbeefdifferent\n"},
	}}
	e := newTestExec(fr)
	changed, err := e.exec(EnsureFile("/etc/app.conf", "new content").Build(), NewVars())
	if err != nil {
		t.Fatalf("exec: %v", err)
	}
	if !changed {
		t.Error("differing file should report changed")
	}
	if !fr.ran("cat >") {
		t.Errorf("expected a write command, got calls: %v", fr.calls)
	}
}

func TestExecEnsureServiceRunningNoOpThenStart(t *testing.T) {
	// Already active -> no-op, no start.
	active := &fakeRunner{} // is-active returns success (nil err)
	e := newTestExec(active)
	changed, err := e.exec(EnsureServiceRunning("nginx").Build(), NewVars())
	if err != nil || changed {
		t.Fatalf("active service: changed=%v err=%v", changed, err)
	}
	if active.ran("systemctl start") {
		t.Error("active service must not be started")
	}

	// Not active -> start issued, changed.
	inactive := &fakeRunner{rules: []rule{
		{contains: "is-active", err: errors.New("inactive")},
	}}
	e2 := newTestExec(inactive)
	changed, err = e2.exec(EnsureServiceRunning("nginx").Build(), NewVars())
	if err != nil {
		t.Fatalf("inactive exec: %v", err)
	}
	if !changed || !inactive.ran("systemctl start 'nginx'") {
		t.Errorf("inactive service should be started; changed=%v calls=%v", changed, inactive.calls)
	}
}

func TestExecEnsureCronIdempotent(t *testing.T) {
	// Present -> no-op. ("| crontab -" is the install pipe, distinct from the
	// "crontab -l | grep" check command.)
	present := &fakeRunner{} // grep -qxF succeeds
	e := newTestExec(present)
	changed, _ := e.exec(EnsureCron("0 * * * *", "/x.sh").Build(), NewVars())
	if changed || present.ran("| crontab -") {
		t.Errorf("present cron entry should be a no-op; changed=%v calls=%v", changed, present.calls)
	}

	// Absent -> appended once.
	absent := &fakeRunner{rules: []rule{{contains: "grep -qxF", err: errors.New("not found")}}}
	e2 := newTestExec(absent)
	changed, _ = e2.exec(EnsureCron("0 * * * *", "/x.sh").Build(), NewVars())
	if !changed || !absent.ran("| crontab -") {
		t.Errorf("absent cron entry should be added; changed=%v calls=%v", changed, absent.calls)
	}
}

func TestExecAssertionsFailClosed(t *testing.T) {
	// assert_command: failure propagates.
	failCmd := &fakeRunner{rules: []rule{{contains: "false", err: errors.New("exit 1")}}}
	if _, err := newTestExec(failCmd).exec(AssertCommandSucceeds("false").Build(), NewVars()); err == nil {
		t.Error("failing command assertion must error")
	}
	// assert_command: success.
	if _, err := newTestExec(&fakeRunner{}).exec(AssertCommandSucceeds("true").Build(), NewVars()); err != nil {
		t.Errorf("succeeding command assertion should pass: %v", err)
	}
	// assert_service_active: inactive -> error.
	inactive := &fakeRunner{rules: []rule{{contains: "is-active", err: errors.New("inactive")}}}
	if _, err := newTestExec(inactive).exec(AssertServiceActive("nginx").Build(), NewVars()); err == nil {
		t.Error("assert_service_active must fail when service is inactive")
	}
	// assert_http_status: mismatched code -> error.
	wrong := &fakeRunner{rules: []rule{{contains: "curl", out: "500"}}}
	if _, err := newTestExec(wrong).exec(AssertHTTPStatus("http://x/h", "200").Build(), NewVars()); err == nil {
		t.Error("assert_http_status must fail on code mismatch")
	}
	// assert_http_status: match -> ok, read-only (no change).
	okrun := &fakeRunner{rules: []rule{{contains: "curl", out: "200"}}}
	changed, err := newTestExec(okrun).exec(AssertHTTPStatus("http://x/h", "200").Build(), NewVars())
	if err != nil || changed {
		t.Errorf("matching http assertion should pass read-only; changed=%v err=%v", changed, err)
	}
}

func TestRunChangedAccountingAndRetry(t *testing.T) {
	// A run action that fails twice then succeeds, with Retry(2).
	attempts := 0
	fr := &fakeRunner{}
	fr.rules = []rule{} // default success; we intercept via a custom closure below
	e := newTestExec(fr)

	// Use a custom runner to count attempts and fail the first two.
	cr := &countingRunner{failFirst: 2, attempts: &attempts}
	e.runner = cr

	stats, err := e.Run("retry play", Tasks(
		Run("flaky").Retry(2).RetryDelay("1ms"),
	), NewVars())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if attempts != 3 {
		t.Errorf("expected 3 attempts (1 + 2 retries), got %d", attempts)
	}
	if stats.OK != 1 || stats.Changed != 1 || stats.Failed != 0 {
		t.Errorf("stats: %+v", stats)
	}
}

func TestRunChangedCountIgnoresReadOnly(t *testing.T) {
	fr := &fakeRunner{rules: []rule{
		{contains: "curl", out: "200"},
		{contains: "test -d", err: errors.New("no such dir")}, // dir missing -> will be created
	}}
	e := newTestExec(fr)
	stats, err := e.Run("mixed", Tasks(
		AssertHTTPStatus("http://x/h", "200"), // read-only -> ok, not changed
		EnsureDir("/opt/app"),                 // dir missing -> created -> changed
	), NewVars())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if stats.OK != 2 {
		t.Errorf("OK = %d, want 2", stats.OK)
	}
	if stats.Changed != 1 {
		t.Errorf("Changed = %d, want 1 (only the mkdir)", stats.Changed)
	}
}

// countingRunner fails the first failFirst calls, then succeeds.
type countingRunner struct {
	failFirst int
	attempts  *int
}

func (c *countingRunner) Run(cmd string) ([]byte, error) {
	*c.attempts++
	if *c.attempts <= c.failFirst {
		return nil, errors.New("transient failure")
	}
	return nil, nil
}
