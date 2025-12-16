// Example: Systemd service file management using Porter
//
// This example demonstrates how to use Porter's systemd service file
// management helpers for idempotent service deployments.
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

// Service file template with configurable parameters
const appServiceTemplate = `[Unit]
Description=MyApp Service
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/home/app
ExecStart=/home/app/bin/myapp -port=8080 -host=0.0.0.0 -mode=production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`

func main() {
	host := flag.String("host", "", "Remote host IP address")
	user := flag.String("user", "", "SSH username")
	pass := flag.String("pass", "", "SSH password")
	port := flag.String("port", "8080", "Application port")
	mode := flag.String("mode", "production", "Application mode")
	flag.Parse()

	if *host == "" || *user == "" || *pass == "" {
		flag.Usage()
		os.Exit(1)
	}

	client, err := porter.Connect(*host, porter.DefaultConfig(*user, *pass))
	if err != nil {
		log.Fatalf("Connection failed: %v", err)
	}
	defer client.Close()

	vars := porter.NewVars()

	// Example 1: Simple parameter update using UpdateServiceParamTask
	// This updates a single parameter while preserving quote style
	simpleTasks := porter.Tasks(
		porter.UpdateServiceParamTask("/etc/systemd/system/myapp.service", "port", *port).Sudo(),
	)

	// Example 2: Full service file management with ManageServiceFile
	// This creates the service file if missing, or updates parameters if it exists
	managedTasks := porter.ManageServiceFile(porter.ServiceFileConfig{
		Name:     "myapp",
		Template: appServiceTemplate,
		IsUser:   false, // System service (/etc/systemd/system/)
		Params: map[string]string{
			"port": *port,
			"mode": *mode,
		},
	})

	// Example 3: With automatic reload and restart
	fullTasks := porter.ManageServiceFileWithReload(porter.ServiceFileConfig{
		Name:     "myapp",
		Template: appServiceTemplate,
		IsUser:   false,
		Params: map[string]string{
			"port": *port,
			"host": "0.0.0.0",
			"mode": *mode,
		},
	})

	// Example 4: User service (runs as current user)
	userServiceTasks := porter.ManageServiceFile(porter.ServiceFileConfig{
		Name:     "myapp-user",
		Template: appServiceTemplate,
		IsUser:   true, // User service (~/.config/systemd/user/)
		Params: map[string]string{
			"port": *port,
		},
	})

	// Choose which example to run
	executor := porter.NewExecutor(client, *pass)

	log.Println("Running Example 2: ManageServiceFile")
	stats, err := executor.Run("Manage Service File", managedTasks, vars)
	if err != nil {
		log.Fatalf("Failed: %v", err)
	}
	log.Printf("Complete: OK=%d Changed=%d Skipped=%d Failed=%d",
		stats.OK, stats.Changed, stats.Skipped, stats.Failed)

	// Suppress unused variable warnings
	_ = simpleTasks
	_ = fullTasks
	_ = userServiceTasks
}
