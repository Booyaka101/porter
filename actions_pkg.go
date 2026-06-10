package porter

import "fmt"

func init() {
	register("apt_update", actAptUpdate)
	register("apt_install", actAptInstall)
	register("apt_remove", actAptRemove)
	register("apt_upgrade", actAptUpgrade)
	register("user_add", actUserAdd)
	register("user_del", actUserDel)
	register("user_mod", actUserMod)
	register("kill", actKill)
	register("killall", actKillall)
	register("pkill", actPkill)
	register("cron_add", actCronAdd)
	register("cron_remove", actCronRemove)
	register("ufw_allow", actUfwAllow)
	register("ufw_deny", actUfwDeny)
	register("ufw_enable", actUfwEnable)
	register("ufw_disable", actUfwDisable)
	register("nginx_test", actNginxTest)
	register("nginx_reload", actNginxReload)
	register("wibu_generate", actWibuGenerate)
	register("wibu_apply", actWibuApply)
	register("wibu_info", actWibuInfo)
	register("wibu_list", actWibuList)
}

func actAptUpdate(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("apt-get update")
}

func actAptInstall(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("DEBIAN_FRONTEND=noninteractive apt-get install -y " + body)
}

func actAptRemove(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("DEBIAN_FRONTEND=noninteractive apt-get remove -y " + body)
}

func actAptUpgrade(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("DEBIAN_FRONTEND=noninteractive apt-get upgrade -y")
}

func actUserAdd(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo(e.buildUserCmd("useradd", dest, body))
}

func actUserDel(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("userdel -r " + dest)
}

func actUserMod(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo(e.buildUserCmd("usermod", dest, body))
}

func actKill(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("kill " + dest)
}

func actKillall(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("killall " + dest)
}

func actPkill(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("pkill " + dest)
}

func actCronAdd(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("(crontab -l 2>/dev/null; echo '" + body + "') | crontab -")
}

func actCronRemove(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("crontab -l | grep -v '" + body + "' | crontab -")
}

func actUfwAllow(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("ufw allow " + dest)
}

func actUfwDeny(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("ufw deny " + dest)
}

func actUfwEnable(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("ufw --force enable")
}

func actUfwDisable(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("ufw disable")
}

func actNginxTest(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("nginx -t")
}

func actNginxReload(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("systemctl reload nginx")
}

func actWibuGenerate(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("cmu -c" + src + " -f " + dest)
	if err != nil {
		return fmt.Errorf("wibu generate failed: %s - %w", out, err)
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actWibuApply(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("cmu -i -f " + src)
	if err != nil {
		return fmt.Errorf("wibu apply failed: %s - %w", out, err)
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actWibuInfo(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("cmu -l")
	if err != nil {
		return fmt.Errorf("wibu info failed: %w", err)
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actWibuList(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("cmu -x")
	if err != nil {
		return fmt.Errorf("wibu list failed: %w", err)
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}
