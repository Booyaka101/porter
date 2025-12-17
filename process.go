package porter

// =============================================================================
// PROCESS MANAGEMENT
// =============================================================================

// Kill sends a signal to a process by PID.
func Kill(pid string) TaskBuilder {
	return TaskBuilder{Task{Action: "kill", Dest: pid, Name: "Kill " + pid}}
}

// Killall kills all processes with the given name.
func Killall(name string) TaskBuilder {
	return TaskBuilder{Task{Action: "killall", Dest: name, Name: "Killall " + name}}
}

// Pkill kills processes matching a pattern.
func Pkill(pattern string) TaskBuilder {
	return TaskBuilder{Task{Action: "pkill", Dest: pattern, Name: "Pkill " + pattern}}
}
