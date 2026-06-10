package porter

import (
	"fmt"
	"io"
	"log"
	"log/slog"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/melbahja/goph"
)

// Executor runs tasks on a remote server.
type Executor struct {
	client     *goph.Client
	password   string
	verbose    bool
	dryRun     bool
	onProgress ProgressFunc
	tracer     *Tracer
	rootSpanID string
	logger     *slog.Logger

	// noOp is set by an action that determined the remote was already in the
	// desired state and did nothing (the Ensure* primitives). It is reset
	// before every dispatch and read by exec to report "ok, unchanged".
	noOp bool
}

// NewExecutor creates a new Executor.
func NewExecutor(client *goph.Client, password string) *Executor {
	return &Executor{client: client, password: password, verbose: true}
}

// SetVerbose enables or disables verbose output.
func (e *Executor) SetVerbose(v bool) *Executor { e.verbose = v; return e }

// SetDryRun enables or disables dry-run mode.
func (e *Executor) SetDryRun(v bool) *Executor { e.dryRun = v; return e }

// OnProgress sets a callback function that is called for each task state change.
func (e *Executor) OnProgress(fn ProgressFunc) *Executor { e.onProgress = fn; return e }

// SetTracer attaches a Tracer so the deploy is recorded as a trace (one root
// span per Run, one child span per task). Pass nil to disable.
func (e *Executor) SetTracer(t *Tracer) *Executor { e.tracer = t; return e }

// SetLogger attaches a structured logger. One record is emitted per task at
// completion (action, status, changed, duration, and the trace_id when a
// Tracer is set — enabling log<->trace correlation). Pass nil to disable.
func (e *Executor) SetLogger(l *slog.Logger) *Executor { e.logger = l; return e }

// logTask emits a structured record for a completed task, if a logger is set.
func (e *Executor) logTask(p TaskProgress) {
	if e.logger == nil {
		return
	}
	attrs := []any{
		"action", p.Action,
		"name", p.Name,
		"status", string(p.Status),
		"attempt", p.Attempt,
		"duration_ms", p.Duration.Milliseconds(),
	}
	if tid := e.tracer.TraceID(); tid != "" {
		attrs = append(attrs, "trace_id", tid)
	}
	if p.Error != nil {
		attrs = append(attrs, "error", p.Error.Error())
	}
	e.logger.Info("porter.task", attrs...)
}

// Run executes a list of tasks.
func (e *Executor) Run(name string, tasks []Task, vars *Vars) (*Stats, error) {
	stats := &Stats{Total: len(tasks)}

	if e.verbose {
		log.Printf("\n\033[1;36mPLAY [%s]\033[0m\n", name)
	}

	root := e.tracer.StartSpan("deploy "+name, "")
	if root != nil {
		root.SetAttribute("porter.task_count", len(tasks))
		if e.client != nil {
			root.SetAttribute("server.address", e.client.Config.Addr)
		}
		e.rootSpanID = root.ID()
	}

	for i, task := range tasks {
		taskName := vars.Expand(task.Name)

		if task.When != nil && !task.When(vars) {
			stats.Skipped++
			e.emitProgress(TaskProgress{
				Index:  i,
				Total:  len(tasks),
				Name:   taskName,
				Action: task.Action,
				Status: StatusSkipped,
			})
			continue
		}

		if len(task.Loop) > 0 {
			for _, item := range task.Loop {
				vars.Item = item
				if err := e.runTask(i, task, vars, stats); err != nil && !task.Ignore {
					return stats, err
				}
			}
			vars.Item = ""
			continue
		}

		if err := e.runTask(i, task, vars, stats); err != nil && !task.Ignore {
			return stats, err
		}
	}

	if e.verbose {
		log.Printf("\n\033[1;36mRECAP\033[0m: ok=%d changed=%d skipped=%d failed=%d\n",
			stats.OK, stats.Changed, stats.Skipped, stats.Failed)
	}
	return stats, nil
}

// emitProgress calls the progress callback if set
func (e *Executor) emitProgress(p TaskProgress) {
	if e.onProgress != nil {
		e.onProgress(p)
	}
}

func (e *Executor) runTask(idx int, task Task, vars *Vars, stats *Stats) error {
	name := vars.Expand(task.Name)
	total := stats.Total
	num := idx + 1

	// Calculate max attempts
	maxAttempts := 1
	if task.Retry > 0 {
		maxAttempts = task.Retry + 1
	}

	// Create progress tracker
	progress := TaskProgress{
		Index:      idx,
		Total:      total,
		Name:       name,
		Action:     task.Action,
		Status:     StatusRunning,
		Attempt:    1,
		MaxAttempt: maxAttempts,
		StartTime:  time.Now(),
	}

	// Emit one structured log record per task at completion, with the final
	// status the function leaves on `progress`.
	defer func() { e.logTask(progress) }()

	if e.verbose {
		mode := ""
		if e.dryRun {
			mode = " \033[35m(CHECK)\033[0m"
		}
		log.Printf("\033[1;33mTASK [%d/%d]\033[0m %s%s", num, total, name, mode)
	}

	// Emit running status
	e.emitProgress(progress)

	if e.dryRun {
		changed, detail := e.preview(task, vars)
		stats.OK++
		if changed {
			stats.Changed++
			progress.Status = StatusChanged
		} else {
			progress.Status = StatusOK
		}
		if e.verbose && detail != "" {
			log.Printf("  \033[35m%s\033[0m", detail)
		}
		progress.Duration = time.Since(progress.StartTime)
		e.emitProgress(progress)
		return nil
	}

	// Check Creates condition - skip if path exists
	if task.Creates != "" {
		creates := vars.Expand(task.Creates)
		if _, err := e.client.Run("test -e " + creates); err == nil {
			if e.verbose {
				log.Printf("  \033[36m...skipped (exists: %s)\033[0m", creates)
			}
			stats.Skipped++
			progress.Status = StatusSkipped
			progress.Duration = time.Since(progress.StartTime)
			e.emitProgress(progress)
			return nil
		}
	}

	// Execute with retry support
	var err error
	var changed bool
	delay := task.Delay
	if delay == 0 {
		delay = 2 * time.Second
	}

	span := e.tracer.StartSpan(task.Action+" "+name, e.rootSpanID)
	if span != nil {
		span.SetAttribute("porter.action", task.Action)
	}

	for i := 0; i < maxAttempts; i++ {
		progress.Attempt = i + 1

		if i > 0 {
			progress.Status = StatusRetrying
			e.emitProgress(progress)

			if e.verbose {
				log.Printf("  \033[33mRetrying (%d/%d)...\033[0m", i, task.Retry)
			}
			time.Sleep(delay)

			progress.Status = StatusRunning
			e.emitProgress(progress)
		}

		changed, err = e.exec(task, vars)
		if err == nil {
			break
		}
		progress.Error = err
	}

	if span != nil {
		span.SetAttribute("porter.attempts", progress.Attempt)
		span.SetAttribute("porter.changed", changed && err == nil)
		span.End(err)
	}

	progress.Duration = time.Since(progress.StartTime)

	if err != nil {
		if task.Ignore {
			if e.verbose {
				log.Printf("  \033[33m...ignoring\033[0m")
			}
			stats.OK++
			progress.Status = StatusOK
			progress.Error = nil
			e.emitProgress(progress)
			return nil
		}
		if e.verbose {
			log.Printf("  \033[1;31mFAILED\033[0m: %v", err)
		}
		stats.Failed++
		progress.Status = StatusFailed
		e.emitProgress(progress)
		return fmt.Errorf("%s: %w", name, err)
	}

	stats.OK++
	if changed {
		stats.Changed++
		progress.Status = StatusChanged
	} else {
		progress.Status = StatusOK
	}
	e.emitProgress(progress)
	return nil
}

