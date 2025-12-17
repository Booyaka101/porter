package porter

import "time"

// =============================================================================
// TASK BUILDER - Fluent API for constructing tasks
// =============================================================================

// TaskBuilder provides a fluent API for building tasks.
// All DSL functions return a TaskBuilder that can be chained with modifiers.
type TaskBuilder struct{ t Task }

// Build returns the underlying Task.
func (b TaskBuilder) Build() Task { return b.t }

// =============================================================================
// TASK METADATA
// =============================================================================

// Name sets a custom display name for the task.
func (b TaskBuilder) Name(n string) TaskBuilder { b.t.Name = n; return b }

// Register stores the task output in a variable for later use.
func (b TaskBuilder) Register(varName string) TaskBuilder { b.t.Register = varName; return b }

// =============================================================================
// EXECUTION CONTROL
// =============================================================================

// When sets a condition that must be true for the task to execute.
func (b TaskBuilder) When(w When) TaskBuilder { b.t.When = w; return b }

// Loop executes the task once for each item in the list.
// Use {{item}} in task fields to reference the current item.
func (b TaskBuilder) Loop(items ...string) TaskBuilder { b.t.Loop = items; return b }

// Ignore continues execution even if this task fails.
func (b TaskBuilder) Ignore() TaskBuilder { b.t.Ignore = true; return b }

// Creates skips the task if the specified path already exists.
func (b TaskBuilder) Creates(path string) TaskBuilder { b.t.Creates = path; return b }

// =============================================================================
// PRIVILEGE ESCALATION
// =============================================================================

// User runs the task in user-level systemd context.
func (b TaskBuilder) User() TaskBuilder { b.t.User = true; return b }

// Sudo runs the task with elevated privileges.
func (b TaskBuilder) Sudo() TaskBuilder { b.t.Sudo = true; return b }

// =============================================================================
// FILE MODIFIERS
// =============================================================================

// Recursive enables recursive operation for file commands.
func (b TaskBuilder) Recursive() TaskBuilder { b.t.Rec = true; return b }

// Owner sets the owner for file operations (used with Chown).
func (b TaskBuilder) Owner(o string) TaskBuilder { b.t.Body = o; return b }

// Mode sets the file mode/permissions (used with Chmod).
func (b TaskBuilder) Mode(m string) TaskBuilder { b.t.Body = m; return b }

// =============================================================================
// RETRY AND TIMEOUT
// =============================================================================

// Retry sets the number of retry attempts on failure.
func (b TaskBuilder) Retry(count int) TaskBuilder { b.t.Retry = count; return b }

// RetryDelay sets the delay between retry attempts.
func (b TaskBuilder) RetryDelay(d string) TaskBuilder {
	if dur, err := time.ParseDuration(d); err == nil {
		b.t.Delay = dur
	}
	return b
}

// Timeout sets the maximum duration for wait operations.
func (b TaskBuilder) Timeout(d string) TaskBuilder {
	if dur, err := time.ParseDuration(d); err == nil {
		b.t.Timeout = dur
	}
	return b
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

// appendOpt appends a key:value option to the Body field.
// Used internally by builders that need to pass multiple options.
func (b TaskBuilder) appendOpt(key, val string) TaskBuilder {
	if b.t.Body == "" {
		b.t.Body = key + ":" + val
	} else {
		b.t.Body += ";" + key + ":" + val
	}
	return b
}

// =============================================================================
// TASK COLLECTION
// =============================================================================

// Tasks converts multiple TaskBuilders into a slice of Tasks.
// This is the primary way to create task lists for execution.
//
// Example:
//
//	tasks := porter.Tasks(
//	    porter.Upload("app.tar.gz", "/tmp/app.tar.gz"),
//	    porter.Run("tar -xzf /tmp/app.tar.gz -C /opt"),
//	    porter.Svc("myapp").Restart(),
//	)
func Tasks(builders ...TaskBuilder) []Task {
	tasks := make([]Task, len(builders))
	for i, b := range builders {
		tasks[i] = b.Build()
	}
	return tasks
}
