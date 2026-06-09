package porter

import (
	"time"

	"github.com/melbahja/goph"
)

// Config holds SSH connection configuration.
type Config struct {
	User, Password string
	Timeout        time.Duration
	Port           uint // SSH port; 0 means the default (22)
}

// DefaultConfig creates a Config with default timeout.
func DefaultConfig(user, password string) Config {
	return Config{User: user, Password: password, Timeout: goph.DefaultTimeout}
}

// sshPort returns the configured port, defaulting to 22.
func sshPort(p uint) uint {
	if p == 0 {
		return 22
	}
	return p
}

// Connect establishes an SSH connection to the remote host.
func Connect(ip string, cfg Config) (*goph.Client, error) {
	return goph.NewConn(&goph.Config{
		User:     cfg.User,
		Addr:     ip,
		Port:     sshPort(cfg.Port),
		Auth:     goph.Password(cfg.Password),
		Timeout:  cfg.Timeout,
		Callback: HostKeyCallback(),
	})
}
