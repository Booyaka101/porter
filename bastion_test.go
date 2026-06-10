package porter

import (
	"strings"
	"testing"
)

func TestHopAddrDefaultsToPort22(t *testing.T) {
	if got := (Hop{Host: "10.0.0.5"}).addr(); got != "10.0.0.5:22" {
		t.Errorf("default port: got %q, want 10.0.0.5:22", got)
	}
	if got := (Hop{Host: "10.0.0.5", Port: 2222}).addr(); got != "10.0.0.5:2222" {
		t.Errorf("explicit port: got %q, want 10.0.0.5:2222", got)
	}
}

func TestHopClientConfigVerifiesHostKeys(t *testing.T) {
	cfg := Hop{User: "deploy", Auth: PasswordAuth("x")}.clientConfig()
	if cfg.User != "deploy" {
		t.Errorf("user = %q", cfg.User)
	}
	if cfg.HostKeyCallback == nil {
		t.Error("jump-host config must verify host keys, not skip them")
	}
}

func TestConnectViaJumpRequiresAJumpHost(t *testing.T) {
	_, err := ConnectViaJump(Hop{Host: "target"})
	if err == nil || !strings.Contains(err.Error(), "jump host is required") {
		t.Fatalf("expected jump-host-required error, got %v", err)
	}
}
