package porter

// =============================================================================
// GIT OPERATIONS
// =============================================================================

// GitClone clones a repository to the specified path.
func GitClone(repo, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_clone", Src: repo, Dest: dest, Name: "Git clone"}}
}

// GitPull pulls the latest changes in a repository.
func GitPull(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_pull", Dest: path, Name: "Git pull"}}
}

// GitCheckout checks out a specific branch, tag, or commit.
func GitCheckout(path, ref string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_checkout", Dest: path, Body: ref, Name: "Git checkout " + ref}}
}

// GitLfsPull pulls LFS files in a repository.
func GitLfsPull(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_lfs_pull", Dest: path, Name: "Git LFS pull"}}
}

// GitFetch fetches from remote.
func GitFetch(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_fetch", Dest: path, Name: "Git fetch"}}
}

// GitReset resets the repository to a specific state.
func GitReset(path, ref string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_reset", Dest: path, Body: ref, Name: "Git reset " + ref}}
}

// GitClean removes untracked files.
func GitClean(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_clean", Dest: path, Name: "Git clean"}}
}

// GitDescribe gets version info from tags.
func GitDescribe(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "git_describe", Dest: path, Name: "Git describe"}}
}

// Shallow enables shallow clone (depth 1).
func (b TaskBuilder) Shallow() TaskBuilder { return b.appendOpt("shallow", "true") }

// Depth sets clone depth.
func (b TaskBuilder) Depth(n int) TaskBuilder { return b.appendOpt("depth", itoa(n)) }

// Hard enables hard reset.
func (b TaskBuilder) Hard() TaskBuilder { return b.appendOpt("hard", "true") }

// Force enables force operations.
func (b TaskBuilder) Force() TaskBuilder { return b.appendOpt("force", "true") }
