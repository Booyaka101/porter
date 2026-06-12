package porter

import "fmt"

func init() {
	register("assert_service_active", actAssertServiceActive)
	register("assert_service_enabled", actAssertServiceEnabled)
	register("assert_process", actAssertProcess)
	register("assert_port_listening", actAssertPortListening)
	register("assert_file_exists", actAssertFileExists)
	register("assert_file_contains", actAssertFileContains)
	register("assert_package", actAssertPackage)
	register("assert_http_status", actAssertHTTPStatus)
	register("assert_command", actAssertCommand)
	register("assert_cert_valid", actAssertCertValid)
}

func actAssertServiceActive(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if !e.serviceActive(dest, t.User) {
		return fmt.Errorf("assertion failed: service %s is not active", dest)
	}
	return nil
}

func actAssertServiceEnabled(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if !e.serviceEnabled(dest, t.User) {
		return fmt.Errorf("assertion failed: service %s is not enabled", dest)
	}
	return nil
}

func actAssertProcess(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if _, err := e.runCapture("pgrep -f -- " + shellEscape(dest) + " >/dev/null"); err != nil {
		return fmt.Errorf("assertion failed: no process matching %q", dest)
	}
	return nil
}

func actAssertPortListening(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if _, err := e.runCapture("ss -ltnH 2>/dev/null | grep -q " + shellEscape(":"+dest+"$\\|:"+dest+" ")); err != nil {
		return fmt.Errorf("assertion failed: nothing listening on port %s", dest)
	}
	return nil
}

func actAssertFileExists(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if !e.pathExists(dest) {
		return fmt.Errorf("assertion failed: %s does not exist", dest)
	}
	return nil
}

func actAssertFileContains(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if _, err := e.runCaptureMaybeSudo(t.Sudo, "grep -qF -- "+shellEscape(body)+" "+shellEscape(dest)); err != nil {
		return fmt.Errorf("assertion failed: %s does not contain %q", dest, body)
	}
	return nil
}

func actAssertPackage(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if !e.packageInstalled(dest) {
		return fmt.Errorf("assertion failed: package %s is not installed", dest)
	}
	return nil
}

func actAssertHTTPStatus(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	got, _ := e.runCapture("curl -s -o /dev/null -w '%{http_code}' " + shellEscape(dest))
	if got != body {
		return fmt.Errorf("assertion failed: %s returned HTTP %s, want %s", dest, got, body)
	}
	return nil
}

func actAssertCommand(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if _, err := e.runCapture(body); err != nil {
		return fmt.Errorf("assertion failed: command did not succeed: %s", body)
	}
	return nil
}

func actAssertCertValid(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	// `openssl x509 -checkend N` exits 0 iff the cert will still be valid N
	// seconds from now; non-zero if it expires within the window, is already
	// expired, or cannot be read. body carries the window in whole seconds.
	cmd := "openssl x509 -checkend " + shellEscape(body) + " -noout -in " + shellEscape(dest)
	if _, err := e.runCaptureMaybeSudo(t.Sudo, cmd); err != nil {
		return fmt.Errorf("assertion failed: certificate %s is missing, unreadable, or expires within %ss", dest, body)
	}
	return nil
}
