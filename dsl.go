package porter

import (
	"strings"
	"time"
)

// =============================================================================
// PORTER DSL - Fluent API for Remote Server Management
// =============================================================================

// TaskBuilder provides fluent API for building tasks
type TaskBuilder struct{ t Task }

func (b TaskBuilder) Build() Task                      { return b.t }
func (b TaskBuilder) Name(n string) TaskBuilder        { b.t.Name = n; return b }
func (b TaskBuilder) When(w When) TaskBuilder          { b.t.When = w; return b }
func (b TaskBuilder) Loop(items ...string) TaskBuilder { b.t.Loop = items; return b }
func (b TaskBuilder) Ignore() TaskBuilder              { b.t.Ignore = true; return b }
func (b TaskBuilder) User() TaskBuilder                { b.t.User = true; return b }
func (b TaskBuilder) Sudo() TaskBuilder                { b.t.Sudo = true; return b }
func (b TaskBuilder) Recursive() TaskBuilder           { b.t.Rec = true; return b }
func (b TaskBuilder) Owner(o string) TaskBuilder       { b.t.Body = o; return b }
func (b TaskBuilder) Mode(m string) TaskBuilder        { b.t.Body = m; return b }

// appendOpt appends key:value to Body
func (b TaskBuilder) appendOpt(key, val string) TaskBuilder {
	if b.t.Body == "" {
		b.t.Body = key + ":" + val
	} else {
		b.t.Body += ";" + key + ":" + val
	}
	return b
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

func Upload(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "upload", Src: src, Dest: dest, Name: "Upload " + src}}
}

func Copy(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "copy", Src: src, Dest: dest, Name: "Copy " + src}}
}

func Move(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "move", Src: src, Dest: dest, Name: "Move " + src}}
}

func Write(dest, content string) TaskBuilder {
	return TaskBuilder{Task{Action: "write", Dest: dest, Body: content, Name: "Write " + dest}}
}

func Mkdir(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "mkdir", Dest: path, Name: "Mkdir " + path}}
}

func Chown(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "chown", Dest: path, Name: "Chown " + path}}
}

func Chmod(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "chmod", Dest: path, Name: "Chmod " + path}}
}

func Rm(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "rm", Dest: path, Name: "Remove " + path}}
}

func Touch(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "touch", Dest: path, Name: "Touch " + path}}
}

func Symlink(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "symlink", Src: src, Dest: dest, Name: "Link " + src}}
}

func Install(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "install", Src: src, Dest: dest, Name: "Install " + dest}}
}

func Sed(pattern, file string) TaskBuilder {
	return TaskBuilder{Task{Action: "sed", Body: pattern, Dest: file, Name: "Sed " + file}}
}

func Cat(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "cat", Dest: path, Name: "Cat " + path}}
}

// =============================================================================
// ARCHIVE OPERATIONS
// =============================================================================

func Tar(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "tar_create", Src: src, Dest: dest, Name: "Tar " + src}}
}

func Untar(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "tar_extract", Src: src, Dest: dest, Name: "Untar " + src}}
}

func TarGz(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "targz_create", Src: src, Dest: dest, Name: "TarGz " + src}}
}

func UntarGz(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "targz_extract", Src: src, Dest: dest, Name: "UntarGz " + src}}
}

func Zip(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "zip_create", Src: src, Dest: dest, Name: "Zip " + src}}
}

func Unzip(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "zip_extract", Src: src, Dest: dest, Name: "Unzip " + src}}
}

// =============================================================================
// COMMAND EXECUTION
// =============================================================================

func Run(cmd string) TaskBuilder {
	return TaskBuilder{Task{Action: "run", Body: cmd, Name: "Run: " + cmd}}
}

func Pause(duration string) TaskBuilder {
	return TaskBuilder{Task{Action: "pause", Body: duration, Name: "Wait " + duration}}
}

// =============================================================================
// PACKAGE MANAGEMENT
// =============================================================================

func AptUpdate() TaskBuilder {
	return TaskBuilder{Task{Action: "apt_update", Name: "Apt update"}}
}

func AptInstall(packages ...string) TaskBuilder {
	pkgs := strings.Join(packages, " ")
	return TaskBuilder{Task{Action: "apt_install", Body: pkgs, Name: "Apt install"}}
}

func AptRemove(packages ...string) TaskBuilder {
	pkgs := strings.Join(packages, " ")
	return TaskBuilder{Task{Action: "apt_remove", Body: pkgs, Name: "Apt remove"}}
}

