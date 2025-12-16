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
func (b TaskBuilder) Creates(path string) TaskBuilder  { b.t.Creates = path; return b }
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
	return TaskBuilder(s)
}
func (s SvcBuilder) Stop() TaskBuilder {
	s.t.State = "stop"
	s.t.Name = "Stop " + s.t.Dest
	return TaskBuilder(s)
}
func (s SvcBuilder) Restart() TaskBuilder {
	s.t.State = "restart"
	s.t.Name = "Restart " + s.t.Dest
	return TaskBuilder(s)
}
func (s SvcBuilder) Enable() TaskBuilder {
	s.t.State = "enable"
	s.t.Name = "Enable " + s.t.Dest
	return TaskBuilder(s)
}

func DaemonReload() TaskBuilder {
	return TaskBuilder{Task{Action: "daemon_reload", Name: "Reload systemd"}}
}

func Template(name, content string) TaskBuilder {
	return TaskBuilder{Task{Action: "template", Dest: name, Body: content, Name: "Template " + name}}
}

// =============================================================================
// JOURNALCTL (SYSTEMD LOGS)
// =============================================================================

// Journal returns a TaskBuilder for retrieving all system journal logs
func Journal() TaskBuilder {
	return TaskBuilder{Task{Action: "journal", Name: "Journal logs"}}
}

// JournalUnit returns a TaskBuilder for retrieving logs for a specific systemd unit
func JournalUnit(unit string) TaskBuilder {
	return TaskBuilder{Task{Action: "journal", Dest: unit, Name: "Journal logs for " + unit}}
}

// Journal-specific methods for TaskBuilder

// Lines limits the number of log lines to retrieve
func (b TaskBuilder) Lines(n string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-n "+n)
	return b
}

// Follow enables real-time log following (use with caution in automation)
func (b TaskBuilder) Follow() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-f")
	return b
}

// Since filters logs from a specific time (e.g., "2024-12-11 10:00:00", "1 hour ago")
func (b TaskBuilder) Since(time string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--since="+shellEscape(time))
	return b
}

// Until filters logs until a specific time
func (b TaskBuilder) Until(time string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--until="+shellEscape(time))
	return b
}

// Priority filters logs by priority level (emerg, alert, crit, err, warning, notice, info, debug)
func (b TaskBuilder) Priority(level string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-p "+level)
	return b
}

// Grep filters logs matching a pattern
func (b TaskBuilder) Grep(pattern string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--grep="+shellEscape(pattern))
	return b
}

// Reverse shows newest entries first
func (b TaskBuilder) Reverse() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-r")
	return b
}

// NoPager disables pager output
func (b TaskBuilder) NoPager() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--no-pager")
	return b
}

// Output sets the output format (short, json, json-pretty, verbose, cat, etc.)
func (b TaskBuilder) Output(format string) TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-o "+format)
	return b
}

// Boot shows logs from a specific boot (empty string for current boot)
func (b TaskBuilder) Boot(id string) TaskBuilder {
	if id == "" {
		b.t.Body = appendJournalFlag(b.t.Body, "-b")
	} else {
		b.t.Body = appendJournalFlag(b.t.Body, "-b "+id)
	}
	return b
}

// Kernel shows kernel logs only
func (b TaskBuilder) Kernel() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-k")
	return b
}

// Dmesg shows kernel ring buffer (similar to dmesg command)
func (b TaskBuilder) Dmesg() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--dmesg")
	return b
}

// System shows system logs explicitly
func (b TaskBuilder) System() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--system")
	return b
}

// UTC shows timestamps in UTC
func (b TaskBuilder) UTC() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "--utc")
	return b
}

// Catalog adds explanatory help texts to log messages
func (b TaskBuilder) Catalog() TaskBuilder {
	b.t.Body = appendJournalFlag(b.t.Body, "-x")
	return b
}

// appendJournalFlag is a helper to append flags to the Body field
func appendJournalFlag(current, flag string) string {
	if current == "" {
		return flag
	}
	return current + " " + flag
}

