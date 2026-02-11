package porterui

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// InitSQLiteDatabase initializes a SQLite database connection
func InitSQLiteDatabase(dbPath string) error {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	var conn *sql.DB
	var err error

	// Open SQLite database
	conn, err = sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err != nil {
		return fmt.Errorf("failed to open SQLite database: %w", err)
	}

	// Configure connection pool for SQLite
	conn.SetMaxOpenConns(1) // SQLite works best with single connection for writes
	conn.SetMaxIdleConns(1)
	conn.SetConnMaxLifetime(0) // Keep connection open

	// Test connection
	if err = conn.Ping(); err != nil {
		conn.Close()
		return fmt.Errorf("failed to ping SQLite database: %w", err)
	}

	db = &Database{db: conn}
	dbType = "sqlite"

	// Check if tables already exist - skip migrations if they do
	var tableCount int
	err = conn.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'").Scan(&tableCount)
	if err == nil && tableCount > 0 {
		log.Println("SQLite database tables already exist, skipping migrations")
	} else {
		// Run migrations only if tables don't exist
		log.Println("Running SQLite database migrations...")
		if err := db.migrateSQLite(); err != nil {
			log.Printf("Migration warning: %v (continuing anyway)", err)
		}
	}

	log.Println("SQLite database initialized successfully")
	return nil
}

