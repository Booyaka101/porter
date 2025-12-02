// Example: Basic deployment using Porter
//
// This example demonstrates how to use Porter to deploy an application
// to a remote server via SSH.
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

	// Define deployment tasks
	tasks := porter.Tasks(
		// Create directory
		porter.Mkdir("/home/app/bin"),

		// Upload application binary
		porter.Upload("./myapp", "/home/app/bin/myapp").Retry(2),

		// Make executable
		porter.Chmod("/home/app/bin/myapp").Mode("755"),

		// Write configuration file
		porter.Write("/home/app/config.env", "PORT={{port}}\nENV={{env}}"),

		// Restart service
		porter.Svc("myapp").Restart().Ignore(),

		// Wait for application to be ready
		porter.WaitForPort("127.0.0.1", "{{port}}").Timeout("30s"),
	)

	// Set variables
	vars := porter.NewVars()
	vars.Set("port", "8080")
	vars.Set("env", "production")

	// Execute deployment
	executor := porter.NewExecutor(client, *pass)
	stats, err := executor.Run("Deploy MyApp", tasks, vars)
	if err != nil {
		log.Fatalf("Deployment failed: %v", err)
	}

	log.Printf("Deployment complete: %d OK, %d Changed, %d Failed", stats.OK, stats.Changed, stats.Failed)
}
