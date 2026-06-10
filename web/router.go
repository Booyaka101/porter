package web

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
	SetupStandaloneAgentRoutes(r)
	SetupAgentRoutes(r)
	BuildClientRoutes(r)
	AIAgentRoutes(r)
	AIAgentDebugRoutes(r)
	TracesRoutes(r)
}

// SetupRoutesWithAuth registers every route and enforces JWT authentication on
// them via AuthMiddleware. The middleware self-filters: static/SPA paths and
// the public allowlist (login, status, agent channels — see publicAPIPrefixes)
// pass through; every other /api/* call requires a valid token. Because the
// middleware decides per-request, the routes can be registered exactly as in
// SetupRoutes — no /api subrouter (which would double the prefix).
func SetupRoutesWithAuth(r *mux.Router) {
	r.Use(AuthMiddleware)
	SetupRoutes(r)
}
