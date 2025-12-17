package porter

// =============================================================================
// CHECKS (set variable based on result)
// =============================================================================

// FileExists checks if a file exists and stores the result ("true"/"false") in a variable.
// Use .Register("varname") to specify the variable name.
func FileExists(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "file_exists", Dest: path, Name: "Check file " + path}}
}

// DirExists checks if a directory exists and stores the result ("true"/"false") in a variable.
// Use .Register("varname") to specify the variable name.
func DirExists(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "dir_exists", Dest: path, Name: "Check dir " + path}}
}

// ServiceRunning checks if a systemd service is running and stores the result.
// Use .Register("varname") to specify the variable name.
func ServiceRunning(name string) TaskBuilder {
	return TaskBuilder{Task{Action: "service_running", Dest: name, Name: "Check service " + name}}
}
