package porterui

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

// MigrateFromMySQLToSQLite migrates all data from MySQL to SQLite
func MigrateFromMySQLToSQLite(mysqlConfig DBConfig, sqlitePath string) error {
	log.Println("Starting MySQL to SQLite migration...")

	// Connect to MySQL
	mysqlDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&charset=utf8mb4",
		mysqlConfig.User, mysqlConfig.Password, mysqlConfig.Host, mysqlConfig.Port, mysqlConfig.Database)

	mysqlDB, err := sql.Open("mysql", mysqlDSN)
	if err != nil {
		return fmt.Errorf("failed to connect to MySQL: %w", err)
	}
	defer mysqlDB.Close()

	if err := mysqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping MySQL: %w", err)
	}
	log.Println("Connected to MySQL")

	// Initialize SQLite
	if err := InitSQLiteDatabase(sqlitePath); err != nil {
		return fmt.Errorf("failed to initialize SQLite: %w", err)
	}
	log.Println("SQLite database initialized")

	// Migrate each table
	tables := []struct {
		name    string
		migrate func(*sql.DB, *Database) error
	}{
		{"users", migrateMySQLUsers},
		{"roles", migrateMySQLRoles},
		{"machines", migrateMySQLMachines},
		{"execution_history", migrateMySQLHistory},
		{"scheduled_jobs", migrateMySQLScheduledJobs},
		{"custom_scripts", migrateMySQLCustomScripts},
		{"bookmarks", migrateMySQLBookmarks},
		{"notifications", migrateMySQLNotifications},
		{"notification_config", migrateMySQLNotificationConfig},
		{"audit_log", migrateMySQLAuditLog},
	}

	for _, t := range tables {
		log.Printf("Migrating table: %s", t.name)
		if err := t.migrate(mysqlDB, db); err != nil {
			log.Printf("Warning: failed to migrate %s: %v", t.name, err)
			// Continue with other tables
		}
	}

	log.Println("MySQL to SQLite migration completed!")
	return nil
}

func migrateMySQLUsers(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`
		SELECT id, username, COALESCE(email, ''), password_hash, role, 
		       COALESCE(display_name, ''), COALESCE(avatar_url, ''), is_active,
		       last_login, created_at, updated_at
		FROM users`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, username, email, passwordHash, role, displayName, avatarURL string
		var isActive bool
		var lastLogin, createdAt, updatedAt sql.NullString

		if err := rows.Scan(&id, &username, &email, &passwordHash, &role,
			&displayName, &avatarURL, &isActive, &lastLogin, &createdAt, &updatedAt); err != nil {
			log.Printf("Warning: failed to scan user row: %v", err)
			continue
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO users (id, username, email, password_hash, role, display_name, avatar_url, is_active, last_login, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, username, nullIfEmpty(email), passwordHash, role, nullIfEmpty(displayName), nullIfEmpty(avatarURL),
			boolToInt(isActive), nullIfEmpty(lastLogin.String), nullIfEmpty(createdAt.String), nullIfEmpty(updatedAt.String))
		if err != nil {
			log.Printf("Warning: failed to insert user %s: %v", username, err)
			continue
		}
		count++
	}
	log.Printf("  Migrated %d users", count)
	return nil
}

func migrateMySQLRoles(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`SELECT id, name, description, permissions, is_system, created_at FROM roles`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, name, description, permissions string
		var isSystem bool
		var createdAt sql.NullString

		if err := rows.Scan(&id, &name, &description, &permissions, &isSystem, &createdAt); err != nil {
			continue
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO roles (id, name, description, permissions, is_system, created_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
			id, name, description, permissions, boolToInt(isSystem), nullIfEmpty(createdAt.String))
		if err != nil {
			continue
		}
		count++
	}
	log.Printf("  Migrated %d roles", count)
	return nil
}

