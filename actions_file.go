package porter

func init() {
	register("upload", actUpload)
	register("copy", actCopy)
	register("move", actMove)
	register("mkdir", actMkdir)
	register("rm", actRm)
	register("touch", actTouch)
	register("symlink", actSymlink)
	register("cat", actCat)
	register("sed", actSed)
	register("write", actWrite)
	register("chown", actChown)
	register("chmod", actChmod)
	register("trust_ca", actTrustCA)
	register("trust_ca_content", actTrustCAContent)
	register("install", actInstall)
}

func actUpload(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.client.Upload(src, dest)
}

func actCopy(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("cp " + src + " " + dest)
}

func actMove(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("mv " + src + " " + dest)
}

func actMkdir(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("mkdir -p " + dest)
}

func actRm(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("rm -rf " + dest)
}

func actTouch(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("touch " + dest)
}

func actSymlink(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("ln -sf " + src + " " + dest)
}

func actCat(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("cat " + dest)
}

func actSed(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("sed -i '" + body + "' " + dest)
}

func actWrite(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.writeFile(dest, body, t.Sudo, perm, own)
}

func actChown(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	owner := own
	if owner == "" {
		owner = vars.Get("default_owner")
	}
	if owner == "" {
		owner = "root:root"
	}
	flag := ""
	if t.Rec {
		flag = "-R "
	}
	return e.runSudo("chown " + flag + owner + " " + dest)
}

func actChmod(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	mode := perm
	if mode == "" {
		mode = "+x"
	}
	return e.runSudo("chmod " + mode + " " + dest)
}

func actTrustCA(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.trustCA(dest, src)
}

func actTrustCAContent(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.trustCAContent(src, body) // src = anchor (.As), body = PEM
}

func actInstall(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	if err := e.runSudo("cp " + src + " " + dest); err != nil {
		return err
	}
	return e.runSudo("chmod +x " + dest)
}
