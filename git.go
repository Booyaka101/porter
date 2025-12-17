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
