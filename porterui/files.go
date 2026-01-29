package porterui

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// FilesRoutes sets up file management API routes
func FilesRoutes(r *mux.Router) {
	// List files in directory - uses Porter's Capture task
	r.HandleFunc("/api/machines/{id}/files", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		path := req.URL.Query().Get("path")
		if path == "" {
			path = "/home"
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's Capture task for directory listing
		cmd := fmt.Sprintf("ls -la --time-style=long-iso '%s' 2>/dev/null || echo 'ERROR'", path)
		output, _ := RunPorterTask(client, password, "List directory", cmd, "files")
		if strings.Contains(output, "ERROR") {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"files": []interface{}{}, "error": "Failed to list directory"})
			return
		}

		var files []map[string]interface{}
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			if line == "" || strings.HasPrefix(line, "total") {
				continue
			}
			fields := strings.Fields(line)
			if len(fields) < 8 {
				continue
			}

			name := strings.Join(fields[7:], " ")
			if name == "." || name == ".." {
				continue
			}

			// Handle symlinks (name -> target)
			isSymlink := strings.HasPrefix(fields[0], "l")
			if isSymlink && strings.Contains(name, " -> ") {
				parts := strings.Split(name, " -> ")
				name = parts[0]
			}

			isDir := strings.HasPrefix(fields[0], "d")
			filePath := filepath.Join(path, name)

			// Parse size
			size := int64(0)
			fmt.Sscanf(fields[4], "%d", &size)

			files = append(files, map[string]interface{}{
				"name":        name,
				"path":        filePath,
				"isDir":       isDir,
				"isSymlink":   isSymlink,
				"permissions": fields[0],
				"owner":       fields[2],
				"group":       fields[3],
				"size":        size,
				"modified":    fields[5] + " " + fields[6],
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"files": files})
	}).Methods("GET")

	// Read file content
	r.HandleFunc("/api/machines/{id}/file", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		path := req.URL.Query().Get("path")

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Read file (limit to 1MB for safety)
		cmd := fmt.Sprintf("head -c 1048576 '%s'", path)
		output, err := client.Run(cmd)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"content": "", "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"content": string(output)})
		}
	}).Methods("GET")

	// Write file content
	r.HandleFunc("/api/machines/{id}/file", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		var request struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Detect if this is a systemd service file
		isSystemdFile := false
		isUserService := false
		serviceName := ""

		// Check for system service paths
		if strings.HasPrefix(request.Path, "/etc/systemd/system/") ||
			strings.HasPrefix(request.Path, "/lib/systemd/system/") ||
			strings.HasPrefix(request.Path, "/usr/lib/systemd/system/") {
			isSystemdFile = true
			isUserService = false
			serviceName = filepath.Base(request.Path)
		}

		// Check for user service paths
		if strings.Contains(request.Path, "/.config/systemd/user/") ||
			strings.HasPrefix(request.Path, "/etc/systemd/user/") ||
			strings.Contains(request.Path, "/.local/share/systemd/user/") {
			isSystemdFile = true
			isUserService = true
			serviceName = filepath.Base(request.Path)
		}

		// Write content using cat with heredoc
		// For systemd files in system directories, we need sudo
		var writeCmd string
		escapedContent := strings.ReplaceAll(request.Content, "'", "'\\''")

		if isSystemdFile && !isUserService {
			// System service - needs sudo to write
			writeCmd = fmt.Sprintf("echo '%s' | sudo -S bash -c \"cat > '%s' << 'PORTER_EOF'\n%s\nPORTER_EOF\"", password, request.Path, escapedContent)
		} else {
			writeCmd = fmt.Sprintf("cat > '%s' << 'PORTER_EOF'\n%s\nPORTER_EOF", request.Path, escapedContent)
		}

		_, err = client.Run(writeCmd)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
			return
		}

		// If this is a systemd service file, run daemon-reload and optionally restart
		var systemdOutput string
		if isSystemdFile {
			if isUserService {
				// User service - use systemctl --user
				daemonReloadCmd := "systemctl --user daemon-reload"
				output, reloadErr := client.Run(daemonReloadCmd)
				systemdOutput = string(output)

				// Try to restart the service if it exists and is a .service file
				if reloadErr == nil && strings.HasSuffix(serviceName, ".service") {
					restartCmd := fmt.Sprintf("systemctl --user restart %s 2>&1 || echo 'Service not active, skipping restart'", serviceName)
					restartOutput, _ := client.Run(restartCmd)
					systemdOutput += "\n" + string(restartOutput)
				}
			} else {
				// System service - use sudo systemctl
				daemonReloadCmd := fmt.Sprintf("echo '%s' | sudo -S systemctl daemon-reload", password)
				output, reloadErr := client.Run(daemonReloadCmd)
				systemdOutput = string(output)

				// Try to restart the service if it exists and is a .service file
				if reloadErr == nil && strings.HasSuffix(serviceName, ".service") {
					restartCmd := fmt.Sprintf("echo '%s' | sudo -S systemctl restart %s 2>&1 || echo 'Service not active, skipping restart'", password, serviceName)
					restartOutput, _ := client.Run(restartCmd)
					systemdOutput += "\n" + string(restartOutput)
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		response := map[string]interface{}{"success": true}
		if isSystemdFile {
			response["systemd"] = true
			response["userService"] = isUserService
			response["serviceName"] = serviceName
			response["systemdOutput"] = strings.TrimSpace(systemdOutput)
			if isUserService {
				response["message"] = fmt.Sprintf("User service updated. Ran: systemctl --user daemon-reload && restart %s", serviceName)
			} else {
				response["message"] = fmt.Sprintf("System service updated. Ran: sudo systemctl daemon-reload && restart %s", serviceName)
			}
		}
		json.NewEncoder(w).Encode(response)
	}).Methods("PUT")

	// Create directory - uses Porter's Mkdir task
	r.HandleFunc("/api/machines/{id}/mkdir", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		var request struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's Mkdir task
		tasks := porter.Tasks(
			porter.Mkdir(request.Path).Name("Create directory"),
		)
		stats, err := RunPorterManifest(client, password, "Create Directory", tasks)

		w.Header().Set("Content-Type", "application/json")
		if err != nil || stats.Failed > 0 {
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": errMsg})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Delete file/directory - uses Porter's Rm task
	r.HandleFunc("/api/machines/{id}/delete", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		var request struct {
			Path      string `json:"path"`
			Recursive bool   `json:"recursive"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's Rm task
		rmTask := porter.Rm(request.Path).Name("Delete file/directory")
		if request.Recursive {
			rmTask = rmTask.Recursive()
		}
		tasks := porter.Tasks(rmTask)
		stats, err := RunPorterManifest(client, password, "Delete", tasks)

		w.Header().Set("Content-Type", "application/json")
		if err != nil || stats.Failed > 0 {
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": errMsg})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("DELETE")

	// Rename/move file - uses Porter's Move task
	r.HandleFunc("/api/machines/{id}/rename", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		var request struct {
			OldPath string `json:"oldPath"`
			NewPath string `json:"newPath"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's Move task
		tasks := porter.Tasks(
			porter.Move(request.OldPath, request.NewPath).Name("Rename/move file"),
		)
		stats, err := RunPorterManifest(client, password, "Rename", tasks)

		w.Header().Set("Content-Type", "application/json")
		if err != nil || stats.Failed > 0 {
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": errMsg})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Upload file
	r.HandleFunc("/api/machines/{id}/upload", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Parse multipart form
		err := req.ParseMultipartForm(100 << 20) // 100MB max
		if err != nil {
			http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
			return
		}

		file, header, err := req.FormFile("file")
		if err != nil {
			http.Error(w, "No file provided", http.StatusBadRequest)
			return
		}
		defer file.Close()

		destPath := req.FormValue("path")
		if destPath == "" {
			destPath = "/tmp"
		}

		// Create temp file locally
		tmpFile, err := os.CreateTemp("", "porter-upload-*")
		if err != nil {
			http.Error(w, "Failed to create temp file", http.StatusInternalServerError)
			return
		}
		defer os.Remove(tmpFile.Name())
		defer tmpFile.Close()

		_, err = io.Copy(tmpFile, file)
		if err != nil {
			http.Error(w, "Failed to save file", http.StatusInternalServerError)
			return
		}
		tmpFile.Close()

		// Upload via SFTP
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		sftp, err := client.NewSftp()
		if err != nil {
			http.Error(w, "SFTP failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer sftp.Close()

		remotePath := filepath.Join(destPath, header.Filename)
		remoteFile, err := sftp.Create(remotePath)
		if err != nil {
			http.Error(w, "Failed to create remote file: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer remoteFile.Close()

		localFile, err := os.Open(tmpFile.Name())
		if err != nil {
			http.Error(w, "Failed to open temp file", http.StatusInternalServerError)
			return
		}
		defer localFile.Close()

		_, err = io.Copy(remoteFile, localFile)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "path": remotePath})
		}
	}).Methods("POST")

	// Download file
	r.HandleFunc("/api/machines/{id}/download", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		path := req.URL.Query().Get("path")

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		sftp, err := client.NewSftp()
		if err != nil {
			http.Error(w, "SFTP failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer sftp.Close()

		remoteFile, err := sftp.Open(path)
		if err != nil {
			http.Error(w, "Failed to open file: "+err.Error(), http.StatusNotFound)
			return
		}
		defer remoteFile.Close()

		filename := filepath.Base(path)
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		w.Header().Set("Content-Type", "application/octet-stream")

		io.Copy(w, remoteFile)
	}).Methods("GET")
}
