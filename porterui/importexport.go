package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ExportData represents all exportable configuration
type ExportData struct {
	Version    string                 `json:"version"`
	ExportedAt time.Time              `json:"exported_at"`
	Machines   []*Machine             `json:"machines,omitempty"`
	Groups     []*MachineGroup        `json:"groups,omitempty"`
	Bookmarks  []*CommandBookmark     `json:"bookmarks,omitempty"`
	SSHKeys    []*SSHKey              `json:"ssh_keys,omitempty"`
	BackupJobs []*BackupJob           `json:"backup_jobs,omitempty"`
	Manifests  map[string]interface{} `json:"manifests,omitempty"`
}

// ImportExportRoutes sets up import/export API routes
func ImportExportRoutes(r *mux.Router) {
	// Export all configuration
	r.HandleFunc("/api/export", func(w http.ResponseWriter, req *http.Request) {
		what := req.URL.Query().Get("what") // all, machines, groups, bookmarks, etc.
		if what == "" {
			what = "all"
		}

		export := ExportData{
			Version:    "1.0",
			ExportedAt: time.Now(),
		}

		if what == "all" || what == "machines" {
			machines := machineRepo.List()
			// Clear passwords for security
			for _, m := range machines {
				m.Password = ""
			}
			export.Machines = machines
		}

		if what == "all" || what == "groups" {
			machineGroupsMu.RLock()
			groups := make([]*MachineGroup, 0, len(machineGroups))
			for _, g := range machineGroups {
				groups = append(groups, g)
			}
			machineGroupsMu.RUnlock()
			export.Groups = groups
		}

		if what == "all" || what == "bookmarks" {
			commandBookmarksMu.RLock()
			bookmarks := make([]*CommandBookmark, 0, len(commandBookmarks))
			for _, b := range commandBookmarks {
				bookmarks = append(bookmarks, b)
			}
			commandBookmarksMu.RUnlock()
			export.Bookmarks = bookmarks
		}

		if what == "all" || what == "ssh_keys" {
			sshKeysMu.RLock()
			keys := make([]*SSHKey, 0, len(sshKeys))
			for _, k := range sshKeys {
				keys = append(keys, k)
			}
			sshKeysMu.RUnlock()
			export.SSHKeys = keys
		}

		if what == "all" || what == "backup_jobs" {
			backupJobsMu.RLock()
			jobs := make([]*BackupJob, 0, len(backupJobs))
			for _, j := range backupJobs {
				jobs = append(jobs, j)
			}
			backupJobsMu.RUnlock()
			export.BackupJobs = jobs
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=porter-export-%s.json", time.Now().Format("20060102-150405")))
		json.NewEncoder(w).Encode(export)

		AddAuditLog("export", "system", "", "", map[string]interface{}{"what": what}, true, "")
	}).Methods("GET")

	// Import configuration
	r.HandleFunc("/api/import", func(w http.ResponseWriter, req *http.Request) {
		var importData ExportData
		if err := json.NewDecoder(req.Body).Decode(&importData); err != nil {
			http.Error(w, "Invalid import data: "+err.Error(), http.StatusBadRequest)
			return
		}

		var imported struct {
			Machines   int `json:"machines"`
			Groups     int `json:"groups"`
			Bookmarks  int `json:"bookmarks"`
			SSHKeys    int `json:"ssh_keys"`
			BackupJobs int `json:"backup_jobs"`
		}

		// Import machines
		if len(importData.Machines) > 0 {
			for _, m := range importData.Machines {
				// Generate new ID to avoid conflicts
				m.ID = fmt.Sprintf("machine-%d", time.Now().UnixNano())
				machineRepo.Add(m)
				imported.Machines++
			}
		}

		// Import groups
		if len(importData.Groups) > 0 {
			machineGroupsMu.Lock()
			for _, g := range importData.Groups {
				g.ID = fmt.Sprintf("group-%d", time.Now().UnixNano())
				machineGroups[g.ID] = g
				imported.Groups++
			}
			machineGroupsMu.Unlock()
		}

		// Import bookmarks
		if len(importData.Bookmarks) > 0 {
			commandBookmarksMu.Lock()
			for _, b := range importData.Bookmarks {
				b.ID = fmt.Sprintf("bookmark-%d", time.Now().UnixNano())
				commandBookmarks[b.ID] = b
				imported.Bookmarks++
			}
			commandBookmarksMu.Unlock()
		}

		// Import SSH keys
		if len(importData.SSHKeys) > 0 {
			sshKeysMu.Lock()
			for _, k := range importData.SSHKeys {
				k.ID = fmt.Sprintf("key-%d", time.Now().UnixNano())
				sshKeys[k.ID] = k
				imported.SSHKeys++
			}
			sshKeysMu.Unlock()
		}

		// Import backup jobs
		if len(importData.BackupJobs) > 0 {
			backupJobsMu.Lock()
			for _, j := range importData.BackupJobs {
				j.ID = fmt.Sprintf("backup-%d", time.Now().UnixNano())
				backupJobs[j.ID] = j
				imported.BackupJobs++
			}
			backupJobsMu.Unlock()
		}

		AddAuditLog("import", "system", "", "", map[string]interface{}{
			"machines":    imported.Machines,
			"groups":      imported.Groups,
			"bookmarks":   imported.Bookmarks,
			"ssh_keys":    imported.SSHKeys,
			"backup_jobs": imported.BackupJobs,
		}, true, "")

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"imported": imported,
		})
	}).Methods("POST")
}
