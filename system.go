package porter

// =============================================================================
// SYSTEM OPERATIONS
// =============================================================================

// Reboot reboots the remote system.
func Reboot() TaskBuilder {
	return TaskBuilder{Task{Action: "reboot", Name: "Reboot"}}
}

// Shutdown shuts down the remote system.
func Shutdown() TaskBuilder {
	return TaskBuilder{Task{Action: "shutdown", Name: "Shutdown"}}
}

// Hostname sets the system hostname.
func Hostname(name string) TaskBuilder {
	return TaskBuilder{Task{Action: "hostname", Dest: name, Name: "Set hostname"}}
}

// Sysctl sets a kernel parameter.
func Sysctl(key, value string) TaskBuilder {
	return TaskBuilder{Task{Action: "sysctl", Src: key, Dest: value, Name: "Sysctl " + key}}
}
