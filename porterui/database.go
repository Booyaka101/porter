package porterui

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// Database holds the MySQL connection
type Database struct {
	db *sql.DB
}

// DBConfig holds database configuration
type DBConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
}

var db *Database

// InitDatabase initializes the MySQL database connection with retry logic
func InitMySQLDatabase(config DBConfig) error {
	dbType = "mysql"
	// Add timeout parameters to prevent hanging on connection/queries
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&timeout=10s&readTimeout=30s&writeTimeout=30s",
		config.User, config.Password, config.Host, config.Port, config.Database)

	var conn *sql.DB
	var err error

	// Retry connection up to 3 times
	for attempt := 1; attempt <= 3; attempt++ {
		conn, err = sql.Open("mysql", dsn)
		if err != nil {
			log.Printf("Database connection attempt %d failed: %v", attempt, err)
			if attempt < 3 {
				time.Sleep(time.Duration(attempt) * time.Second)
				continue
			}
			return fmt.Errorf("failed to open database after %d attempts: %w", attempt, err)
		}
		break
	}

	// Configure connection pool
	conn.SetMaxOpenConns(10)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(3 * time.Minute)

	// Test connection with retry
	for attempt := 1; attempt <= 3; attempt++ {
		err = conn.Ping()
		if err == nil {
			break
		}
		log.Printf("Database ping attempt %d failed: %v", attempt, err)
		if attempt < 3 {
			time.Sleep(time.Duration(attempt) * time.Second)
			continue
		}
		conn.Close()
		return fmt.Errorf("failed to ping database after %d attempts: %w", attempt, err)
	}

	db = &Database{db: conn}

	// Check if tables already exist - skip migrations if they do
	var tableCount int
	err = conn.QueryRow("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'").Scan(&tableCount)
	if err == nil && tableCount > 0 {
		log.Println("Database tables already exist, skipping migrations")
	} else {
		// Run migrations only if tables don't exist
		log.Println("Running database migrations...")
		if err := db.migrateWithRecovery(); err != nil {
			log.Printf("Migration warning: %v (continuing anyway)", err)
		}
	}

	log.Println("Database initialized successfully")
	return nil
}

// GetDB returns the database instance
func GetDB() *Database {
	return db
}

// Close closes the database connection
func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

// migrateWithRecovery runs database migrations with error recovery
func (d *Database) migrateWithRecovery() error {
	return d.migrate()
}