// migrateSQLite runs SQLite-compatible migrations
func (d *Database) migrateSQLite() error {
	migrations := []string{
		// Users table
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			email TEXT UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'viewer',
			display_name TEXT,
			avatar_url TEXT,
			is_active INTEGER DEFAULT 1,
			last_login TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
		`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,

		// Roles table
		`CREATE TABLE IF NOT EXISTS roles (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			description TEXT,
			permissions TEXT,
			is_system INTEGER DEFAULT 0,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,

		// Sessions table
		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			token TEXT NOT NULL,
			ip_address TEXT,
			user_agent TEXT,
			expires_at TEXT NOT NULL,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,

		// Machines table
		`CREATE TABLE IF NOT EXISTS machines (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			ip TEXT NOT NULL,
			username TEXT NOT NULL,
			password TEXT,
			status TEXT DEFAULT 'unknown',
			category TEXT,
			notes TEXT,
			agent_port INTEGER DEFAULT 8083,
			has_agent INTEGER DEFAULT 0,
			tags TEXT,
			mac TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_machines_name ON machines(name)`,
		`CREATE INDEX IF NOT EXISTS idx_machines_ip ON machines(ip)`,
		`CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status)`,
		`CREATE INDEX IF NOT EXISTS idx_machines_category ON machines(category)`,

		// Execution history table
		`CREATE TABLE IF NOT EXISTS execution_history (
			id TEXT PRIMARY KEY,
			machine_id TEXT,
			machine_name TEXT,
			machine_ip TEXT,
			script_path TEXT,
			script_name TEXT,
			args TEXT,
			preset_name TEXT,
			started_at TEXT,
			finished_at TEXT,
			duration TEXT,
			success INTEGER,
			output TEXT,
			error TEXT,
			exit_code INTEGER DEFAULT 0,
			operator TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_history_machine_id ON execution_history(machine_id)`,
		`CREATE INDEX IF NOT EXISTS idx_history_script_name ON execution_history(script_name)`,
		`CREATE INDEX IF NOT EXISTS idx_history_started_at ON execution_history(started_at)`,
		`CREATE INDEX IF NOT EXISTS idx_history_success ON execution_history(success)`,

		// Scheduled jobs table
		`CREATE TABLE IF NOT EXISTS scheduled_jobs (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			script_path TEXT NOT NULL,
			args TEXT,
			machine_ids TEXT,
			cron_expr TEXT NOT NULL,
			enabled INTEGER DEFAULT 1,
			last_run TEXT,
			next_run TEXT,
			last_status TEXT,
			last_error TEXT,
			run_count INTEGER DEFAULT 0,
			success_count INTEGER DEFAULT 0,
			fail_count INTEGER DEFAULT 0,
			timeout_mins INTEGER DEFAULT 0,
			retry_count INTEGER DEFAULT 0,
			retry_delay_min INTEGER DEFAULT 0,
			notify_on_fail INTEGER DEFAULT 0,
			notify_on_success INTEGER DEFAULT 0,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_name ON scheduled_jobs(name)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_enabled ON scheduled_jobs(enabled)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON scheduled_jobs(next_run)`,

		// Custom scripts table
		`CREATE TABLE IF NOT EXISTS custom_scripts (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			category TEXT,
			file_name TEXT NOT NULL,
			content TEXT,
			size INTEGER DEFAULT 0,
			tags TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_scripts_name ON custom_scripts(name)`,
		`CREATE INDEX IF NOT EXISTS idx_scripts_category ON custom_scripts(category)`,

		// Bookmarks table
		`CREATE TABLE IF NOT EXISTS bookmarks (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			script_path TEXT,
			command TEXT,
			args TEXT,
			machine_ids TEXT,
			description TEXT,
			color TEXT,
			user_id TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookmarks_type ON bookmarks(type)`,

		// Notifications table
		`CREATE TABLE IF NOT EXISTS notifications (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			title TEXT NOT NULL,
			message TEXT,
			is_read INTEGER DEFAULT 0,
			data TEXT,
			user_id TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)`,

		// Notification config table
		`CREATE TABLE IF NOT EXISTS notification_config (
			id INTEGER PRIMARY KEY DEFAULT 1,
			enabled INTEGER DEFAULT 1,
			slack_webhook TEXT,
			email_smtp TEXT,
			email_from TEXT,
			email_to TEXT,
			email_password TEXT,
			on_success INTEGER DEFAULT 0,
			on_failure INTEGER DEFAULT 1,
			on_scheduled INTEGER DEFAULT 0,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,

		// Health cache table
		`CREATE TABLE IF NOT EXISTS health_cache (
			machine_id TEXT PRIMARY KEY,
			machine_name TEXT,
			ip TEXT,
			online INTEGER DEFAULT 0,
			cpu_usage TEXT,
			memory_usage TEXT,
			disk_usage TEXT,
			load_avg TEXT,
			uptime TEXT,
			last_checked TEXT,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
		)`,

		// Audit log table
		`CREATE TABLE IF NOT EXISTS audit_log (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			username TEXT,
			action TEXT NOT NULL,
			resource_type TEXT,
			resource_id TEXT,
			details TEXT,
			ip_address TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)`,

		// Build clients table
		`CREATE TABLE IF NOT EXISTS build_clients (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			customer TEXT NOT NULL,
			pack TEXT,
			branch TEXT NOT NULL,
			version TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_build_clients_name ON build_clients(name)`,
		`CREATE INDEX IF NOT EXISTS idx_build_clients_customer ON build_clients(customer)`,

		// Insert default roles
		`INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system) VALUES
			('role-admin', 'admin', 'Full system access with root privileges', '["*", "sudo:enabled"]', 1),
			('role-operator', 'operator', 'Execute scripts and commands as regular user', '["machines:read", "machines:write", "scripts:read", "scripts:execute", "history:read", "history:write", "scheduler:read", "scheduler:write", "terminal:access", "files:read", "files:write", "tools:access"]', 1),
			('role-viewer', 'viewer', 'Read-only monitoring access', '["machines:read", "scripts:read", "history:read", "scheduler:read", "dashboard:read"]', 1)`,
	}

	for i, migration := range migrations {
		_, err := d.db.Exec(migration)
		if err != nil {
			log.Printf("SQLite migration %d warning: %v", i+1, err)
		}
	}

	log.Println("SQLite database migrations completed")
	return nil
}

// GetSQLitePath returns the default SQLite database path
func GetSQLitePath() string {
	// Check for custom path
	if path := os.Getenv("SQLITE_PATH"); path != "" {
		return path
	}

	// Always use data directory for SQLite
	return filepath.Join(getDataDir(), "porter.db")
}

// IsSQLite returns true if using SQLite database
func IsSQLite() bool {
	return dbType == "sqlite"
}

// IsMySQL returns true if using MySQL database
func IsMySQL() bool {
	return dbType == "mysql"
}

// dbType tracks which database type is in use
var dbType string = ""

// NowFunc returns the current time formatted for the database
func NowFunc() string {
	return time.Now().UTC().Format("2006-01-02 15:04:05")
}
