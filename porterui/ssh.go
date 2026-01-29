package porterui

import (
	"fmt"
	"os/exec"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHConfig holds SSH connection configuration
type SSHConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	Timeout  time.Duration
}

// SSHClient wraps SSH operations
type SSHClient struct {
	config *ssh.ClientConfig
	host   string
	port   int
}

// NewSSHClient creates a new SSH client
func NewSSHClient(cfg SSHConfig) *SSHClient {
	if cfg.Port == 0 {
		cfg.Port = 22
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}

	sshConfig := &ssh.ClientConfig{
		User: cfg.Username,
		Auth: []ssh.AuthMethod{
			ssh.Password(cfg.Password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         cfg.Timeout,
	}

	return &SSHClient{
		config: sshConfig,
		host:   cfg.Host,
		port:   cfg.Port,
	}
}

// TestConnection tests if SSH connection is possible
func (c *SSHClient) TestConnection() error {
	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", c.host, c.port), c.config)
	if err != nil {
		return err
	}
	client.Close()
	return nil
}

// RunCommand executes a command over SSH and returns output
func (c *SSHClient) RunCommand(cmd string) (string, error) {
	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", c.host, c.port), c.config)
	if err != nil {
		return "", fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)
	return string(output), err
}

// RunCommandWithSudo executes a command with sudo
func (c *SSHClient) RunCommandWithSudo(cmd, password string) (string, error) {
	sudoCmd := fmt.Sprintf("echo '%s' | sudo -S %s 2>&1", password, cmd)
	return c.RunCommand(sudoCmd)
}

// ExecuteCommand executes a command and returns output, exit code, and error
func (c *SSHClient) ExecuteCommand(cmd string) (string, int, error) {
	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", c.host, c.port), c.config)
	if err != nil {
		return "", -1, fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", -1, fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*ssh.ExitError); ok {
			exitCode = exitErr.ExitStatus()
			return string(output), exitCode, nil
		}
		return string(output), -1, err
	}
	return string(output), exitCode, nil
}

// UploadDirectory uploads a directory via SSH using tar
func (c *SSHClient) UploadDirectory(localPath, remotePath, password string) error {
	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", c.host, c.port), c.config)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	// Create remote directory
	session1, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}
	session1.Run(fmt.Sprintf("mkdir -p %s", remotePath))
	session1.Close()

	// Create tar of local directory
	tarCmd := exec.Command("tar", "-czf", "-", "-C", localPath, ".")
	tarOutput, err := tarCmd.Output()
	if err != nil {
		return fmt.Errorf("failed to create tar: %w", err)
	}

	// Upload and extract via SSH
	session2, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("failed to create upload session: %w", err)
	}
	defer session2.Close()

	// Pipe tar data to remote extraction
	stdin, err := session2.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdin pipe: %w", err)
	}

	if err := session2.Start(fmt.Sprintf("tar -xzf - -C %s", remotePath)); err != nil {
		return fmt.Errorf("failed to start remote tar: %w", err)
	}

	_, err = stdin.Write(tarOutput)
	if err != nil {
		return fmt.Errorf("failed to write tar data: %w", err)
	}
	stdin.Close()

	return session2.Wait()
}

// UploadFile uploads a single file via SSH
func (c *SSHClient) UploadFile(content []byte, remotePath string) error {
	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", c.host, c.port), c.config)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	cmd := fmt.Sprintf("cat > %s << 'EOF'\n%s\nEOF\nchmod +x %s", remotePath, string(content), remotePath)
	return session.Run(cmd)
}
