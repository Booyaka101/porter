package porter

import (
	"crypto/ed25519"
	"net"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/ssh"
)

func testHostKey(t *testing.T) ssh.PublicKey {
	t.Helper()
	pub, _, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatalf("ssh public key: %v", err)
	}
	return sshPub
}

func TestHostKeyTOFUPinsThenVerifies(t *testing.T) {
	kh := filepath.Join(t.TempDir(), "known_hosts")
	cb := knownHostsVerifier(HostKeyTOFU, kh)

	key := testHostKey(t)
	addr := &net.TCPAddr{IP: net.ParseIP("10.0.0.5"), Port: 22}

	// First connection: unknown host, TOFU pins and accepts.
	if err := cb("10.0.0.5:22", addr, key); err != nil {
		t.Fatalf("first TOFU connection should pin and accept, got: %v", err)
	}
	// Second connection with the same key: must verify and accept.
	if err := cb("10.0.0.5:22", addr, key); err != nil {
		t.Fatalf("second connection with pinned key should accept, got: %v", err)
	}
}

func TestHostKeyChangedKeyIsRejected(t *testing.T) {
	kh := filepath.Join(t.TempDir(), "known_hosts")
	cb := knownHostsVerifier(HostKeyTOFU, kh)

	addr := &net.TCPAddr{IP: net.ParseIP("10.0.0.6"), Port: 22}
	if err := cb("10.0.0.6:22", addr, testHostKey(t)); err != nil {
		t.Fatalf("initial pin should succeed, got: %v", err)
	}

	// A different key for the same host = possible MITM, must hard-fail.
	if err := cb("10.0.0.6:22", addr, testHostKey(t)); err == nil {
		t.Fatal("changed host key must be rejected, got nil error")
	}
}

func TestHostKeyStrictRejectsUnknown(t *testing.T) {
	kh := filepath.Join(t.TempDir(), "known_hosts")
	cb := knownHostsVerifier(HostKeyStrict, kh)

	addr := &net.TCPAddr{IP: net.ParseIP("10.0.0.7"), Port: 22}
	if err := cb("10.0.0.7:22", addr, testHostKey(t)); err == nil {
		t.Fatal("strict mode must reject an unknown host, got nil error")
	}
}

func TestHostKeyInsecureModeSkipsVerification(t *testing.T) {
	SetHostKeyMode(HostKeyInsecure)
	defer SetHostKeyMode(HostKeyTOFU)

	cb := HostKeyCallback()
	addr := &net.TCPAddr{IP: net.ParseIP("10.0.0.8"), Port: 22}
	if err := cb("10.0.0.8:22", addr, testHostKey(t)); err != nil {
		t.Fatalf("insecure mode should accept any key, got: %v", err)
	}
}
