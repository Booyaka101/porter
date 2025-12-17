package porter

import "strings"

// =============================================================================
// PACKAGE MANAGEMENT (APT)
// =============================================================================

// AptUpdate updates the package index.
func AptUpdate() TaskBuilder {
	return TaskBuilder{Task{Action: "apt_update", Name: "Apt update"}}
}

// AptInstall installs one or more packages.
func AptInstall(packages ...string) TaskBuilder {
	pkgs := strings.Join(packages, " ")
	return TaskBuilder{Task{Action: "apt_install", Body: pkgs, Name: "Apt install"}}
}

// AptRemove removes one or more packages.
func AptRemove(packages ...string) TaskBuilder {
	pkgs := strings.Join(packages, " ")
	return TaskBuilder{Task{Action: "apt_remove", Body: pkgs, Name: "Apt remove"}}
}

// AptUpgrade upgrades all installed packages.
func AptUpgrade() TaskBuilder {
	return TaskBuilder{Task{Action: "apt_upgrade", Name: "Apt upgrade"}}
}
