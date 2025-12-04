package porter

import (
	"fmt"
	"io"
	"log"
	"os/exec"
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

// Run executes a list of tasks.
func (e *Executor) Run(name string, tasks []Task, vars *Vars) (*Stats, error) {
	stats := &Stats{Total: len(tasks)}

	if e.verbose {
		log.Printf("\n\033[1;36mPLAY [%s]\033[0m\n", name)
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
		stats.OK++
		progress.Status = StatusOK
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
	delay := task.Delay
	if delay == 0 {
		delay = 2 * time.Second
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

		err = e.exec(task, vars)
		if err == nil {
			break
		}
		progress.Error = err
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
	stats.Changed++
	progress.Status = StatusChanged
	e.emitProgress(progress)
	return nil
}

// =============================================================================
// COMMAND HELPERS
// =============================================================================

func (e *Executor) sudo(cmd string) string {
	return "echo " + e.password + " | sudo -S " + cmd
}

func (e *Executor) run(cmd string) error {
	_, err := e.client.Run(cmd)
	return err
}

func (e *Executor) runSudo(cmd string) error {
	return e.run(e.sudo(cmd))
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

func (e *Executor) exec(t Task, vars *Vars) error {
	src := vars.Expand(t.Src)
	dest := vars.Expand(t.Dest)
	body := vars.Expand(t.Body)

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
		return e.run("cat > " + dest + " <<'EOF'\n" + body + "\nEOF")
	case "chown":
		owner := body
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
		mode := body
		if mode == "" {
			mode = "+x"
		}
		return e.runSudo("chmod " + mode + " " + dest)
	case "install":
		if err := e.runSudo("cp " + src + " " + dest); err != nil {
			return err
		}
		return e.runSudo("chmod +x " + dest)

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
		return e.run("git clone " + src + " " + dest)
	case "git_pull":
		return e.run("cd " + dest + " && git pull")
	case "git_checkout":
		return e.run("cd " + dest + " && git checkout " + body)

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
	case "daemon_reload":
		if t.User {
			return e.run("systemctl --user daemon-reload")
		}
		return e.runSudo("systemctl daemon-reload")
	case "template":
		return e.installTemplate(dest, body, t.User)

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
		return e.run("systemctl --user " + state + " " + svc)
	}
	if state == "stop" {
		return e.runSudo("service " + name + " stop")
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
		sshCmd += " -o StrictHostKeyChecking=no"

		// Use sshpass if password is available and no SSH key specified
		if e.password != "" && sshKey == "" {
			cmd = "sshpass -p '" + e.password + "' " + cmd + " -e \"" + sshCmd + "\""
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
