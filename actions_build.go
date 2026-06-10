package porter

func init() {
	register("go", actGo)
	register("npm", actNpm)
}

func actGo(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.goCtl(dest, t.State, t.Src, body)
}

func actNpm(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.npmCtl(dest, t.State, body)
}
