// Example: Conditional deployment using Porter
//
// This example demonstrates how to use conditions, loops, and variable
// expansion in Porter deployments.
//
// Usage:
//
//	go run main.go -host 192.168.1.100 -user admin -pass secret -env prod
package main

import (
	"flag"
	"log"
	"os"

	"github.com/booyaka101/porter"
)

func main() {
	host := flag.String("host", "", "Remote host IP address")
	user := flag.String("user", "", "SSH username")
	pass := flag.String("pass", "", "SSH password")
	env := flag.String("env", "dev", "Environment (dev/staging/prod)")
	enableMonitoring := flag.Bool("monitoring", false, "Enable monitoring agent")
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

	// Set variables based on flags
	vars := porter.NewVars()
	vars.Set("env", *env)
	vars.SetBool("monitoring", *enableMonitoring)
	vars.SetBool("is_prod", *env == "prod")

	// Define tasks with conditions
	tasks := porter.Tasks(
		// Always run: create directories
		porter.Mkdir("/home/app/{{env}}"),

		// Conditional: only in production
		porter.Write("/home/app/{{env}}/prod.conf", "PRODUCTION=true").
			When(porter.If("is_prod")).
			Name("Write production config"),

		// Conditional: only if monitoring enabled
		porter.Svc("monitoring-agent").Start().
			When(porter.If("monitoring")).
			Name("Start monitoring agent"),

		// Loop: restart multiple services
		porter.Run("systemctl restart {{item}}").
			Loop("app", "worker", "scheduler").
			Name("Restart {{item}} service").
			Ignore(),

		// Combined conditions: prod AND monitoring
		porter.Run("curl -X POST http://alerts.example.com/deploy").
			When(porter.And(porter.If("is_prod"), porter.If("monitoring"))).
			Name("Notify alerting system").
			Ignore(),

		// Capture output to variable
		porter.Capture("hostname").Register("server_hostname"),

		// Use captured variable
		porter.Run("echo 'Deployed to {{server_hostname}}'").
			Name("Log deployment"),
	)

	executor := porter.NewExecutor(client, *pass)
	stats, err := executor.Run("Conditional Deploy", tasks, vars)
	if err != nil {
		log.Fatalf("Deployment failed: %v", err)
	}

	log.Printf("Deployment complete: OK=%d Changed=%d Skipped=%d Failed=%d",
		stats.OK, stats.Changed, stats.Skipped, stats.Failed)
}
