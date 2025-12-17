package porter

// =============================================================================
// RSYNC OPERATIONS
// =============================================================================

// RsyncBuilder provides a fluent API for building rsync tasks.
type RsyncBuilder struct{ t Task }

// Rsync creates a new rsync task from src to dest.
func Rsync(src, dest string) RsyncBuilder {
	return RsyncBuilder{Task{Action: "rsync", Src: src, Dest: dest, Name: "Rsync " + src + " -> " + dest}}
}

// Build returns a TaskBuilder for use with Tasks().
func (r RsyncBuilder) Build() TaskBuilder { return TaskBuilder(struct{ t Task }(r)) }

// Name sets a custom name for the task.
func (r RsyncBuilder) Name(n string) RsyncBuilder { r.t.Name = n; return r }

// When sets a condition for execution.
func (r RsyncBuilder) When(w When) RsyncBuilder { r.t.When = w; return r }

// Ignore ignores errors from this task.
func (r RsyncBuilder) Ignore() RsyncBuilder { r.t.Ignore = true; return r }

// Sudo runs rsync with sudo.
func (r RsyncBuilder) Sudo() RsyncBuilder { r.t.Sudo = true; return r }

// appendOpt appends key:value to Body.
func (r RsyncBuilder) appendOpt(key, val string) RsyncBuilder {
	if r.t.Body == "" {
		r.t.Body = key + ":" + val
	} else {
		r.t.Body += ";" + key + ":" + val
	}
	return r
}

// =============================================================================
// RSYNC OPTIONS
// =============================================================================

// Flags sets custom rsync flags (default: -avz).
func (r RsyncBuilder) Flags(f string) RsyncBuilder { return r.appendOpt("flags", f) }

// Delete enables --delete flag (remove extraneous files from dest).
func (r RsyncBuilder) Delete() RsyncBuilder { return r.appendOpt("delete", "true") }

// Exclude adds patterns to exclude (comma-separated).
func (r RsyncBuilder) Exclude(patterns string) RsyncBuilder { return r.appendOpt("exclude", patterns) }

// Include adds patterns to include (comma-separated).
func (r RsyncBuilder) Include(patterns string) RsyncBuilder { return r.appendOpt("include", patterns) }

// NoCompress disables compression.
func (r RsyncBuilder) NoCompress() RsyncBuilder { return r.appendOpt("compress", "false") }

// Progress shows progress during transfer.
func (r RsyncBuilder) Progress() RsyncBuilder { return r.appendOpt("progress", "true") }

// DryRun performs a trial run with no changes made.
func (r RsyncBuilder) DryRun() RsyncBuilder { return r.appendOpt("dry-run", "true") }

// BwLimit limits bandwidth in KB/s.
func (r RsyncBuilder) BwLimit(kbps string) RsyncBuilder { return r.appendOpt("bwlimit", kbps) }

// Checksum uses checksum instead of mod-time & size.
func (r RsyncBuilder) Checksum() RsyncBuilder { return r.appendOpt("checksum", "true") }

// Partial keeps partially transferred files.
func (r RsyncBuilder) Partial() RsyncBuilder { return r.appendOpt("partial", "true") }

// Inplace updates files in-place (don't create temp file).
func (r RsyncBuilder) Inplace() RsyncBuilder { return r.appendOpt("inplace", "true") }

// Delta enables delta-transfer algorithm (only send changed parts of files).
// This is the key option for faster syncs of large files with small changes.
func (r RsyncBuilder) Delta() RsyncBuilder { return r.appendOpt("delta", "true") }

// Fast is a convenience method that enables both Inplace and Delta for fastest incremental syncs.
func (r RsyncBuilder) Fast() RsyncBuilder {
	return r.appendOpt("inplace", "true").appendOpt("delta", "true")
}

// Local runs rsync on the local machine instead of remote, syncing local files to remote via SSH.
// This is useful for Docker environments where you can't SSH into the container.
// The destination path will be prefixed with user@host: automatically.
func (r RsyncBuilder) Local() RsyncBuilder { return r.appendOpt("local", "true") }

// SSHPort sets a custom SSH port for local-to-remote rsync (only used with Local()).
func (r RsyncBuilder) SSHPort(port string) RsyncBuilder { return r.appendOpt("ssh-port", port) }

// SSHKey sets the SSH key path for local-to-remote rsync (only used with Local()).
func (r RsyncBuilder) SSHKey(keyPath string) RsyncBuilder { return r.appendOpt("ssh-key", keyPath) }

// =============================================================================
// RSYNC UTILITIES
// =============================================================================

// RsyncInstall installs rsync on the remote system using the appropriate package manager.
func RsyncInstall() TaskBuilder {
	return TaskBuilder{Task{Action: "rsync_install", Name: "Install rsync"}}
}

// RsyncCheck checks if rsync is installed (use .Register("varname") to store result).
func RsyncCheck() TaskBuilder {
	return TaskBuilder{Task{Action: "rsync_check", Name: "Check rsync installed"}}
}

// RsyncVersion gets the rsync version (use .Register("varname") to store result).
func RsyncVersion() TaskBuilder {
	return TaskBuilder{Task{Action: "rsync_version", Name: "Get rsync version"}}
}

// RsyncEnsure ensures rsync is installed (installs if not present).
func RsyncEnsure() []Task {
	return Tasks(
		RsyncCheck().Register("rsync_installed"),
		RsyncInstall().When(IfEquals("rsync_installed", "false")).Ignore(),
	)
}
