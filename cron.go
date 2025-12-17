package porter

// =============================================================================
// CRON OPERATIONS
// =============================================================================

// CronAdd adds a cron job with the specified schedule and command.
// Example: CronAdd("0 * * * *", "/usr/bin/backup.sh")
func CronAdd(schedule, command string) TaskBuilder {
	return TaskBuilder{Task{Action: "cron_add", Body: schedule + " " + command, Name: "Add cron"}}
}

// CronRemove removes cron jobs matching the pattern.
func CronRemove(pattern string) TaskBuilder {
	return TaskBuilder{Task{Action: "cron_remove", Body: pattern, Name: "Remove cron"}}
}
