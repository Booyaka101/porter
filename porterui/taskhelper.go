package porterui

import (
	"github.com/booyaka101/porter"
	"github.com/melbahja/goph"
)

// RunPorterTask executes a single Porter task and returns the captured output
// This is a helper to standardize the Ansible-like task execution pattern
func RunPorterTask(client *goph.Client, password, taskName, command, registerVar string) (string, error) {
	tasks := porter.Tasks(
		porter.Capture(command).
			Name(taskName).
			Register(registerVar).
			Ignore(),
	)

	vars := porter.NewVars()
	executor := porter.NewExecutor(client, password)
	executor.SetVerbose(false)

	_, err := executor.Run(taskName, tasks, vars)
	return vars.Get(registerVar), err
}

// RunPorterCommand executes a single Porter Run task (no output capture)
func RunPorterCommand(client *goph.Client, password, taskName, command string) error {
	tasks := porter.Tasks(
		porter.Run(command).Name(taskName),
	)

	vars := porter.NewVars()
	executor := porter.NewExecutor(client, password)
	executor.SetVerbose(false)

	stats, err := executor.Run(taskName, tasks, vars)
	if err != nil {
		return err
	}
	if stats.Failed > 0 {
		return nil // Command ran but may have non-zero exit
	}
	return nil
}

// RunPorterSudoCommand executes a command with sudo using Porter's Run task
func RunPorterSudoCommand(client *goph.Client, password, taskName, command string) error {
	tasks := porter.Tasks(
		porter.Run(command).Name(taskName).Sudo(),
	)

	vars := porter.NewVars()
	executor := porter.NewExecutor(client, password)
	executor.SetVerbose(false)

	_, err := executor.Run(taskName, tasks, vars)
	return err
}

// RunPorterManifest executes a full Porter manifest with multiple tasks
func RunPorterManifest(client *goph.Client, password, manifestName string, tasks []porter.Task) (*porter.Stats, error) {
	vars := porter.NewVars()
	executor := porter.NewExecutor(client, password)
	executor.SetVerbose(false)

	return executor.Run(manifestName, tasks, vars)
}

// RunPorterManifestWithVars executes a Porter manifest with custom variables
func RunPorterManifestWithVars(client *goph.Client, password, manifestName string, tasks []porter.Task, vars *porter.Vars) (*porter.Stats, error) {
	executor := porter.NewExecutor(client, password)
	executor.SetVerbose(false)

	return executor.Run(manifestName, tasks, vars)
}

// BuildServiceTask creates a Porter task for systemd service management
func BuildServiceTask(serviceName, action string, isUser bool) porter.Task {
	svc := porter.Svc(serviceName)

	switch action {
	case "start":
		if isUser {
			return svc.Start().User().Build()
		}
		return svc.Start().Sudo().Build()
	case "stop":
		if isUser {
			return svc.Stop().User().Build()
		}
		return svc.Stop().Sudo().Build()
	case "restart":
		if isUser {
			return svc.Restart().User().Build()
		}
		return svc.Restart().Sudo().Build()
	case "enable":
		if isUser {
			return svc.Enable().User().Build()
		}
		return svc.Enable().Sudo().Build()
	case "disable":
		if isUser {
			return svc.Disable().User().Build()
		}
		return svc.Disable().Sudo().Build()
	default:
		// Default to status check
		return svc.Start().Sudo().Build()
	}
}

// BuildDockerTask creates a Porter task for Docker container management
func BuildDockerTask(containerName, action string) porter.Task {
	docker := porter.Docker(containerName)

	switch action {
	case "start":
		return docker.Start().Build()
	case "stop":
		return docker.Stop().Build()
	case "restart":
		return docker.Restart().Build()
	case "remove":
		return docker.Remove().Build()
	default:
		// Default to start
		return docker.Start().Build()
	}
}

// SystemInfoManifest returns a Porter manifest for gathering system information
func SystemInfoManifest() []porter.Task {
	return porter.Tasks(
		porter.Capture("hostname").
			Name("Get hostname").
			Register("hostname").
			Ignore(),
		porter.Capture("cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'").
			Name("Get OS info").
			Register("os").
			Ignore(),
		porter.Capture("uname -r").
			Name("Get kernel version").
			Register("kernel").
			Ignore(),
		porter.Capture("uptime -p").
			Name("Get uptime").
			Register("uptime").
			Ignore(),
		porter.Capture("uname -m").
			Name("Get architecture").
			Register("arch").
			Ignore(),
	)
}

// PackageManifest returns a Porter manifest for package management
func PackageInstallManifest(packages string) []porter.Task {
	return porter.Tasks(
		porter.Run("DEBIAN_FRONTEND=noninteractive apt-get install -y " + packages).
			Name("Install packages").
			Sudo(),
	)
}

func PackageRemoveManifest(packages string) []porter.Task {
	return porter.Tasks(
		porter.Run("DEBIAN_FRONTEND=noninteractive apt-get remove -y " + packages).
			Name("Remove packages").
			Sudo(),
	)
}

func PackageUpgradeManifest() []porter.Task {
	return porter.Tasks(
		porter.Run("DEBIAN_FRONTEND=noninteractive apt-get update").
			Name("Update package lists").
			Sudo(),
		porter.Run("DEBIAN_FRONTEND=noninteractive apt-get upgrade -y").
			Name("Upgrade packages").
			Sudo(),
	)
}

// UserManifest returns a Porter manifest for user management
func UserCreateManifest(username, shell, password, groups string) []porter.Task {
	tasks := []porter.Task{
		porter.Run("useradd -m -s " + shell + " " + username).
			Name("Create user").
			Sudo().
			Build(),
	}

	if password != "" {
		tasks = append(tasks,
			porter.Run("echo '"+username+":"+password+"' | chpasswd").
				Name("Set password").
				Sudo().
				Build(),
		)
	}

	if groups != "" {
		tasks = append(tasks,
			porter.Run("usermod -aG "+groups+" "+username).
				Name("Add to groups").
				Sudo().
				Build(),
		)
	}

	return tasks
}

func UserDeleteManifest(username string) []porter.Task {
	return porter.Tasks(
		porter.Run("userdel -r " + username + " 2>/dev/null || userdel " + username).
			Name("Delete user").
			Sudo(),
	)
}

// FirewallManifest returns Porter tasks for firewall management
func FirewallEnableManifest() []porter.Task {
	return porter.Tasks(
		porter.Run("ufw --force enable").
			Name("Enable firewall").
			Sudo(),
	)
}

func FirewallDisableManifest() []porter.Task {
	return porter.Tasks(
		porter.Run("ufw disable").
			Name("Disable firewall").
			Sudo(),
	)
}

func FirewallAddRuleManifest(port, action, protocol string) []porter.Task {
	rule := port
	if protocol != "" && protocol != "both" {
		rule += "/" + protocol
	}
	return porter.Tasks(
		porter.Run("ufw " + action + " " + rule).
			Name("Add firewall rule").
			Sudo(),
	)
}
