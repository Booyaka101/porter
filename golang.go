package porter

// =============================================================================
// GO BUILD OPERATIONS
// =============================================================================

// GoBuilder provides a fluent API for Go build operations.
type GoBuilder struct{ t Task }

// Go creates a Go build task builder.
func Go(path string) GoBuilder {
	return GoBuilder{Task{Action: "go", Dest: path}}
}

// Build compiles the Go package.
func (g GoBuilder) Build(output string) TaskBuilder {
	g.t.State = "build"
	g.t.Src = output
	g.t.Name = "Go build"
	return TaskBuilder(g)
}

// Test runs Go tests.
func (g GoBuilder) Test() TaskBuilder {
	g.t.State = "test"
	g.t.Name = "Go test"
	return TaskBuilder(g)
}

// ModDownload downloads Go module dependencies.
func (g GoBuilder) ModDownload() TaskBuilder {
	g.t.State = "mod_download"
	g.t.Name = "Go mod download"
	return TaskBuilder(g)
}

// Vet runs go vet on the package.
func (g GoBuilder) Vet() TaskBuilder {
	g.t.State = "vet"
	g.t.Name = "Go vet"
	return TaskBuilder(g)
}

// =============================================================================
// GO BUILD OPTIONS
// =============================================================================

// GOOS sets the target operating system.
func (b TaskBuilder) GOOS(os string) TaskBuilder { return b.appendOpt("goos", os) }

// GOARCH sets the target architecture.
func (b TaskBuilder) GOARCH(arch string) TaskBuilder { return b.appendOpt("goarch", arch) }

// LDFlags sets linker flags (e.g., "-s -w" for stripped binaries).
func (b TaskBuilder) LDFlags(flags string) TaskBuilder { return b.appendOpt("ldflags", flags) }

// Tags sets build tags.
func (b TaskBuilder) Tags(tags string) TaskBuilder { return b.appendOpt("tags", tags) }

// Race enables race detector.
func (b TaskBuilder) Race() TaskBuilder { return b.appendOpt("race", "true") }

// Verbose enables verbose output.
func (b TaskBuilder) Verbose() TaskBuilder { return b.appendOpt("verbose", "true") }

// Parallel sets the number of parallel test jobs.
func (b TaskBuilder) Parallel(n int) TaskBuilder { return b.appendOpt("parallel", itoa(n)) }

// Failfast stops tests on first failure.
func (b TaskBuilder) Failfast() TaskBuilder { return b.appendOpt("failfast", "true") }
