package porterui

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/benitogf/ooo"
	"github.com/gorilla/mux"
)

// RunConfig holds configuration for running Porter
type RunConfig struct {
	// UIBuildFS is the embedded filesystem containing the UI build
	UIBuildFS embed.FS
	// UIBuildRoot is the root directory in UIBuildFS (default: "build")
	UIBuildRoot string
	// DefaultPort is the default server port (default: 8069)
	DefaultPort int
	// AppName is used in log messages (default: "Porter")
	AppName string
	// Port overrides DefaultPort (set via flag or config)
	Port int
	// OpenBrowser controls whether to auto-open browser
	OpenBrowser bool
	// PortableMode stores data alongside binary
	PortableMode bool
	// UseMySQL uses MySQL instead of SQLite
	UseMySQL bool
	// UseSQLite uses SQLite (default true)
	UseSQLite bool
	// MigrateData migrates JSON data to database
	MigrateData bool
	// MigrateFromMySQL migrates from MySQL to SQLite
	MigrateFromMySQL bool
}

func runnerOpenBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}

// runnerSpaHandler serves the SPA and handles client-side routing
func runnerSpaHandler(fileServer http.Handler, subFS fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api") {
			http.Error(w, "Not Found", http.StatusNotFound)
			return
		}

		path := r.URL.Path
		if path == "/" {
			path = "/index.html"
		}
		_, err := fs.Stat(subFS, path[1:])
		if err != nil {
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})
}

