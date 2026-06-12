package porter

import (
	"fmt"
	"strconv"
	"time"
)

// =============================================================================
// DECLARATIVE HEALTH ASSERTIONS (Goss-style)
//
// Each Assert* states a fact that MUST hold on the remote; if it doesn't, the
// task fails and (unless .Ignore()) aborts the deploy. Unlike WaitFor*, which
// polls until a condition becomes true, an assertion checks once — use it as a
// post-deploy smoke test ("the service is active, the port listens, /health is
// 200") or a pre-flight guard. All assertions are read-only (never counted as
// a change).
// =============================================================================

// AssertServiceActive fails unless the systemd unit is active. .UserMode() for
// a --user unit.
func AssertServiceActive(name string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_service_active", Dest: name, Name: "assert service active: " + name}}
}

// AssertServiceEnabled fails unless the systemd unit is enabled at boot.
func AssertServiceEnabled(name string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_service_enabled", Dest: name, Name: "assert service enabled: " + name}}
}

// AssertProcessRunning fails unless a process matching pattern is running
// (pgrep -f).
func AssertProcessRunning(pattern string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_process", Dest: pattern, Name: "assert process running: " + pattern}}
}

// AssertPortListening fails unless something is listening on the TCP port.
func AssertPortListening(port string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_port_listening", Dest: port, Name: "assert port listening: " + port}}
}

// AssertFileExists fails unless the path exists on the remote.
func AssertFileExists(path string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_file_exists", Dest: path, Name: "assert file exists: " + path}}
}

// AssertFileContains fails unless file contains the literal substring.
func AssertFileContains(file, substr string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_file_contains", Dest: file, Body: substr, Name: "assert file contains: " + file}}
}

// AssertPackageInstalled fails unless the apt package is installed.
func AssertPackageInstalled(name string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_package", Dest: name, Name: "assert package installed: " + name}}
}

// AssertHTTPStatus fails unless an HTTP GET of url returns the expected status
// code (checked from the remote host).
func AssertHTTPStatus(url, code string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_http_status", Dest: url, Body: code, Name: "assert HTTP " + code + ": " + url}}
}

// AssertCommandSucceeds fails unless the command exits zero on the remote.
func AssertCommandSucceeds(cmd string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "assert_command", Body: cmd, Name: "assert command succeeds: " + cmd}}
}

// AssertCertValid fails unless the X.509 certificate at path stays valid for at
// least `within` from now (its NotAfter is more than `within` in the future).
// Use it as a pre-flight guard ("the leaf cert isn't about to expire, don't
// deploy on top of a dying one") or a post-renewal smoke test. The check runs
// on the remote host via `openssl x509 -checkend` (openssl must be installed
// there); a missing, unreadable, or already-expired cert fails the assertion.
// Use .Sudo() for a root-only cert path.
//
//	porter.AssertCertValid("/var/lib/idxgames/certs/leaf.crt", 30*24*time.Hour)
func AssertCertValid(path string, within time.Duration) TaskBuilder {
	secs := int64(within.Seconds())
	return TaskBuilder{t: Task{
		Action: "assert_cert_valid",
		Dest:   path,
		Body:   strconv.FormatInt(secs, 10),
		Name:   fmt.Sprintf("assert cert valid for ≥%s: %s", within, path),
	}}
}
