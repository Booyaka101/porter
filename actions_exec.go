package porter

import "time"

func init() {
	register("run", actRun)
	register("pause", actPause)
	register("capture", actCapture)
	register("capture_sudo", actCaptureSudo)
}

func actRun(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if t.Sudo {
		return e.runSudo(body)
	}
	return e.run(body)
}

func actPause(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if d, err := time.ParseDuration(body); err == nil {
		time.Sleep(d)
	}
	return nil
}

func actCapture(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture(body)
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actCaptureSudo(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runSudoCapture(body)
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}
