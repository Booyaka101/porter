package porter

// =============================================================================
// DOCKER IMAGES
// =============================================================================

// DockerPull pulls an image from a registry.
func DockerPull(image string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_pull", Dest: image, Name: "Pull " + image}}
}

// DockerBuild builds an image from a Dockerfile.
func DockerBuild(path, tag string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_build", Src: path, Dest: tag, Name: "Build " + tag}}
}

// DockerSave saves an image to a tar archive.
func DockerSave(image, tarFile string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_save", Src: image, Dest: tarFile, Name: "Save " + image}}
}

// DockerLoad loads an image from a tar archive.
func DockerLoad(tarFile string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_load", Src: tarFile, Name: "Load " + tarFile}}
}

// DockerExport exports a container's filesystem to a tar archive.
func DockerExport(container, tarFile string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_export", Src: container, Dest: tarFile, Name: "Export " + container}}
}

// DockerImport imports a tar archive as a new image.
func DockerImport(tarFile, image string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_import", Src: tarFile, Dest: image, Name: "Import " + tarFile}}
}

// DockerTag tags an image with a new name.
func DockerTag(src, dest string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_tag", Src: src, Dest: dest, Name: "Tag " + src}}
}

// DockerPush pushes an image to a registry.
func DockerPush(image string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_push", Dest: image, Name: "Push " + image}}
}

// DockerRmi removes an image.
func DockerRmi(image string) TaskBuilder {
	return TaskBuilder{Task{Action: "docker_rmi", Dest: image, Name: "Rmi " + image}}
}

// DockerPrune removes unused Docker resources.
func DockerPrune() TaskBuilder {
	return TaskBuilder{Task{Action: "docker_prune", Name: "Docker prune"}}
}

// =============================================================================
// DOCKER CONTAINERS
// =============================================================================

// DockerBuilder provides a fluent API for Docker container operations.
type DockerBuilder struct{ t Task }

// Docker creates a container builder for the named container.
func Docker(container string) DockerBuilder {
	return DockerBuilder{Task{Action: "docker", Dest: container}}
}

// Run creates and starts a new container from an image.
func (d DockerBuilder) Run(image string) TaskBuilder {
	d.t.State = "run"
	d.t.Src = image
	d.t.Name = "Run " + d.t.Dest
	return TaskBuilder(d)
}

// Start starts an existing container.
func (d DockerBuilder) Start() TaskBuilder {
	d.t.State = "start"
	d.t.Name = "Start " + d.t.Dest
	return TaskBuilder(d)
}

// Stop stops a running container.
func (d DockerBuilder) Stop() TaskBuilder {
	d.t.State = "stop"
	d.t.Name = "Stop " + d.t.Dest
	return TaskBuilder(d)
}

// Restart restarts a container.
func (d DockerBuilder) Restart() TaskBuilder {
	d.t.State = "restart"
	d.t.Name = "Restart " + d.t.Dest
	return TaskBuilder(d)
}

// Remove removes a container.
func (d DockerBuilder) Remove() TaskBuilder {
	d.t.State = "rm"
	d.t.Name = "Remove " + d.t.Dest
	return TaskBuilder(d)
}

// Logs retrieves container logs.
func (d DockerBuilder) Logs() TaskBuilder {
	d.t.State = "logs"
	d.t.Name = "Logs " + d.t.Dest
	return TaskBuilder(d)
}

// Exec executes a command in a running container.
func (d DockerBuilder) Exec(cmd string) TaskBuilder {
	d.t.State = "exec"
	d.t.Body = cmd
	d.t.Name = "Exec " + d.t.Dest
	return TaskBuilder(d)
}

// =============================================================================
// DOCKER RUN OPTIONS
// =============================================================================

// Ports maps container ports to host ports (e.g., "8080:80").
func (b TaskBuilder) Ports(p string) TaskBuilder { return b.appendOpt("ports", p) }

// Volumes mounts volumes (e.g., "/host/path:/container/path").
func (b TaskBuilder) Volumes(v string) TaskBuilder { return b.appendOpt("volumes", v) }

// Env sets environment variables (e.g., "KEY=value").
func (b TaskBuilder) Env(e string) TaskBuilder { return b.appendOpt("env", e) }

// Network connects the container to a network.
func (b TaskBuilder) Network(n string) TaskBuilder { return b.appendOpt("network", n) }

// Detach runs the container in the background.
func (b TaskBuilder) Detach() TaskBuilder { return b.appendOpt("detach", "true") }
