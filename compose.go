package porter

// =============================================================================
// DOCKER COMPOSE
// =============================================================================

// ComposeBuilder provides a fluent API for Docker Compose operations.
type ComposeBuilder struct{ t Task }

// Compose creates a compose builder for the specified compose file path.
func Compose(path string) ComposeBuilder {
	return ComposeBuilder{Task{Action: "compose", Dest: path}}
}

// Up creates and starts containers.
func (c ComposeBuilder) Up() TaskBuilder {
	c.t.State = "up"
	c.t.Name = "Compose up"
	return TaskBuilder(c)
}

// Down stops and removes containers.
func (c ComposeBuilder) Down() TaskBuilder {
	c.t.State = "down"
	c.t.Name = "Compose down"
	return TaskBuilder(c)
}

// Pull pulls service images.
func (c ComposeBuilder) Pull() TaskBuilder {
	c.t.State = "pull"
	c.t.Name = "Compose pull"
	return TaskBuilder(c)
}

// Build builds service images.
func (c ComposeBuilder) Build() TaskBuilder {
	c.t.State = "build"
	c.t.Name = "Compose build"
	return TaskBuilder(c)
}

// Start starts existing containers.
func (c ComposeBuilder) Start() TaskBuilder {
	c.t.State = "start"
	c.t.Name = "Compose start"
	return TaskBuilder(c)
}

// Stop stops running containers.
func (c ComposeBuilder) Stop() TaskBuilder {
	c.t.State = "stop"
	c.t.Name = "Compose stop"
	return TaskBuilder(c)
}

// Restart restarts containers.
func (c ComposeBuilder) Restart() TaskBuilder {
	c.t.State = "restart"
	c.t.Name = "Compose restart"
	return TaskBuilder(c)
}

// Logs retrieves container logs.
func (c ComposeBuilder) Logs() TaskBuilder {
	c.t.State = "logs"
	c.t.Name = "Compose logs"
	return TaskBuilder(c)
}

// Ps lists containers.
func (c ComposeBuilder) Ps() TaskBuilder {
	c.t.State = "ps"
	c.t.Name = "Compose ps"
	return TaskBuilder(c)
}

// Kill sends SIGKILL to containers.
func (c ComposeBuilder) Kill() TaskBuilder {
	c.t.State = "kill"
	c.t.Name = "Compose kill"
	return TaskBuilder(c)
}

// Rm removes stopped containers.
func (c ComposeBuilder) Rm() TaskBuilder {
	c.t.State = "rm"
	c.t.Name = "Compose rm"
	return TaskBuilder(c)
}

// Top displays running processes.
func (c ComposeBuilder) Top() TaskBuilder {
	c.t.State = "top"
	c.t.Name = "Compose top"
	return TaskBuilder(c)
}

// Pause pauses containers.
func (c ComposeBuilder) Pause() TaskBuilder {
	c.t.State = "pause"
	c.t.Name = "Compose pause"
	return TaskBuilder(c)
}

// Unpause unpauses containers.
func (c ComposeBuilder) Unpause() TaskBuilder {
	c.t.State = "unpause"
	c.t.Name = "Compose unpause"
	return TaskBuilder(c)
}

// Exec executes a command in a running service container.
func (c ComposeBuilder) Exec(service, cmd string) TaskBuilder {
	c.t.State = "exec"
	c.t.Src = service
	c.t.Body = cmd
	c.t.Name = "Compose exec " + service
	return TaskBuilder(c)
}

// Run runs a one-off command in a service container.
func (c ComposeBuilder) Run(service, cmd string) TaskBuilder {
	c.t.State = "run"
	c.t.Src = service
	c.t.Body = cmd
	c.t.Name = "Compose run " + service
	return TaskBuilder(c)
}

// Cp copies files between container and host.
func (c ComposeBuilder) Cp(src, dest string) TaskBuilder {
	c.t.State = "cp"
	c.t.Src = src
	c.t.Body = dest
	c.t.Name = "Compose cp"
	return TaskBuilder(c)
}

// =============================================================================
// COMPOSE OPTIONS
// =============================================================================

// Service targets a specific service.
func (b TaskBuilder) Service(s string) TaskBuilder { return b.appendOpt("service", s) }

// WithBuild builds images before starting containers.
func (b TaskBuilder) WithBuild() TaskBuilder { return b.appendOpt("build", "true") }

// RemoveOrphans removes containers for services not defined in the compose file.
func (b TaskBuilder) RemoveOrphans() TaskBuilder { return b.appendOpt("orphans", "true") }

// RemoveVolumes removes volumes when stopping containers.
func (b TaskBuilder) RemoveVolumes() TaskBuilder { return b.appendOpt("volumes", "true") }
