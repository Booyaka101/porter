package porter

// =============================================================================
// BACKUP/RESTORE
// =============================================================================

// Backup creates a timestamped backup of a file or directory.
func Backup(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "backup", Dest: path, Name: "Backup " + path}}
}

// Restore restores a file or directory from a backup.
func Restore(path string) TaskBuilder {
	return TaskBuilder{Task{Action: "restore", Dest: path, Name: "Restore " + path}}
}
