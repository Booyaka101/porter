package porter

import (
	"time"

	"github.com/melbahja/goph"
	"golang.org/x/crypto/ssh"
)

// Config holds SSH connection configuration.
type Config struct {
	User, Password string
	Timeout        time.Duration
}

// DefaultConfig creates a Config with default timeout.
func DefaultConfig(user, password string) Config {
	return Config{User: user, Password: password, Timeout: goph.DefaultTimeout}
}

// Connect establishes an SSH connection to the remote host.
func Connect(ip string, cfg Config) (*goph.Client, error) {
	return goph.NewConn(&goph.Config{
		User:     cfg.User,
		Addr:     ip,
		Port:     22,
		Auth:     goph.Password(cfg.Password),
		Timeout:  cfg.Timeout,
		Callback: ssh.InsecureIgnoreHostKey(),
	})
}