func migrateMySQLMachines(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`
		SELECT id, name, ip, username, COALESCE(password, ''), status, 
		       COALESCE(category, ''), COALESCE(notes, ''), agent_port, has_agent,
		       COALESCE(tags, '[]'), COALESCE(mac, ''), created_at, updated_at
		FROM machines`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, name, ip, username, password, status, category, notes, tags, mac string
		var agentPort int
		var hasAgent bool
		var createdAt, updatedAt sql.NullString

		if err := rows.Scan(&id, &name, &ip, &username, &password, &status,
			&category, &notes, &agentPort, &hasAgent, &tags, &mac, &createdAt, &updatedAt); err != nil {
			log.Printf("Warning: failed to scan machine row: %v", err)
			continue
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO machines (id, name, ip, username, password, status, category, notes, agent_port, has_agent, tags, mac, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, name, ip, username, nullIfEmpty(password), status, nullIfEmpty(category), nullIfEmpty(notes),
			agentPort, boolToInt(hasAgent), tags, nullIfEmpty(mac), nullIfEmpty(createdAt.String), nullIfEmpty(updatedAt.String))
		if err != nil {
			log.Printf("Warning: failed to insert machine %s: %v", name, err)
			continue
		}
		count++
	}
	log.Printf("  Migrated %d machines", count)
	return nil
}

func migrateMySQLHistory(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`
		SELECT id, COALESCE(machine_id, ''), COALESCE(machine_name, ''), COALESCE(machine_ip, ''),
		       COALESCE(script_path, ''), COALESCE(script_name, ''), COALESCE(args, ''),
		       COALESCE(preset_name, ''), started_at, finished_at, COALESCE(duration, ''),
		       success, COALESCE(output, ''), COALESCE(error, ''), exit_code, COALESCE(operator, ''), created_at
		FROM execution_history ORDER BY created_at DESC LIMIT 1000`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, machineID, machineName, machineIP, scriptPath, scriptName, args string
		var presetName, duration, output, errorMsg, operator string
		var startedAt, finishedAt, createdAt sql.NullString
		var success sql.NullBool
		var exitCode int

		if err := rows.Scan(&id, &machineID, &machineName, &machineIP, &scriptPath, &scriptName, &args,
			&presetName, &startedAt, &finishedAt, &duration, &success, &output, &errorMsg, &exitCode, &operator, &createdAt); err != nil {
			continue
		}

		successInt := 0
		if success.Valid && success.Bool {
			successInt = 1
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO execution_history (id, machine_id, machine_name, machine_ip, script_path, script_name, args, preset_name, started_at, finished_at, duration, success, output, error, exit_code, operator, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, nullIfEmpty(machineID), nullIfEmpty(machineName), nullIfEmpty(machineIP), nullIfEmpty(scriptPath),
			nullIfEmpty(scriptName), nullIfEmpty(args), nullIfEmpty(presetName), nullIfEmpty(startedAt.String),
			nullIfEmpty(finishedAt.String), nullIfEmpty(duration), successInt, nullIfEmpty(output), nullIfEmpty(errorMsg),
			exitCode, nullIfEmpty(operator), nullIfEmpty(createdAt.String))
		if err != nil {
			continue
		}
		count++
	}
	log.Printf("  Migrated %d history entries", count)
	return nil
}

