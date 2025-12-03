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
