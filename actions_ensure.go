package porter

import "fmt"

func init() {
	register("ensure_file", actEnsureFile)
	register("ensure_dir", actEnsureDir)
	register("ensure_symlink", actEnsureSymlink)
	register("ensure_package", actEnsurePackage)
	register("ensure_line", actEnsureLine)
	register("ensure_systemd_key", actEnsureSystemdKey)
	register("ensure_service_running", actEnsureServiceRunning)
	register("ensure_service_enabled", actEnsureServiceEnabled)
	register("ensure_cron", actEnsureCron)
	register("ensure_user", actEnsureUser)
	register("ensure_mode", actEnsureMode)
	register("ensure_owner", actEnsureOwner)
	register("ensure_absent", actEnsureAbsent)
	register("ensure_git_repo", actEnsureGitRepo)
}

func actEnsureFile(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.fileConverged(dest, body, t.Sudo) {
		e.noOp = true
		return nil
	}
	return e.writeFile(dest, body, t.Sudo, perm, own)
}

func actEnsureDir(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.dirExists(dest) {
		e.noOp = true
		return nil
	}
	return e.runMaybeSudo(t.Sudo, "mkdir -p "+shellEscape(dest))
}

func actEnsureSymlink(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.symlinkPointsAt(dest, src) {
		e.noOp = true
		return nil
	}
	return e.runMaybeSudo(t.Sudo, "ln -sfn "+shellEscape(src)+" "+shellEscape(dest))
}

func actEnsurePackage(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.packageInstalled(dest) {
		e.noOp = true
		return nil
	}
	return e.runSudo("DEBIAN_FRONTEND=noninteractive apt-get install -y " + shellEscape(dest))
}

func actEnsureLine(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.linePresent(dest, body, t.Sudo) {
		e.noOp = true
		return nil
	}
	appendCmd := "printf '%s\\n' " + shellEscape(body) + " >> " + shellEscape(dest)
	if t.Sudo {
		return e.runSudo("sh -c " + shellEscape(appendCmd))
	}
	return e.run(appendCmd)
}

func actEnsureSystemdKey(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	// src = section ("Service"/"Unit"/...), body = "key=value", dest = unit path.
	content, err := e.runCaptureMaybeSudo(t.Sudo, "cat "+shellEscape(dest))
	if err != nil {
		return fmt.Errorf("ensure_systemd_key: read %s: %w", dest, err)
	}
	newContent, changed, err := ensureSystemdKeyInContent(content, src, body)
	if err != nil {
		return fmt.Errorf("ensure_systemd_key %s: %w", dest, err)
	}
	if !changed {
		e.noOp = true
		return nil
	}
	// Empty perm/owner: writeFile cp's over the existing unit, preserving its
	// mode and ownership (typically 0644 root:root).
	return e.writeFile(dest, newContent, t.Sudo, "", "")
}

func actEnsureServiceRunning(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.serviceActive(dest, t.User) {
		e.noOp = true
		return nil
	}
	sc, sudo := systemctlPrefix(t.User)
	return e.runMaybeSudo(sudo, sc+"start "+shellEscape(dest))
}

func actEnsureServiceEnabled(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.serviceEnabled(dest, t.User) {
		e.noOp = true
		return nil
	}
	sc, sudo := systemctlPrefix(t.User)
	return e.runMaybeSudo(sudo, sc+"enable "+shellEscape(dest))
}

func actEnsureCron(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	// Present if an exact crontab line already matches.
	if _, err := e.runCapture("crontab -l 2>/dev/null | grep -qxF -- " + shellEscape(body)); err == nil {
		e.noOp = true
		return nil
	}
	return e.run("(crontab -l 2>/dev/null; printf '%s\\n' " + shellEscape(body) + ") | crontab -")
}

func actEnsureUser(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if _, err := e.runCapture("id " + shellEscape(dest) + " >/dev/null 2>&1"); err == nil {
		e.noOp = true
		return nil
	}
	return e.runSudo(e.buildUserCmd("useradd", dest, body))
}

func actEnsureMode(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.modeMatches(dest, perm, t.Sudo) {
		e.noOp = true
		return nil
	}
	return e.runMaybeSudo(t.Sudo, "chmod "+perm+" "+shellEscape(dest))
}

func actEnsureOwner(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if e.ownerMatches(dest, own, t.Sudo) {
		e.noOp = true
		return nil
	}
	flag := ""
	if t.Rec {
		flag = "-R "
	}
	return e.runMaybeSudo(t.Sudo, "chown "+flag+own+" "+shellEscape(dest))
}

func actEnsureAbsent(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if !e.pathExists(dest) {
		e.noOp = true
		return nil
	}
	return e.runMaybeSudo(t.Sudo, "rm -rf "+shellEscape(dest))
}

func actEnsureGitRepo(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.ensureGitRepo(src, dest)
}
