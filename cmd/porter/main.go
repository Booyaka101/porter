package main

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
	"syscall"
	"time"

	"github.com/booyaka101/porter/porterui"

	"github.com/benitogf/ooo"
	"github.com/gorilla/mux"
)

//go:embed build/*
var uiBuildFS embed.FS

var port = flag.Int("port", 8069, "server port")
var openBrowserFlag = flag.Bool("open", true, "auto-open browser")
var portableMode = flag.Bool("portable", false, "portable mode - store data alongside binary")
var useMySQL = flag.Bool("mysql", false, "use MySQL database instead of SQLite")
var useSQLite = flag.Bool("sqlite", true, "use SQLite database (default)")
var migrateData = flag.Bool("migrate", false, "migrate existing JSON data to database")
var migrateFromMySQL = flag.Bool("migrate-mysql", false, "migrate data from MySQL to SQLite")

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

// isValidELF checks if a file is a valid ELF binary by reading magic bytes
func isValidELF(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	// ELF magic: 0x7f 'E' 'L' 'F'
	magic := make([]byte, 4)
	if _, err := f.Read(magic); err != nil {
		return false
	}
	return magic[0] == 0x7f && magic[1] == 'E' && magic[2] == 'L' && magic[3] == 'F'
}

// spaHandler serves the SPA and handles client-side routing
func spaHandler(fileServer http.Handler, subFS fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Don't handle API routes
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

func main() {
	// Check for wrapper binary at /app/data/porterw
	// If a valid ELF binary exists there, execute it instead of default Porter
	const wrapperPath = "/app/data/porterw"
	if os.Getenv("PORTER_IS_WRAPPER") != "1" {
		if info, err := os.Stat(wrapperPath); err == nil && !info.IsDir() && info.Mode()&0111 != 0 {
			if isValidELF(wrapperPath) {
				log.Printf("Executing wrapper binary: %s", wrapperPath)
				env := append(os.Environ(), "PORTER_IS_WRAPPER=1")
				if err := syscall.Exec(wrapperPath, append([]string{wrapperPath}, os.Args[1:]...), env); err != nil {
					log.Printf("Failed to exec wrapper: %v, falling back to default Porter", err)
				}
			} else {
				log.Printf("Warning: %s is not a valid ELF binary, ignoring", wrapperPath)
			}
		}
	}

	flag.Parse()

	// Set portable mode before initializing subsystems
	porterui.SetPortableMode(*portableMode)
	if *portableMode {
		log.Println("Running in portable mode - data stored alongside binary")
	}

	// Handle MySQL to SQLite migration
	if *migrateFromMySQL || os.Getenv("MIGRATE_FROM_MYSQL") == "true" {
		log.Println("Starting MySQL to SQLite migration...")
		mysqlConfig := porterui.LoadDBConfigFromEnv()
		sqlitePath := porterui.GetSQLitePath()
		if err := porterui.MigrateFromMySQLToSQLite(mysqlConfig, sqlitePath); err != nil {
			log.Fatalf("Migration failed: %v", err)
		}
		log.Println("Migration complete! You can now run Porter with SQLite.")
		return
	}

	// Initialize database
	useMySQLEnv := os.Getenv("USE_MYSQL") == "true"
	useSQLiteEnv := os.Getenv("USE_SQLITE") != "false" // SQLite is default unless explicitly disabled

	if *useMySQL || useMySQLEnv {
		// MySQL mode
		log.Println("Initializing MySQL database...")
		dbConfig := porterui.LoadDBConfigFromEnv()
		if err := porterui.InitMySQLDatabase(dbConfig); err != nil {
			log.Fatalf("Failed to initialize MySQL database: %v", err)
		}
		defer porterui.GetDB().Close()

		// Initialize authentication
		if err := porterui.InitAuth(); err != nil {
			log.Printf("Warning: auth init failed: %v", err)
		}

		// Reload data stores from database now that DB is initialized
		porterui.ReloadMachineRepo()

		// Run migration if requested
		if *migrateData || os.Getenv("MIGRATE_DATA") == "true" {
			log.Println("Running data migration from JSON to MySQL...")
			if err := porterui.MigrateFromJSON(); err != nil {
				log.Printf("Migration completed with errors: %v", err)
			}
		}

		log.Println("MySQL mode enabled - using MySQL database storage")
	} else if *useSQLite || useSQLiteEnv {
		// SQLite mode (default)
		log.Println("Initializing SQLite database...")
		dbPath := porterui.GetSQLitePath()
		if err := porterui.InitSQLiteDatabase(dbPath); err != nil {
			log.Fatalf("Failed to initialize SQLite database: %v", err)
		}
		defer porterui.GetDB().Close()

		// Initialize authentication
		if err := porterui.InitAuth(); err != nil {
			log.Printf("Warning: auth init failed: %v", err)
		}

		// Reload data stores from database now that DB is initialized
		porterui.ReloadMachineRepo()

		// Run migration if requested
		if *migrateData || os.Getenv("MIGRATE_DATA") == "true" {
			log.Println("Running data migration from JSON to SQLite...")
			if err := porterui.MigrateFromJSON(); err != nil {
				log.Printf("Migration completed with errors: %v", err)
			}
		}

		log.Println("SQLite mode enabled - using SQLite database storage")
	}

	// Initialize subsystems
	if err := porterui.InitEncryption(); err != nil {
		log.Printf("Warning: encryption init failed: %v", err)
	}
	if err := porterui.InitHistoryStore(); err != nil {
		log.Printf("Warning: history store init failed: %v", err)
	}
	if err := porterui.InitScheduler(); err != nil {
		log.Printf("Warning: scheduler init failed: %v", err)
	}
	if err := porterui.InitNotifications(); err != nil {
		log.Printf("Warning: notifications init failed: %v", err)
	}

	// Start background agent connections for live updates
	porterui.StartAgentPoller()
	if err := porterui.InitCustomScripts(); err != nil {
		log.Printf("Warning: custom scripts init failed: %v", err)
	}

	// Start background health poller
	porterui.StartHealthPoller()

	// Server using ooo framework
	server := &ooo.Server{
		Router:  mux.NewRouter(),
		Static:  true,
		Workers: 2,
		OnClose: func() {
			log.Println("Shutting down...")
			porterui.StopScheduler()
			porterui.StopHealthPoller()
		},
		Silence: false,
	}

	// Setup API routes
	porterui.SetupRoutes(server.Router)

	// Serve embedded SPA
	subFS, err := fs.Sub(uiBuildFS, "build")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(subFS))
	server.Router.PathPrefix("/").Handler(spaHandler(fileServer, subFS))

	url := fmt.Sprintf("http://localhost:%d", *port)
	log.Printf("Porter UI starting on %s\n", url)

	// Auto-open browser after a short delay
	if *openBrowserFlag {
		go func() {
			time.Sleep(500 * time.Millisecond)
			openBrowser(url)
		}()
	}

	// Start server
	server.Start("0.0.0.0:" + strconv.Itoa(*port))

	server.WaitClose()
}
