package porter

import "time"

// Task represents a single deployment action.
type Task struct {
	Name     string        // Display name for the task
	Action   string        // Action type (e.g., "upload", "run", "service")
	Src      string        // Source path or value
	Dest     string        // Destination path or target
	Body     string        // Command body or content
	State    string        // State for services/containers (start, stop, etc.)
	User     bool          // Use user-level systemd
	Sudo     bool          // Run with sudo
	Rec      bool          // Recursive flag
	When     When          // Condition for execution
	Loop     []string      // Items to loop over
	Ignore   bool          // Ignore errors
	Retry    int           // Retry count on failure
	Delay    time.Duration // Delay between retries
	Timeout  time.Duration // Timeout for wait operations
	Register string        // Variable name to store output
	Creates  string        // Skip if this path exists
}

// Stats holds execution statistics.
type Stats struct {
	Total, OK, Changed, Skipped, Failed int
}

// TaskStatus represents the current status of a task.
type TaskStatus string

const (
	StatusPending  TaskStatus = "pending"
	StatusRunning  TaskStatus = "running"
	StatusOK       TaskStatus = "ok"
	StatusChanged  TaskStatus = "changed"
	StatusSkipped  TaskStatus = "skipped"
	StatusFailed   TaskStatus = "failed"
	StatusRetrying TaskStatus = "retrying"
)

// TaskProgress represents the progress of a single task.
type TaskProgress struct {
	Index      int           // 0-based task index
	Total      int           // Total number of tasks
	Name       string        // Task name (expanded)
	Action     string        // Task action type
	Status     TaskStatus    // Current status
	Attempt    int           // Current attempt (1-based, for retries)
	MaxAttempt int           // Max attempts (1 + Retry count)
	Error      error         // Error if failed
	Duration   time.Duration // Time taken (set on completion)
	StartTime  time.Time     // When task started
}

// ProgressFunc is called for each task state change.
type ProgressFunc func(TaskProgress)

// WorkflowProgress represents overall workflow progress.
type WorkflowProgress struct {
	Name      string        // Workflow name
	Total     int           // Total tasks
	Completed int           // Completed tasks (ok + changed + skipped + failed)
	OK        int           // Successful tasks
	Changed   int           // Changed tasks
	Skipped   int           // Skipped tasks
	Failed    int           // Failed tasks
	Current   *TaskProgress // Current task (nil if not running)
	Percent   float64       // Completion percentage
	Elapsed   time.Duration // Total elapsed time
	StartTime time.Time     // When workflow started
}

// ProgressBar returns a simple text progress bar for the task
func (p TaskProgress) ProgressBar(width int) string {
	if width <= 0 {
		width = 40
	}
	pct := float64(p.Index+1) / float64(p.Total)
	filled := int(pct * float64(width))
	if filled > width {
		filled = width
	}
	bar := ""
	for i := 0; i < filled; i++ {
		bar += "█"
	}
	for i := filled; i < width; i++ {
		bar += "░"
	}
	return bar
}

// String returns a formatted string representation of the progress
func (p TaskProgress) String() string {
	status := string(p.Status)
	retry := ""
	if p.MaxAttempt > 1 {
		retry = " (attempt " + itoa(p.Attempt) + "/" + itoa(p.MaxAttempt) + ")"
	}
	dur := ""
	if p.Duration > 0 {
		dur = " [" + p.Duration.Round(time.Millisecond).String() + "]"
	}
	return "[" + itoa(p.Index+1) + "/" + itoa(p.Total) + "] " + p.Name + " - " + status + retry + dur
}

func itoa(i int) string {
	if i < 0 {
		return "-" + itoa(-i)
	}
	if i < 10 {
		return string(rune('0' + i))
	}
	return itoa(i/10) + string(rune('0'+i%10))
}
