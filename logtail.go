package porter

import (
	"bufio"
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/melbahja/goph"
	"golang.org/x/crypto/ssh"
)

// LogLine represents a single line from a log stream.
type LogLine struct {
	Line      string // The log line content
	Source    string // "journalctl", "tail", or custom identifier
	Timestamp string // Optional timestamp if parsed
	Error     error  // Error if stream encountered an issue
}

// LogStreamFunc is called for each line received from the log stream.
type LogStreamFunc func(line LogLine)

// LogStream represents an active log streaming session that can be stopped.
type LogStream struct {
	cancel context.CancelFunc
	done   chan struct{}
	err    error
	mu     sync.Mutex
}

// Stop terminates the log streaming session.
func (s *LogStream) Stop() {
	s.cancel()
	<-s.done // Wait for stream to finish
}

// Wait blocks until the stream finishes (either by Stop() or error).
func (s *LogStream) Wait() error {
	<-s.done
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.err
}

// Done returns a channel that's closed when the stream finishes.
func (s *LogStream) Done() <-chan struct{} {
	return s.done
}

// Err returns any error that occurred during streaming.
func (s *LogStream) Err() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.err
}

// JournalFollow starts streaming journalctl logs in real-time.
// Returns a LogStream that can be used to stop the streaming.
//
// Options:
//   - unit: systemd unit name (empty for all logs)
//   - lines: number of initial lines to show (0 for default)
//   - filters: additional journalctl filters (e.g., "--priority=err")
func JournalFollow(client *goph.Client, unit string, lines int, filters string, callback LogStreamFunc) (*LogStream, error) {
	// Build journalctl command
	cmd := "journalctl -f"
	if unit != "" {
		cmd += fmt.Sprintf(" -u %s", unit)
	}
	if lines > 0 {
		cmd += fmt.Sprintf(" -n %d", lines)
	}
	if filters != "" {
		cmd += " " + filters
	}

	return startLogStream(client, cmd, "journalctl", callback)
}

// JournalFollowUser starts streaming user-level journalctl logs.
func JournalFollowUser(client *goph.Client, unit string, lines int, filters string, callback LogStreamFunc) (*LogStream, error) {
	cmd := "journalctl --user -f"
	if unit != "" {
		cmd += fmt.Sprintf(" -u %s", unit)
	}
	if lines > 0 {
		cmd += fmt.Sprintf(" -n %d", lines)
	}
	if filters != "" {
		cmd += " " + filters
	}

	return startLogStream(client, cmd, "journalctl-user", callback)
}

// TailFollow starts streaming a file using tail -f.
// Returns a LogStream that can be used to stop the streaming.
//
// Options:
//   - path: path to the file to tail
//   - lines: number of initial lines to show (0 for default 10)
func TailFollow(client *goph.Client, path string, lines int, callback LogStreamFunc) (*LogStream, error) {
	cmd := fmt.Sprintf("tail -f %s", path)
	if lines > 0 {
		cmd = fmt.Sprintf("tail -n %d -f %s", lines, path)
	}

	return startLogStream(client, cmd, "tail:"+path, callback)
}

// TailFollowMultiple starts streaming multiple files using tail -f.
func TailFollowMultiple(client *goph.Client, paths []string, lines int, callback LogStreamFunc) (*LogStream, error) {
	pathsStr := strings.Join(paths, " ")
	cmd := fmt.Sprintf("tail -f %s", pathsStr)
	if lines > 0 {
		cmd = fmt.Sprintf("tail -n %d -f %s", lines, pathsStr)
	}

	return startLogStream(client, cmd, "tail-multi", callback)
}

// TailFollowWithSudo starts streaming a file that requires sudo access.
func TailFollowWithSudo(client *goph.Client, path string, lines int, password string, callback LogStreamFunc) (*LogStream, error) {
	cmd := fmt.Sprintf("echo '%s' | sudo -S tail -f %s 2>/dev/null", password, path)
	if lines > 0 {
		cmd = fmt.Sprintf("echo '%s' | sudo -S tail -n %d -f %s 2>/dev/null", password, lines, path)
	}

	return startLogStream(client, cmd, "tail-sudo:"+path, callback)
}

