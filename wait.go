package porter

// =============================================================================
// WAIT/HEALTH CHECKS
// =============================================================================

// WaitForPort waits until a TCP port is accepting connections.
func WaitForPort(host, port string) TaskBuilder {
	return TaskBuilder{Task{Action: "wait_port", Dest: host, Body: port, Name: "Wait for " + host + ":" + port}}
}

// WaitForHttp waits until an HTTP endpoint returns a successful response.
func WaitForHttp(url string) TaskBuilder {
	return TaskBuilder{Task{Action: "wait_http", Dest: url, State: "200", Name: "Wait for " + url}}
}

// WaitForFile waits until a file exists.
func WaitForFile(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "wait_file", Dest: path, Name: "Wait for " + path}}
}

// ExpectCode sets the expected HTTP status code for WaitForHttp.
func (b TaskBuilder) ExpectCode(code string) TaskBuilder { b.t.State = code; return b }