// shellEscape escapes a string for safe use in shell commands
func shellEscape(s string) string {
	// Replace single quotes with '\'' which closes the quote, adds an escaped quote, and reopens
	return "'" + strings.Replace(s, "'", "'\\''", -1) + "'"
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
	return TaskBuilder(d)
}

func (d DockerBuilder) Start() TaskBuilder {
	d.t.State = "start"
	d.t.Name = "Start " + d.t.Dest
	return TaskBuilder(d)
}
func (d DockerBuilder) Stop() TaskBuilder {
	d.t.State = "stop"
	d.t.Name = "Stop " + d.t.Dest
	return TaskBuilder(d)
}
func (d DockerBuilder) Restart() TaskBuilder {
	d.t.State = "restart"
	d.t.Name = "Restart " + d.t.Dest
	return TaskBuilder(d)
}
func (d DockerBuilder) Remove() TaskBuilder {
	d.t.State = "rm"
	d.t.Name = "Remove " + d.t.Dest
	return TaskBuilder(d)
}
func (d DockerBuilder) Logs() TaskBuilder {
	d.t.State = "logs"
	d.t.Name = "Logs " + d.t.Dest
	return TaskBuilder(d)
}

func (d DockerBuilder) Exec(cmd string) TaskBuilder {
	d.t.State = "exec"
	d.t.Body = cmd
	d.t.Name = "Exec " + d.t.Dest
	return TaskBuilder(d)
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
	return TaskBuilder(c)
}
func (c ComposeBuilder) Down() TaskBuilder {
	c.t.State = "down"
	c.t.Name = "Compose down"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Pull() TaskBuilder {
	c.t.State = "pull"
	c.t.Name = "Compose pull"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Build() TaskBuilder {
	c.t.State = "build"
	c.t.Name = "Compose build"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Start() TaskBuilder {
	c.t.State = "start"
	c.t.Name = "Compose start"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Stop() TaskBuilder {
	c.t.State = "stop"
	c.t.Name = "Compose stop"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Restart() TaskBuilder {
	c.t.State = "restart"
	c.t.Name = "Compose restart"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Logs() TaskBuilder {
	c.t.State = "logs"
	c.t.Name = "Compose logs"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Ps() TaskBuilder {
	c.t.State = "ps"
	c.t.Name = "Compose ps"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Kill() TaskBuilder {
	c.t.State = "kill"
	c.t.Name = "Compose kill"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Rm() TaskBuilder {
	c.t.State = "rm"
	c.t.Name = "Compose rm"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Top() TaskBuilder {
	c.t.State = "top"
	c.t.Name = "Compose top"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Pause() TaskBuilder {
	c.t.State = "pause"
	c.t.Name = "Compose pause"
	return TaskBuilder(c)
}
func (c ComposeBuilder) Unpause() TaskBuilder {
	c.t.State = "unpause"
	c.t.Name = "Compose unpause"
	return TaskBuilder(c)
}

func (c ComposeBuilder) Exec(service, cmd string) TaskBuilder {
	c.t.State = "exec"
	c.t.Src = service
	c.t.Body = cmd
	c.t.Name = "Compose exec " + service
	return TaskBuilder(c)
}

func (c ComposeBuilder) Run(service, cmd string) TaskBuilder {
	c.t.State = "run"
	c.t.Src = service
	c.t.Body = cmd
	c.t.Name = "Compose run " + service
	return TaskBuilder(c)
}

func (c ComposeBuilder) Cp(src, dest string) TaskBuilder {
	c.t.State = "cp"
	c.t.Src = src
	c.t.Body = dest
	c.t.Name = "Compose cp"
	return TaskBuilder(c)
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

// RsyncBuilder provides fluent API for building rsync tasks
type RsyncBuilder struct{ t Task }

// Rsync creates a new rsync task from src to dest
func Rsync(src, dest string) RsyncBuilder {
	return RsyncBuilder{Task{Action: "rsync", Src: src, Dest: dest, Name: "Rsync " + src + " -> " + dest}}
}

// Build returns a TaskBuilder for use with Tasks()
func (r RsyncBuilder) Build() TaskBuilder { return TaskBuilder(struct{ t Task }(r)) }

// Name sets a custom name for the task
func (r RsyncBuilder) Name(n string) RsyncBuilder { r.t.Name = n; return r }

// When sets a condition for execution
func (r RsyncBuilder) When(w When) RsyncBuilder { r.t.When = w; return r }

// Ignore ignores errors from this task
func (r RsyncBuilder) Ignore() RsyncBuilder { r.t.Ignore = true; return r }

// Sudo runs rsync with sudo
func (r RsyncBuilder) Sudo() RsyncBuilder { r.t.Sudo = true; return r }

// appendOpt appends key:value to Body
func (r RsyncBuilder) appendOpt(key, val string) RsyncBuilder {
	if r.t.Body == "" {
		r.t.Body = key + ":" + val
	} else {
		r.t.Body += ";" + key + ":" + val
	}
	return r
}

// Flags sets custom rsync flags (default: -avz)
func (r RsyncBuilder) Flags(f string) RsyncBuilder { return r.appendOpt("flags", f) }

// Delete enables --delete flag (remove extraneous files from dest)
func (r RsyncBuilder) Delete() RsyncBuilder { return r.appendOpt("delete", "true") }

// Exclude adds patterns to exclude (comma-separated)
func (r RsyncBuilder) Exclude(patterns string) RsyncBuilder { return r.appendOpt("exclude", patterns) }

// Include adds patterns to include (comma-separated)
func (r RsyncBuilder) Include(patterns string) RsyncBuilder { return r.appendOpt("include", patterns) }

// NoCompress disables compression
func (r RsyncBuilder) NoCompress() RsyncBuilder { return r.appendOpt("compress", "false") }

// Progress shows progress during transfer
func (r RsyncBuilder) Progress() RsyncBuilder { return r.appendOpt("progress", "true") }

// DryRun performs a trial run with no changes made
func (r RsyncBuilder) DryRun() RsyncBuilder { return r.appendOpt("dry-run", "true") }

// BwLimit limits bandwidth in KB/s
func (r RsyncBuilder) BwLimit(kbps string) RsyncBuilder { return r.appendOpt("bwlimit", kbps) }

// Checksum uses checksum instead of mod-time & size
func (r RsyncBuilder) Checksum() RsyncBuilder { return r.appendOpt("checksum", "true") }

// Partial keeps partially transferred files
func (r RsyncBuilder) Partial() RsyncBuilder { return r.appendOpt("partial", "true") }

// Inplace updates files in-place (don't create temp file)
func (r RsyncBuilder) Inplace() RsyncBuilder { return r.appendOpt("inplace", "true") }

// Delta enables delta-transfer algorithm (only send changed parts of files)
// This is the key option for faster syncs of large files with small changes
func (r RsyncBuilder) Delta() RsyncBuilder { return r.appendOpt("delta", "true") }

// Fast is a convenience method that enables both Inplace and Delta for fastest incremental syncs
func (r RsyncBuilder) Fast() RsyncBuilder {
	return r.appendOpt("inplace", "true").appendOpt("delta", "true")
}

// Local runs rsync on the local machine instead of remote, syncing local files to remote via SSH.
// This is useful for Docker environments where you can't SSH into the container.
// The destination path will be prefixed with user@host: automatically.
func (r RsyncBuilder) Local() RsyncBuilder { return r.appendOpt("local", "true") }

// SSHPort sets a custom SSH port for local-to-remote rsync (only used with Local())
func (r RsyncBuilder) SSHPort(port string) RsyncBuilder { return r.appendOpt("ssh-port", port) }

// SSHKey sets the SSH key path for local-to-remote rsync (only used with Local())
func (r RsyncBuilder) SSHKey(keyPath string) RsyncBuilder { return r.appendOpt("ssh-key", keyPath) }

// RsyncInstall installs rsync on the remote system using the appropriate package manager
func RsyncInstall() TaskBuilder {
	return TaskBuilder{Task{Action: "rsync_install", Name: "Install rsync"}}
}

// RsyncCheck checks if rsync is installed (use .Register("varname") to store result)
func RsyncCheck() TaskBuilder {
	return TaskBuilder{Task{Action: "rsync_check", Name: "Check rsync installed"}}
}

// RsyncVersion gets the rsync version (use .Register("varname") to store result)
func RsyncVersion() TaskBuilder {
	return TaskBuilder{Task{Action: "rsync_version", Name: "Get rsync version"}}
}

// RsyncEnsure ensures rsync is installed (installs if not present)
func RsyncEnsure() []Task {
	return Tasks(
		RsyncCheck().Register("rsync_installed"),
		RsyncInstall().When(IfEquals("rsync_installed", "false")).Ignore(),
	)
}

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

// =============================================================================
// SYSTEMD SERVICE FILE MANAGEMENT
// =============================================================================

// EscapeSed escapes special characters for sed replacement strings.
// Use this when passing dynamic values to Sed() to avoid syntax errors.
func EscapeSed(value string) string {
	v := strings.ReplaceAll(value, `\`, `\\`)
	v = strings.ReplaceAll(v, `&`, `\&`)
	v = strings.ReplaceAll(v, `/`, `\/`)
	return v
}

// UpdateServiceParam creates a sed pattern that updates a systemd service parameter
// while preserving its existing quote style (quoted vs unquoted).
// For example, updating -port=3099 or -port="3099" will preserve the original format.
// The pattern matches: -paramName="value" or -paramName=value
func UpdateServiceParam(paramName, newValue string) string {
	escaped := EscapeSed(newValue)
	// Pattern explanation:
	// s%                    - sed substitute command with % delimiter
	// -paramName=           - literal match of parameter
	// \("\{0,1\}\)          - capture group 1: optional quote (0 or 1 times)
	// \([^" ]*\)            - capture group 2: the value (non-quote, non-space chars)
	// \1                    - back-reference to match closing quote if opening existed
	// -paramName=\1...\1    - replacement preserving quote style
	// %g                    - global flag
	return `s%-` + paramName + `=\("\{0,1\}\)\([^" ]*\)\1%-` + paramName + `=\1` + escaped + `\1%g`
}

// UpdateServiceParamTask creates a TaskBuilder that updates a systemd service parameter
// in the specified file while preserving quote style.
func UpdateServiceParamTask(servicePath, paramName, newValue string) TaskBuilder {
	pattern := UpdateServiceParam(paramName, newValue)
	return Sed(pattern, servicePath).Name("Update " + paramName + " in " + servicePath)
}

// ServiceFileConfig defines configuration for managing a systemd service file.
type ServiceFileConfig struct {
	Name      string            // Service name (e.g., "myapp", "worker")
	Template  string            // Service file template content
	IsUser    bool              // true for user services (~/.config/systemd/user/), false for system (/etc/systemd/system/)
	Params    map[string]string // Parameters to update if service file exists (key=param name, value=new value)
	NeedsSudo bool              // true if template creation needs sudo (always true for system services; sed updates always use sudo)
	When      When              // Optional condition to apply to all generated tasks (combined with internal conditions via And)
}

// servicePath returns the full path to the service file based on IsUser flag.
// For user services: ~/.config/systemd/user/<name>.service
// For system services: /etc/systemd/system/<name>.service
func (c ServiceFileConfig) servicePath() string {
	if c.IsUser {
		return "~/.config/systemd/user/" + c.Name + ".service"
	}
	return "/etc/systemd/system/" + c.Name + ".service"
}

// ManageServiceFile creates a task group that idempotently manages a systemd service file:
// 1. Checks if the service file exists
// 2. Creates from template if missing
// 3. Updates parameters if the file exists
//
// The returned tasks use a variable named "<serviceName>_service_exists" to track state.
// For user services, tasks are configured with .User(). For system services, tasks use .Sudo().
//
// Example usage:
//
//	tasks := porter.ManageServiceFile(porter.ServiceFileConfig{
//	    Name:     "myapp",
//	    Template: appServiceTemplate,
//	    IsUser:   true,
//	    Params: map[string]string{
//	        "port": "8080",
//	        "host": "0.0.0.0",
//	    },
//	    When: porter.IfEquals("env", "production"), // Optional: only run in production
//	})
func ManageServiceFile(cfg ServiceFileConfig) []Task {
	servicePath := cfg.servicePath()
	existsVar := cfg.Name + "_service_exists"

	var builders []TaskBuilder

	// 1. Check if service file exists
	builders = append(builders,
		FileExists(servicePath).Register(existsVar).Name("Check if "+cfg.Name+" service exists"),
	)

	// 2. Create from template if missing
	// System services always need sudo; user services need sudo if NeedsSudo is set
	needsSudo := !cfg.IsUser || cfg.NeedsSudo
	createTask := Template(servicePath, cfg.Template).Name("Create " + cfg.Name + " service file")
	if cfg.IsUser {
		createTask = createTask.User()
	}
	if needsSudo {
		createTask = createTask.Sudo()
	}
	createTask = createTask.When(IfEquals(existsVar, "false"))
	builders = append(builders, createTask)

	// 3. Update parameters if file exists
	for paramName, paramValue := range cfg.Params {
		updateTask := UpdateServiceParamTask(servicePath, paramName, paramValue)
		if needsSudo {
			updateTask = updateTask.Sudo()
		}
		updateTask = updateTask.When(IfEquals(existsVar, "true"))
		builders = append(builders, updateTask)
	}

	tasks := Tasks(builders...)

	// Apply user's condition to all tasks if provided
	if cfg.When != nil {
		for i := range tasks {
			if tasks[i].When != nil {
				tasks[i].When = And(cfg.When, tasks[i].When)
			} else {
				tasks[i].When = cfg.When
			}
		}
	}

	return tasks
}

// BuildServiceTasks is an alias for ManageServiceFile that makes the conditional
// execution pattern more explicit. Use this when you want to emphasize that the
// When condition controls whether the entire service management workflow runs.
//
// Example:
//
//	tasks := porter.BuildServiceTasks(porter.ServiceFileConfig{
//	    Name:     "myapp",
//	    Template: appServiceTemplate,
//	    IsUser:   true,
//	    Params:   map[string]string{"port": "8080"},
//	    When:     porter.IfEquals("env", "production"),
//	})
func BuildServiceTasks(cfg ServiceFileConfig) []Task {
	return ManageServiceFile(cfg)
}

// ManageServiceFileWithReload is like ManageServiceFile but also adds daemon-reload
// and service restart tasks at the end.
func ManageServiceFileWithReload(cfg ServiceFileConfig) []Task {
	tasks := ManageServiceFile(cfg)

	// Add daemon-reload
	reloadTask := DaemonReload()
	if cfg.IsUser {
		reloadTask = reloadTask.User()
	} else {
		reloadTask = reloadTask.Sudo()
	}

	// Add service restart
	restartTask := Svc(cfg.Name).Restart()
	if cfg.IsUser {
		restartTask = restartTask.User()
	} else {
		restartTask = restartTask.Sudo()
	}

	allTasks := append(tasks, Tasks(reloadTask, restartTask)...)

	// Apply user's condition to reload and restart tasks if provided
	if cfg.When != nil {
		for i := len(tasks); i < len(allTasks); i++ {
			if allTasks[i].When != nil {
				allTasks[i].When = And(cfg.When, allTasks[i].When)
			} else {
				allTasks[i].When = cfg.When
			}
		}
	}

	return allTasks
}
