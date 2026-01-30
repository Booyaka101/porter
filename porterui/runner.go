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
}

var (
	runnerPort             = flag.Int("port", 8069, "server port")
	runnerOpenBrowser      = flag.Bool("open", true, "auto-open browser")
	runnerPortableMode     = flag.Bool("portable", false, "portable mode - store data alongside binary")
	runnerUseMySQL         = flag.Bool("mysql", false, "use MySQL database instead of SQLite")
	runnerUseSQLite        = flag.Bool("sqlite", true, "use SQLite database (default)")
	runnerMigrateData      = flag.Bool("migrate", false, "migrate existing JSON data to database")
	runnerMigrateFromMySQL = flag.Bool("migrate-mysql", false, "migrate data from MySQL to SQLite")
)

func openBrowser(url string) {
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

// spaHandler serves the SPA and handles client-side routing
func spaHandler(fileServer http.Handler, subFS fs.FS) http.Handler {
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
	flag.Parse()

	if config.UIBuildRoot == "" {
		config.UIBuildRoot = "build"
	}
	if config.DefaultPort == 0 {
		config.DefaultPort = 8069
	}
	if config.AppName == "" {
		config.AppName = "Porter"
	}

	// Override default port if not set via flag
	if *runnerPort == 8069 && config.DefaultPort != 8069 {
		*runnerPort = config.DefaultPort
	}

	// Set portable mode before initializing subsystems
	SetPortableMode(*runnerPortableMode)
	if *runnerPortableMode {
		log.Println("Running in portable mode - data stored alongside binary")
	}

	// Handle MySQL to SQLite migration
	if *runnerMigrateFromMySQL || os.Getenv("MIGRATE_FROM_MYSQL") == "true" {
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

	if *runnerUseMySQL || useMySQLEnv {
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

		if *runnerMigrateData || os.Getenv("MIGRATE_DATA") == "true" {
			log.Println("Running data migration from JSON to MySQL...")
			if err := MigrateFromJSON(); err != nil {
				log.Printf("Migration completed with errors: %v", err)
			}
		}

		log.Println("MySQL mode enabled - using MySQL database storage")
	} else if *runnerUseSQLite || useSQLiteEnv {
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

		if *runnerMigrateData || os.Getenv("MIGRATE_DATA") == "true" {
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
	server.Router.PathPrefix("/").Handler(spaHandler(fileServer, subFS))

	url := fmt.Sprintf("http://localhost:%d", *runnerPort)
	log.Printf("%s starting on %s\n", config.AppName, url)

	if *runnerOpenBrowser {
		go func() {
			time.Sleep(500 * time.Millisecond)
			openBrowser(url)
		}()
	}

	server.Start("0.0.0.0:" + strconv.Itoa(*runnerPort))
	server.WaitClose()
}
