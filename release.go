package porter

import (
	"path/filepath"
	"time"
)

// =============================================================================
// ATOMIC RELEASES + ROLLBACK (Capistrano/Kamal-style, for plain VMs)
//
// Deploys into a fresh timestamped releases/<ts> directory and, only after an
// optional health check passes, flips a `current` symlink to it via an atomic
// rename(2). Rollback re-points `current` at the previous release in ~one
// syscall. This gives zero-downtime, instantly-reversible deploys for systemd
// binaries / static payloads on plain VMs — the gap the Kubernetes
// progressive-delivery stack (Argo Rollouts, Flagger) doesn't cover.
// =============================================================================

// Release describes an atomic release deploy rooted at a base directory:
//
//	<base>/releases/<timestamp>/   the new release (deploy your payload here)
//	<base>/shared/                 persistent data shared across releases
//	<base>/current -> releases/..  the live symlink, swapped atomically
type Release struct {
	base       string
	releaseDir string
	keep       int
	sudo       bool
	health     string
}

// NewRelease starts a release rooted at baseDir. The release directory is
// stamped once, now, so every task in this deploy targets the same path.
func NewRelease(baseDir string) *Release {
	ts := time.Now().UTC().Format("20060102150405")
	return &Release{
		base:       baseDir,
		releaseDir: baseDir + "/releases/" + ts,
		keep:       5,
	}
}

// Keep sets how many past releases to retain after a deploy (default 5).
func (r *Release) Keep(n int) *Release { r.keep = n; return r }

// Sudo runs the release's own filesystem operations (mkdir, symlink, prune)
// with elevated privileges.
func (r *Release) Sudo() *Release { r.sudo = true; return r }

// HealthCheck sets a command run inside the new release directory before the
// symlink swap. A non-zero exit aborts the deploy with `current` still pointing
// at the previous release — health-gated cutover.
func (r *Release) HealthCheck(cmd string) *Release { r.health = cmd; return r }

// Dir is the new release directory — deploy your payload (binary, build
// output, extracted archive) into this path.
func (r *Release) Dir() string { return r.releaseDir }

// Current is the live symlink path (point your systemd unit / web root here).
func (r *Release) Current() string { return r.base + "/current" }

// Shared is the cross-release persistent directory (configs, uploads, data).
func (r *Release) Shared() string { return r.base + "/shared" }

func (r *Release) maybeSudo(b TaskBuilder) TaskBuilder {
	if r.sudo {
		return b.Sudo()
	}
	return b
}

// Prepare returns the tasks that create the releases/shared/release dirs.
func (r *Release) Prepare() []TaskBuilder {
	return []TaskBuilder{
		r.maybeSudo(EnsureDir(r.base + "/releases")).Name("prepare releases dir"),
		r.maybeSudo(EnsureDir(r.Shared())).Name("prepare shared dir"),
		r.maybeSudo(EnsureDir(r.releaseDir)).Name("create release " + filepath.Base(r.releaseDir)),
	}
}

// Activate returns the health-check (if any) and the atomic symlink swap. The
// swap stages the link then renames it over `current`, so the cutover is a
// single atomic rename(2) — never a window with no `current`.
func (r *Release) Activate() []TaskBuilder {
	var out []TaskBuilder
	if r.health != "" {
		out = append(out, Run("cd "+shellEscape(r.releaseDir)+" && "+r.health).
			Name("health check release"))
	}
	tmp := r.base + "/current.tmp"
	swap := "ln -sfn " + shellEscape(r.releaseDir) + " " + shellEscape(tmp) +
		" && mv -Tf " + shellEscape(tmp) + " " + shellEscape(r.Current())
	out = append(out, r.maybeSudo(Run(swap)).Name("activate release (atomic symlink swap)"))
	return out
}

// Prune returns a task that removes all but the newest Keep release dirs.
func (r *Release) Prune() TaskBuilder {
	cmd := "cd " + shellEscape(r.base+"/releases") +
		" && ls -1dt */ 2>/dev/null | tail -n +" + itoa(r.keep+1) + " | xargs -r rm -rf"
	return r.maybeSudo(Run(cmd)).Name("prune old releases (keep " + itoa(r.keep) + ")")
}

// Deploy assembles the full release sequence ready for Executor.Run:
// prepare -> your deploySteps (which deploy into r.Dir()) -> health-gated
// atomic activate -> prune. If any step (including the health check) fails the
// run aborts before activation, leaving the previous release live.
func (r *Release) Deploy(deploySteps ...TaskBuilder) []Task {
	all := r.Prepare()
	all = append(all, deploySteps...)
	all = append(all, r.Activate()...)
	all = append(all, r.Prune())
	return Tasks(all...)
}

// Rollback returns a task that re-points `current` at the previous release
// (the second-newest releases/* dir) via an atomic rename. Use when a deploy
// looked healthy at cutover but misbehaved afterward.
func Rollback(baseDir string) TaskBuilder {
	rel := shellEscape(baseDir + "/releases")
	cur := shellEscape(baseDir + "/current")
	tmp := shellEscape(baseDir + "/current.tmp")
	script := "prev=$(cd " + rel + " && ls -1dt */ 2>/dev/null | sed -n 2p); " +
		"[ -n \"$prev\" ] || { echo 'no previous release to roll back to' >&2; exit 1; }; " +
		"ln -sfn " + rel + "/\"$prev\" " + tmp + " && mv -Tf " + tmp + " " + cur
	return Run("sh -c " + shellEscape(script)).Name("rollback to previous release")
}
