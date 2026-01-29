package porter

import (
	"bufio"
	"fmt"
	"strings"
	"sync"

	"github.com/melbahja/goph"
	"golang.org/x/crypto/ssh"
)

// StreamEvent represents a real-time output event during command execution.
type StreamEvent struct {
	Type string // "stdout", "stderr", "exit", "error"
	Data string // Line of output or error message
	Code int    // Exit code (only for "exit" type)
}

// StreamFunc is called for each line of output during streaming execution.
type StreamFunc func(event StreamEvent)

// RunStreaming executes a command with real-time output streaming.
// The callback is called for each line of stdout/stderr output.
// Returns the combined output, exit code, and any error.
func RunStreaming(client *goph.Client, cmd string, callback StreamFunc) (string, int, error) {
	session, err := client.NewSession()
	if err != nil {
		return "", -1, fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	// Get stdout and stderr pipes
	stdout, err := session.StdoutPipe()
	if err != nil {
		return "", -1, fmt.Errorf("failed to get stdout pipe: %w", err)
	}
	stderr, err := session.StderrPipe()
	if err != nil {
		return "", -1, fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	// Start the command
	if err := session.Start(cmd); err != nil {
		return "", -1, fmt.Errorf("failed to start command: %w", err)
	}

	// Collect output while streaming
	var outputBuilder strings.Builder
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Stream stdout
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			mu.Lock()
			outputBuilder.WriteString(line + "\n")
			mu.Unlock()
			if callback != nil {
				callback(StreamEvent{Type: "stdout", Data: line})
			}
		}
	}()

	// Stream stderr
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			mu.Lock()
			outputBuilder.WriteString(line + "\n")
			mu.Unlock()
			if callback != nil {
				callback(StreamEvent{Type: "stderr", Data: line})
			}
		}
	}()

	// Wait for output streaming to complete
	wg.Wait()

	// Wait for command to finish and get exit code
	exitCode := 0
	err = session.Wait()
	if err != nil {
		if exitErr, ok := err.(*ssh.ExitError); ok {
			exitCode = exitErr.ExitStatus()
			err = nil // Not a real error, just non-zero exit
		}
	}

	if callback != nil {
		callback(StreamEvent{Type: "exit", Code: exitCode})
	}

	return outputBuilder.String(), exitCode, err
}

// StreamingExecutor wraps an Executor with streaming capabilities.
type StreamingExecutor struct {
	*Executor
	onOutput StreamFunc
}

// NewStreamingExecutor creates an executor that streams output.
func NewStreamingExecutor(client *goph.Client, password string) *StreamingExecutor {
	return &StreamingExecutor{
		Executor: NewExecutor(client, password),
	}
}

// OnOutput sets a callback for real-time output streaming.
func (e *StreamingExecutor) OnOutput(fn StreamFunc) *StreamingExecutor {
	e.onOutput = fn
	return e
}

// RunWithStreaming executes a single command with streaming output.
// This is useful for long-running scripts where you want real-time feedback.
func (e *StreamingExecutor) RunWithStreaming(cmd string) (string, int, error) {
	return RunStreaming(e.client, cmd, e.onOutput)
}
