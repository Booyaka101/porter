package porter

// =============================================================================
// FILE OPERATIONS
// =============================================================================

// Upload transfers a local file to the remote server.
func Upload(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "upload", Src: src, Dest: dest, Name: "Upload " + src}}
}

// Copy copies a file on the remote server.
func Copy(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "copy", Src: src, Dest: dest, Name: "Copy " + src}}
}

// Move moves/renames a file on the remote server.
func Move(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "move", Src: src, Dest: dest, Name: "Move " + src}}
}

// Write creates a file with the specified content.
func Write(dest, content string) TaskBuilder {
	return TaskBuilder{Task{Action: "write", Dest: dest, Body: content, Name: "Write " + dest}}
}

// Mkdir creates a directory (use .Recursive() for nested directories).
func Mkdir(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "mkdir", Dest: path, Name: "Mkdir " + path}}
}

// Chown changes file ownership (use .Owner("user:group")).
func Chown(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "chown", Dest: path, Name: "Chown " + path}}
}

// Chmod changes file permissions (use .Mode("755")).
func Chmod(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "chmod", Dest: path, Name: "Chmod " + path}}
}

// Rm removes a file or directory (use .Recursive() for directories).
func Rm(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "rm", Dest: path, Name: "Remove " + path}}
}

// Touch creates an empty file or updates timestamps.
func Touch(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "touch", Dest: path, Name: "Touch " + path}}
}

// Symlink creates a symbolic link from src to dest.
func Symlink(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "symlink", Src: src, Dest: dest, Name: "Link " + src}}
}

// Install copies a file and sets permissions atomically.
func Install(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "install", Src: src, Dest: dest, Name: "Install " + dest}}
}

// Sed performs in-place text substitution using sed patterns.
func Sed(pattern, file string) TaskBuilder {
	return TaskBuilder{Task{Action: "sed", Body: pattern, Dest: file, Name: "Sed " + file}}
}

// Cat reads and outputs file contents.
func Cat(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "cat", Dest: path, Name: "Cat " + path}}
}

// Template creates a file from a template with variable expansion.
func Template(name, content string) TaskBuilder {
	return TaskBuilder{Task{Action: "template", Dest: name, Body: content, Name: "Template " + name}}
}
