// Example: Rsync operations using Porter
//
// This example demonstrates how to use Porter's rsync functionality
// to synchronize files between local and remote servers.
//
// Usage:
//
//	go run main.go -host 192.168.1.100 -user admin -pass secret
package main

import (
	"flag"
	"log"
	"os"

	"github.com/booyaka101/porter"
)

func main() {
	// Parse command line flags
	host := flag.String("host", "", "Remote host IP address")
	user := flag.String("user", "", "SSH username")
	pass := flag.String("pass", "", "SSH password")
	flag.Parse()

	if *host == "" || *user == "" || *pass == "" {
		flag.Usage()
		os.Exit(1)
	}

	// Connect to remote server
	client, err := porter.Connect(*host, porter.DefaultConfig(*user, *pass))
	if err != nil {
		log.Fatalf("Connection failed: %v", err)
	}
	defer client.Close()

	// Create variables
	vars := porter.NewVars()
	vars.Set("app_dir", "/home/app")

	// Define rsync tasks
	tasks := porter.Tasks(
		// First, ensure rsync is installed on the remote system
		porter.RsyncCheck().Register("rsync_installed"),
		porter.RsyncInstall().When(porter.IfEquals("rsync_installed", "false")),

		// Get rsync version for logging
		porter.RsyncVersion().Register("rsync_version"),

		// Basic rsync - sync a directory
		porter.Rsync("./dist/", "{{app_dir}}/dist/").Build(),

		// Rsync with delete - remove files in dest that don't exist in src
		porter.Rsync("./config/", "{{app_dir}}/config/").
			Delete().
			Build(),

		// Rsync with exclusions
		porter.Rsync("./src/", "{{app_dir}}/src/").
			Exclude("*.log,*.tmp,.git").
			Delete().
			Build(),

		// Rsync with bandwidth limit (useful for large transfers)
		porter.Rsync("./assets/", "{{app_dir}}/assets/").
			BwLimit("1000"). // 1000 KB/s
			Progress().
			Build(),

		// Rsync with checksum verification (slower but more accurate)
		porter.Rsync("./data/", "{{app_dir}}/data/").
			Checksum().
			Partial(). // Keep partial files for resume
			Build(),

		// Rsync with custom flags
		porter.Rsync("./backup/", "{{app_dir}}/backup/").
			Flags("-rlptD"). // Custom flags without compression
			NoCompress().
			Build(),

		// Rsync with sudo (for system directories)
		porter.Rsync("./etc/", "/etc/myapp/").
			Sudo().
			Delete().
			Build(),

		// Dry run - preview what would be synced
		porter.Rsync("./test/", "{{app_dir}}/test/").
			DryRun().
			Name("Preview sync (dry run)").
			Build(),

		// Rsync with include patterns
		porter.Rsync("./mixed/", "{{app_dir}}/mixed/").
			Include("*.go,*.mod,*.sum").
			Exclude("*").
			Build(),
	)

	// Execute rsync tasks
	executor := porter.NewExecutor(client, *pass)
	stats, err := executor.Run("Rsync Operations", tasks, vars)
	if err != nil {
		log.Fatalf("Rsync failed: %v", err)
	}

	// Print rsync version that was used
	log.Printf("Rsync version: %s", vars.Get("rsync_version"))
	log.Printf("Rsync complete: %d OK, %d Changed, %d Failed", stats.OK, stats.Changed, stats.Failed)
}
