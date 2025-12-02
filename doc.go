// Package porter provides a declarative deployment system for Go.
//
// Porter "carries" files and commands to remote servers over SSH,
// using a fluent DSL for defining deployment tasks.
//
// # Quick Start
//
//	client, err := porter.Connect("192.168.1.100", porter.DefaultConfig("user", "pass"))
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer client.Close()
//
//	tasks := porter.Tasks(
//	    porter.Upload("./app", "/home/app/bin"),
//	    porter.Chmod("/home/app/bin").Mode("755"),
//	    porter.Svc("app").Restart(),
//	)
//
//	executor := porter.NewExecutor(client, "pass")
//	stats, err := executor.Run("Deploy", tasks, porter.NewVars())
//
// # Features
//
//   - Declarative DSL for defining deployment tasks
//   - SSH/SFTP file transfers and command execution
//   - Retry logic with configurable delays
//   - Conditional task execution
//   - Loop support for iterating over items
//   - Health checks (port, HTTP, file)
//   - Systemd service management
//   - Docker and Docker Compose support
//   - Variable expansion in commands and files
package porter
