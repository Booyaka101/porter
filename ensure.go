package porter

import (
	"crypto/sha256"
	"encoding/hex"
)

// sha256Hex returns the hex-encoded SHA-256 of s, matching the output format
// of remote `sha256sum`, so EnsureFile can compare desired vs actual content.
func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// =============================================================================
// DECLARATIVE STATE PRIMITIVES (fact-gather -> diff -> no-op)
//
// Unlike the imperative actions (Copy, Run, Svc().Start()), the Ensure*
// builders describe a desired STATE. At execution each one first gathers a
// fact from the remote, compares it to the desired state, and acts only if
// they differ. A host already in the desired state is a true no-op — reported
// as "ok" (not "changed"), so the RECAP changed-count finally means something.
// This is the pyinfra/Ansible idempotency model.
// =============================================================================

// EnsureFile ensures dest contains exactly content. The remote file is hashed
// (SHA-256) and rewritten only if absent or different. Combine with .Mode()
// and .Owner() to also pin permissions, and .Sudo() for privileged paths.
func EnsureFile(dest, content string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "ensure_file", Dest: dest, Body: content}}
}

// EnsureDir ensures a directory exists at path. No-op if it already exists.
func EnsureDir(path string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "ensure_dir", Dest: path}}
}

// EnsureSymlink ensures dest is a symlink pointing at src. No-op if it already
// points there; repointed otherwise.
func EnsureSymlink(src, dest string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "ensure_symlink", Src: src, Dest: dest}}
}

// EnsurePackage ensures an apt package is installed. No-op if dpkg already
// reports it installed.
func EnsurePackage(name string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "ensure_package", Dest: name}}
}

// EnsureLine ensures the exact line is present in file (appended if absent).
// No-op if an identical line already exists. Use .Sudo() for root-owned files.
func EnsureLine(file, line string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "ensure_line", Dest: file, Body: line}}
}

// EnsureServiceRunning ensures a systemd unit is active (started if not).
// No-op if already running. Use .UserMode() for a --user unit.
func EnsureServiceRunning(name string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "ensure_service_running", Dest: name}}
}

// EnsureServiceEnabled ensures a systemd unit is enabled at boot (enabled if
// not). No-op if already enabled. Use .UserMode() for a --user unit.
func EnsureServiceEnabled(name string) TaskBuilder {
	return TaskBuilder{t: Task{Action: "ensure_service_enabled", Dest: name}}
}

// =============================================================================
// FACT PREDICATES — shared by dispatch (to no-op) and dry-run (to preview).
// Each returns true when the remote is ALREADY in the desired state.
// =============================================================================

func (e *Executor) fileConverged(dest, content string, sudo bool) bool {
	// Read the digest with sudo when the target may be root-only, otherwise a
	// permission error would read as "differs" and rewrite every run.
	cmd := "sha256sum " + shellEscape(dest) + " 2>/dev/null | cut -d' ' -f1"
	got, _ := e.runCaptureMaybeSudo(sudo, cmd)
	return got == sha256Hex(content)
}

func (e *Executor) dirExists(path string) bool {
	_, err := e.runCapture("test -d " + shellEscape(path))
	return err == nil
}

func (e *Executor) symlinkPointsAt(dest, src string) bool {
	got, _ := e.runCapture("readlink " + shellEscape(dest) + " 2>/dev/null")
	return got == src
}

func (e *Executor) packageInstalled(name string) bool {
	_, err := e.runCapture("dpkg-query -W -f='${Status}' " + shellEscape(name) + " 2>/dev/null | grep -q 'install ok installed'")
	return err == nil
}

func (e *Executor) linePresent(file, line string, sudo bool) bool {
	_, err := e.runCaptureMaybeSudo(sudo, "grep -qxF -- "+shellEscape(line)+" "+shellEscape(file)+" 2>/dev/null")
	return err == nil
}

func systemctlPrefix(user bool) (cmd string, sudo bool) {
	if user {
		return "systemctl --user ", false
	}
	return "systemctl ", true
}

func (e *Executor) serviceActive(name string, user bool) bool {
	sc, _ := systemctlPrefix(user)
	_, err := e.runCapture(sc + "is-active --quiet " + shellEscape(name))
	return err == nil
}

func (e *Executor) serviceEnabled(name string, user bool) bool {
	sc, _ := systemctlPrefix(user)
	_, err := e.runCapture(sc + "is-enabled --quiet " + shellEscape(name))
	return err == nil
}

func (e *Executor) pathExists(p string) bool {
	_, err := e.client.Run("test -e " + p)
	return err == nil
}

// preview reports, WITHOUT mutating the remote, whether a task would change
// state in a real run, plus a short human detail for --dry-run output. For the
// declarative actions it runs the (read-only) fact check; for Creates it tests
// the path; otherwise it assumes a change ("would run"). With no connection it
// degrades to the action classification.
func (e *Executor) preview(t Task, vars *Vars) (bool, string) {
	if e.client == nil {
		if readOnlyActions[t.Action] {
			return false, ""
		}
		return true, "would run " + t.Action
	}

	if t.Creates != "" {
		creates := vars.Expand(t.Creates)
		if e.pathExists(creates) {
			return false, "skipped (exists: " + creates + ")"
		}
	}

	dest := vars.Expand(t.Dest)
	src := vars.Expand(t.Src)
	body := vars.Expand(t.Body)

	switch t.Action {
	case "ensure_file":
		if e.fileConverged(dest, body, t.Sudo) {
			return false, "ensure_file: " + dest + " already up to date"
		}
		return true, "ensure_file: would write " + dest
	case "ensure_dir":
		if e.dirExists(dest) {
			return false, "ensure_dir: " + dest + " exists"
		}
		return true, "ensure_dir: would create " + dest
	case "ensure_symlink":
		if e.symlinkPointsAt(dest, src) {
			return false, "ensure_symlink: " + dest + " already -> " + src
		}
		return true, "ensure_symlink: would link " + dest + " -> " + src
	case "ensure_package":
		if e.packageInstalled(dest) {
			return false, "ensure_package: " + dest + " installed"
		}
		return true, "ensure_package: would install " + dest
	case "ensure_line":
		if e.linePresent(dest, body, t.Sudo) {
			return false, "ensure_line: present in " + dest
		}
		return true, "ensure_line: would append to " + dest
	case "ensure_service_running":
		if e.serviceActive(dest, t.User) {
			return false, "ensure_service_running: " + dest + " active"
		}
		return true, "ensure_service_running: would start " + dest
	case "ensure_service_enabled":
		if e.serviceEnabled(dest, t.User) {
			return false, "ensure_service_enabled: " + dest + " enabled"
		}
		return true, "ensure_service_enabled: would enable " + dest
	}

	if readOnlyActions[t.Action] {
		return false, ""
	}
	return true, "would run " + t.Action
}