func migrateMySQLScheduledJobs(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`
		SELECT id, name, COALESCE(description, ''), script_path, COALESCE(args, ''),
		       COALESCE(machine_ids, '[]'), cron_expr, enabled, last_run, next_run,
		       COALESCE(last_status, ''), COALESCE(last_error, ''), run_count, success_count, fail_count,
		       timeout_mins, retry_count, retry_delay_min, notify_on_fail, notify_on_success, created_at
		FROM scheduled_jobs`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, name, description, scriptPath, args, machineIDs, cronExpr string
		var lastStatus, lastError string
		var enabled, notifyOnFail, notifyOnSuccess bool
		var lastRun, nextRun, createdAt sql.NullString
		var runCount, successCount, failCount, timeoutMins, retryCount, retryDelayMin int

		if err := rows.Scan(&id, &name, &description, &scriptPath, &args, &machineIDs, &cronExpr,
			&enabled, &lastRun, &nextRun, &lastStatus, &lastError, &runCount, &successCount, &failCount,
			&timeoutMins, &retryCount, &retryDelayMin, &notifyOnFail, &notifyOnSuccess, &createdAt); err != nil {
			continue
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO scheduled_jobs (id, name, description, script_path, args, machine_ids, cron_expr, enabled, last_run, next_run, last_status, last_error, run_count, success_count, fail_count, timeout_mins, retry_count, retry_delay_min, notify_on_fail, notify_on_success, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, name, nullIfEmpty(description), scriptPath, nullIfEmpty(args), machineIDs, cronExpr,
			boolToInt(enabled), nullIfEmpty(lastRun.String), nullIfEmpty(nextRun.String), nullIfEmpty(lastStatus),
			nullIfEmpty(lastError), runCount, successCount, failCount, timeoutMins, retryCount, retryDelayMin,
			boolToInt(notifyOnFail), boolToInt(notifyOnSuccess), nullIfEmpty(createdAt.String))
		if err != nil {
			continue
		}
		count++
	}
	log.Printf("  Migrated %d scheduled jobs", count)
	return nil
}

func migrateMySQLCustomScripts(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`
		SELECT id, name, COALESCE(description, ''), COALESCE(category, ''), file_name,
		       COALESCE(content, ''), size, COALESCE(tags, '[]'), created_at
		FROM custom_scripts`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, name, description, category, fileName, content, tags string
		var size int64
		var createdAt sql.NullString

		if err := rows.Scan(&id, &name, &description, &category, &fileName, &content, &size, &tags, &createdAt); err != nil {
			continue
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO custom_scripts (id, name, description, category, file_name, content, size, tags, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, name, nullIfEmpty(description), nullIfEmpty(category), fileName, nullIfEmpty(content), size, tags, nullIfEmpty(createdAt.String))
		if err != nil {
			continue
		}
		count++
	}
	log.Printf("  Migrated %d custom scripts", count)
	return nil
}

func migrateMySQLBookmarks(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`
		SELECT id, name, type, COALESCE(script_path, ''), COALESCE(command, ''),
		       COALESCE(args, ''), COALESCE(machine_ids, '[]'), COALESCE(description, ''),
		       COALESCE(color, ''), COALESCE(user_id, ''), created_at
		FROM bookmarks`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, name, bookmarkType, scriptPath, command, args, machineIDs, description, color, userID string
		var createdAt sql.NullString

		if err := rows.Scan(&id, &name, &bookmarkType, &scriptPath, &command, &args, &machineIDs, &description, &color, &userID, &createdAt); err != nil {
			continue
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO bookmarks (id, name, type, script_path, command, args, machine_ids, description, color, user_id, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, name, bookmarkType, nullIfEmpty(scriptPath), nullIfEmpty(command), nullIfEmpty(args),
			machineIDs, nullIfEmpty(description), nullIfEmpty(color), nullIfEmpty(userID), nullIfEmpty(createdAt.String))
		if err != nil {
			continue
		}
		count++
	}
	log.Printf("  Migrated %d bookmarks", count)
	return nil
}

func migrateMySQLNotifications(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`
		SELECT id, type, title, COALESCE(message, ''), is_read, COALESCE(data, '{}'),
		       COALESCE(user_id, ''), created_at
		FROM notifications ORDER BY created_at DESC LIMIT 500`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, notifType, title, message, data, userID string
		var isRead bool
		var createdAt sql.NullString

		if err := rows.Scan(&id, &notifType, &title, &message, &isRead, &data, &userID, &createdAt); err != nil {
			continue
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO notifications (id, type, title, message, is_read, data, user_id, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, notifType, title, nullIfEmpty(message), boolToInt(isRead), data, nullIfEmpty(userID), nullIfEmpty(createdAt.String))
		if err != nil {
			continue
		}
		count++
	}
	log.Printf("  Migrated %d notifications", count)
	return nil
}

