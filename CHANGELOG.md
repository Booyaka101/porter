# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial public release
- Declarative DSL for deployment tasks
- SSH/SFTP file transfers and command execution
- Retry logic with configurable delays
- Conditional task execution with `When()`, `If()`, `IfEquals()`, etc.
- Loop support for iterating over items
- Health checks (port, HTTP, file)
- Systemd service management (user and system services)
- Journalctl log retrieval with shell injection protection
- Docker and Docker Compose support
- Rsync file synchronization
- Variable expansion in commands and files
- Idempotent operations with `Creates()`
- Progress tracking with callbacks
- Service file management helpers (`ManageServiceFile`, `ManageServiceFileWithReload`)

### Security
- Shell injection protection for journalctl grep patterns
- Sed escape helper for safe string replacement

## [0.1.0] - 2024-01-01

### Added
- Initial development release
- Core SSH connection handling
- Basic file operations (Upload, Copy, Move, Write, Mkdir, Rm, Chmod, Chown, Symlink)
- Command execution (Run, Capture)
- Service management (Svc)
- Variable system (Vars)
- Task executor with progress reporting

[Unreleased]: https://github.com/booyaka101/porter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/booyaka101/porter/releases/tag/v0.1.0
