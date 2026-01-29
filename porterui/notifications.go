package porterui

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// NotificationConfig holds notification settings
type NotificationConfig struct {
	Enabled       bool   `json:"enabled"`
	SlackWebhook  string `json:"slack_webhook,omitempty"`
	EmailSMTP     string `json:"email_smtp,omitempty"`
	EmailFrom     string `json:"email_from,omitempty"`
	EmailTo       string `json:"email_to,omitempty"`
	EmailPassword string `json:"email_password,omitempty"`
	OnSuccess     bool   `json:"on_success"`
	OnFailure     bool   `json:"on_failure"`
	OnScheduled   bool   `json:"on_scheduled"`
}

// Notification represents a notification event
type Notification struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"` // success, failure, info, warning
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Read      bool      `json:"read"`
	Data      any       `json:"data,omitempty"`
}

// NotificationStore manages notifications
type NotificationStore struct {
	mu            sync.RWMutex
	notifications []Notification
	config        NotificationConfig
	configPath    string
	maxSize       int
}

var notificationStore *NotificationStore

// InitNotifications initializes the notification system
func InitNotifications() error {
	dataDir := getDataDir()
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	notificationStore = &NotificationStore{
		notifications: []Notification{},
		configPath:    filepath.Join(dataDir, "notification_config.json"),
		maxSize:       100,
	}

	return notificationStore.loadConfig()
}

func (n *NotificationStore) loadConfig() error {
	data, err := os.ReadFile(n.configPath)
	if os.IsNotExist(err) {
		n.config = NotificationConfig{
			Enabled:   true,
			OnSuccess: false,
			OnFailure: true,
		}
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &n.config)
}

func (n *NotificationStore) saveConfig() error {
	data, err := json.MarshalIndent(n.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(n.configPath, data, 0644)
}

// Add adds a new notification
func (n *NotificationStore) Add(notif Notification) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if notif.ID == "" {
		notif.ID = fmt.Sprintf("notif-%d", time.Now().UnixNano())
	}
	notif.Timestamp = time.Now()

	n.notifications = append([]Notification{notif}, n.notifications...)

	if len(n.notifications) > n.maxSize {
		n.notifications = n.notifications[:n.maxSize]
	}

	// Send external notifications
	go n.sendExternal(notif)
}

func (n *NotificationStore) sendExternal(notif Notification) {
	if !n.config.Enabled {
		return
	}

	// Check if we should send based on type
	if notif.Type == "success" && !n.config.OnSuccess {
		return
	}
	if notif.Type == "failure" && !n.config.OnFailure {
		return
	}

	// Send to Slack
	if n.config.SlackWebhook != "" {
		n.sendSlack(notif)
	}

	// Send email
	if n.config.EmailSMTP != "" && n.config.EmailTo != "" {
		n.sendEmail(notif)
	}
}

