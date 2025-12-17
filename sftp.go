package porter

// =============================================================================
// SFTP OPERATIONS (for binary/special file handling)
// =============================================================================

// Download downloads a remote file to a local variable (for binary data).
// Use .Register("varname") to store the file contents.
func Download(remotePath string) TaskBuilder {
	return TaskBuilder{Task{Action: "download", Src: remotePath, Name: "Download " + remotePath}}
}

// UploadBytes uploads binary data from a variable to remote path.
// varName: the variable containing the data (set via vars.SetBytes)
func UploadBytes(varName, remotePath string) TaskBuilder {
	return TaskBuilder{Task{Action: "upload_bytes", Src: varName, Dest: remotePath, Name: "Upload bytes to " + remotePath}}
}

// ReadFile reads a remote file content into a variable.
func ReadFile(remotePath string) TaskBuilder {
	return TaskBuilder{Task{Action: "read_file", Src: remotePath, Name: "Read " + remotePath}}
}

// WriteBytes writes raw bytes to a remote file (from Body).
func WriteBytes(remotePath string) TaskBuilder {
	return TaskBuilder{Task{Action: "write_bytes", Dest: remotePath, Name: "Write bytes to " + remotePath}}
}
