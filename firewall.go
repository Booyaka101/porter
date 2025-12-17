package porter

// =============================================================================
// FIREWALL (UFW)
// =============================================================================

// UfwAllow allows traffic on the specified port.
func UfwAllow(port string) TaskBuilder {
	return TaskBuilder{Task{Action: "ufw_allow", Dest: port, Name: "UFW allow " + port}}
}

// UfwDeny denies traffic on the specified port.
func UfwDeny(port string) TaskBuilder {
	return TaskBuilder{Task{Action: "ufw_deny", Dest: port, Name: "UFW deny " + port}}
}

// UfwEnable enables the firewall.
func UfwEnable() TaskBuilder {
	return TaskBuilder{Task{Action: "ufw_enable", Name: "UFW enable"}}
}

// UfwDisable disables the firewall.
func UfwDisable() TaskBuilder {
	return TaskBuilder{Task{Action: "ufw_disable", Name: "UFW disable"}}
}
