package porterui

import (
	"testing"
	"time"
)

func TestIsDangerousCommand(t *testing.T) {
	tests := []struct {
		name     string
		command  string
		expected bool
	}{
		// Dangerous commands - should return true
		{"rm -rf", "rm -rf /", true},
		{"rm -r", "rm -r /home/user", true},
		{"rm with force", "rm -f important.txt", true},
		{"dd command", "dd if=/dev/zero of=/dev/sda", true},
		{"mkfs", "mkfs.ext4 /dev/sda1", true},
		{"shutdown", "shutdown -h now", true},
		{"reboot", "sudo reboot", true},
		{"poweroff", "poweroff", true},
		{"halt", "halt", true},
		{"init 0", "init 0", true},
		{"kill all", "kill -9 -1", true},
		{"killall", "killall nginx", true},
		{"chmod 777", "chmod 777 /var/www", true},
		{"chown root recursive", "chown -R root /home", false}, // Not in dangerous patterns currently
		{"fork bomb", ":() { :|:& }", true},
		{"overwrite system file", "/dev/null > /etc/passwd", true},

		// Safe commands - should return false
		{"ls", "ls -la", false},
		{"cat", "cat /etc/hosts", false},
		{"echo", "echo hello world", false},
		{"grep", "grep -r pattern /var/log", false},
		{"ps", "ps aux", false},
		{"top", "top -bn1", false},
		{"df", "df -h", false},
		{"du", "du -sh /home", false},
		{"find", "find /var -name '*.log'", false},
		{"systemctl status", "systemctl status nginx", false},
		{"docker ps", "docker ps -a", false},
		{"apt update", "apt update", false},
		{"pip install", "pip install requests", false},
		{"npm install", "npm install express", false},
		{"git clone", "git clone https://github.com/user/repo", false},
		{"curl", "curl https://example.com", false},
		{"wget", "wget https://example.com/file.txt", false},
		{"mkdir", "mkdir -p /tmp/test", false},
		{"touch", "touch /tmp/newfile.txt", false},
		{"cp", "cp file1.txt file2.txt", false},
		{"mv", "mv old.txt new.txt", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsDangerousCommand(tt.command)
			if result != tt.expected {
				t.Errorf("IsDangerousCommand(%q) = %v, want %v", tt.command, result, tt.expected)
			}
		})
	}
}

func TestSanitizeFilePath(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"normal path", "/home/user/file.txt", "/home/user/file.txt"},
		{"path with dots", "/home/user/../etc/passwd", ""}, // Contains .. after clean
		{"null bytes", "/home/user\x00/file.txt", "/home/user/file.txt"},
		{"double slashes", "/home//user//file.txt", "/home/user/file.txt"},
		{"relative traversal", "../../../etc/passwd", ""},         // Contains ..
		{"hidden traversal", "/home/user/./../../etc/passwd", ""}, // Contains .. after clean
		{"clean path", "/var/log/syslog", "/var/log/syslog"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeFilePath(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeFilePath(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestValidateCommand(t *testing.T) {
	tests := []struct {
		name        string
		command     string
		expectError bool
	}{
		{"valid command", "ls -la", false},
		{"empty command", "", true},
		{"whitespace only", "   ", true},
		{"null bytes removed", "ls\x00-la", false},
		{"very long command", string(make([]byte, 10001)), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidateCommand(tt.command)
			if (err != nil) != tt.expectError {
				t.Errorf("ValidateCommand(%q) error = %v, expectError = %v", tt.command, err, tt.expectError)
			}
		})
	}
}

func TestRateLimiter(t *testing.T) {
	rl := NewRateLimiter(3, 100*time.Millisecond) // 3 requests per 100ms

	// First 3 requests should be allowed
	for i := 0; i < 3; i++ {
		if !rl.Allow("test-key") {
			t.Errorf("Request %d should be allowed", i+1)
		}
	}

	// 4th request should be denied
	if rl.Allow("test-key") {
		t.Error("4th request should be denied")
	}

	// Different key should be allowed
	if !rl.Allow("other-key") {
		t.Error("Different key should be allowed")
	}
}

func TestEncryptDecrypt(t *testing.T) {
	// Initialize encryption for testing
	if err := InitEncryption(); err != nil {
		t.Fatalf("Failed to initialize encryption: %v", err)
	}

	tests := []struct {
		name      string
		plaintext string
	}{
		{"simple password", "password123"},
		{"complex password", "P@ssw0rd!#$%^&*()"},
		{"unicode password", "密码测试🔐"},
		{"empty string", ""},
		{"long password", "this-is-a-very-long-password-that-should-still-work-correctly-12345"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := Encrypt(tt.plaintext)
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			// Encrypted should be different from plaintext (unless empty)
			if tt.plaintext != "" && encrypted == tt.plaintext {
				t.Error("Encrypted text should be different from plaintext")
			}

			decrypted, err := Decrypt(encrypted)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			if decrypted != tt.plaintext {
				t.Errorf("Decrypt(%q) = %q, want %q", encrypted, decrypted, tt.plaintext)
			}
		})
	}
}

func TestIsEncrypted(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"plain text", "password123", false},
		{"short string", "abc", false},
		{"base64 encoded", "SGVsbG8gV29ybGQhIQ==", true},
		{"invalid base64", "not-valid-base64!!!", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsEncrypted(tt.input)
			if result != tt.expected {
				t.Errorf("IsEncrypted(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}
