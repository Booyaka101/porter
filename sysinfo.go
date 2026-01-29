package porter

// =============================================================================
// SYSTEM INFORMATION & CHECKS
// =============================================================================

// DiskSpace checks available disk space on a path.
// Use .Register("varname") to store the result in GB.
func DiskSpace(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "disk_space", Dest: path, Name: "Check disk space: " + path}}
}

// MemoryInfo gets available memory information.
// Use .Register("varname") to store the result.
func MemoryInfo() TaskBuilder {
	return TaskBuilder{Task{Action: "memory_info", Name: "Check memory"}}
}

// CPUInfo gets CPU information.
// Use .Register("varname") to store the result.
func CPUInfo() TaskBuilder {
	return TaskBuilder{Task{Action: "cpu_info", Name: "Check CPU"}}
}

// LoadAverage gets system load average.
// Use .Register("varname") to store the result.
func LoadAverage() TaskBuilder {
	return TaskBuilder{Task{Action: "load_avg", Name: "Check load average"}}
}

// CommandExists checks if a command is available.
// Use .Register("varname") to store "true" or "false".
func CommandExists(cmd string) TaskBuilder {
	return TaskBuilder{Task{Action: "command_exists", Dest: cmd, Name: "Check command: " + cmd}}
}

// RequireDiskSpace fails if available space is less than minGB.
func RequireDiskSpace(path string, minGB int) TaskBuilder {
	return TaskBuilder{Task{Action: "require_disk", Dest: path, Body: itoa(minGB), Name: "Require " + itoa(minGB) + "GB on " + path}}
}

// RequireMemory fails if available memory is less than minGB.
func RequireMemory(minGB int) TaskBuilder {
	return TaskBuilder{Task{Action: "require_memory", Body: itoa(minGB), Name: "Require " + itoa(minGB) + "GB memory"}}
}

// RequireCommand fails if the command is not available.
func RequireCommand(cmd string) TaskBuilder {
	return TaskBuilder{Task{Action: "require_command", Dest: cmd, Name: "Require command: " + cmd}}
}

// Nproc gets the number of CPU cores.
// Use .Register("varname") to store the result.
func Nproc() TaskBuilder {
	return TaskBuilder{Task{Action: "nproc", Name: "Get CPU cores"}}
}
