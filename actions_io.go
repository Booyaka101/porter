package porter

import "fmt"

func init() {
	register("backup", actBackup)
	register("restore", actRestore)
	register("env_set", actEnvSet)
	register("env_delete", actEnvDelete)
	register("rsync", actRsync)
	register("rsync_install", actRsyncInstall)
	register("rsync_check", actRsyncCheck)
	register("rsync_version", actRsyncVersion)
	register("download", actDownload)
	register("upload_bytes", actUploadBytes)
	register("read_file", actReadFile)
	register("write_bytes", actWriteBytes)
}

func actBackup(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("cp -a " + dest + " " + dest + ".bak.$(date +%Y%m%d%H%M%S)")
}

func actRestore(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("cp -a $(ls -t " + dest + ".bak.* 2>/dev/null | head -1) " + dest)
}

func actEnvSet(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("grep -q '^" + src + "=' " + dest + " && sed -i 's|^" + src + "=.*|" + src + "=" + body + "|' " + dest + " || echo '" + src + "=" + body + "' >> " + dest)
}

func actEnvDelete(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("sed -i '/^" + src + "=/d' " + dest)
}

func actRsync(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.rsyncExec(src, dest, body, t.Sudo)
}

func actRsyncInstall(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.rsyncInstall()
}

func actRsyncCheck(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	installed := e.rsyncCheck()
	if t.Register != "" {
		if installed {
			vars.Set(t.Register, "true")
		} else {
			vars.Set(t.Register, "false")
		}
	}
	return nil
}

func actRsyncVersion(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("rsync --version | head -1")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actDownload(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	data, err := e.sftpRead(src)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	if t.Register != "" {
		vars.SetBytes(t.Register, data)
	}
	return nil
}

func actUploadBytes(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	data := vars.GetBytes(src)
	if data == nil {
		return fmt.Errorf("no data in variable: %s", src)
	}
	return e.sftpWrite(dest, data)
}

func actReadFile(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	data, err := e.sftpRead(src)
	if err != nil {
		return fmt.Errorf("read file failed: %w", err)
	}
	if t.Register != "" {
		vars.Set(t.Register, string(data))
	}
	return nil
}

func actWriteBytes(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	data := vars.GetBytes(body)
	if data == nil {
		data = []byte(body)
	}
	return e.sftpWrite(dest, data)
}