// DockerLogs starts streaming Docker container logs.
func DockerLogs(client *goph.Client, container string, lines int, callback LogStreamFunc) (*LogStream, error) {
	cmd := fmt.Sprintf("docker logs -f %s", container)
	if lines > 0 {
		cmd = fmt.Sprintf("docker logs -f --tail %d %s", lines, container)
	}

	return startLogStream(client, cmd, "docker:"+container, callback)
}

// DockerComposeLogs starts streaming Docker Compose logs.
func DockerComposeLogs(client *goph.Client, composePath string, service string, lines int, callback LogStreamFunc) (*LogStream, error) {
	cmd := fmt.Sprintf("docker compose -f %s logs -f", composePath)
	if service != "" {
		cmd += " " + service
	}
	if lines > 0 {
		cmd = fmt.Sprintf("docker compose -f %s logs -f --tail %d", composePath, lines)
		if service != "" {
			cmd += " " + service
		}
	}

	return startLogStream(client, cmd, "compose:"+composePath, callback)
}

// CustomLogStream starts streaming output from any command.
// This is useful for custom log formats or monitoring commands.
func CustomLogStream(client *goph.Client, cmd string, source string, callback LogStreamFunc) (*LogStream, error) {
	return startLogStream(client, cmd, source, callback)
}

// startLogStream is the internal function that handles all log streaming.
func startLogStream(client *goph.Client, cmd string, source string, callback LogStreamFunc) (*LogStream, error) {
	ctx, cancel := context.WithCancel(context.Background())

	stream := &LogStream{
		cancel: cancel,
		done:   make(chan struct{}),
	}

	session, err := client.NewSession()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		cancel()
		return nil, fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	stderr, err := session.StderrPipe()
	if err != nil {
		session.Close()
		cancel()
		return nil, fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	if err := session.Start(cmd); err != nil {
		session.Close()
		cancel()
		return nil, fmt.Errorf("failed to start command: %w", err)
	}

	// Stream output in goroutines
	var wg sync.WaitGroup

	// Stream stdout
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			select {
			case <-ctx.Done():
				return
			default:
				if callback != nil {
					callback(LogLine{
						Line:   scanner.Text(),
						Source: source,
					})
				}
			}
		}
	}()

	// Stream stderr (often contains log output too)
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			select {
			case <-ctx.Done():
				return
			default:
				if callback != nil {
					callback(LogLine{
						Line:   scanner.Text(),
						Source: source + ":stderr",
					})
				}
			}
		}
	}()

	// Cleanup goroutine
	go func() {
		// Wait for context cancellation
		<-ctx.Done()

		// Send SIGINT to the remote process to stop it gracefully
		// session.Signal doesn't work reliably, so we close the session
		// which sends SIGHUP to the process group
		session.Signal(ssh.SIGINT)

		// Give it a moment to clean up, then force close
		time.Sleep(100 * time.Millisecond)
		session.Close()

		// Wait for readers to finish
		wg.Wait()

		// Signal completion
		close(stream.done)
	}()

	return stream, nil
}

// LogMultiplexer allows streaming from multiple sources and combining them.
type LogMultiplexer struct {
	streams  []*LogStream
	callback LogStreamFunc
	mu       sync.Mutex
}

// NewLogMultiplexer creates a new multiplexer for combining multiple log streams.
func NewLogMultiplexer(callback LogStreamFunc) *LogMultiplexer {
	return &LogMultiplexer{
		streams:  make([]*LogStream, 0),
		callback: callback,
	}
}

// Add adds a log stream to the multiplexer.
func (m *LogMultiplexer) Add(stream *LogStream) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.streams = append(m.streams, stream)
}

// StopAll stops all streams in the multiplexer.
func (m *LogMultiplexer) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.streams {
		s.Stop()
	}
}

// WaitAll waits for all streams to finish.
func (m *LogMultiplexer) WaitAll() {
	m.mu.Lock()
	streams := make([]*LogStream, len(m.streams))
	copy(streams, m.streams)
	m.mu.Unlock()

	for _, s := range streams {
		s.Wait()
	}
}