// =============================================================================
// COMMAND HELPERS
// =============================================================================

func (e *Executor) sudo(cmd string) string {
	// Feed the password to sudo over stdin via printf (a shell builtin, so it
	// never lands in the remote process table) and shell-quote it so embedded
	// metacharacters can neither break the command nor inject shell. -p ''
	// suppresses the prompt that would otherwise pollute stdout.
	return "printf '%s\\n' " + shellEscape(e.password) + " | sudo -S -p '' " + cmd
}

func (e *Executor) run(cmd string) error {
	_, err := e.client.Run(cmd)
	return err
}

// writeFile writes content to dest. With no sudo, mode, or owner it streams
// straight to dest via a quoted heredoc (the original behavior). Otherwise the
// content is first staged in a private temp (mktemp creates it 0600, so it is
// never world-readable while staged) and then placed into dest: with a mode
// set, install applies that mode atomically — pass .Mode("600") for a secret
// such as a private key so dest itself is never world-readable; with only an
// owner, dest is copied (default umask mode, like a plain write) then chowned.
// The temp is always removed.
func (e *Executor) writeFile(dest, content string, sudo bool, perm, owner string) error {
	if !sudo && perm == "" && owner == "" {
		return e.run("cat > " + dest + " <<'PORTER_EOF'\n" + content + "\nPORTER_EOF")
	}
	tmp, err := e.runCapture("mktemp")
	if err != nil {
		return err
	}
	defer func() { _ = e.run("rm -f " + tmp) }()
	if err := e.run("cat > " + tmp + " <<'PORTER_EOF'\n" + content + "\nPORTER_EOF"); err != nil {
		return err
	}

	place := e.run
	if sudo {
		place = e.runSudo
	}

	// install sets mode (and owner) atomically when a mode is given; without
	// a mode, copy then chown so we don't force install's default 0755.
	if perm != "" {
		cmd := "install -m " + perm
		if owner != "" {
			user, group, hasGroup := splitOwner(owner)
			cmd += " -o " + user
			if hasGroup {
				cmd += " -g " + group
			}
		}
		return place(cmd + " " + tmp + " " + dest)
	}
	if err := place("cp " + tmp + " " + dest); err != nil {
		return err
	}
	if owner != "" {
		return place("chown " + owner + " " + dest)
	}
	return nil
}

// trustCA installs the CA certificate at certPath into the OS trust store so
// the machine trusts HTTPS peers signed by it without warnings. anchor is the
// filename under /usr/local/share/ca-certificates (defaults to certPath's base
// name); update-ca-certificates only consumes *.crt, so a .crt suffix is
// ensured.
func (e *Executor) trustCA(certPath, anchor string) error {
	if anchor == "" {
		anchor = filepath.Base(certPath)
	}
	if !strings.HasSuffix(anchor, ".crt") {
		anchor += ".crt"
	}
	target := "/usr/local/share/ca-certificates/" + anchor
	if err := e.runSudo("cp " + certPath + " " + target); err != nil {
		return err
	}
	return e.runSudo("update-ca-certificates")
}

// splitOwner splits a "user:group" owner spec. hasGroup is false when only a
// user is given (no colon, or an empty group).
func splitOwner(owner string) (user, group string, hasGroup bool) {
	parts := strings.SplitN(owner, ":", 2)
	if len(parts) == 2 && parts[1] != "" {
		return parts[0], parts[1], true
	}
	return parts[0], "", false
}

func (e *Executor) runSudo(cmd string) error {
	return e.run(e.sudo(cmd))
}

// runMaybeSudo runs cmd under sudo only when sudo is true.
func (e *Executor) runMaybeSudo(sudo bool, cmd string) error {
	if sudo {
		return e.runSudo(cmd)
	}
	return e.run(cmd)
}

// runCaptureMaybeSudo captures cmd output, under sudo only when sudo is true.
func (e *Executor) runCaptureMaybeSudo(sudo bool, cmd string) (string, error) {
	if sudo {
		return e.runSudoCapture(cmd)
	}
	return e.runCapture(cmd)
}

func (e *Executor) runCapture(cmd string) (string, error) {
	out, err := e.client.Run(cmd)
	return strings.TrimSpace(string(out)), err
}

func (e *Executor) runSudoCapture(cmd string) (string, error) {
	return e.runCapture(e.sudo(cmd))
}

func (e *Executor) parseOpt(opts, key string) string {
	for _, opt := range strings.Split(opts, ";") {
		parts := strings.SplitN(opt, ":", 2)
		if len(parts) == 2 && parts[0] == key {
			return parts[1]
		}
	}
	return ""
}

// runLocal executes a command on the local machine
func (e *Executor) runLocal(cmd string) error {
	c := exec.Command("sh", "-c", cmd)
	out, err := c.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %w", strings.TrimSpace(string(out)), err)
	}
	return nil
}

// getSSHDestination returns the SSH destination string (user@host) for rsync
func (e *Executor) getSSHDestination() string {
	return e.client.Config.User + "@" + e.client.Config.Addr
}

