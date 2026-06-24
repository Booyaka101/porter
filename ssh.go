package porter

import (
	"net"
	"strconv"
	"time"

	"github.com/melbahja/goph"
	"golang.org/x/crypto/ssh"
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
	return dialBounded(cfg.User, ip, cfg.Port, goph.Password(cfg.Password), cfg.Timeout)
}

// dialBounded establishes an SSH client connection whose ENTIRE handshake —
// TCP connect, key exchange and authentication — is bounded by timeout.
//
// goph.NewConn / ssh.Dial honour ClientConfig.Timeout only for the TCP dial.
// Once the socket is connected, a server that stalls mid-handshake (sshd
// shedding load, sitting at MaxStartups, or otherwise slow to answer the key
// exchange) makes ssh.NewClientConn block indefinitely — there is no handshake
// timeout in crypto/ssh. Worse, the underlying net.Conn is never closed, so the
// stalled attempt leaks an unauthenticated connection that occupies a slot on
// the server until its LoginGraceTime. A caller that wraps Connect in its own
// deadline (e.g. a retry loop) abandons the goroutine but cannot reclaim that
// socket, so repeated attempts pile up against MaxStartups and turn a brief
// server hiccup into a self-sustaining stall.
//
// Setting a deadline across the handshake makes a stall fail fast and closes
// the socket so nothing leaks. The deadline is cleared on success so it never
// interrupts the established session.
func dialBounded(user, addr string, port uint, auth goph.Auth, timeout time.Duration) (*goph.Client, error) {
	if timeout <= 0 {
		timeout = goph.DefaultTimeout
	}
	hostport := net.JoinHostPort(addr, strconv.Itoa(int(sshPort(port))))

	conn, err := net.DialTimeout("tcp", hostport, timeout)
	if err != nil {
		return nil, err
	}
	if err := conn.SetDeadline(time.Now().Add(timeout)); err != nil {
		conn.Close()
		return nil, err
	}

	callback := HostKeyCallback()
	sshConn, chans, reqs, err := ssh.NewClientConn(conn, hostport, &ssh.ClientConfig{
		User:            user,
		Auth:            auth,
		HostKeyCallback: callback,
		Timeout:         timeout,
	})
	if err != nil {
		conn.Close()
		return nil, err
	}
	// Hand the live session an open-ended deadline; the handshake is done.
	if err := conn.SetDeadline(time.Time{}); err != nil {
		sshConn.Close()
		return nil, err
	}

	return &goph.Client{
		Client: ssh.NewClient(sshConn, chans, reqs),
		Config: &goph.Config{
			User:     user,
			Addr:     addr,
			Port:     sshPort(port),
			Auth:     auth,
			Timeout:  timeout,
			Callback: callback,
		},
	}, nil
}
