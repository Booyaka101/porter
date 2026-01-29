package porterui

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

// MigrateFromJSON migrates all data from JSON files to MySQL
func MigrateFromJSON() error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	dataDir := getDataDir()
	log.Printf("Starting migration from JSON files in: %s", dataDir)

	var errors []string

	// Migrate machines
	if err := migrateMachines(dataDir); err != nil {
		errors = append(errors, fmt.Sprintf("machines: %v", err))
	}

	// Migrate execution history
	if err := migrateHistory(dataDir); err != nil {
		errors = append(errors, fmt.Sprintf("history: %v", err))
	}

	// Migrate scheduled jobs
	if err := migrateScheduledJobs(dataDir); err != nil {
		errors = append(errors, fmt.Sprintf("scheduled_jobs: %v", err))
	}

	// Migrate custom scripts
	if err := migrateCustomScripts(dataDir); err != nil {
		errors = append(errors, fmt.Sprintf("custom_scripts: %v", err))
	}

	// Migrate bookmarks
	if err := migrateBookmarks(dataDir); err != nil {
		errors = append(errors, fmt.Sprintf("bookmarks: %v", err))
	}

	// Migrate notification config
	if err := migrateNotificationConfig(dataDir); err != nil {
		errors = append(errors, fmt.Sprintf("notification_config: %v", err))
	}

	if len(errors) > 0 {
		log.Printf("Migration completed with errors: %v", errors)
		return fmt.Errorf("migration errors: %v", errors)
	}

	log.Println("Migration completed successfully")
	return nil
}

func migrateMachines(dataDir string) error {
	filePath := filepath.Join(dataDir, "machines.json")
	data, err := os.ReadFile(filePath)
	if os.IsNotExist(err) {
		log.Println("No machines.json found, skipping")
		return nil
	}
	if err != nil {
		return err
	}

	var machines []struct {
		ID        string   `json:"id"`
		Name      string   `json:"name"`
		IP        string   `json:"ip"`
		Username  string   `json:"username"`
		Password  string   `json:"password"`
		Status    string   `json:"status"`
		Category  string   `json:"category"`
		Notes     string   `json:"notes"`
		AgentPort int      `json:"agent_port"`
		HasAgent  bool     `json:"has_agent"`
		Tags      []string `json:"tags"`
		MAC       string   `json:"mac"`
	}

	if err := json.Unmarshal(data, &machines); err != nil {
		return err
	}

	log.Printf("Migrating %d machines...", len(machines))

	for _, m := range machines {
		tagsJSON := "[]"
		if len(m.Tags) > 0 {
			if b, err := json.Marshal(m.Tags); err == nil {
				tagsJSON = string(b)
			}
		}

		_, err := db.db.Exec(`
			INSERT INTO machines (id, name, ip, username, password, status, category, notes, agent_port, has_agent, tags, mac)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				ip = VALUES(ip),
				username = VALUES(username),
				password = VALUES(password),
				status = VALUES(status),
				category = VALUES(category),
				notes = VALUES(notes),
				agent_port = VALUES(agent_port),
				has_agent = VALUES(has_agent),
				tags = VALUES(tags),
				mac = VALUES(mac)`,
			m.ID, m.Name, m.IP, m.Username, m.Password, m.Status, m.Category, m.Notes,
			m.AgentPort, m.HasAgent, tagsJSON, m.MAC)
		if err != nil {
			log.Printf("Failed to migrate machine %s: %v", m.ID, err)
		}
	}

	log.Printf("Migrated %d machines", len(machines))
	return nil
}

func migrateHistory(dataDir string) error {
	filePath := filepath.Join(dataDir, "execution_history.json")
	data, err := os.ReadFile(filePath)
	if os.IsNotExist(err) {
		log.Println("No execution_history.json found, skipping")
		return nil
	}
	if err != nil {
		return err
	}

	var records []ExecutionRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return err
	}

	log.Printf("Migrating %d execution records...", len(records))

	for _, r := range records {
		_, err := db.db.Exec(`
			INSERT INTO execution_history (id, machine_id, machine_name, machine_ip, script_path, script_name, 
				args, preset_name, started_at, finished_at, duration, success, output, error, exit_code, operator)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id = id`,
			r.ID, r.MachineID, r.MachineName, r.MachineIP, r.ScriptPath, r.ScriptName,
			r.Args, r.PresetName, r.StartedAt, r.FinishedAt, r.Duration, r.Success,
			r.Output, r.Error, r.ExitCode, r.Operator)
		if err != nil {
			log.Printf("Failed to migrate history record %s: %v", r.ID, err)
		}
	}

	log.Printf("Migrated %d execution records", len(records))
	return nil
}

