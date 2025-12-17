package porter

// =============================================================================
// ENVIRONMENT FILE OPERATIONS
// =============================================================================

// EnvSet sets a key-value pair in an environment file (.env format).
func EnvSet(file, key, value string) TaskBuilder {
	return TaskBuilder{Task{Action: "env_set", Dest: file, Src: key, Body: value, Name: "Set " + key + " in " + file}}
}

// EnvDelete removes a key from an environment file.
func EnvDelete(file, key string) TaskBuilder {
	return TaskBuilder{Task{Action: "env_delete", Dest: file, Src: key, Name: "Delete " + key + " from " + file}}
}
