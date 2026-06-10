package porter

func init() {
	register("wait_port", actWaitPort)
	register("wait_http", actWaitHTTP)
	register("wait_file", actWaitFile)
	register("file_exists", actFileExists)
	register("dir_exists", actDirExists)
	register("service_running", actServiceRunning)
}

func actWaitPort(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.waitForPort(dest, body, t.Timeout)
}

func actWaitHTTP(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.waitForHttp(dest, t.State, t.Timeout)
}

func actWaitFile(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.waitForFile(dest, t.Timeout)
}

func actFileExists(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	exists := e.checkFileExists(dest)
	if t.Register != "" {
		if exists {
			vars.Set(t.Register, "true")
		} else {
			vars.Set(t.Register, "false")
		}
	}
	return nil
}

func actDirExists(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	exists := e.checkDirExists(dest)
	if t.Register != "" {
		if exists {
			vars.Set(t.Register, "true")
		} else {
			vars.Set(t.Register, "false")
		}
	}
	return nil
}

func actServiceRunning(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	running := e.checkServiceRunning(dest, t.User)
	if t.Register != "" {
		if running {
			vars.Set(t.Register, "true")
		} else {
			vars.Set(t.Register, "false")
		}
	}
	return nil
}
