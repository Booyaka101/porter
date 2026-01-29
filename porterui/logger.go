package porterui

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// LogLevel represents the severity of a log message
type LogLevel int

const (
	LevelDebug LogLevel = iota
	LevelInfo
	LevelWarn
	LevelError
)

func (l LogLevel) String() string {
	switch l {
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

// Logger provides structured logging capabilities
type Logger struct {
	mu       sync.Mutex
	level    LogLevel
	output   io.Writer
	fields   map[string]interface{}
	logFile  *os.File
	filePath string
}

var (
	defaultLogger *Logger
	loggerOnce    sync.Once
)

// GetLogger returns the singleton logger instance
func GetLogger() *Logger {
	loggerOnce.Do(func() {
		defaultLogger = NewLogger()
	})
	return defaultLogger
}

// NewLogger creates a new logger instance
func NewLogger() *Logger {
	logDir := filepath.Join(getDataDir(), "logs")
	os.MkdirAll(logDir, 0755)

	logPath := filepath.Join(logDir, fmt.Sprintf("porter-%s.log", time.Now().Format("2006-01-02")))
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		logFile = nil
	}

	return &Logger{
		level:    LevelInfo,
		output:   os.Stdout,
		fields:   make(map[string]interface{}),
		logFile:  logFile,
		filePath: logPath,
	}
}

// SetLevel sets the minimum log level
func (l *Logger) SetLevel(level LogLevel) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// WithField returns a new logger with an additional field
func (l *Logger) WithField(key string, value interface{}) *Logger {
	newLogger := &Logger{
		level:    l.level,
		output:   l.output,
		fields:   make(map[string]interface{}),
		logFile:  l.logFile,
		filePath: l.filePath,
	}
	for k, v := range l.fields {
		newLogger.fields[k] = v
	}
	newLogger.fields[key] = value
	return newLogger
}

// WithFields returns a new logger with additional fields
func (l *Logger) WithFields(fields map[string]interface{}) *Logger {
	newLogger := &Logger{
		level:    l.level,
		output:   l.output,
		fields:   make(map[string]interface{}),
		logFile:  l.logFile,
		filePath: l.filePath,
	}
	for k, v := range l.fields {
		newLogger.fields[k] = v
	}
	for k, v := range fields {
		newLogger.fields[k] = v
	}
	return newLogger
}

// log writes a log entry
func (l *Logger) log(level LogLevel, msg string, fields map[string]interface{}) {
	if level < l.level {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	entry := LogEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		Level:     level.String(),
		Message:   msg,
		Fields:    make(map[string]interface{}),
	}

	// Merge logger fields with call-specific fields
	for k, v := range l.fields {
		entry.Fields[k] = v
	}
	for k, v := range fields {
		entry.Fields[k] = v
	}

	// JSON output for file
	if l.logFile != nil {
		jsonBytes, _ := json.Marshal(entry)
		l.logFile.Write(jsonBytes)
		l.logFile.Write([]byte("\n"))
	}

	// Colored console output
	var levelColor string
	switch level {
	case LevelDebug:
		levelColor = "\033[36m" // Cyan
	case LevelInfo:
		levelColor = "\033[32m" // Green
	case LevelWarn:
		levelColor = "\033[33m" // Yellow
	case LevelError:
		levelColor = "\033[31m" // Red
	}

	timestamp := time.Now().Format("15:04:05")
	fieldsStr := ""
	if len(entry.Fields) > 0 {
		for k, v := range entry.Fields {
			fieldsStr += fmt.Sprintf(" %s=%v", k, v)
		}
	}

	fmt.Fprintf(l.output, "%s %s%-5s\033[0m %s%s\n", timestamp, levelColor, level.String(), msg, fieldsStr)
}

// Debug logs a debug message
func (l *Logger) Debug(msg string) {
	l.log(LevelDebug, msg, nil)
}

// Info logs an info message
func (l *Logger) Info(msg string) {
	l.log(LevelInfo, msg, nil)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string) {
	l.log(LevelWarn, msg, nil)
}

// Error logs an error message
func (l *Logger) Error(msg string) {
	l.log(LevelError, msg, nil)
}

// Debugf logs a formatted debug message
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.log(LevelDebug, fmt.Sprintf(format, args...), nil)
}

// Infof logs a formatted info message
func (l *Logger) Infof(format string, args ...interface{}) {
	l.log(LevelInfo, fmt.Sprintf(format, args...), nil)
}

// Warnf logs a formatted warning message
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.log(LevelWarn, fmt.Sprintf(format, args...), nil)
}

// Errorf logs a formatted error message
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.log(LevelError, fmt.Sprintf(format, args...), nil)
}

// Close closes the log file
func (l *Logger) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.logFile != nil {
		l.logFile.Close()
	}
}

// Convenience functions using the default logger

// Log returns the default logger
func Log() *Logger {
	return GetLogger()
}

// LogInfo logs an info message with fields
func LogInfo(msg string, fields map[string]interface{}) {
	GetLogger().log(LevelInfo, msg, fields)
}

// LogError logs an error message with fields
func LogError(msg string, fields map[string]interface{}) {
	GetLogger().log(LevelError, msg, fields)
}

// LogWarn logs a warning message with fields
func LogWarn(msg string, fields map[string]interface{}) {
	GetLogger().log(LevelWarn, msg, fields)
}

// LogDebug logs a debug message with fields
func LogDebug(msg string, fields map[string]interface{}) {
	GetLogger().log(LevelDebug, msg, fields)
}
