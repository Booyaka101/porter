package porter

// =============================================================================
// WIBU LICENSE (CMU) OPERATIONS
// =============================================================================

// WibuGenerate generates a license request file using cmu.
// container: CodeMeter container number (e.g., "6000930")
// output: output file path for the .WibuCmRaC file
func WibuGenerate(container, output string) TaskBuilder {
	return TaskBuilder{Task{Action: "wibu_generate", Src: container, Dest: output, Name: "Generate Wibu license request"}}
}

// WibuApply applies a license update file using cmu.
// input: path to the .WibuCmRaU file
func WibuApply(input string) TaskBuilder {
	return TaskBuilder{Task{Action: "wibu_apply", Src: input, Name: "Apply Wibu license update"}}
}

// WibuInfo gets license info from CodeMeter.
func WibuInfo() TaskBuilder {
	return TaskBuilder{Task{Action: "wibu_info", Name: "Get Wibu license info"}}
}

// WibuList lists all CodeMeter containers.
func WibuList() TaskBuilder {
	return TaskBuilder{Task{Action: "wibu_list", Name: "List Wibu containers"}}
}