// =============================================================================
// ACTION DISPATCHER
// =============================================================================

// readOnlyActions never mutate the remote — running them is not a "change".
// Everything not listed is treated as mutating (the safe default for an
// imperative action). The Ensure* primitives report no-op dynamically via
// e.noOp instead of appearing here.
var readOnlyActions = map[string]bool{
	"cat": true, "read_file": true, "capture": true, "capture_sudo": true,
	"file_exists": true, "dir_exists": true, "service_running": true,
	"wait_port": true, "wait_http": true, "wait_file": true, "pause": true,
	"disk_space": true, "memory_info": true, "cpu_info": true, "load_average": true,
	"command_exists": true, "nproc": true, "sysinfo": true,
	"require_disk": true, "require_memory": true, "require_command": true,
	"docker_ps": true, "docker_images": true, "docker_volumes": true,
	"docker_networks": true, "docker_info": true,
	"compose_ps": true, "compose_logs": true, "compose_top": true,
	"svc_status": true, "svc_list": true, "svc_timers": true,
	"journal": true, "journal_unit": true, "git_describe": true,
	"ping": true, "curl": true, "wget": true,
	"verify_blob": true, "verify_image": true,
	"assert_service_active": true, "assert_service_enabled": true,
	"assert_process": true, "assert_port_listening": true,
	"assert_file_exists": true, "assert_file_contains": true,
	"assert_package": true, "assert_http_status": true, "assert_command": true,
}

// exec runs the action and reports whether it changed remote state. A
// read-only action, or an Ensure* primitive that found the host already
// converged (e.noOp), counts as ok-but-unchanged.
func (e *Executor) exec(t Task, vars *Vars) (bool, error) {
	e.noOp = false
	if err := e.dispatch(t, vars); err != nil {
		return false, err
	}
	if e.noOp || readOnlyActions[t.Action] {
		return false, nil
	}
	return true, nil
}

