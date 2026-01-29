package porter

import (
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/melbahja/goph"
	"golang.org/x/crypto/ssh"
)

// ConnectWithKey establishes an SSH connection using a private key file.
func ConnectWithKey(ip string, user string, keyPath string, timeout time.Duration) (*goph.Client, error) {
	if timeout == 0 {
		timeout = goph.DefaultTimeout
	}

	auth, err := goph.Key(keyPath, "")
	if err != nil {
		return nil, fmt.Errorf("failed to load key: %w", err)
	}

	return goph.NewConn(&goph.Config{
		User:     user,
		Addr:     ip,
		Port:     22,
		Auth:     auth,
		Timeout:  timeout,
		Callback: ssh.InsecureIgnoreHostKey(),
	})
}

// ConnectWithKeyAndPassphrase establishes an SSH connection using a passphrase-protected key.
func ConnectWithKeyAndPassphrase(ip string, user string, keyPath string, passphrase string, timeout time.Duration) (*goph.Client, error) {
	if timeout == 0 {
		timeout = goph.DefaultTimeout
	}

	auth, err := goph.Key(keyPath, passphrase)
	if err != nil {
		return nil, fmt.Errorf("failed to load key: %w", err)
	}

	return goph.NewConn(&goph.Config{
		User:     user,
		Addr:     ip,
		Port:     22,
		Auth:     auth,
		Timeout:  timeout,
		Callback: ssh.InsecureIgnoreHostKey(),
	})
}

// ConnectWithAgent establishes an SSH connection using the SSH agent.
func ConnectWithAgent(ip string, user string, timeout time.Duration) (*goph.Client, error) {
	if timeout == 0 {
		timeout = goph.DefaultTimeout
	}

	auth, err := goph.UseAgent()
	if err != nil {
		return nil, fmt.Errorf("failed to use SSH agent: %w", err)
	}

	return goph.NewConn(&goph.Config{
		User:     user,
		Addr:     ip,
		Port:     22,
		Auth:     auth,
		Timeout:  timeout,
		Callback: ssh.InsecureIgnoreHostKey(),
	})
}

// TestConnection tests if an SSH connection can be established.
// Returns nil if connection succeeds, error otherwise.
func TestConnection(ip string, cfg Config) error {
	client, err := Connect(ip, cfg)
	if err != nil {
		return err
	}
	client.Close()
	return nil
}

// TestConnectionWithKey tests SSH connection using a key file.
func TestConnectionWithKey(ip string, user string, keyPath string) error {
	client, err := ConnectWithKey(ip, user, keyPath, 5*time.Second)
	if err != nil {
		return err
	}
	client.Close()
	return nil
}

// SSHPing checks if a host is reachable via SSH and returns response time.
func SSHPing(ip string, cfg Config) (time.Duration, error) {
	start := time.Now()
	client, err := Connect(ip, cfg)
	if err != nil {
		return 0, err
	}
	client.Close()
	return time.Since(start), nil
}

// UploadDir uploads an entire directory to the remote server.
// It creates a tar archive locally, uploads it, and extracts on the remote.
func UploadDir(client *goph.Client, localDir, remoteDir string) error {
	// Create remote directory
	_, err := client.Run(fmt.Sprintf("mkdir -p %s", remoteDir))
	if err != nil {
		return fmt.Errorf("failed to create remote directory: %w", err)
	}

	// Create tar of local directory
	tarFile, err := os.CreateTemp("", "porter-upload-*.tar.gz")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tarPath := tarFile.Name()
	tarFile.Close()
	defer os.Remove(tarPath)

	// Create tar archive using system tar command
	cmd := fmt.Sprintf("tar -czf %s -C %s .", tarPath, localDir)
	if err := runLocalCommand(cmd); err != nil {
		return fmt.Errorf("failed to create tar archive: %w", err)
	}

	// Upload tar file
	remoteTar := fmt.Sprintf("/tmp/porter-upload-%d.tar.gz", time.Now().UnixNano())
	if err := client.Upload(tarPath, remoteTar); err != nil {
		return fmt.Errorf("failed to upload tar: %w", err)
	}

	// Extract on remote
	_, err = client.Run(fmt.Sprintf("tar -xzf %s -C %s && rm -f %s", remoteTar, remoteDir, remoteTar))
	if err != nil {
		return fmt.Errorf("failed to extract tar: %w", err)
	}

	return nil
}

// DownloadDir downloads an entire directory from the remote server.
func DownloadDir(client *goph.Client, remoteDir, localDir string) error {
	// Create local directory
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return fmt.Errorf("failed to create local directory: %w", err)
	}

	// Create tar on remote
	remoteTar := fmt.Sprintf("/tmp/porter-download-%d.tar.gz", time.Now().UnixNano())
	_, err := client.Run(fmt.Sprintf("tar -czf %s -C %s .", remoteTar, remoteDir))
	if err != nil {
		return fmt.Errorf("failed to create remote tar: %w", err)
	}

	// Download tar file
	tarFile, err := os.CreateTemp("", "porter-download-*.tar.gz")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tarPath := tarFile.Name()
	tarFile.Close()
	defer os.Remove(tarPath)

	if err := client.Download(remoteTar, tarPath); err != nil {
		// Clean up remote tar
		client.Run(fmt.Sprintf("rm -f %s", remoteTar))
		return fmt.Errorf("failed to download tar: %w", err)
	}

	// Clean up remote tar
	client.Run(fmt.Sprintf("rm -f %s", remoteTar))

	// Extract locally
	cmd := fmt.Sprintf("tar -xzf %s -C %s", tarPath, localDir)
	if err := runLocalCommand(cmd); err != nil {
		return fmt.Errorf("failed to extract tar: %w", err)
	}

	return nil
}

// runLocalCommand executes a command on the local machine
func runLocalCommand(cmd string) error {
	c := exec.Command("sh", "-c", cmd)
	return c.Run()
}
