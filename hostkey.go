package porter

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

// HostKeyMode controls how porter verifies remote SSH host keys.
type HostKeyMode int

const (
	// HostKeyTOFU trusts an unknown host on first use, pins it to the
	// known_hosts file, and verifies on every subsequent connection.
	// A key that changes after pinning is a hard failure (possible MITM).
	// This matches OpenSSH's default StrictHostKeyChecking=ask behaviour
	// minus the interactive prompt, and is porter's default.
	HostKeyTOFU HostKeyMode = iota
	// HostKeyStrict refuses any host not already present in known_hosts.
	HostKeyStrict
	// HostKeyInsecure disables verification entirely. Opt-in only; intended
	// for tests and throwaway hosts. Logs nothing — the caller chose this.
	HostKeyInsecure
)

var (
	hostKeyMu      sync.RWMutex
	hostKeyMode    = HostKeyTOFU
	knownHostsPath = defaultKnownHostsPath()
	hostCAPath     string // optional file of trusted host-CA public keys (step-ca @cert-authority)
)

// SetHostKeyMode sets the global host-key verification policy.
func SetHostKeyMode(m HostKeyMode) {
	hostKeyMu.Lock()
	defer hostKeyMu.Unlock()
	hostKeyMode = m
}

// SetKnownHostsPath overrides the known_hosts file porter reads and pins to.
func SetKnownHostsPath(path string) {
	hostKeyMu.Lock()
	defer hostKeyMu.Unlock()
	knownHostsPath = path
}

// TrustHostCA registers a file of SSH host-CA public keys (the public half of
// a step-ca host CA, one key per line). When set, hosts presenting a valid
// certificate signed by that CA are accepted without a known_hosts entry —
// the modern way to eliminate TOFU. Plain (non-cert) host keys still fall
// through to known_hosts verification.
func TrustHostCA(path string) {
	hostKeyMu.Lock()
	defer hostKeyMu.Unlock()
	hostCAPath = path
}

// knownHostsFile returns the path porter pins host keys to (for CLI ssh/rsync).
func knownHostsFile() string {
	hostKeyMu.RLock()
	defer hostKeyMu.RUnlock()
	return knownHostsPath
}

// sshStrictOption maps the current host-key mode to the OpenSSH CLI
// StrictHostKeyChecking value used by the rsync-over-ssh path.
func sshStrictOption() string {
	hostKeyMu.RLock()
	defer hostKeyMu.RUnlock()
	switch hostKeyMode {
	case HostKeyInsecure:
		return "no"
	case HostKeyStrict:
		return "yes"
	default:
		return "accept-new" // TOFU: accept unknown, refuse changed
	}
}

func defaultKnownHostsPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".ssh", "known_hosts")
}

// HostKeyCallback returns the ssh.HostKeyCallback porter uses for every
// connection, honouring the current mode and any registered host CA.
func HostKeyCallback() ssh.HostKeyCallback {
	hostKeyMu.RLock()
	mode, khPath, caPath := hostKeyMode, knownHostsPath, hostCAPath
	hostKeyMu.RUnlock()

	if mode == HostKeyInsecure {
		return ssh.InsecureIgnoreHostKey()
	}

	known := knownHostsVerifier(mode, khPath)

	if caPath == "" {
		return known
	}

	authorities, err := loadHostCAs(caPath)
	if err != nil {
		// A misconfigured CA must not silently downgrade to no-cert
		// verification: fail every connection until it's fixed.
		return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			return fmt.Errorf("host CA %q unusable: %w", caPath, err)
		}
	}

	checker := &ssh.CertChecker{
		IsHostAuthority: func(auth ssh.PublicKey, address string) bool {
			authMarshaled := auth.Marshal()
			for _, ca := range authorities {
				if string(ca.Marshal()) == string(authMarshaled) {
					return true
				}
			}
			return false
		},
		HostKeyFallback: known,
	}
	return checker.CheckHostKey
}

// knownHostsVerifier builds a callback over the known_hosts file with explicit
// TOFU / strict handling and a clear MITM error on key change.
func knownHostsVerifier(mode HostKeyMode, path string) ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		if path == "" {
			return errors.New("porter: no known_hosts path configured and host-key verification is enabled")
		}
		if err := ensureFile(path); err != nil {
			return fmt.Errorf("porter: cannot access known_hosts %q: %w", path, err)
		}

		verify, err := knownhosts.New(path)
		if err != nil {
			return fmt.Errorf("porter: failed to load known_hosts %q: %w", path, err)
		}

		err = verify(hostname, remote, key)
		if err == nil {
			return nil
		}

		var keyErr *knownhosts.KeyError
		if !errors.As(err, &keyErr) {
			return err
		}

		// Non-empty Want means we have a pinned key that does NOT match the
		// presented one — treat as a potential man-in-the-middle, always fail.
		if len(keyErr.Want) > 0 {
			return fmt.Errorf("porter: host key mismatch for %s — pinned key changed (possible MITM); "+
				"if intentional, remove the stale line from %s: %w", hostname, path, keyErr)
		}

		// Empty Want means the host is unknown.
		if mode == HostKeyStrict {
			return fmt.Errorf("porter: unknown host %s and host-key mode is strict; "+
				"add it to %s to proceed: %w", hostname, path, keyErr)
		}

		// TOFU: pin the key now and accept this first connection.
		if err := appendKnownHost(path, hostname, remote, key); err != nil {
			return fmt.Errorf("porter: failed to pin host key for %s: %w", hostname, err)
		}
		return nil
	}
}

func appendKnownHost(path, hostname string, remote net.Addr, key ssh.PublicKey) error {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()

	addrs := []string{knownhosts.Normalize(hostname)}
	if remote != nil {
		if r := knownhosts.Normalize(remote.String()); r != addrs[0] {
			addrs = append(addrs, r)
		}
	}
	line := knownhosts.Line(addrs, key)
	_, err = fmt.Fprintln(f, line)
	return err
}

func loadHostCAs(path string) ([]ssh.PublicKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cas []ssh.PublicKey
	rest := data
	for len(rest) > 0 {
		key, _, _, remainder, err := ssh.ParseAuthorizedKey(rest)
		if err != nil {
			// ParseAuthorizedKey stops at the first unparsable line; if we
			// already have keys, use them, otherwise surface the error.
			if len(cas) > 0 {
				break
			}
			return nil, fmt.Errorf("no usable CA keys in %q: %w", path, err)
		}
		cas = append(cas, key)
		rest = remainder
	}
	if len(cas) == 0 {
		return nil, fmt.Errorf("no CA keys found in %q", path)
	}
	return cas, nil
}

func ensureFile(path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	return f.Close()
}