// migrate runs database migrations
func (d *Database) migrate() error {
	migrations := []string{
		// Users table
		`CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(64) PRIMARY KEY,
			username VARCHAR(100) UNIQUE NOT NULL,
			email VARCHAR(255) UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			role VARCHAR(50) NOT NULL DEFAULT 'viewer',
			display_name VARCHAR(100),
			avatar_url VARCHAR(500),
			is_active BOOLEAN DEFAULT TRUE,
			last_login DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_username (username),
			INDEX idx_email (email),
			INDEX idx_role (role)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Roles table
		`CREATE TABLE IF NOT EXISTS roles (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(50) UNIQUE NOT NULL,
			description VARCHAR(255),
			permissions JSON,
			is_system BOOLEAN DEFAULT FALSE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Sessions table
		`CREATE TABLE IF NOT EXISTS sessions (
			id VARCHAR(64) PRIMARY KEY,
			user_id VARCHAR(64) NOT NULL,
			token VARCHAR(500) NOT NULL,
			ip_address VARCHAR(45),
			user_agent VARCHAR(500),
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_user_id (user_id),
			INDEX idx_token (token(255)),
			INDEX idx_expires (expires_at),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Machines table
		`CREATE TABLE IF NOT EXISTS machines (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			ip VARCHAR(45) NOT NULL,
			username VARCHAR(100) NOT NULL,
			password VARCHAR(500),
			status VARCHAR(20) DEFAULT 'unknown',
			category VARCHAR(100),
			notes TEXT,
			agent_port INT DEFAULT 8083,
			has_agent BOOLEAN DEFAULT FALSE,
			tags JSON,
			mac VARCHAR(17),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_name (name),
			INDEX idx_ip (ip),
			INDEX idx_status (status),
			INDEX idx_category (category)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Execution history table
		`CREATE TABLE IF NOT EXISTS execution_history (
			id VARCHAR(64) PRIMARY KEY,
			machine_id VARCHAR(64),
			machine_name VARCHAR(100),
			machine_ip VARCHAR(45),
			script_path VARCHAR(500),
			script_name VARCHAR(255),
			args TEXT,
			preset_name VARCHAR(100),
			started_at DATETIME,
			finished_at DATETIME,
			duration VARCHAR(50),
			success BOOLEAN,
			output LONGTEXT,
			error TEXT,
			exit_code INT DEFAULT 0,
			operator VARCHAR(100),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_machine_id (machine_id),
			INDEX idx_script_name (script_name),
			INDEX idx_started_at (started_at),
			INDEX idx_success (success)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Scheduled jobs table
		`CREATE TABLE IF NOT EXISTS scheduled_jobs (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			description TEXT,
			script_path VARCHAR(500) NOT NULL,
			args TEXT,
			machine_ids JSON,
			cron_expr VARCHAR(100) NOT NULL,
			enabled BOOLEAN DEFAULT TRUE,
			last_run DATETIME,
			next_run DATETIME,
			last_status VARCHAR(50),
			last_error TEXT,
			run_count INT DEFAULT 0,
			success_count INT DEFAULT 0,
			fail_count INT DEFAULT 0,
			timeout_mins INT DEFAULT 0,
			retry_count INT DEFAULT 0,
			retry_delay_min INT DEFAULT 0,
			notify_on_fail BOOLEAN DEFAULT FALSE,
			notify_on_success BOOLEAN DEFAULT FALSE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_name (name),
			INDEX idx_enabled (enabled),
			INDEX idx_next_run (next_run)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Custom scripts table
		`CREATE TABLE IF NOT EXISTS custom_scripts (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			description TEXT,
			category VARCHAR(100),
			file_name VARCHAR(255) NOT NULL,
			content LONGTEXT,
			size BIGINT DEFAULT 0,
			tags JSON,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_name (name),
			INDEX idx_category (category)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Bookmarks table
		`CREATE TABLE IF NOT EXISTS bookmarks (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			type VARCHAR(20) NOT NULL,
			script_path VARCHAR(500),
			command TEXT,
			args TEXT,
			machine_ids JSON,
			description TEXT,
			color VARCHAR(20),
			user_id VARCHAR(64),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_user_id (user_id),
			INDEX idx_type (type)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Notifications table
		`CREATE TABLE IF NOT EXISTS notifications (
			id VARCHAR(64) PRIMARY KEY,
			type VARCHAR(20) NOT NULL,
			title VARCHAR(255) NOT NULL,
			message TEXT,
			is_read BOOLEAN DEFAULT FALSE,
			data JSON,
			user_id VARCHAR(64),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_user_id (user_id),
			INDEX idx_is_read (is_read),
			INDEX idx_created_at (created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Notification config table
		`CREATE TABLE IF NOT EXISTS notification_config (
			id INT PRIMARY KEY DEFAULT 1,
			enabled BOOLEAN DEFAULT TRUE,
			slack_webhook VARCHAR(500),
			email_smtp VARCHAR(255),
			email_from VARCHAR(255),
			email_to VARCHAR(255),
			email_password VARCHAR(255),
			on_success BOOLEAN DEFAULT FALSE,
			on_failure BOOLEAN DEFAULT TRUE,
			on_scheduled BOOLEAN DEFAULT FALSE,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Health cache table
		`CREATE TABLE IF NOT EXISTS health_cache (
			machine_id VARCHAR(64) PRIMARY KEY,
			machine_name VARCHAR(100),
			ip VARCHAR(45),
			online BOOLEAN DEFAULT FALSE,
			cpu_usage VARCHAR(20),
			memory_usage VARCHAR(20),
			disk_usage VARCHAR(20),
			load_avg VARCHAR(50),
			uptime VARCHAR(100),
			last_checked DATETIME,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Audit log table
		`CREATE TABLE IF NOT EXISTS audit_log (
			id VARCHAR(64) PRIMARY KEY,
			user_id VARCHAR(64),
			username VARCHAR(100),
			action VARCHAR(100) NOT NULL,
			resource_type VARCHAR(50),
			resource_id VARCHAR(64),
			details JSON,
			ip_address VARCHAR(45),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_user_id (user_id),
			INDEX idx_action (action),
			INDEX idx_resource (resource_type, resource_id),
			INDEX idx_created_at (created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Insert default roles
		// viewer: read-only monitoring, no actions allowed
		// operator: can execute scripts/commands as non-sudo user, manage machines
		// admin: full access, runs commands as root
		`INSERT IGNORE INTO roles (id, name, description, permissions, is_system) VALUES
			('role-admin', 'admin', 'Full system access with root privileges', '["*", "sudo:enabled"]', TRUE),
			('role-operator', 'operator', 'Execute scripts and commands as regular user', '["machines:read", "machines:write", "scripts:read", "scripts:execute", "history:read", "history:write", "scheduler:read", "scheduler:write", "terminal:access", "files:read", "files:write", "tools:access"]', TRUE),
			('role-viewer', 'viewer', 'Read-only monitoring access', '["machines:read", "scripts:read", "history:read", "scheduler:read", "dashboard:read"]', TRUE)`,
	}

	var lastErr error
	for i, migration := range migrations {
		// Use a context with 10 second timeout for each migration to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		_, err := d.db.ExecContext(ctx, migration)
		cancel()
		if err != nil {
			// Log but continue - table may already exist or be locked
			log.Printf("Migration %d warning: %v", i+1, err)
			lastErr = err
			// Continue with other migrations
		}
	}

	if lastErr != nil {
		log.Printf("Some migrations had warnings, but continuing...")
	}
	log.Println("Database migrations completed")
	return nil
}

// LoadDBConfigFromEnv loads database config from environment variables
func LoadDBConfigFromEnv() DBConfig {
	return DBConfig{
		Host:     getEnvOrDefault("DB_HOST", "localhost"),
		Port:     getEnvIntOrDefault("DB_PORT", 3306),
		User:     getEnvOrDefault("DB_USER", "porter"),
		Password: getEnvOrDefault("DB_PASSWORD", ""),
		Database: getEnvOrDefault("DB_NAME", "porter"),
	}
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvIntOrDefault(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		var i int
		fmt.Sscanf(val, "%d", &i)
		if i > 0 {
			return i
		}
	}
	return defaultVal
}