func (n *NotificationStore) sendEmail(notif Notification) {
	// Parse SMTP server (format: host:port)
	smtpParts := strings.Split(n.config.EmailSMTP, ":")
	if len(smtpParts) != 2 {
		return
	}
	host := smtpParts[0]
	addr := n.config.EmailSMTP

	// Build email
	subject := notif.Title
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background: #1a1a2e; color: #e0f7ff; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #111827; border-radius: 12px; padding: 24px; border: 1px solid #00d4ff33; }
        .header { font-size: 24px; font-weight: bold; margin-bottom: 16px; color: %s; }
        .message { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
        .footer { margin-top: 24px; font-size: 12px; color: #7dd3fc; border-top: 1px solid #00d4ff33; padding-top: 16px; }
        .timestamp { color: #7dd3fc; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">%s</div>
        <div class="message">%s</div>
        <div class="footer">
            <div class="timestamp">%s</div>
            IDX Script Runner
        </div>
    </div>
</body>
</html>
`, getEmailColor(notif.Type), notif.Title, notif.Message, notif.Timestamp.Format(time.RFC1123))

	// Build message
	msg := fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"\r\n%s", n.config.EmailFrom, n.config.EmailTo, subject, body)

	// Setup auth if password provided
	var auth smtp.Auth
	if n.config.EmailPassword != "" && n.config.EmailFrom != "" {
		auth = smtp.PlainAuth("", n.config.EmailFrom, n.config.EmailPassword, host)
	}

	// Try TLS first (port 465), then STARTTLS (port 587), then plain
	if strings.HasSuffix(addr, ":465") {
		// Direct TLS connection
		tlsConfig := &tls.Config{ServerName: host}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, host)
		if err != nil {
			return
		}
		defer client.Close()

		if auth != nil {
			if err := client.Auth(auth); err != nil {
				return
			}
		}

		if err := client.Mail(n.config.EmailFrom); err != nil {
			return
		}
		if err := client.Rcpt(n.config.EmailTo); err != nil {
			return
		}

		w, err := client.Data()
		if err != nil {
			return
		}
		w.Write([]byte(msg))
		w.Close()
		client.Quit()
	} else {
		// Standard SMTP with optional STARTTLS
		smtp.SendMail(addr, auth, n.config.EmailFrom, []string{n.config.EmailTo}, []byte(msg))
	}
}

func getEmailColor(notifType string) string {
	switch notifType {
	case "success":
		return "#00ff88"
	case "failure":
		return "#ff3366"
	case "warning":
		return "#ffaa00"
	default:
		return "#00d4ff"
	}
}

func (n *NotificationStore) sendSlack(notif Notification) {
	color := "#36a64f" // green
	if notif.Type == "failure" {
		color = "#ff0000"
	} else if notif.Type == "warning" {
		color = "#ffaa00"
	}

	payload := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"color":  color,
				"title":  notif.Title,
				"text":   notif.Message,
				"footer": "IDX Script Runner",
				"ts":     notif.Timestamp.Unix(),
			},
		},
	}

	data, _ := json.Marshal(payload)
	http.Post(n.config.SlackWebhook, "application/json", bytes.NewBuffer(data))
}

// GetAll returns all notifications
func (n *NotificationStore) GetAll() []Notification {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.notifications
}

// GetUnread returns unread notifications
func (n *NotificationStore) GetUnread() []Notification {
	n.mu.RLock()
	defer n.mu.RUnlock()

	var unread []Notification
	for _, notif := range n.notifications {
		if !notif.Read {
			unread = append(unread, notif)
		}
	}
	return unread
}

// MarkRead marks a notification as read
func (n *NotificationStore) MarkRead(id string) {
	n.mu.Lock()
	defer n.mu.Unlock()

	for i := range n.notifications {
		if n.notifications[i].ID == id {
			n.notifications[i].Read = true
			break
		}
	}
}

// MarkAllRead marks all notifications as read
func (n *NotificationStore) MarkAllRead() {
	n.mu.Lock()
	defer n.mu.Unlock()

	for i := range n.notifications {
		n.notifications[i].Read = true
	}
}

// Clear clears all notifications
func (n *NotificationStore) Clear() {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.notifications = []Notification{}
}

// GetConfig returns the notification config
func (n *NotificationStore) GetConfig() NotificationConfig {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.config
}

// UpdateConfig updates the notification config
func (n *NotificationStore) UpdateConfig(config NotificationConfig) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.config = config
	return n.saveConfig()
}

// NotifyExecutionComplete sends a notification for script execution
func NotifyExecutionComplete(result ExecutionResult, scriptName string) {
	if notificationStore == nil {
		return
	}

	notifType := "success"
	title := fmt.Sprintf("✅ Script completed: %s", scriptName)
	if !result.Success {
		notifType = "failure"
		title = fmt.Sprintf("❌ Script failed: %s", scriptName)
	}

	message := fmt.Sprintf("Machine: %s\nDuration: %s",
		result.MachineName,
		result.FinishedAt.Sub(result.StartedAt).Round(time.Second))

	if result.Error != "" {
		message += fmt.Sprintf("\nError: %s", result.Error)
	}

	notificationStore.Add(Notification{
		Type:    notifType,
		Title:   title,
		Message: message,
		Data:    result,
	})
}

// NotifyBatchComplete sends a notification for batch execution
func NotifyBatchComplete(scriptName string, total, success, failed int) {
	if notificationStore == nil {
		return
	}

	notifType := "success"
	title := fmt.Sprintf("✅ Batch completed: %s", scriptName)
	if failed > 0 {
		notifType = "warning"
		title = fmt.Sprintf("⚠️ Batch completed with errors: %s", scriptName)
	}
	if failed == total {
		notifType = "failure"
		title = fmt.Sprintf("❌ Batch failed: %s", scriptName)
	}

	message := fmt.Sprintf("Total: %d | Success: %d | Failed: %d", total, success, failed)

	notificationStore.Add(Notification{
		Type:    notifType,
		Title:   title,
		Message: message,
	})
}

// NotificationRoutes sets up notification API routes
func NotificationRoutes(r *mux.Router) {
	// Get all notifications
	r.HandleFunc("/api/notifications", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(notificationStore.GetAll())
	}).Methods("GET")

	// Get unread count
	r.HandleFunc("/api/notifications/unread", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		unread := notificationStore.GetUnread()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"count":         len(unread),
			"notifications": unread,
		})
	}).Methods("GET")

	// Mark notification as read
	r.HandleFunc("/api/notifications/{id}/read", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		vars := mux.Vars(req)
		notificationStore.MarkRead(vars["id"])
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("POST")

	// Mark all as read
	r.HandleFunc("/api/notifications/read-all", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		notificationStore.MarkAllRead()
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("POST")

	// Clear all notifications
	r.HandleFunc("/api/notifications", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		notificationStore.Clear()
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("DELETE")

	// Get notification config
	r.HandleFunc("/api/notifications/config", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(notificationStore.GetConfig())
	}).Methods("GET")

	// Update notification config
	r.HandleFunc("/api/notifications/config", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var config NotificationConfig
		if err := json.NewDecoder(req.Body).Decode(&config); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := notificationStore.UpdateConfig(config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(config)
	}).Methods("PUT")
}
