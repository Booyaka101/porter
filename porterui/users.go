package porterui

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// UserRoutes sets up user management API routes
func UserRoutes(router *mux.Router) {
	// List all users (admin only)
	router.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		claims := getClaimsFromRequest(r)
		if claims == nil || !HasPermission(claims.Permissions, "users:read") {
			http.Error(w, `{"error": "forbidden"}`, http.StatusForbidden)
			return
		}

		rows, err := db.db.Query(`
			SELECT id, username, email, role, display_name, avatar_url, 
			       is_active, last_login, created_at, updated_at
			FROM users ORDER BY created_at DESC`)
		if err != nil {
			http.Error(w, `{"error": "database error"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var users []map[string]interface{}
		for rows.Next() {
			var id, username, role string
			var email, displayName, avatarURL sql.NullString
			var isActive bool
			var lastLogin, createdAt, updatedAt sql.NullString

			if err := rows.Scan(&id, &username, &email, &role, &displayName, &avatarURL,
				&isActive, &lastLogin, &createdAt, &updatedAt); err != nil {
				continue
			}

			user := map[string]interface{}{
				"id":        id,
				"username":  username,
				"role":      role,
				"is_active": isActive,
			}
			if createdAt.Valid {
				if t, err := parseDateTime(createdAt.String); err == nil {
					user["created_at"] = t
				}
			}
			if updatedAt.Valid {
				if t, err := parseDateTime(updatedAt.String); err == nil {
					user["updated_at"] = t
				}
			}
			if email.Valid {
				user["email"] = email.String
			}
			if displayName.Valid {
				user["display_name"] = displayName.String
			}
			if avatarURL.Valid {
				user["avatar_url"] = avatarURL.String
			}
			if lastLogin.Valid {
				if t, err := parseDateTime(lastLogin.String); err == nil {
					user["last_login"] = t
				}
			}
			users = append(users, user)
		}

		json.NewEncoder(w).Encode(users)
	}).Methods("GET")

	// Create user (admin only)
	router.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		claims := getClaimsFromRequest(r)
		if claims == nil || !HasPermission(claims.Permissions, "users:write") {
			http.Error(w, `{"error": "forbidden"}`, http.StatusForbidden)
			return
		}

		var req struct {
			Username    string `json:"username"`
			Email       string `json:"email"`
			Password    string `json:"password"`
			Role        string `json:"role"`
			DisplayName string `json:"display_name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid request body",
			})
			return
		}

		if req.Username == "" || req.Password == "" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Username and password are required",
			})
			return
		}

		if len(req.Password) < 6 {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Password must be at least 6 characters",
			})
			return
		}

		// Check if username exists
		existing, _ := GetUserByUsername(req.Username)
		if existing != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Username already exists",
			})
			return
		}

		// Default role
		if req.Role == "" {
			req.Role = "viewer"
		}

		// Validate role
		validRoles := []string{"admin", "operator", "viewer"}
		roleValid := false
		for _, r := range validRoles {
			if req.Role == r {
				roleValid = true
				break
			}
		}
		if !roleValid {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid role. Must be: admin, operator, or viewer",
			})
			return
		}

		hashedPassword, err := HashPassword(req.Password)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to hash password",
			})
			return
		}

		id := fmt.Sprintf("user-%d", time.Now().UnixNano())

		// Use NULL for empty email to avoid unique constraint issues
		var emailValue interface{}
		if req.Email != "" {
			emailValue = req.Email
		} else {
			emailValue = nil
		}

		_, err = db.db.Exec(`
			INSERT INTO users (id, username, email, password_hash, role, display_name, is_active)
			VALUES (?, ?, ?, ?, ?, ?, 1)`,
			id, req.Username, emailValue, hashedPassword, req.Role, req.DisplayName)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to create user: " + err.Error(),
			})
			return
		}

		LogAudit(claims.UserID, claims.Username, "create_user", "user", id,
			map[string]string{"username": req.Username, "role": req.Role}, r.RemoteAddr)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"id":      id,
			"message": "User created successfully",
		})
	}).Methods("POST")

	// Get single user
	router.HandleFunc("/api/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		claims := getClaimsFromRequest(r)
		if claims == nil {
			http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := mux.Vars(r)["id"]

		// Users can view their own profile, admins can view all
		if id != claims.UserID && !HasPermission(claims.Permissions, "users:read") {
			http.Error(w, `{"error": "forbidden"}`, http.StatusForbidden)
			return
		}

		user, err := GetUserByID(id)
		if err != nil || user == nil {
			http.Error(w, `{"error": "user not found"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":           user.ID,
			"username":     user.Username,
			"email":        user.Email,
			"role":         user.Role,
			"display_name": user.DisplayName,
			"avatar_url":   user.AvatarURL,
			"is_active":    user.IsActive,
			"last_login":   user.LastLogin,
			"created_at":   user.CreatedAt,
		})
	}).Methods("GET")

	// Update user
	router.HandleFunc("/api/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		claims := getClaimsFromRequest(r)
		if claims == nil {
			http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := mux.Vars(r)["id"]

		// Users can update their own profile (limited), admins can update all
		isOwnProfile := id == claims.UserID
		isAdmin := HasPermission(claims.Permissions, "users:write")

		if !isOwnProfile && !isAdmin {
			http.Error(w, `{"error": "forbidden"}`, http.StatusForbidden)
			return
		}

		var req struct {
			Email       string `json:"email"`
			DisplayName string `json:"display_name"`
			AvatarURL   string `json:"avatar_url"`
			Role        string `json:"role"`
			IsActive    *bool  `json:"is_active"`
			Password    string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid request body",
			})
			return
		}

		// Build update query
		updates := []string{}
		args := []interface{}{}

		if req.Email != "" {
			updates = append(updates, "email = ?")
			args = append(args, req.Email)
		}
		if req.DisplayName != "" {
			updates = append(updates, "display_name = ?")
			args = append(args, req.DisplayName)
		}
		if req.AvatarURL != "" {
			updates = append(updates, "avatar_url = ?")
			args = append(args, req.AvatarURL)
		}

		// Only admins can change role and active status
		if isAdmin {
			if req.Role != "" {
				updates = append(updates, "role = ?")
				args = append(args, req.Role)
			}
			if req.IsActive != nil {
				updates = append(updates, "is_active = ?")
				args = append(args, *req.IsActive)
			}
			if req.Password != "" && len(req.Password) >= 6 {
				hashedPassword, err := HashPassword(req.Password)
				if err == nil {
					updates = append(updates, "password_hash = ?")
					args = append(args, hashedPassword)
				}
			}
		}

		if len(updates) == 0 {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "No fields to update",
			})
			return
		}

		args = append(args, id)
		query := fmt.Sprintf("UPDATE users SET %s WHERE id = ?",
			joinStrings(updates, ", "))

		_, err := db.db.Exec(query, args...)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to update user",
			})
			return
		}

		LogAudit(claims.UserID, claims.Username, "update_user", "user", id, nil, r.RemoteAddr)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "User updated successfully",
		})
	}).Methods("PUT")

	// Delete user (admin only)
	router.HandleFunc("/api/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		claims := getClaimsFromRequest(r)
		if claims == nil || !HasPermission(claims.Permissions, "users:write") {
			http.Error(w, `{"error": "forbidden"}`, http.StatusForbidden)
			return
		}

		id := mux.Vars(r)["id"]

		// Prevent deleting yourself
		if id == claims.UserID {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Cannot delete your own account",
			})
			return
		}

		// Prevent deleting the last admin
		var adminCount int
		db.db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1").Scan(&adminCount)

		var targetRole string
		db.db.QueryRow("SELECT role FROM users WHERE id = ?", id).Scan(&targetRole)

		if targetRole == "admin" && adminCount <= 1 {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Cannot delete the last admin user",
			})
			return
		}

		_, err := db.db.Exec("DELETE FROM users WHERE id = ?", id)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to delete user",
			})
			return
		}

		LogAudit(claims.UserID, claims.Username, "delete_user", "user", id, nil, r.RemoteAddr)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "User deleted successfully",
		})
	}).Methods("DELETE")

	// List roles
	router.HandleFunc("/api/roles", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		rows, err := db.db.Query("SELECT id, name, description, permissions, is_system FROM roles")
		if err != nil {
			http.Error(w, `{"error": "database error"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var roles []Role
		for rows.Next() {
			var role Role
			var permissionsJSON string
			if err := rows.Scan(&role.ID, &role.Name, &role.Description, &permissionsJSON, &role.IsSystem); err != nil {
				continue
			}
			json.Unmarshal([]byte(permissionsJSON), &role.Permissions)
			roles = append(roles, role)
		}

		json.NewEncoder(w).Encode(roles)
	}).Methods("GET")

	// Get audit log (admin only)
	router.HandleFunc("/api/audit-log", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		claims := getClaimsFromRequest(r)
		if claims == nil || !HasPermission(claims.Permissions, "*") {
			http.Error(w, `{"error": "forbidden"}`, http.StatusForbidden)
			return
		}

		limit := 100
		if l := r.URL.Query().Get("limit"); l != "" {
			fmt.Sscanf(l, "%d", &limit)
		}

		rows, err := db.db.Query(`
			SELECT id, user_id, username, action, resource_type, resource_id, details, ip_address, created_at
			FROM audit_log ORDER BY created_at DESC LIMIT ?`, limit)
		if err != nil {
			http.Error(w, `{"error": "database error"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var logs []map[string]interface{}
		for rows.Next() {
			var id, action string
			var userID, username, resourceType, resourceID, details, ipAddress, createdAt sql.NullString

			if err := rows.Scan(&id, &userID, &username, &action, &resourceType, &resourceID,
				&details, &ipAddress, &createdAt); err != nil {
				continue
			}

			log := map[string]interface{}{
				"id":     id,
				"action": action,
			}
			if createdAt.Valid {
				if t, err := parseDateTime(createdAt.String); err == nil {
					log["created_at"] = t
				}
			}
			if userID.Valid {
				log["user_id"] = userID.String
			}
			if username.Valid {
				log["username"] = username.String
			}
			if resourceType.Valid {
				log["resource_type"] = resourceType.String
			}
			if resourceID.Valid {
				log["resource_id"] = resourceID.String
			}
			if ipAddress.Valid {
				log["ip_address"] = ipAddress.String
			}
			if details.Valid {
				var d interface{}
				json.Unmarshal([]byte(details.String), &d)
				log["details"] = d
			}
			logs = append(logs, log)
		}

		json.NewEncoder(w).Encode(logs)
	}).Methods("GET")
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}