func (e *Executor) dispatch(t Task, vars *Vars) error {
	src := vars.Expand(t.Src)
	dest := vars.Expand(t.Dest)
	body := vars.Expand(t.Body)
	perm := vars.Expand(t.Perm)
	own := vars.Expand(t.Own)

	switch t.Action {
	// File operations
	case "upload":
		return e.client.Upload(src, dest)
	case "copy":
		return e.runSudo("cp " + src + " " + dest)
	case "move":
		return e.runSudo("mv " + src + " " + dest)
	case "mkdir":
		return e.runSudo("mkdir -p " + dest)
	case "rm":
		return e.runSudo("rm -rf " + dest)
	case "touch":
		return e.run("touch " + dest)
	case "symlink":
		return e.runSudo("ln -sf " + src + " " + dest)
	case "cat":
		return e.run("cat " + dest)
	case "sed":
		return e.runSudo("sed -i '" + body + "' " + dest)
	case "write":
		return e.writeFile(dest, body, t.Sudo, perm, own)
	case "chown":
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
	case "chmod":
		mode := perm
		if mode == "" {
			mode = "+x"
		}
		return e.runSudo("chmod " + mode + " " + dest)
	case "trust_ca":
		return e.trustCA(dest, src)
	case "install":
		if err := e.runSudo("cp " + src + " " + dest); err != nil {
			return err
		}
		return e.runSudo("chmod +x " + dest)

	// Declarative state primitives (fact-gather -> diff -> no-op)
	case "ensure_file":
		if e.fileConverged(dest, body, t.Sudo) {
			e.noOp = true
			return nil
		}
		return e.writeFile(dest, body, t.Sudo, perm, own)
	case "ensure_dir":
		if e.dirExists(dest) {
			e.noOp = true
			return nil
		}
		return e.runMaybeSudo(t.Sudo, "mkdir -p "+shellEscape(dest))
	case "ensure_symlink":
		if e.symlinkPointsAt(dest, src) {
			e.noOp = true
			return nil
		}
		return e.runMaybeSudo(t.Sudo, "ln -sfn "+shellEscape(src)+" "+shellEscape(dest))
	case "ensure_package":
		if e.packageInstalled(dest) {
			e.noOp = true
			return nil
		}
		return e.runSudo("DEBIAN_FRONTEND=noninteractive apt-get install -y " + shellEscape(dest))
	case "ensure_line":
		if e.linePresent(dest, body, t.Sudo) {
			e.noOp = true
			return nil
		}
		appendCmd := "printf '%s\\n' " + shellEscape(body) + " >> " + shellEscape(dest)
		if t.Sudo {
			return e.runSudo("sh -c " + shellEscape(appendCmd))
		}
		return e.run(appendCmd)
	case "ensure_service_running":
		if e.serviceActive(dest, t.User) {
			e.noOp = true
			return nil
		}
		sc, sudo := systemctlPrefix(t.User)
		return e.runMaybeSudo(sudo, sc+"start "+shellEscape(dest))
	case "ensure_service_enabled":
		if e.serviceEnabled(dest, t.User) {
			e.noOp = true
			return nil
		}
		sc, sudo := systemctlPrefix(t.User)
		return e.runMaybeSudo(sudo, sc+"enable "+shellEscape(dest))

	// Declarative health assertions (Goss-style; fail closed)
	case "assert_service_active":
		if !e.serviceActive(dest, t.User) {
			return fmt.Errorf("assertion failed: service %s is not active", dest)
		}
		return nil
	case "assert_service_enabled":
		if !e.serviceEnabled(dest, t.User) {
			return fmt.Errorf("assertion failed: service %s is not enabled", dest)
		}
		return nil
	case "assert_process":
		if _, err := e.runCapture("pgrep -f -- " + shellEscape(dest) + " >/dev/null"); err != nil {
			return fmt.Errorf("assertion failed: no process matching %q", dest)
		}
		return nil
	case "assert_port_listening":
		if _, err := e.runCapture("ss -ltnH 2>/dev/null | grep -q " + shellEscape(":"+dest+"$\\|:"+dest+" ")); err != nil {
			return fmt.Errorf("assertion failed: nothing listening on port %s", dest)
		}
		return nil
	case "assert_file_exists":
		if !e.pathExists(dest) {
			return fmt.Errorf("assertion failed: %s does not exist", dest)
		}
		return nil
	case "assert_file_contains":
		if _, err := e.runCaptureMaybeSudo(t.Sudo, "grep -qF -- "+shellEscape(body)+" "+shellEscape(dest)); err != nil {
			return fmt.Errorf("assertion failed: %s does not contain %q", dest, body)
		}
		return nil
	case "assert_package":
		if !e.packageInstalled(dest) {
			return fmt.Errorf("assertion failed: package %s is not installed", dest)
		}
		return nil
	case "assert_http_status":
		got, _ := e.runCapture("curl -s -o /dev/null -w '%{http_code}' " + shellEscape(dest))
		if got != body {
			return fmt.Errorf("assertion failed: %s returned HTTP %s, want %s", dest, got, body)
		}
		return nil
	case "assert_command":
		if _, err := e.runCapture(body); err != nil {
			return fmt.Errorf("assertion failed: command did not succeed: %s", body)
		}
		return nil

	// Secrets & supply-chain verification
	case "secret":
		plain, err := decryptSops(src)
		if err != nil {
			return err
		}
		return e.sftpWriteSecret(dest, plain, perm, own, t.Sudo)
	case "secret_command":
		plain, err := fetchSecretCommand(body)
		if err != nil {
			return err
		}
		return e.sftpWriteSecret(dest, plain, perm, own, t.Sudo)
	case "verify_blob":
		return cosignVerify("verify-blob", body, src)
	case "verify_image":
		return cosignVerify("verify", body, src)

	// Command execution
	case "run":
		if t.Sudo {
			return e.runSudo(body)
		}
		return e.run(body)
	case "pause":
		if d, err := time.ParseDuration(body); err == nil {
			time.Sleep(d)
		}
		return nil

	// Archives
	case "tar_create":
		return e.runSudo("tar -cvf " + dest + " -C $(dirname " + src + ") $(basename " + src + ")")
	case "tar_extract":
		return e.runSudo("tar -xvf " + src + " -C " + dest)
	case "targz_create":
		return e.runSudo("tar -czvf " + dest + " -C $(dirname " + src + ") $(basename " + src + ")")
	case "targz_extract":
		return e.runSudo("tar -xzvf " + src + " -C " + dest)
	case "zip_create":
		return e.runSudo("zip -r " + dest + " " + src)
	case "zip_extract":
		return e.runSudo("unzip -o " + src + " -d " + dest)

	// Package management
	case "apt_update":
		return e.runSudo("apt-get update")
	case "apt_install":
		return e.runSudo("apt-get install -y " + body)
	case "apt_remove":
		return e.runSudo("apt-get remove -y " + body)
	case "apt_upgrade":
		return e.runSudo("apt-get upgrade -y")

	// User management
	case "user_add":
		return e.runSudo(e.buildUserCmd("useradd", dest, body))
	case "user_del":
		return e.runSudo("userdel -r " + dest)
	case "user_mod":
		return e.runSudo(e.buildUserCmd("usermod", dest, body))

	// Process management
	case "kill":
		return e.runSudo("kill " + dest)
	case "killall":
		return e.runSudo("killall " + dest)
	case "pkill":
		return e.runSudo("pkill " + dest)

	// Network
	case "curl":
		return e.run("curl -fsSL -o " + dest + " " + src)
	case "wget":
		return e.run("wget -q -O " + dest + " " + src)
	case "ping":
		return e.run("ping -c 1 " + dest)

	// Git
	case "git_clone":
		cmd := "git clone"
		if strings.Contains(body, "shallow:true") {
			cmd += " --depth 1"
		} else if depth := e.parseOpt(body, "depth"); depth != "" {
			cmd += " --depth " + depth
		}
		cmd += " " + src + " " + dest
		return e.run(cmd)
	case "git_pull":
		return e.run("cd " + dest + " && git pull --ff-only")
	case "git_checkout":
		return e.run("cd " + dest + " && git checkout " + body)
	case "git_lfs_pull":
		return e.run("cd " + dest + " && git lfs pull")
	case "git_fetch":
		cmd := "cd " + dest + " && git fetch origin"
		if strings.Contains(body, "prune:true") {
			cmd += " --prune"
		}
		return e.run(cmd)
	case "git_reset":
		cmd := "cd " + dest + " && git reset"
		if strings.Contains(body, "hard:true") || body == "HEAD" || body == "" {
			cmd += " --hard"
		}
		if body != "" && !strings.Contains(body, ":") {
			cmd += " " + body
		}
		return e.run(cmd)
	case "git_clean":
		cmd := "cd " + dest + " && git clean -f -d"
		if strings.Contains(body, "force:true") {
			cmd += " -x"
		}
		return e.run(cmd)
	case "git_describe":
		out, err := e.runCapture("cd " + dest + " && git describe --tags --always 2>/dev/null || git rev-parse --short HEAD")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil

	// Cron
	case "cron_add":
		return e.run("(crontab -l 2>/dev/null; echo '" + body + "') | crontab -")
	case "cron_remove":
		return e.run("crontab -l | grep -v '" + body + "' | crontab -")

	// Firewall
	case "ufw_allow":
		return e.runSudo("ufw allow " + dest)
	case "ufw_deny":
		return e.runSudo("ufw deny " + dest)
	case "ufw_enable":
		return e.runSudo("ufw --force enable")
	case "ufw_disable":
		return e.runSudo("ufw disable")

	// System
	case "reboot":
		return e.runSudo("reboot")
	case "shutdown":
		return e.runSudo("shutdown -h now")
	case "hostname":
		return e.runSudo("hostnamectl set-hostname " + dest)
	case "sysctl":
		return e.runSudo("sysctl -w " + src + "=" + dest)

	// Systemd
	case "service":
		return e.serviceCtl(dest, t.State, t.User)
	case "service_list":
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
	case "timer_list":
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
	case "daemon_reload":
		if t.User {
			return e.run("systemctl --user daemon-reload")
		}
		return e.runSudo("systemctl daemon-reload")
	case "template":
		return e.installTemplate(dest, body, t.User)
	case "journal":
		return e.journalCtl(dest, body, t.User, t.Sudo, t.Register, vars)

	// Docker images
	case "docker_pull":
		return e.runSudo("docker pull " + dest)
	case "docker_build":
		return e.runSudo("docker build -t " + dest + " " + src)
	case "docker_save":
		return e.runSudo("docker save -o " + dest + " " + src)
	case "docker_load":
		return e.runSudo("docker load -i " + src)
	case "docker_export":
		return e.runSudo("docker export -o " + dest + " " + src)
	case "docker_import":
		return e.runSudo("docker import " + src + " " + dest)
	case "docker_tag":
		return e.runSudo("docker tag " + src + " " + dest)
	case "docker_push":
		return e.runSudo("docker push " + dest)
	case "docker_rmi":
		return e.runSudo("docker rmi " + dest)
	case "docker_prune":
		return e.runSudo("docker system prune -af")

	// Docker list/info
	case "docker_ps":
		all := ""
		if strings.Contains(body, "all:true") {
			all = "-a "
		}
		out, err := e.runCapture("sudo docker ps " + all + "--format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}|{{.State}}'")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "docker_images":
		out, err := e.runCapture("sudo docker images --format '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}'")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "docker_volumes":
		out, err := e.runCapture("sudo docker volume ls --format '{{.Name}}|{{.Driver}}|{{.Mountpoint}}'")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "docker_networks":
		out, err := e.runCapture("sudo docker network ls --format '{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}'")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "docker_info":
		out, err := e.runCapture("sudo docker info --format '{{.Containers}}|{{.ContainersRunning}}|{{.Images}}'")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil

	// Docker containers
	case "docker":
		return e.dockerCtl(dest, t.State, t.Src, body)

	// Docker Compose
	case "compose":
		return e.composeCtl(dest, t.State, t.Src, body)

	// Wait/Health checks
	case "wait_port":
		return e.waitForPort(dest, body, t.Timeout)
	case "wait_http":
		return e.waitForHttp(dest, t.State, t.Timeout)
	case "wait_file":
		return e.waitForFile(dest, t.Timeout)

	// Checks (set variable based on result)
	case "file_exists":
		exists := e.checkFileExists(dest)
		if t.Register != "" {
			if exists {
				vars.Set(t.Register, "true")
			} else {
				vars.Set(t.Register, "false")
			}
		}
		return nil
	case "dir_exists":
		exists := e.checkDirExists(dest)
		if t.Register != "" {
			if exists {
				vars.Set(t.Register, "true")
			} else {
				vars.Set(t.Register, "false")
			}
		}
		return nil
	case "service_running":
		running := e.checkServiceRunning(dest, t.User)
		if t.Register != "" {
			if running {
				vars.Set(t.Register, "true")
			} else {
				vars.Set(t.Register, "false")
			}
		}
		return nil

	// Capture output to variable
	case "capture":
		out, err := e.runCapture(body)
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "capture_sudo":
		out, err := e.runSudoCapture(body)
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil

	// Backup/Restore
	case "backup":
		return e.runSudo("cp -a " + dest + " " + dest + ".bak.$(date +%Y%m%d%H%M%S)")
	case "restore":
		return e.runSudo("cp -a $(ls -t " + dest + ".bak.* 2>/dev/null | head -1) " + dest)

	// Environment file
	case "env_set":
		return e.run("grep -q '^" + src + "=' " + dest + " && sed -i 's|^" + src + "=.*|" + src + "=" + body + "|' " + dest + " || echo '" + src + "=" + body + "' >> " + dest)
	case "env_delete":
		return e.run("sed -i '/^" + src + "=/d' " + dest)

	// Rsync
	case "rsync":
		return e.rsyncExec(src, dest, body, t.Sudo)
	case "rsync_install":
		return e.rsyncInstall()
	case "rsync_check":
		installed := e.rsyncCheck()
		if t.Register != "" {
			if installed {
				vars.Set(t.Register, "true")
			} else {
				vars.Set(t.Register, "false")
			}
		}
		return nil
	case "rsync_version":
		out, err := e.runCapture("rsync --version | head -1")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil

	// Nginx
	case "nginx_test":
		return e.runSudo("nginx -t")
	case "nginx_reload":
		return e.runSudo("systemctl reload nginx")

	// Wibu License (CMU)
	case "wibu_generate":
		out, err := e.runCapture("cmu -c" + src + " -f " + dest)
		if err != nil {
			return fmt.Errorf("wibu generate failed: %s - %w", out, err)
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "wibu_apply":
		out, err := e.runCapture("cmu -i -f " + src)
		if err != nil {
			return fmt.Errorf("wibu apply failed: %s - %w", out, err)
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "wibu_info":
		out, err := e.runCapture("cmu -l")
		if err != nil {
			return fmt.Errorf("wibu info failed: %w", err)
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "wibu_list":
		out, err := e.runCapture("cmu -x")
		if err != nil {
			return fmt.Errorf("wibu list failed: %w", err)
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil

	// SFTP Operations
	case "download":
		data, err := e.sftpRead(src)
		if err != nil {
			return fmt.Errorf("download failed: %w", err)
		}
		if t.Register != "" {
			vars.SetBytes(t.Register, data)
		}
		return nil
	case "upload_bytes":
		data := vars.GetBytes(src)
		if data == nil {
			return fmt.Errorf("no data in variable: %s", src)
		}
		return e.sftpWrite(dest, data)
	case "read_file":
		data, err := e.sftpRead(src)
		if err != nil {
			return fmt.Errorf("read file failed: %w", err)
		}
		if t.Register != "" {
			vars.Set(t.Register, string(data))
		}
		return nil
	case "write_bytes":
		data := vars.GetBytes(body)
		if data == nil {
			data = []byte(body)
		}
		return e.sftpWrite(dest, data)

	// Go build operations
	case "go":
		return e.goCtl(dest, t.State, t.Src, body)

	// npm operations
	case "npm":
		return e.npmCtl(dest, t.State, body)

	// System info operations
	case "disk_space":
		out, err := e.runCapture("df -BG " + dest + " | awk 'NR==2 {print $4}' | tr -d 'G'")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "memory_info":
		out, err := e.runCapture("awk '/MemAvailable/ {print int($2/1024/1024)}' /proc/meminfo")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "cpu_info":
		out, err := e.runCapture("nproc")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "load_avg":
		out, err := e.runCapture("cat /proc/loadavg | cut -d' ' -f1-3")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "nproc":
		out, err := e.runCapture("nproc")
		if err != nil {
			return err
		}
		if t.Register != "" {
			vars.Set(t.Register, out)
		}
		return nil
	case "command_exists":
		_, err := e.runCapture("command -v " + dest)
		if t.Register != "" {
			if err == nil {
				vars.Set(t.Register, "true")
			} else {
				vars.Set(t.Register, "false")
			}
		}
		return nil
	case "require_disk":
		out, err := e.runCapture("df -BG " + dest + " | awk 'NR==2 {print $4}' | tr -d 'G'")
		if err != nil {
			return err
		}
		// Parse and compare
		var avail int
		fmt.Sscanf(out, "%d", &avail)
		var required int
		fmt.Sscanf(body, "%d", &required)
		if avail < required {
			return fmt.Errorf("insufficient disk space: %dGB available, %dGB required", avail, required)
		}
		return nil
	case "require_memory":
		out, err := e.runCapture("awk '/MemAvailable/ {print int($2/1024/1024)}' /proc/meminfo")
		if err != nil {
			return err
		}
		var avail int
		fmt.Sscanf(out, "%d", &avail)
		var required int
		fmt.Sscanf(body, "%d", &required)
		if avail < required {
			return fmt.Errorf("insufficient memory: %dGB available, %dGB required", avail, required)
		}
		return nil
	case "require_command":
		_, err := e.runCapture("command -v " + dest)
		if err != nil {
			return fmt.Errorf("required command not found: %s", dest)
		}
		return nil

	default:
		return fmt.Errorf("unknown action: %s", t.Action)
	}
}

// =============================================================================
// SYSTEMD HELPERS
// =============================================================================

func (e *Executor) serviceCtl(name, state string, user bool) error {
	svc := name + ".service"
	if user {
		// For status, we need to allow non-zero exit (inactive services return 3)
		if state == "status" {
			return e.run("systemctl --user " + state + " " + svc + " 2>&1 || true")
		}
		return e.run("systemctl --user " + state + " " + svc)
	}
	if state == "stop" {
		return e.runSudo("service " + name + " stop")
	}
	// For status, we need to allow non-zero exit (inactive services return 3)
	if state == "status" {
		return e.runSudo("systemctl " + state + " " + svc + " 2>&1 || true")
	}
	return e.runSudo("systemctl " + state + " " + svc)
}

func (e *Executor) installTemplate(name, content string, user bool) error {
	filename := name + ".service"
	if err := e.run("cat > " + filename + " <<'EOF'\n" + content + "\nEOF"); err != nil {
		return err
	}
	target := "/etc/systemd/system/" + filename
	if user {
		target = "/etc/systemd/user/" + filename
	}
	return e.runSudo("cp " + filename + " " + target)
}

func (e *Executor) journalCtl(unit, flags string, user, sudo bool, register string, vars *Vars) error {
	cmd := "journalctl"

	if user {
		cmd += " --user"
	}

	if unit != "" {
		cmd += " -u " + unit
	}

	if flags != "" {
		cmd += " " + flags
	}

	// Always add --no-pager if not already present to avoid interactive pager
	if !strings.Contains(flags, "--no-pager") && !strings.Contains(flags, "-f") {
		cmd += " --no-pager"
	}

	var out string
	var err error

	if sudo {
		out, err = e.runSudoCapture(cmd)
	} else {
		out, err = e.runCapture(cmd)
	}

	if err != nil {
		return err
	}

	if register != "" {
		vars.Set(register, out)
	}

	return nil
}

// =============================================================================
// USER HELPERS
// =============================================================================

func (e *Executor) buildUserCmd(base, user, opts string) string {
	cmd := base
	for _, opt := range strings.Split(opts, ";") {
		if opt == "" {
			continue
		}
		parts := strings.SplitN(opt, ":", 2)
		if len(parts) != 2 {
			continue
		}
		switch parts[0] {
		case "groups":
			if base == "usermod" {
				cmd += " -aG " + parts[1]
			} else {
				cmd += " -G " + parts[1]
			}
		case "shell":
			cmd += " -s " + parts[1]
		case "home":
			cmd += " -m -d " + parts[1]
		}
	}
	return cmd + " " + user
}

// =============================================================================
// DOCKER HELPERS
// =============================================================================

func (e *Executor) dockerCtl(container, state, image, opts string) error {
	switch state {
	case "run":
		return e.runSudo(e.buildDockerRun(container, image, opts))
	case "start":
		return e.runSudo("docker start " + container)
	case "stop":
		return e.runSudo("docker stop " + container)
	case "restart":
		return e.runSudo("docker restart " + container)
	case "rm":
		return e.runSudo("docker rm -f " + container)
	case "logs":
		return e.runSudo("docker logs " + container)
	case "exec":
		return e.runSudo("docker exec " + container + " " + opts)
	default:
		return fmt.Errorf("unknown docker state: %s", state)
	}
}

func (e *Executor) buildDockerRun(container, image, opts string) string {
	cmd := "docker run -d"
	if container != "" {
		cmd += " --name " + container
	}
	for _, opt := range strings.Split(opts, ";") {
		if opt == "" {
			continue
		}
		parts := strings.SplitN(opt, ":", 2)
		if len(parts) != 2 {
			continue
		}
		switch parts[0] {
		case "ports":
			for _, p := range strings.Split(parts[1], ",") {
				if p != "" {
					cmd += " -p " + p
				}
			}
		case "volumes":
			for _, v := range strings.Split(parts[1], ",") {
				if v != "" {
					cmd += " -v " + v
				}
			}
		case "env":
			for _, ev := range strings.Split(parts[1], ",") {
				if ev != "" {
					cmd += " -e " + ev
				}
			}
		case "network":
			cmd += " --network " + parts[1]
		}
	}
	return cmd + " " + image
}

// =============================================================================
// DOCKER COMPOSE HELPERS
// =============================================================================

func (e *Executor) composeCtl(file, state, service, opts string) error {
	base := "docker compose -f " + file
	svc := e.parseOpt(opts, "service")

	switch state {
	case "up":
		cmd := base + " up -d"
		if e.parseOpt(opts, "build") == "true" {
			cmd += " --build"
		}
		if svc != "" {
			cmd += " " + svc
		}
		return e.runSudo(cmd)

	case "down":
		cmd := base + " down"
		if e.parseOpt(opts, "orphans") == "true" {
			cmd += " --remove-orphans"
		}
		if e.parseOpt(opts, "volumes") == "true" {
			cmd += " -v"
		}
		return e.runSudo(cmd)

	case "pull", "build", "start", "stop", "restart", "logs", "kill", "rm", "top", "pause", "unpause":
		cmd := base + " " + state
		if svc != "" {
			cmd += " " + svc
		}
		return e.runSudo(cmd)

	case "ps":
		return e.runSudo(base + " ps")
	case "exec":
		return e.runSudo(base + " exec " + service + " " + opts)
	case "run":
		return e.runSudo(base + " run --rm " + service + " " + opts)
	case "cp":
		return e.runSudo(base + " cp " + service + " " + opts)

	default:
		return fmt.Errorf("unknown compose state: %s", state)
	}
}

// =============================================================================
// WAIT/CHECK HELPERS
// =============================================================================

func (e *Executor) waitForPort(host, port string, timeout time.Duration) error {
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if err := e.run("nc -z " + host + " " + port); err == nil {
			return nil
		}
		time.Sleep(time.Second)
	}
	return fmt.Errorf("timeout waiting for %s:%s", host, port)
}

func (e *Executor) waitForHttp(url, expectedCode string, timeout time.Duration) error {
	if timeout == 0 {
		timeout = 60 * time.Second
	}
	if expectedCode == "" {
		expectedCode = "200"
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		out, err := e.runCapture("curl -s -o /dev/null -w '%{http_code}' " + url)
		if err == nil && out == expectedCode {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("timeout waiting for %s to return %s", url, expectedCode)
}

func (e *Executor) waitForFile(path string, timeout time.Duration) error {
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if err := e.run("test -f " + path); err == nil {
			return nil
		}
		time.Sleep(time.Second)
	}
	return fmt.Errorf("timeout waiting for file %s", path)
}

func (e *Executor) checkFileExists(path string) bool {
	return e.run("test -f "+path) == nil
}

func (e *Executor) checkDirExists(path string) bool {
	return e.run("test -d "+path) == nil
}

func (e *Executor) checkServiceRunning(name string, user bool) bool {
	var cmd string
	if user {
		cmd = "systemctl --user is-active " + name + ".service"
	} else {
		cmd = "systemctl is-active " + name + ".service"
	}
	out, err := e.runCapture(cmd)
	return err == nil && out == "active"
}

// =============================================================================
// SFTP HELPERS
// =============================================================================

func (e *Executor) sftpRead(path string) ([]byte, error) {
	ftp, err := e.client.NewSftp()
	if err != nil {
		return nil, fmt.Errorf("sftp session failed: %w", err)
	}
	defer ftp.Close()

	file, err := ftp.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open remote file failed: %w", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read remote file failed: %w", err)
	}
	return data, nil
}

func (e *Executor) sftpWrite(path string, data []byte) error {
	ftp, err := e.client.NewSftp()
	if err != nil {
		return fmt.Errorf("sftp session failed: %w", err)
	}
	defer ftp.Close()

	file, err := ftp.Create(path)
	if err != nil {
		return fmt.Errorf("create remote file failed: %w", err)
	}
	defer file.Close()

	_, err = file.Write(data)
	if err != nil {
		return fmt.Errorf("write remote file failed: %w", err)
	}
	return nil
}

// sftpWriteSecret writes secret data to dest over SFTP, applying the mode
// BEFORE writing the bytes so the plaintext is never briefly world-readable,
// then optionally chowns. perm defaults to 0600. The plaintext is never placed
// in a shell command or logged.
func (e *Executor) sftpWriteSecret(dest string, data []byte, perm, owner string, sudo bool) error {
	ftp, err := e.client.NewSftp()
	if err != nil {
		return fmt.Errorf("sftp session failed: %w", err)
	}
	defer ftp.Close()

	mode := parseFileMode(perm, 0o600)

	file, err := ftp.Create(dest)
	if err != nil {
		return fmt.Errorf("create remote secret failed: %w", err)
	}
	// Tighten permissions before any bytes land.
	if err := ftp.Chmod(dest, mode); err != nil {
		file.Close()
		return fmt.Errorf("chmod remote secret failed: %w", err)
	}
	if _, err := file.Write(data); err != nil {
		file.Close()
		return fmt.Errorf("write remote secret failed: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close remote secret failed: %w", err)
	}
	if owner != "" {
		return e.runMaybeSudo(sudo, "chown "+owner+" "+shellEscape(dest))
	}
	return nil
}

// =============================================================================
// GO BUILD HELPERS
// =============================================================================

func (e *Executor) goCtl(path, state, output, opts string) error {
	// Parse options
	goos := ""
	goarch := ""
	ldflags := ""
	tags := ""
	race := false
	verbose := false
	parallel := ""
	failfast := false

	for _, opt := range strings.Split(opts, ";") {
		if opt == "" {
			continue
		}
		parts := strings.SplitN(opt, ":", 2)
		key := parts[0]
		val := ""
		if len(parts) == 2 {
			val = parts[1]
		}
		switch key {
		case "goos":
			goos = val
		case "goarch":
			goarch = val
		case "ldflags":
			ldflags = val
		case "tags":
			tags = val
		case "race":
			race = val == "true" || val == ""
		case "verbose":
			verbose = val == "true" || val == ""
		case "parallel":
			parallel = val
		case "failfast":
			failfast = val == "true" || val == ""
		}
	}

	// Build environment prefix
	envPrefix := ""
	if goos != "" {
		envPrefix += "GOOS=" + goos + " "
	}
	if goarch != "" {
		envPrefix += "GOARCH=" + goarch + " "
	}

	// Build command based on state
	var cmd string
	switch state {
	case "build":
		cmd = envPrefix + "go build"
		if ldflags != "" {
			cmd += " -ldflags=\"" + ldflags + "\""
		}
		if tags != "" {
			cmd += " -tags=" + tags
		}
		if race {
			cmd += " -race"
		}
		if output != "" {
			cmd += " -o " + output
		}
		cmd += " ."
	case "test":
		cmd = "go test"
		if verbose {
			cmd += " -v"
		}
		if race {
			cmd += " -race"
		}
		if failfast {
			cmd += " -failfast"
		}
		if parallel != "" {
			cmd += " -parallel " + parallel
		}
		if tags != "" {
			cmd += " -tags=" + tags
		}
		cmd += " ./..."
	case "mod_download":
		cmd = "go mod download"
	case "vet":
		cmd = "go vet ./..."
	default:
		return fmt.Errorf("unknown go state: %s", state)
	}

	return e.run("cd " + path + " && " + cmd)
}

// =============================================================================
// NPM HELPERS
// =============================================================================

func (e *Executor) npmCtl(path, state, opts string) error {
	// Parse options
	silent := false
	production := false
	legacyPeerDeps := false
	script := ""

	for _, opt := range strings.Split(opts, ";") {
		if opt == "" {
			continue
		}
		parts := strings.SplitN(opt, ":", 2)
		key := parts[0]
		val := ""
		if len(parts) == 2 {
			val = parts[1]
		}
		switch key {
		case "silent":
			silent = val == "true" || val == ""
		case "production":
			production = val == "true" || val == ""
		case "legacy-peer-deps":
			legacyPeerDeps = val == "true" || val == ""
		case "script":
			script = val
		}
	}

	// Build command based on state
	var cmd string
	switch state {
	case "install":
		cmd = "npm install"
		if production {
			cmd += " --production"
		}
		if legacyPeerDeps {
			cmd += " --legacy-peer-deps"
		}
	case "ci":
		cmd = "npm ci"
		if production {
			cmd += " --production"
		}
	case "build":
		cmd = "npm run build"
	case "test":
		cmd = "npm test"
	case "run":
		if script == "" {
			return fmt.Errorf("npm run requires a script name")
		}
		cmd = "npm run " + script
	default:
		return fmt.Errorf("unknown npm state: %s", state)
	}

	if silent {
		cmd += " --silent"
	}

	return e.run("cd " + path + " && " + cmd)
}

// =============================================================================
// RSYNC HELPERS
// =============================================================================

// rsyncCheck checks if rsync is installed
func (e *Executor) rsyncCheck() bool {
	return e.run("which rsync") == nil
}

// rsyncInstall installs rsync using the appropriate package manager
func (e *Executor) rsyncInstall() error {
	// Try to detect package manager and install rsync
	// Check for apt (Debian/Ubuntu)
	if e.run("which apt-get") == nil {
		if err := e.runSudo("apt-get update"); err != nil {
			return fmt.Errorf("apt update failed: %w", err)
		}
		return e.runSudo("apt-get install -y rsync")
	}
	// Check for yum (RHEL/CentOS)
	if e.run("which yum") == nil {
		return e.runSudo("yum install -y rsync")
	}
	// Check for dnf (Fedora)
	if e.run("which dnf") == nil {
		return e.runSudo("dnf install -y rsync")
	}
	// Check for pacman (Arch)
	if e.run("which pacman") == nil {
		return e.runSudo("pacman -S --noconfirm rsync")
	}
	// Check for apk (Alpine)
	if e.run("which apk") == nil {
		return e.runSudo("apk add rsync")
	}
	// Check for zypper (openSUSE)
	if e.run("which zypper") == nil {
		return e.runSudo("zypper install -y rsync")
	}
	return fmt.Errorf("no supported package manager found")
}

// rsyncExec executes rsync with the given options
func (e *Executor) rsyncExec(src, dest, opts string, sudo bool) error {
	flags := "-avz"
	exclude := ""
	include := ""
	delete := false
	compress := true
	progress := false
	dryRun := false
	bwLimit := ""
	checksum := false
	partial := false
	inplace := false
	delta := false
	local := false // Run rsync locally (local-to-remote sync)
	sshPort := ""  // Custom SSH port for local mode
	sshKey := ""   // SSH key path for local mode

	// Parse options from body (semicolon-separated key:value pairs)
	for _, opt := range strings.Split(opts, ";") {
		if opt == "" {
			continue
		}
		parts := strings.SplitN(opt, ":", 2)
		key := parts[0]
		val := ""
		if len(parts) == 2 {
			val = parts[1]
		}
		switch key {
		case "flags":
			flags = val
		case "exclude":
			exclude = val
		case "include":
			include = val
		case "delete":
			delete = val == "true" || val == ""
		case "compress":
			compress = val == "true" || val == ""
		case "progress":
			progress = val == "true" || val == ""
		case "dry-run":
			dryRun = val == "true" || val == ""
		case "bwlimit":
			bwLimit = val
		case "checksum":
			checksum = val == "true" || val == ""
		case "partial":
			partial = val == "true" || val == ""
		case "inplace":
			inplace = val == "true" || val == ""
		case "delta":
			delta = val == "true" || val == ""
		case "local":
			local = val == "true" || val == ""
		case "ssh-port":
			sshPort = val
		case "ssh-key":
			sshKey = val
		}
	}

	// Build command
	cmd := "rsync " + flags
	if !compress {
		cmd = strings.Replace(cmd, "z", "", 1)
	}
	if delete {
		cmd += " --delete"
	}
	if progress {
		cmd += " --progress"
	}
	if dryRun {
		cmd += " --dry-run"
	}
	if checksum {
		cmd += " --checksum"
	}
	if partial {
		cmd += " --partial"
	}
	if inplace {
		cmd += " --inplace"
	}
	if delta {
		cmd += " --no-whole-file"
	}
	if bwLimit != "" {
		cmd += " --bwlimit=" + bwLimit
	}
	if exclude != "" {
		for _, ex := range strings.Split(exclude, ",") {
			if ex != "" {
				cmd += " --exclude='" + ex + "'"
			}
		}
	}
	if include != "" {
		for _, inc := range strings.Split(include, ",") {
			if inc != "" {
				cmd += " --include='" + inc + "'"
			}
		}
	}

	// Local-to-remote mode: run rsync on local machine with SSH destination
	if local {
		// Build SSH command with sshpass for password authentication
		sshCmd := "ssh"
		if sshPort != "" {
			sshCmd += " -p " + sshPort
		}
		if sshKey != "" {
			sshCmd += " -i " + sshKey
		}
		sshCmd += " -o StrictHostKeyChecking=" + sshStrictOption()
		if kh := knownHostsFile(); kh != "" {
			sshCmd += " -o UserKnownHostsFile=" + shellEscape(kh)
		}

		// Use sshpass if password is available and no SSH key specified.
		// Pass the password via the SSHPASS env var (sshpass -e) rather than
		// -p, so it never appears in the local process argv, and shell-quote
		// it. Prefer key/cert auth — password+sshpass remains a fallback.
		if e.password != "" && sshKey == "" {
			cmd = "SSHPASS=" + shellEscape(e.password) + " sshpass -e " + cmd + " -e \"" + sshCmd + "\""
		} else {
			cmd += " -e \"" + sshCmd + "\""
		}

		// Format: rsync [opts] local_src user@host:remote_dest
		cmd += " " + src + " " + e.getSSHDestination() + ":" + dest
		return e.runLocal(cmd)
	}

	// Remote mode: run rsync on remote machine
	cmd += " " + src + " " + dest

	if sudo {
		return e.runSudo(cmd)
	}
	return e.run(cmd)
}
