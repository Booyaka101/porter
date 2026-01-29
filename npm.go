package porter

// =============================================================================
// NPM/NODE.JS OPERATIONS
// =============================================================================

// NpmBuilder provides a fluent API for npm operations.
type NpmBuilder struct{ t Task }

// Npm creates an npm task builder for the specified directory.
func Npm(path string) NpmBuilder {
	return NpmBuilder{Task{Action: "npm", Dest: path}}
}

// Install runs npm install.
func (n NpmBuilder) Install() TaskBuilder {
	n.t.State = "install"
	n.t.Name = "npm install"
	return TaskBuilder(n)
}

// CI runs npm ci (clean install from lockfile).
func (n NpmBuilder) CI() TaskBuilder {
	n.t.State = "ci"
	n.t.Name = "npm ci"
	return TaskBuilder(n)
}

// Build runs npm run build.
func (n NpmBuilder) Build() TaskBuilder {
	n.t.State = "build"
	n.t.Name = "npm run build"
	return TaskBuilder(n)
}

// RunScript runs a custom npm script.
func (n NpmBuilder) RunScript(script string) TaskBuilder {
	n.t.State = "run"
	n.t.Body = script
	n.t.Name = "npm run " + script
	return TaskBuilder(n)
}

// Test runs npm test.
func (n NpmBuilder) Test() TaskBuilder {
	n.t.State = "test"
	n.t.Name = "npm test"
	return TaskBuilder(n)
}

// =============================================================================
// NPM OPTIONS
// =============================================================================

// Silent suppresses npm output.
func (b TaskBuilder) Silent() TaskBuilder { return b.appendOpt("silent", "true") }

// Production installs only production dependencies.
func (b TaskBuilder) Production() TaskBuilder { return b.appendOpt("production", "true") }

// LegacyPeerDeps uses legacy peer dependency resolution.
func (b TaskBuilder) LegacyPeerDeps() TaskBuilder { return b.appendOpt("legacy-peer-deps", "true") }
