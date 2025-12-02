# Contributing to Porter

Thank you for your interest in contributing to Porter! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/porter.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

```bash
# Install dependencies
go mod download

# Run tests
go test -v ./...

# Run tests with coverage
go test -cover ./...
```

## Code Style

- Follow standard Go conventions and formatting
- Run `go fmt` before committing
- Run `go vet` to catch common issues
- Keep functions focused and well-documented
- Add tests for new functionality

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add tests for new features
4. Keep commits focused and atomic
5. Write clear commit messages

## Adding New Actions

When adding a new action to Porter:

1. Add the action handler in `porter.go` in the `exec()` switch statement
2. Add a DSL builder function in `dsl.go`
3. Add tests in `porter_test.go`
4. Update the README.md with documentation

Example structure for a new action:

```go
// In dsl.go
func MyNewAction(param string) TaskBuilder {
    return TaskBuilder{Task{Action: "my_action", Dest: param, Name: "My Action " + param}}
}

// In porter.go exec() switch
case "my_action":
    return e.run("my-command " + dest)
```

## Testing

- Unit tests should not require SSH connections
- Test DSL builders and variable expansion
- Test conditions and task building

## Reporting Issues

When reporting issues, please include:

- Go version (`go version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
