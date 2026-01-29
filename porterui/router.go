package porterui

import (
	"github.com/gorilla/mux"
)

func SetupRoutes(r *mux.Router) {
	// Auth routes (no auth required for login/status)
	AuthRoutes(r)

	// User management routes (requires auth)
	UserRoutes(r)

	// All other routes
	ScriptsRoutes(r)
	MachinesRoutes(r)
	ManifestRoutes(r)
	HistoryRoutes(r)
	HealthRoutes(r)
	SchedulerRoutes(r)
	NotificationRoutes(r)
	StreamingRoutes(r)
	CustomScriptsRoutes(r)
	LogsRoutes(r)
	SystemRoutes(r)
	FilesRoutes(r)
	SystemToolsRoutes(r)
	TerminalRoutes(r)
	BookmarkRoutes(r)
	VNCRoutes(r)
	WOLRoutes(r)
	NetworkToolsRoutes(r)
	SSHKeyRoutes(r)
	BackupRoutes(r)
	DiffRoutes(r)
	MultiTerminalRoutes(r)
	ImportExportRoutes(r)
	DashboardWSRoutes(r)
}

// SetupRoutesWithAuth sets up routes with authentication middleware
func SetupRoutesWithAuth(r *mux.Router) {
	// Auth routes (no auth required for login/status)
	AuthRoutes(r)

	// Create a subrouter for authenticated routes
	api := r.PathPrefix("/api").Subrouter()
	api.Use(AuthMiddleware)

	// User management routes
	UserRoutes(r)

	// All other routes (will be protected by middleware when using this setup)
	ScriptsRoutes(r)
	MachinesRoutes(r)
	ManifestRoutes(r)
	HistoryRoutes(r)
	HealthRoutes(r)
	SchedulerRoutes(r)
	NotificationRoutes(r)
	StreamingRoutes(r)
	CustomScriptsRoutes(r)
	LogsRoutes(r)
	SystemRoutes(r)
	FilesRoutes(r)
	SystemToolsRoutes(r)
	TerminalRoutes(r)
	BookmarkRoutes(r)
	VNCRoutes(r)
	WOLRoutes(r)
	NetworkToolsRoutes(r)
	SSHKeyRoutes(r)
	BackupRoutes(r)
	DiffRoutes(r)
	MultiTerminalRoutes(r)
	ImportExportRoutes(r)
	DashboardWSRoutes(r)
}