func migrateMySQLNotificationConfig(mysql *sql.DB, sqlite *Database) error {
	var enabled, onSuccess, onFailure, onScheduled bool
	var slackWebhook, emailSmtp, emailFrom, emailTo, emailPassword sql.NullString

	err := mysql.QueryRow(`SELECT enabled, slack_webhook, email_smtp, email_from, email_to, email_password, on_success, on_failure, on_scheduled FROM notification_config WHERE id = 1`).
		Scan(&enabled, &slackWebhook, &emailSmtp, &emailFrom, &emailTo, &emailPassword, &onSuccess, &onFailure, &onScheduled)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("  No notification config to migrate")
			return nil
		}
		return err
	}

	_, err = sqlite.db.Exec(`
		INSERT OR REPLACE INTO notification_config (id, enabled, slack_webhook, email_smtp, email_from, email_to, email_password, on_success, on_failure, on_scheduled)
		VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		boolToInt(enabled), nullIfEmpty(slackWebhook.String), nullIfEmpty(emailSmtp.String),
		nullIfEmpty(emailFrom.String), nullIfEmpty(emailTo.String), nullIfEmpty(emailPassword.String),
		boolToInt(onSuccess), boolToInt(onFailure), boolToInt(onScheduled))
	if err != nil {
		return err
	}
	log.Printf("  Migrated notification config")
	return nil
}

func migrateMySQLAuditLog(mysql *sql.DB, sqlite *Database) error {
	rows, err := mysql.Query(`
		SELECT id, COALESCE(user_id, ''), COALESCE(username, ''), action,
		       COALESCE(resource_type, ''), COALESCE(resource_id, ''), COALESCE(details, '{}'),
		       COALESCE(ip_address, ''), created_at
		FROM audit_log ORDER BY created_at DESC LIMIT 1000`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, userID, username, action, resourceType, resourceID, details, ipAddress string
		var createdAt sql.NullString

		if err := rows.Scan(&id, &userID, &username, &action, &resourceType, &resourceID, &details, &ipAddress, &createdAt); err != nil {
			continue
		}

		_, err := sqlite.db.Exec(`
			INSERT OR REPLACE INTO audit_log (id, user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, nullIfEmpty(userID), nullIfEmpty(username), action, nullIfEmpty(resourceType),
			nullIfEmpty(resourceID), details, nullIfEmpty(ipAddress), nullIfEmpty(createdAt.String))
		if err != nil {
			continue
		}
		count++
	}
	log.Printf("  Migrated %d audit log entries", count)
	return nil
}

// Helper functions
func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// ExportMySQLToJSON exports MySQL data to JSON for backup
func ExportMySQLToJSON(mysqlConfig DBConfig) (map[string]interface{}, error) {
	mysqlDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&charset=utf8mb4",
		mysqlConfig.User, mysqlConfig.Password, mysqlConfig.Host, mysqlConfig.Port, mysqlConfig.Database)

	mysqlDB, err := sql.Open("mysql", mysqlDSN)
	if err != nil {
		return nil, err
	}
	defer mysqlDB.Close()

	export := make(map[string]interface{})

	// Export machines
	rows, err := mysqlDB.Query("SELECT id, name, ip, username, password, status, category, notes, agent_port, has_agent, tags, mac FROM machines")
	if err == nil {
		var machines []map[string]interface{}
		for rows.Next() {
			var id, name, ip, username string
			var password, status, category, notes, tags, mac sql.NullString
			var agentPort int
			var hasAgent bool

			rows.Scan(&id, &name, &ip, &username, &password, &status, &category, &notes, &agentPort, &hasAgent, &tags, &mac)
			m := map[string]interface{}{
				"id": id, "name": name, "ip": ip, "username": username,
				"password": password.String, "status": status.String, "category": category.String,
				"notes": notes.String, "agent_port": agentPort, "has_agent": hasAgent,
				"mac": mac.String,
			}
			if tags.Valid {
				var t []string
				json.Unmarshal([]byte(tags.String), &t)
				m["tags"] = t
			}
			machines = append(machines, m)
		}
		rows.Close()
		export["machines"] = machines
	}

	return export, nil
}
