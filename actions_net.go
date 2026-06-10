package porter

import "strings"

func init() {
	register("curl", actCurl)
	register("wget", actWget)
	register("ping", actPing)
	register("git_clone", actGitClone)
	register("git_pull", actGitPull)
	register("git_checkout", actGitCheckout)
	register("git_lfs_pull", actGitLfsPull)
	register("git_fetch", actGitFetch)
	register("git_reset", actGitReset)
	register("git_clean", actGitClean)
	register("git_describe", actGitDescribe)
}

func actCurl(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("curl --proto-redir =https --tlsv1.2 -fsSL -o " + dest + " " + src)
}

func actWget(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("wget -q -O " + dest + " " + src)
}

func actPing(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("ping -c 1 " + dest)
}

func actGitClone(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	cmd := "git clone"
	if strings.Contains(body, "shallow:true") {
		cmd += " --depth 1"
	} else if depth := e.parseOpt(body, "depth"); depth != "" {
		cmd += " --depth " + depth
	}
	cmd += " " + src + " " + dest
	return e.run(cmd)
}

func actGitPull(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("cd " + dest + " && git pull --ff-only")
}

func actGitCheckout(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("cd " + dest + " && git checkout " + body)
}

func actGitLfsPull(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.run("cd " + dest + " && git lfs pull")
}

func actGitFetch(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	cmd := "cd " + dest + " && git fetch origin"
	if strings.Contains(body, "prune:true") {
		cmd += " --prune"
	}
	return e.run(cmd)
}

func actGitReset(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	cmd := "cd " + dest + " && git reset"
	if strings.Contains(body, "hard:true") || body == "HEAD" || body == "" {
		cmd += " --hard"
	}
	if body != "" && !strings.Contains(body, ":") {
		cmd += " " + body
	}
	return e.run(cmd)
}

func actGitClean(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	cmd := "cd " + dest + " && git clean -f -d"
	if strings.Contains(body, "force:true") {
		cmd += " -x"
	}
	return e.run(cmd)
}

func actGitDescribe(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("cd " + dest + " && git describe --tags --always 2>/dev/null || git rev-parse --short HEAD")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}
