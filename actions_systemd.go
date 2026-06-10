package porter

func init() {
	register("reboot", actReboot)
	register("shutdown", actShutdown)
	register("hostname", actHostname)
	register("sysctl", actSysctl)
	register("service", actService)
	register("service_list", actServiceList)
	register("timer_list", actTimerList)
	register("daemon_reload", actDaemonReload)
	register("template", actTemplate)
	register("journal", actJournal)
}

func actReboot(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("reboot")
}

func actShutdown(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("shutdown -h now")
}

func actHostname(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("hostnamectl set-hostname " + dest)
}

func actSysctl(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("sysctl -w " + src + "=" + dest)
}

func actService(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.serviceCtl(dest, t.State, t.User)
}

func actServiceList(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	userFlag := ""
	if t.User {
		userFlag = "--user "
	}
	out, err := e.runCapture("systemctl " + userFlag + "list-units --type=service --all --no-pager --plain --no-legend")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actTimerList(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	userFlag := ""
	if t.User {
		userFlag = "--user "
	}
	out, err := e.runCapture("systemctl " + userFlag + "list-units --type=timer --all --no-pager --plain --no-legend")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actDaemonReload(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if t.User {
		return e.run("systemctl --user daemon-reload")
	}
	return e.runSudo("systemctl daemon-reload")
}

func actTemplate(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.installTemplate(dest, body, t.User)
}

func actJournal(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.journalCtl(dest, body, t.User, t.Sudo, t.Register, vars)
}
