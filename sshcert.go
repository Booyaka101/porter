package porter

import (
	"fmt"
	"os"
	"time"

	"github.com/melbahja/goph"
	"golang.org/x/crypto/ssh"
)

// ConnectWithCert establishes an SSH connection authenticating with an SSH
// user certificate (the modern, short-lived-credential model — e.g. issued by
// step-ca, Vault SSH, or Teleport). keyPath is the private key; certPath is the
// matching certificate (step-ca writes it as "<key>-cert.pub"). passphrase may
// be "" for an unencrypted key. port 0 defaults to 22.
//
// Certificate auth eliminates static-key distribution: the CA signs a cert
// scoped to a short TTL, so a leaked key expires on its own. Host-key
// verification still applies (see HostKeyCallback / TrustHostCA).
func ConnectWithCert(ip, user, keyPath, certPath, passphrase string, port uint, timeout time.Duration) (*goph.Client, error) {
	if timeout == 0 {
		timeout = goph.DefaultTimeout
	}

	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("read private key: %w", err)
	}

	var signer ssh.Signer
	if passphrase != "" {
		signer, err = ssh.ParsePrivateKeyWithPassphrase(keyBytes, []byte(passphrase))
	} else {
		signer, err = ssh.ParsePrivateKey(keyBytes)
	}
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}

	certBytes, err := os.ReadFile(certPath)
	if err != nil {
		return nil, fmt.Errorf("read certificate: %w", err)
	}
	pub, _, _, _, err := ssh.ParseAuthorizedKey(certBytes)
	if err != nil {
		return nil, fmt.Errorf("parse certificate: %w", err)
	}
	cert, ok := pub.(*ssh.Certificate)
	if !ok {
		return nil, fmt.Errorf("%s is not an SSH certificate", certPath)
	}

	certSigner, err := ssh.NewCertSigner(cert, signer)
	if err != nil {
		return nil, fmt.Errorf("build certificate signer: %w", err)
	}

	return goph.NewConn(&goph.Config{
		User:     user,
		Addr:     ip,
		Port:     sshPort(port),
		Auth:     goph.Auth{ssh.PublicKeys(certSigner)},
		Timeout:  timeout,
		Callback: HostKeyCallback(),
	})
}

// StartKeepalive sends OpenSSH keepalive requests over the connection every
// interval so a long deploy across an idle or NAT'd link isn't silently
// dropped. It returns a stop function; call it (e.g. with defer) when the
// connection is no longer needed. A nil client or non-positive interval is a
// no-op returning a no-op stop.
func StartKeepalive(client *goph.Client, interval time.Duration) (stop func()) {
	if client == nil || interval <= 0 {
		return func() {}
	}
	done := make(chan struct{})
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-done:
				return
			case <-t.C:
				// Best-effort liveness probe; errors mean the link is gone
				// and the next real operation will surface it.
				_, _, _ = client.SendRequest("keepalive@openssh.com", true, nil)
			}
		}
	}()
	return func() { close(done) }
}