// Run starts Porter with the given configuration.
// Wrappers should call this after setting EmbeddedScripts and ScriptDiscoveryConfig.
//
// Example wrapper:
//
//	package main
//
//	import (
//	    "embed"
//	    "github.com/booyaka101/porter/porterui"
//	)
//
//	//go:embed embedded-scripts/*
//	var scripts embed.FS
//
//	//go:embed build/*
//	var ui embed.FS
//
//	func main() {
//	    porterui.EmbeddedScripts = scripts
//	    porterui.SetScriptDiscoveryConfig(&porterui.ScriptDiscoveryConfig{
//	        EmbeddedRoot: "embedded-scripts",
//	        TopLevelScripts: map[string]bool{"setup.sh": true},
//	    })
//	    porterui.Run(porterui.RunConfig{UIBuildFS: ui})
//	}
func Run(config RunConfig) {
	// Set defaults
	if config.UIBuildRoot == "" {
		config.UIBuildRoot = "build"
	}
	if config.DefaultPort == 0 {
		config.DefaultPort = 8069
	}
	if config.AppName == "" {
		config.AppName = "Porter"
	}

	// Determine port: config.Port > env PORT > config.DefaultPort
	port := config.DefaultPort
	if config.Port > 0 {
		port = config.Port
	}
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil {
			port = p
		}
	}

	// Check for flag overrides (only if flags were defined by wrapper)
	if flag.Parsed() {
		if f := flag.Lookup("port"); f != nil {
			if p, err := strconv.Atoi(f.Value.String()); err == nil && p != 8069 {
				port = p
			}
		}
		if f := flag.Lookup("portable"); f != nil && f.Value.String() == "true" {
			config.PortableMode = true
		}
		if f := flag.Lookup("open"); f != nil && f.Value.String() == "false" {
			config.OpenBrowser = false
		}
		if f := flag.Lookup("mysql"); f != nil && f.Value.String() == "true" {
			config.UseMySQL = true
		}
		if f := flag.Lookup("migrate"); f != nil && f.Value.String() == "true" {
			config.MigrateData = true
		}
		if f := flag.Lookup("migrate-mysql"); f != nil && f.Value.String() == "true" {
			config.MigrateFromMySQL = true
		}
	}

	// Set portable mode before initializing subsystems
	SetPortableMode(config.PortableMode)
	if config.PortableMode {
		log.Println("Running in portable mode - data stored alongside binary")
	}

	// Handle MySQL to SQLite migration
	if config.MigrateFromMySQL || os.Getenv("MIGRATE_FROM_MYSQL") == "true" {
		log.Println("Starting MySQL to SQLite migration...")
		mysqlConfig := LoadDBConfigFromEnv()
		sqlitePath := GetSQLitePath()
		if err := MigrateFromMySQLToSQLite(mysqlConfig, sqlitePath); err != nil {
			log.Fatalf("Migration failed: %v", err)
		}
		log.Println("Migration complete! You can now run with SQLite.")
		return
	}

	// Initialize database
	useMySQLEnv := os.Getenv("USE_MYSQL") == "true"
	useSQLiteEnv := os.Getenv("USE_SQLITE") != "false"

	if config.UseMySQL || useMySQLEnv {
		log.Println("Initializing MySQL database...")
		dbConfig := LoadDBConfigFromEnv()
		if err := InitMySQLDatabase(dbConfig); err != nil {
			log.Fatalf("Failed to initialize MySQL database: %v", err)
		}
		defer GetDB().Close()

		if err := InitAuth(); err != nil {
			log.Printf("Warning: auth init failed: %v", err)
		}

		ReloadMachineRepo()

		if config.MigrateData || os.Getenv("MIGRATE_DATA") == "true" {
			log.Println("Running data migration from JSON to MySQL...")
			if err := MigrateFromJSON(); err != nil {
				log.Printf("Migration completed with errors: %v", err)
			}
		}

		log.Println("MySQL mode enabled - using MySQL database storage")
	} else if config.UseSQLite || useSQLiteEnv {
		log.Println("Initializing SQLite database...")
		dbPath := GetSQLitePath()
		if err := InitSQLiteDatabase(dbPath); err != nil {
			log.Fatalf("Failed to initialize SQLite database: %v", err)
		}
		defer GetDB().Close()

		if err := InitAuth(); err != nil {
			log.Printf("Warning: auth init failed: %v", err)
		}

		ReloadMachineRepo()

		if config.MigrateData || os.Getenv("MIGRATE_DATA") == "true" {
			log.Println("Running data migration from JSON to SQLite...")
			if err := MigrateFromJSON(); err != nil {
				log.Printf("Migration completed with errors: %v", err)
			}
		}

		log.Println("SQLite mode enabled - using SQLite database storage")
	}

	// Initialize subsystems
	if err := InitEncryption(); err != nil {
		log.Printf("Warning: encryption init failed: %v", err)
	}
	if err := InitHistoryStore(); err != nil {
		log.Printf("Warning: history store init failed: %v", err)
	}
	if err := InitScheduler(); err != nil {
		log.Printf("Warning: scheduler init failed: %v", err)
	}
	if err := InitNotifications(); err != nil {
		log.Printf("Warning: notifications init failed: %v", err)
	}

	StartAgentPoller()
	if err := InitCustomScripts(); err != nil {
		log.Printf("Warning: custom scripts init failed: %v", err)
	}

	StartHealthPoller()

	// Server
	server := &ooo.Server{
		Router:  mux.NewRouter(),
		Static:  true,
		Workers: 2,
		OnClose: func() {
			log.Println("Shutting down...")
			StopScheduler()
			StopHealthPoller()
		},
		Silence: false,
	}

	SetupRoutes(server.Router)

	// Serve embedded SPA
	subFS, err := fs.Sub(config.UIBuildFS, config.UIBuildRoot)
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(subFS))
	server.Router.PathPrefix("/").Handler(runnerSpaHandler(fileServer, subFS))

	url := fmt.Sprintf("http://localhost:%d", port)
	log.Printf("%s starting on %s\n", config.AppName, url)

	if config.OpenBrowser {
		go func() {
			time.Sleep(500 * time.Millisecond)
			runnerOpenBrowser(url)
		}()
	}

	server.Start("0.0.0.0:" + strconv.Itoa(port))
	server.WaitClose()
}
