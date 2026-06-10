package porterui

import (
	"net/http/httptest"
	"testing"
)

func TestCheckWSOrigin(t *testing.T) {
	cases := []struct {
		name   string
		host   string
		origin string
		env    string
		want   bool
	}{
		{"no origin (agent/cli)", "porter.local", "", "", true},
		{"same origin", "porter.local", "http://porter.local", "", true},
		{"same origin https", "porter.local:8080", "https://porter.local:8080", "", true},
		{"cross origin rejected", "porter.local", "http://evil.example", "", false},
		{"allowlisted origin", "porter.local", "http://ui.example", "http://ui.example", true},
		{"allowlisted by host", "porter.local", "http://ui.example", "ui.example", true},
		{"not in allowlist", "porter.local", "http://evil.example", "http://ui.example", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Setenv("PORTER_ALLOWED_ORIGINS", c.env)
			req := httptest.NewRequest("GET", "http://"+c.host+"/ws", nil)
			req.Host = c.host
			if c.origin != "" {
				req.Header.Set("Origin", c.origin)
			}
			if got := checkWSOrigin(req); got != c.want {
				t.Errorf("checkWSOrigin(host=%s, origin=%s, env=%s) = %v, want %v",
					c.host, c.origin, c.env, got, c.want)
			}
		})
	}
}

func TestAgentTokenValid(t *testing.T) {
	// No token configured -> channels stay open.
	t.Run("unset = open", func(t *testing.T) {
		t.Setenv("PORTER_AGENT_TOKEN", "")
		req := httptest.NewRequest("GET", "/api/agent/ws", nil)
		if !agentTokenValid(req) {
			t.Error("with no PORTER_AGENT_TOKEN, agent channel should be open")
		}
	})
	t.Run("matching header", func(t *testing.T) {
		t.Setenv("PORTER_AGENT_TOKEN", "s3cr3t")
		req := httptest.NewRequest("GET", "/api/agent/ws", nil)
		req.Header.Set("X-Porter-Agent-Token", "s3cr3t")
		if !agentTokenValid(req) {
			t.Error("matching header token should pass")
		}
	})
	t.Run("matching query", func(t *testing.T) {
		t.Setenv("PORTER_AGENT_TOKEN", "s3cr3t")
		req := httptest.NewRequest("GET", "/api/agent/ws?agent_token=s3cr3t", nil)
		if !agentTokenValid(req) {
			t.Error("matching query token should pass")
		}
	})
	t.Run("missing/wrong rejected", func(t *testing.T) {
		t.Setenv("PORTER_AGENT_TOKEN", "s3cr3t")
		req := httptest.NewRequest("GET", "/api/agent/ws", nil)
		if agentTokenValid(req) {
			t.Error("missing token must be rejected when configured")
		}
		req.Header.Set("X-Porter-Agent-Token", "wrong")
		if agentTokenValid(req) {
			t.Error("wrong token must be rejected")
		}
	})
}

func TestEncryptFailsClosedWithoutKey(t *testing.T) {
	saved := encryptionKey
	encryptionKey = nil
	defer func() { encryptionKey = saved }()

	if _, err := Encrypt("secret"); err == nil {
		t.Error("Encrypt must fail closed when key is uninitialized, not return plaintext")
	}
	if _, err := Decrypt("c2VjcmV0c2VjcmV0c2VjcmV0"); err == nil {
		t.Error("Decrypt must fail closed when key is uninitialized")
	}
}

func TestDecryptRoundTripAndTamperDetection(t *testing.T) {
	saved := encryptionKey
	encryptionKey = make([]byte, 32)
	for i := range encryptionKey {
		encryptionKey[i] = byte(i)
	}
	defer func() { encryptionKey = saved }()

	enc, err := Encrypt("hunter2")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	dec, err := Decrypt(enc)
	if err != nil || dec != "hunter2" {
		t.Fatalf("round trip: dec=%q err=%v", dec, err)
	}

	// A value that looks encrypted (valid base64, long) but is not our
	// ciphertext must fail closed, not be returned as plaintext.
	if _, err := Decrypt("QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ=="); err == nil {
		t.Error("tampered/foreign ciphertext must fail closed")
	}

	// Legacy short plaintext (not base64-looking-encrypted) still reads.
	if got, err := Decrypt("plainpw"); err != nil || got != "plainpw" {
		t.Errorf("legacy plaintext should pass through: got=%q err=%v", got, err)
	}
}