func AptUpgrade() TaskBuilder {
	return TaskBuilder{Task{Action: "apt_upgrade", Name: "Apt upgrade"}}
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

func UserAdd(username string) TaskBuilder {
	return TaskBuilder{Task{Action: "user_add", Dest: username, Name: "Add user " + username}}
}

func UserDel(username string) TaskBuilder {
	return TaskBuilder{Task{Action: "user_del", Dest: username, Name: "Delete user " + username}}
}

func UserMod(username string) TaskBuilder {
	return TaskBuilder{Task{Action: "user_mod", Dest: username, Name: "Modify user " + username}}
}

func (b TaskBuilder) Groups(g string) TaskBuilder { return b.appendOpt("groups", g) }
func (b TaskBuilder) Shell(s string) TaskBuilder  { return b.appendOpt("shell", s) }
func (b TaskBuilder) Home(h string) TaskBuilder   { return b.appendOpt("home", h) }

// =============================================================================
// PROCESS MANAGEMENT
// =============================================================================

func Kill(pid string) TaskBuilder {
	return TaskBuilder{Task{Action: "kill", Dest: pid, Name: "Kill " + pid}}
}

func Killall(name string) TaskBuilder {
	return TaskBuilder{Task{Action: "killall", Dest: name, Name: "Killall " + name}}
}

func Pkill(pattern string) TaskBuilder {
	return TaskBuilder{Task{Action: "pkill", Dest: pattern, Name: "Pkill " + pattern}}
}

// =============================================================================
// NETWORK
// =============================================================================

func Curl(url, output string) TaskBuilder {
	return TaskBuilder{Task{Action: "curl", Src: url, Dest: output, Name: "Curl " + url}}
}

func Wget(url, output string) TaskBuilder {
	return TaskBuilder{Task{Action: "wget", Src: url, Dest: output, Name: "Wget " + url}}
}

func Ping(host string) TaskBuilder {
	return TaskBuilder{Task{Action: "ping", Dest: host, Name: "Ping " + host}}
}

// =============================================================================
// GIT
// =============================================================================

func GitClone(repo, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_clone", Src: repo, Dest: dest, Name: "Git clone"}}
}

func GitPull(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_pull", Dest: path, Name: "Git pull"}}
}

func GitCheckout(path, ref string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_checkout", Dest: path, Body: ref, Name: "Git checkout " + ref}}
}

// =============================================================================
// CRON
// =============================================================================

func CronAdd(schedule, command string) TaskBuilder {
	return TaskBuilder{Task{Action: "cron_add", Body: schedule + " " + command, Name: "Add cron"}}
}

func CronRemove(pattern string) TaskBuilder {
	return TaskBuilder{Task{Action: "cron_remove", Body: pattern, Name: "Remove cron"}}
}

// =============================================================================
// FIREWALL (UFW)
// =============================================================================

func UfwAllow(port string) TaskBuilder {
	return TaskBuilder{Task{Action: "ufw_allow", Dest: port, Name: "UFW allow " + port}}
}

func UfwDeny(port string) TaskBuilder {
	return TaskBuilder{Task{Action: "ufw_deny", Dest: port, Name: "UFW deny " + port}}
}

func UfwEnable() TaskBuilder {
	return TaskBuilder{Task{Action: "ufw_enable", Name: "UFW enable"}}
}

func UfwDisable() TaskBuilder {
	return TaskBuilder{Task{Action: "ufw_disable", Name: "UFW disable"}}
}

// =============================================================================
// SYSTEM
// =============================================================================

func Reboot() TaskBuilder {
	return TaskBuilder{Task{Action: "reboot", Name: "Reboot"}}
}

func Shutdown() TaskBuilder {
	return TaskBuilder{Task{Action: "shutdown", Name: "Shutdown"}}
}

func Hostname(name string) TaskBuilder {
	return TaskBuilder{Task{Action: "hostname", Dest: name, Name: "Set hostname"}}
}

func Sysctl(key, value string) TaskBuilder {
	return TaskBuilder{Task{Action: "sysctl", Src: key, Dest: value, Name: "Sysctl " + key}}
}

// =============================================================================
// SYSTEMD SERVICES
// =============================================================================

type SvcBuilder struct{ t Task }

func Svc(name string) SvcBuilder {
	return SvcBuilder{Task{Action: "service", Dest: name}}
}

func (s SvcBuilder) Start() TaskBuilder {
	s.t.State = "start"
	s.t.Name = "Start " + s.t.Dest
	return TaskBuilder{s.t}
}
func (s SvcBuilder) Stop() TaskBuilder {
	s.t.State = "stop"
	s.t.Name = "Stop " + s.t.Dest
	return TaskBuilder{s.t}
}
func (s SvcBuilder) Restart() TaskBuilder {
	s.t.State = "restart"
	s.t.Name = "Restart " + s.t.Dest
	return TaskBuilder{s.t}
}
func (s SvcBuilder) Enable() TaskBuilder {
	s.t.State = "enable"
	s.t.Name = "Enable " + s.t.Dest
	return TaskBuilder{s.t}
}

func DaemonReload() TaskBuilder {
	return TaskBuilder{Task{Action: "daemon_reload", Name: "Reload systemd"}}
}

func Template(name, content string) TaskBuilder {
	return TaskBuilder{Task{Action: "template", Dest: name, Body: content, Name: "Template " + name}}
}

// =============================================================================
// DOCKER IMAGES
// =============================================================================

func DockerPull(image string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_pull", Dest: image, Name: "Pull " + image}}
}

func DockerBuild(path, tag string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_build", Src: path, Dest: tag, Name: "Build " + tag}}
}

func DockerSave(image, tarFile string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_save", Src: image, Dest: tarFile, Name: "Save " + image}}
}

func DockerLoad(tarFile string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_load", Src: tarFile, Name: "Load " + tarFile}}
}

func DockerExport(container, tarFile string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_export", Src: container, Dest: tarFile, Name: "Export " + container}}
}

func DockerImport(tarFile, image string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_import", Src: tarFile, Dest: image, Name: "Import " + tarFile}}
}

func DockerTag(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_tag", Src: src, Dest: dest, Name: "Tag " + src}}
}

func DockerPush(image string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_push", Dest: image, Name: "Push " + image}}
}

func DockerRmi(image string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_rmi", Dest: image, Name: "Rmi " + image}}
}

func DockerPrune() TaskBuilder {
	return TaskBuilder{Task{Action: "docker_prune", Name: "Docker prune"}}
}

// =============================================================================
// DOCKER CONTAINERS
// =============================================================================

type DockerBuilder struct{ t Task }

func Docker(container string) DockerBuilder {
	return DockerBuilder{Task{Action: "docker", Dest: container}}
}

func (d DockerBuilder) Run(image string) TaskBuilder {
	d.t.State = "run"
	d.t.Src = image
	d.t.Name = "Run " + d.t.Dest
	return TaskBuilder{d.t}
}

func (d DockerBuilder) Start() TaskBuilder {
	d.t.State = "start"
	d.t.Name = "Start " + d.t.Dest
	return TaskBuilder{d.t}
}
func (d DockerBuilder) Stop() TaskBuilder {
	d.t.State = "stop"
	d.t.Name = "Stop " + d.t.Dest
	return TaskBuilder{d.t}
}
func (d DockerBuilder) Restart() TaskBuilder {
	d.t.State = "restart"
	d.t.Name = "Restart " + d.t.Dest
	return TaskBuilder{d.t}
}
func (d DockerBuilder) Remove() TaskBuilder {
	d.t.State = "rm"
	d.t.Name = "Remove " + d.t.Dest
	return TaskBuilder{d.t}
}
func (d DockerBuilder) Logs() TaskBuilder {
	d.t.State = "logs"
	d.t.Name = "Logs " + d.t.Dest
	return TaskBuilder{d.t}
}

func (d DockerBuilder) Exec(cmd string) TaskBuilder {
	d.t.State = "exec"
	d.t.Body = cmd
	d.t.Name = "Exec " + d.t.Dest
	return TaskBuilder{d.t}
}

// Docker run options
func (b TaskBuilder) Ports(p string) TaskBuilder   { return b.appendOpt("ports", p) }
func (b TaskBuilder) Volumes(v string) TaskBuilder { return b.appendOpt("volumes", v) }
func (b TaskBuilder) Env(e string) TaskBuilder     { return b.appendOpt("env", e) }
func (b TaskBuilder) Network(n string) TaskBuilder { return b.appendOpt("network", n) }
func (b TaskBuilder) Detach() TaskBuilder          { return b.appendOpt("detach", "true") }

// =============================================================================
// DOCKER COMPOSE
// =============================================================================

type ComposeBuilder struct{ t Task }

func Compose(path string) ComposeBuilder {
	return ComposeBuilder{Task{Action: "compose", Dest: path}}
}

func (c ComposeBuilder) Up() TaskBuilder {
	c.t.State = "up"
	c.t.Name = "Compose up"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Down() TaskBuilder {
	c.t.State = "down"
	c.t.Name = "Compose down"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Pull() TaskBuilder {
	c.t.State = "pull"
	c.t.Name = "Compose pull"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Build() TaskBuilder {
	c.t.State = "build"
	c.t.Name = "Compose build"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Start() TaskBuilder {
	c.t.State = "start"
	c.t.Name = "Compose start"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Stop() TaskBuilder {
	c.t.State = "stop"
	c.t.Name = "Compose stop"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Restart() TaskBuilder {
	c.t.State = "restart"
	c.t.Name = "Compose restart"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Logs() TaskBuilder {
	c.t.State = "logs"
	c.t.Name = "Compose logs"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Ps() TaskBuilder {
	c.t.State = "ps"
	c.t.Name = "Compose ps"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Kill() TaskBuilder {
	c.t.State = "kill"
	c.t.Name = "Compose kill"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Rm() TaskBuilder {
	c.t.State = "rm"
	c.t.Name = "Compose rm"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Top() TaskBuilder {
	c.t.State = "top"
	c.t.Name = "Compose top"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Pause() TaskBuilder {
	c.t.State = "pause"
	c.t.Name = "Compose pause"
	return TaskBuilder{c.t}
}
func (c ComposeBuilder) Unpause() TaskBuilder {
	c.t.State = "unpause"
	c.t.Name = "Compose unpause"
	return TaskBuilder{c.t}
}

func (c ComposeBuilder) Exec(service, cmd string) TaskBuilder {
	c.t.State = "exec"
	c.t.Src = service
	c.t.Body = cmd
	c.t.Name = "Compose exec " + service
	return TaskBuilder{c.t}
}

func (c ComposeBuilder) Run(service, cmd string) TaskBuilder {
	c.t.State = "run"
	c.t.Src = service
	c.t.Body = cmd
	c.t.Name = "Compose run " + service
	return TaskBuilder{c.t}
}

func (c ComposeBuilder) Cp(src, dest string) TaskBuilder {
	c.t.State = "cp"
	c.t.Src = src
	c.t.Body = dest
	c.t.Name = "Compose cp"
	return TaskBuilder{c.t}
}

// Compose options
func (b TaskBuilder) Service(s string) TaskBuilder { return b.appendOpt("service", s) }
func (b TaskBuilder) WithBuild() TaskBuilder       { return b.appendOpt("build", "true") }
func (b TaskBuilder) RemoveOrphans() TaskBuilder   { return b.appendOpt("orphans", "true") }
func (b TaskBuilder) RemoveVolumes() TaskBuilder   { return b.appendOpt("volumes", "true") }

// =============================================================================
// WAIT/HEALTH CHECKS
// =============================================================================

func WaitForPort(host, port string) TaskBuilder {
	return TaskBuilder{Task{Action: "wait_port", Dest: host, Body: port, Name: "Wait for " + host + ":" + port}}
}

func WaitForHttp(url string) TaskBuilder {
	return TaskBuilder{Task{Action: "wait_http", Dest: url, State: "200", Name: "Wait for " + url}}
}

func WaitForFile(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "wait_file", Dest: path, Name: "Wait for " + path}}
}

// ExpectCode sets expected HTTP status code for WaitForHttp
func (b TaskBuilder) ExpectCode(code string) TaskBuilder { b.t.State = code; return b }

// =============================================================================
// CHECKS (set variable based on result)
// =============================================================================

func FileExists(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "file_exists", Dest: path, Name: "Check file " + path}}
}

func DirExists(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "dir_exists", Dest: path, Name: "Check dir " + path}}
}

func ServiceRunning(name string) TaskBuilder {
	return TaskBuilder{Task{Action: "service_running", Dest: name, Name: "Check service " + name}}
}

// =============================================================================
// OUTPUT CAPTURE
// =============================================================================

func Capture(cmd string) TaskBuilder {
	return TaskBuilder{Task{Action: "capture", Body: cmd, Name: "Capture: " + cmd}}
}

func CaptureSudo(cmd string) TaskBuilder {
	return TaskBuilder{Task{Action: "capture_sudo", Body: cmd, Name: "Capture: " + cmd}}
}

// =============================================================================
// BACKUP/RESTORE
// =============================================================================

func Backup(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "backup", Dest: path, Name: "Backup " + path}}
}

func Restore(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "restore", Dest: path, Name: "Restore " + path}}
}

// =============================================================================
// ENVIRONMENT FILE
// =============================================================================

func EnvSet(file, key, value string) TaskBuilder {
	return TaskBuilder{Task{Action: "env_set", Dest: file, Src: key, Body: value, Name: "Set " + key + " in " + file}}
}

func EnvDelete(file, key string) TaskBuilder {
	return TaskBuilder{Task{Action: "env_delete", Dest: file, Src: key, Name: "Delete " + key + " from " + file}}
}

// =============================================================================
// RSYNC
// =============================================================================

func Rsync(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "rsync", Src: src, Dest: dest, Name: "Rsync " + src + " -> " + dest}}
}

// Flags sets custom rsync flags (default: -avz --delete)
func (b TaskBuilder) Flags(f string) TaskBuilder { b.t.Body = f; return b }

// =============================================================================
// NGINX
// =============================================================================

func NginxTest() TaskBuilder {
	return TaskBuilder{Task{Action: "nginx_test", Name: "Nginx config test"}}
}

func NginxReload() TaskBuilder {
	return TaskBuilder{Task{Action: "nginx_reload", Name: "Nginx reload"}}
}

// =============================================================================
// WIBU LICENSE (CMU)
// =============================================================================

// WibuGenerate generates a license request file using cmu
// container: CodeMeter container number (e.g., "6000930")
// output: output file path for the .WibuCmRaC file
func WibuGenerate(container, output string) TaskBuilder {
	return TaskBuilder{Task{Action: "wibu_generate", Src: container, Dest: output, Name: "Generate Wibu license request"}}
}

// WibuApply applies a license update file using cmu
// input: path to the .WibuCmRaU file
func WibuApply(input string) TaskBuilder {
	return TaskBuilder{Task{Action: "wibu_apply", Src: input, Name: "Apply Wibu license update"}}
}

// WibuInfo gets license info from CodeMeter
func WibuInfo() TaskBuilder {
	return TaskBuilder{Task{Action: "wibu_info", Name: "Get Wibu license info"}}
}

// WibuList lists all CodeMeter containers
func WibuList() TaskBuilder {
	return TaskBuilder{Task{Action: "wibu_list", Name: "List Wibu containers"}}
}

// =============================================================================
// SFTP OPERATIONS (for binary/special file handling)
// =============================================================================

// Download downloads a remote file to a local variable (for binary data)
// Use .Register("varname") to store the file contents
func Download(remotePath string) TaskBuilder {
	return TaskBuilder{Task{Action: "download", Src: remotePath, Name: "Download " + remotePath}}
}

// UploadBytes uploads binary data from a variable to remote path
// varName: the variable containing the data (set via vars.SetBytes)
func UploadBytes(varName, remotePath string) TaskBuilder {
	return TaskBuilder{Task{Action: "upload_bytes", Src: varName, Dest: remotePath, Name: "Upload bytes to " + remotePath}}
}

// ReadFile reads a remote file content into a variable
func ReadFile(remotePath string) TaskBuilder {
	return TaskBuilder{Task{Action: "read_file", Src: remotePath, Name: "Read " + remotePath}}
}

// WriteBytes writes raw bytes to a remote file (from Body)
func WriteBytes(remotePath string) TaskBuilder {
	return TaskBuilder{Task{Action: "write_bytes", Dest: remotePath, Name: "Write bytes to " + remotePath}}
}

// =============================================================================
// TASK OPTIONS
// =============================================================================

// Retry sets retry count and optional delay
func (b TaskBuilder) Retry(count int) TaskBuilder {
	b.t.Retry = count
	return b
}

// RetryDelay sets delay between retries
func (b TaskBuilder) RetryDelay(d string) TaskBuilder {
	if dur, err := parseDuration(d); err == nil {
		b.t.Delay = dur
	}
	return b
}

// Timeout sets timeout for wait operations
func (b TaskBuilder) Timeout(d string) TaskBuilder {
	if dur, err := parseDuration(d); err == nil {
		b.t.Timeout = dur
	}
	return b
}

// Register stores output in a variable
func (b TaskBuilder) Register(varName string) TaskBuilder {
	b.t.Register = varName
	return b
}

func parseDuration(s string) (time.Duration, error) {
	return time.ParseDuration(s)
}

// =============================================================================
// HELPER
// =============================================================================

func Tasks(builders ...TaskBuilder) []Task {
	tasks := make([]Task, len(builders))
	for i, b := range builders {
		tasks[i] = b.Build()
	}
	return tasks
}