func migrateScheduledJobs(dataDir string) error {
	filePath := filepath.Join(dataDir, "scheduled_jobs.json")
	data, err := os.ReadFile(filePath)
	if os.IsNotExist(err) {
		log.Println("No scheduled_jobs.json found, skipping")
		return nil
	}
	if err != nil {
		return err
	}

	var jobs []ScheduledJob
	if err := json.Unmarshal(data, &jobs); err != nil {
		return err
	}

	log.Printf("Migrating %d scheduled jobs...", len(jobs))

	for _, j := range jobs {
		machineIDsJSON := "[]"
		if len(j.MachineIDs) > 0 {
			if b, err := json.Marshal(j.MachineIDs); err == nil {
				machineIDsJSON = string(b)
			}
		}

		_, err := db.db.Exec(`
			INSERT INTO scheduled_jobs (id, name, description, script_path, args, machine_ids, cron_expr, 
				enabled, last_run, next_run, last_status, last_error, run_count, success_count, fail_count,
				timeout_mins, retry_count, retry_delay_min, notify_on_fail, notify_on_success, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				description = VALUES(description),
				script_path = VALUES(script_path),
				args = VALUES(args),
				machine_ids = VALUES(machine_ids),
				cron_expr = VALUES(cron_expr),
				enabled = VALUES(enabled)`,
			j.ID, j.Name, j.Description, j.ScriptPath, j.Args, machineIDsJSON, j.CronExpr,
			j.Enabled, nullTime(j.LastRun), nullTime(j.NextRun), j.LastStatus, j.LastError,
			j.RunCount, j.SuccessCount, j.FailCount, j.TimeoutMins, j.RetryCount, j.RetryDelayMin,
			j.NotifyOnFail, j.NotifyOnSuccess, j.CreatedAt)
		if err != nil {
			log.Printf("Failed to migrate scheduled job %s: %v", j.ID, err)
		}
	}

	log.Printf("Migrated %d scheduled jobs", len(jobs))
	return nil
}

func migrateCustomScripts(dataDir string) error {
	indexPath := filepath.Join(dataDir, "custom-scripts", "index.json")
	data, err := os.ReadFile(indexPath)
	if os.IsNotExist(err) {
		log.Println("No custom scripts index found, skipping")
		return nil
	}
	if err != nil {
		return err
	}

	var scripts []CustomScript
	if err := json.Unmarshal(data, &scripts); err != nil {
		return err
	}

	log.Printf("Migrating %d custom scripts...", len(scripts))

	for _, s := range scripts {
		tagsJSON := "[]"
		if len(s.Tags) > 0 {
			if b, err := json.Marshal(s.Tags); err == nil {
				tagsJSON = string(b)
			}
		}

		// Read script content from file
		content := s.Content
		if content == "" {
			scriptPath := filepath.Join(dataDir, "custom-scripts", s.Category, s.FileName)
			if contentBytes, err := os.ReadFile(scriptPath); err == nil {
				content = string(contentBytes)
			}
		}

		_, err := db.db.Exec(`
			INSERT INTO custom_scripts (id, name, description, category, file_name, content, size, tags, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				description = VALUES(description),
				category = VALUES(category),
				content = VALUES(content),
				size = VALUES(size),
				tags = VALUES(tags)`,
			s.ID, s.Name, s.Description, s.Category, s.FileName, content, s.Size, tagsJSON, s.CreatedAt, s.UpdatedAt)
		if err != nil {
			log.Printf("Failed to migrate custom script %s: %v", s.ID, err)
		}
	}

	log.Printf("Migrated %d custom scripts", len(scripts))
	return nil
}

func migrateBookmarks(dataDir string) error {
	filePath := filepath.Join(dataDir, "bookmarks.json")
	data, err := os.ReadFile(filePath)
	if os.IsNotExist(err) {
		log.Println("No bookmarks.json found, skipping")
		return nil
	}
	if err != nil {
		return err
	}

	var bookmarks []Bookmark
	if err := json.Unmarshal(data, &bookmarks); err != nil {
		return err
	}

	log.Printf("Migrating %d bookmarks...", len(bookmarks))

	for _, b := range bookmarks {
		machineIDsJSON := "[]"
		if len(b.MachineIDs) > 0 {
			if bytes, err := json.Marshal(b.MachineIDs); err == nil {
				machineIDsJSON = string(bytes)
			}
		}

		_, err := db.db.Exec(`
			INSERT INTO bookmarks (id, name, type, script_path, command, args, machine_ids, description, color, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				type = VALUES(type),
				script_path = VALUES(script_path),
				command = VALUES(command),
				args = VALUES(args),
				machine_ids = VALUES(machine_ids),
				description = VALUES(description),
				color = VALUES(color)`,
			b.ID, b.Name, b.Type, b.ScriptPath, b.Command, b.Args, machineIDsJSON, b.Description, b.Color, b.CreatedAt)
		if err != nil {
			log.Printf("Failed to migrate bookmark %s: %v", b.ID, err)
		}
	}

	log.Printf("Migrated %d bookmarks", len(bookmarks))
	return nil
}

func migrateNotificationConfig(dataDir string) error {
	filePath := filepath.Join(dataDir, "notification_config.json")
	data, err := os.ReadFile(filePath)
	if os.IsNotExist(err) {
		log.Println("No notification_config.json found, skipping")
		return nil
	}
	if err != nil {
		return err
	}

	var config NotificationConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}

	log.Println("Migrating notification config...")

	_, err = db.db.Exec(`
		INSERT INTO notification_config (id, enabled, slack_webhook, email_smtp, email_from, email_to, 
			email_password, on_success, on_failure, on_scheduled)
		VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			enabled = VALUES(enabled),
			slack_webhook = VALUES(slack_webhook),
			email_smtp = VALUES(email_smtp),
			email_from = VALUES(email_from),
			email_to = VALUES(email_to),
			email_password = VALUES(email_password),
			on_success = VALUES(on_success),
			on_failure = VALUES(on_failure),
			on_scheduled = VALUES(on_scheduled)`,
		config.Enabled, config.SlackWebhook, config.EmailSMTP, config.EmailFrom, config.EmailTo,
		config.EmailPassword, config.OnSuccess, config.OnFailure, config.OnScheduled)
	if err != nil {
		return err
	}

	log.Println("Migrated notification config")
	return nil
}

func nullTime(t time.Time) interface{} {
	if t.IsZero() {
		return nil
	}
	return t
}
