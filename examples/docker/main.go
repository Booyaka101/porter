// Example: Docker deployment using Porter
//
// This example demonstrates how to use Porter to manage Docker containers
// and Docker Compose on a remote server.
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
	host := flag.String("host", "", "Remote host IP address")
	user := flag.String("user", "", "SSH username")
	pass := flag.String("pass", "", "SSH password")
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

	// Docker container management
	containerTasks := porter.Tasks(
		// Pull latest image
		porter.DockerPull("nginx:latest"),

		// Stop and remove existing container
		porter.Docker("web").Stop().Ignore(),
		porter.Docker("web").Remove().Ignore(),

		// Run new container with port mapping
		porter.Docker("web").Run("nginx:latest").
			Ports("80:80,443:443").
			Volumes("/data/nginx:/etc/nginx").
			Env("NGINX_HOST=example.com"),

		// Wait for container to be healthy
		porter.WaitForPort("127.0.0.1", "80").Timeout("30s"),
	)

	vars := porter.NewVars()
	executor := porter.NewExecutor(client, *pass)

	stats, err := executor.Run("Deploy Docker Container", containerTasks, vars)
	if err != nil {
		log.Fatalf("Container deployment failed: %v", err)
	}
	log.Printf("Container deployment: %d OK, %d Changed", stats.OK, stats.Changed)

	// Docker Compose example
	composeTasks := porter.Tasks(
		// Upload compose file
		porter.Upload("./docker-compose.yml", "/home/app/docker-compose.yml"),

		// Pull images and start services
		porter.Compose("/home/app/docker-compose.yml").Pull(),
		porter.Compose("/home/app/docker-compose.yml").Up().WithBuild(),

		// Check status
		porter.Compose("/home/app/docker-compose.yml").Ps(),
	)

	stats, err = executor.Run("Deploy Docker Compose", composeTasks, vars)
	if err != nil {
		log.Fatalf("Compose deployment failed: %v", err)
	}
	log.Printf("Compose deployment: %d OK, %d Changed", stats.OK, stats.Changed)
}
