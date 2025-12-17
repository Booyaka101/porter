package porter

// =============================================================================
// NETWORK OPERATIONS
// =============================================================================

// Curl downloads a file using curl.
func Curl(url, output string) TaskBuilder {
	return TaskBuilder{Task{Action: "curl", Src: url, Dest: output, Name: "Curl " + url}}
}

// Wget downloads a file using wget.
func Wget(url, output string) TaskBuilder {
	return TaskBuilder{Task{Action: "wget", Src: url, Dest: output, Name: "Wget " + url}}
}

// Ping tests network connectivity to a host.
func Ping(host string) TaskBuilder {
	return TaskBuilder{Task{Action: "ping", Dest: host, Name: "Ping " + host}}
}
