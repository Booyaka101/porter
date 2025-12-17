package porter

// =============================================================================
// COMMAND EXECUTION
// =============================================================================

// Run executes a shell command on the remote server.
func Run(cmd string) TaskBuilder {
	return TaskBuilder{Task{Action: "run", Body: cmd, Name: "Run: " + cmd}}
}

// Pause waits for the specified duration (e.g., "5s", "1m").
func Pause(duration string) TaskBuilder {
	return TaskBuilder{Task{Action: "pause", Body: duration, Name: "Wait " + duration}}
}

// =============================================================================
// OUTPUT CAPTURE
// =============================================================================

// Capture executes a command and stores its output in a variable.
// Use .Register("varname") to specify the variable name.
func Capture(cmd string) TaskBuilder {
	return TaskBuilder{Task{Action: "capture", Body: cmd, Name: "Capture: " + cmd}}
}

// CaptureSudo executes a command with sudo and stores its output.
// Use .Register("varname") to specify the variable name.
func CaptureSudo(cmd string) TaskBuilder {
	return TaskBuilder{Task{Action: "capture_sudo", Body: cmd, Name: "Capture: " + cmd}}
}
