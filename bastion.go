package porter

import (
	"fmt"
	"time"

	"github.com/melbahja/goph"
	"golang.org/x/crypto/ssh"
)

// Hop describes one SSH endpoint (a bastion or the final target) for a
// jump-host connection. Build Auth with PasswordAuth / KeyAuth / AgentAuth.
type Hop struct {
	User    string
	Host    string
	Port    uint // 0 -> 22
	Auth    goph.Auth
	Timeout time.Duration
}

func (h Hop) addr() string {
	return fmt.Sprintf("%s:%d", h.Host, sshPort(h.Port))
}

func (h Hop) clientConfig() *ssh.ClientConfig {
	t := h.Timeout
	if t == 0 {
		t = goph.DefaultTimeout
	}
	return &ssh.ClientConfig{
		User:            h.User,
		Auth:            h.Auth,
		HostKeyCallback: HostKeyCallback(),
		Timeout:         t,
	}
}

// PasswordAuth builds password auth for a Hop.
func PasswordAuth(password string) goph.Auth { return goph.Password(password) }

// KeyAuth builds private-key auth for a Hop (passphrase may be "").
func KeyAuth(keyPath, passphrase string) (goph.Auth, error) { return goph.Key(keyPath, passphrase) }

// AgentAuth builds ssh-agent auth for a Hop.
func AgentAuth() (goph.Auth, error) { return goph.UseAgent() }

// ConnectViaJump connects to target by tunnelling through one or more bastion
// hops (ProxyJump). This is the modern bastion pattern: the connection is
// proxied hop-by-hop and the target session runs over the tunnel — no SSH
// agent is forwarded to (and thus exposed on) any intermediate host. Host keys
// are verified at every hop via HostKeyCallback.
//
//	porter.ConnectViaJump(target, bastion)            // single bastion
//	porter.ConnectViaJump(target, edge, inner)        // chained: edge -> inner -> target
func ConnectViaJump(target Hop, jumps ...Hop) (*goph.Client, error) {
	if len(jumps) == 0 {
		return nil, fmt.Errorf("ConnectViaJump: at least one jump host is required")
	}

	// Dial the first bastion directly.
	bastion, err := ssh.Dial("tcp", jumps[0].addr(), jumps[0].clientConfig())
	if err != nil {
		return nil, fmt.Errorf("dial bastion %s: %w", jumps[0].addr(), err)
	}

	// Chain through any further bastions.
	for i := 1; i < len(jumps); i++ {
		bastion, err = hopThrough(bastion, jumps[i])
		if err != nil {
			return nil, fmt.Errorf("hop to %s: %w", jumps[i].addr(), err)
		}
	}

	// Tunnel from the last bastion to the target and run SSH over it.
	conn, err := bastion.Dial("tcp", target.addr())
	if err != nil {
		return nil, fmt.Errorf("tunnel to target %s: %w", target.addr(), err)
	}
	ncc, chans, reqs, err := ssh.NewClientConn(conn, target.addr(), target.clientConfig())
	if err != nil {
		return nil, fmt.Errorf("ssh handshake with target %s: %w", target.addr(), err)
	}

	return &goph.Client{
		Client: ssh.NewClient(ncc, chans, reqs),
		Config: &goph.Config{
			User:     target.User,
			Addr:     target.Host,
			Port:     sshPort(target.Port),
			Auth:     target.Auth,
			Timeout:  target.Timeout,
			Callback: HostKeyCallback(),
		},
	}, nil
}

// hopThrough opens an SSH connection to next over an existing client's tunnel.
func hopThrough(through *ssh.Client, next Hop) (*ssh.Client, error) {
	conn, err := through.Dial("tcp", next.addr())
	if err != nil {
		return nil, err
	}
	ncc, chans, reqs, err := ssh.NewClientConn(conn, next.addr(), next.clientConfig())
	if err != nil {
		return nil, err
	}
	return ssh.NewClient(ncc, chans, reqs), nil
}
