package porter

// =============================================================================
// ARCHIVE OPERATIONS
// =============================================================================

// Tar creates a tar archive.
func Tar(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "tar_create", Src: src, Dest: dest, Name: "Tar " + src}}
}

// Untar extracts a tar archive.
func Untar(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "tar_extract", Src: src, Dest: dest, Name: "Untar " + src}}
}

// TarGz creates a gzip-compressed tar archive.
func TarGz(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "targz_create", Src: src, Dest: dest, Name: "TarGz " + src}}
}

// UntarGz extracts a gzip-compressed tar archive.
func UntarGz(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "targz_extract", Src: src, Dest: dest, Name: "UntarGz " + src}}
}

// Zip creates a zip archive.
func Zip(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "zip_create", Src: src, Dest: dest, Name: "Zip " + src}}
}

// Unzip extracts a zip archive.
func Unzip(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "zip_extract", Src: src, Dest: dest, Name: "Unzip " + src}}
}
