package porterui

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
)

// User represents a system user
type User struct {
	ID          string     `json:"id"`
	Username    string     `json:"username"`
	Email       string     `json:"email,omitempty"`
	Password    string     `json:"-"` // Never expose password hash
	Role        string     `json:"role"`
	DisplayName string     `json:"display_name,omitempty"`
	AvatarURL   string     `json:"avatar_url,omitempty"`
	IsActive    bool       `json:"is_active"`
	LastLogin   *time.Time `json:"last_login,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// Role represents a user role with permissions
type Role struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Permissions []string  `json:"permissions"`
	IsSystem    bool      `json:"is_system"`
	CreatedAt   time.Time `json:"created_at"`
}

// Session represents an active user session
type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Token     string    `json:"token"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// JWTClaims represents JWT token claims
type JWTClaims struct {
	UserID      string   `json:"user_id"`
	Username    string   `json:"username"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

// AuthContext key for request context
type contextKey string

const UserContextKey contextKey = "user"

var jwtSecret []byte

// InitAuth initializes the authentication system
func InitAuth() error {
	// Load or generate JWT secret
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Generate a random secret if not provided
		bytes := make([]byte, 32)
		if _, err := rand.Read(bytes); err != nil {
			return fmt.Errorf("failed to generate JWT secret: %w", err)
		}
		secret = hex.EncodeToString(bytes)
		log.Println("Warning: Using generated JWT secret. Set JWT_SECRET env var for persistence.")
	}
	jwtSecret = []byte(secret)

	// Create default admin user if no users exist
	if err := ensureDefaultAdmin(); err != nil {
		log.Printf("Warning: failed to create default admin: %v", err)
	}

	return nil
}

// ensureDefaultAdmin creates a default admin user if none exists
func ensureDefaultAdmin() error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	var count int
	err := db.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		// Create default admin user
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
		if err != nil {
			return err
		}

		_, err = db.db.Exec(`
			INSERT INTO users (id, username, password_hash, role, display_name, is_active)
			VALUES (?, ?, ?, ?, ?, ?)`,
			"user-admin", "admin", string(hashedPassword), "admin", "Administrator", true)
		if err != nil {
			return err
		}
		log.Println("Created default admin user (username: admin, password: admin)")
	}

	return nil
}

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword verifies a password against a hash
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateToken creates a JWT token for a user
func GenerateToken(user *User, permissions []string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)

	claims := &JWTClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Role:        user.Role,
		Permissions: permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// GetUserByID retrieves a user by ID
func GetUserByID(id string) (*User, error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	var user User
	var lastLogin sql.NullTime
	var email sql.NullString

	err := db.db.QueryRow(`
		SELECT id, username, email, password_hash, role, display_name, avatar_url, 
		       is_active, last_login, created_at, updated_at
		FROM users WHERE id = ?`, id).Scan(
		&user.ID, &user.Username, &email, &user.Password, &user.Role,
		&user.DisplayName, &user.AvatarURL, &user.IsActive, &lastLogin,
		&user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if email.Valid {
		user.Email = email.String
	}
	if lastLogin.Valid {
		user.LastLogin = &lastLogin.Time
	}

	return &user, nil
}

// GetUserByUsername retrieves a user by username
func GetUserByUsername(username string) (*User, error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	var user User
	var lastLogin, createdAt, updatedAt sql.NullString
	var email, displayName, avatarURL sql.NullString

	err := db.db.QueryRow(`
		SELECT id, username, email, password_hash, role, display_name, avatar_url, 
		       is_active, last_login, created_at, updated_at
		FROM users WHERE username = ?`, username).Scan(
		&user.ID, &user.Username, &email, &user.Password, &user.Role,
		&displayName, &avatarURL, &user.IsActive, &lastLogin,
		&createdAt, &updatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if email.Valid {
		user.Email = email.String
	}
	if displayName.Valid {
		user.DisplayName = displayName.String
	}
	if avatarURL.Valid {
		user.AvatarURL = avatarURL.String
	}
	if lastLogin.Valid {
		if t, err := parseDateTime(lastLogin.String); err == nil {
			user.LastLogin = &t
		}
	}
	if createdAt.Valid {
		user.CreatedAt, _ = parseDateTime(createdAt.String)
	}
	if updatedAt.Valid {
		user.UpdatedAt, _ = parseDateTime(updatedAt.String)
	}

	return &user, nil
}

// parseDateTime parses a datetime string from the database
func parseDateTime(s string) (time.Time, error) {
	// Try common formats
	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		time.RFC3339,
	}
	for _, format := range formats {
		if t, err := time.Parse(format, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unable to parse datetime: %s", s)
}

// GetRolePermissions retrieves permissions for a role
func GetRolePermissions(roleName string) ([]string, error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	var permissionsJSON string
	err := db.db.QueryRow("SELECT permissions FROM roles WHERE name = ?", roleName).Scan(&permissionsJSON)
	if err == sql.ErrNoRows {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}

	var permissions []string
	if err := json.Unmarshal([]byte(permissionsJSON), &permissions); err != nil {
		return nil, err
	}

	return permissions, nil
}

// getClaimsFromRequest extracts JWT claims from request header or cookie
func getClaimsFromRequest(r *http.Request) *JWTClaims {
	tokenString := ""

	// Check Authorization header first
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	}

	// Fall back to cookie
	if tokenString == "" {
		if cookie, err := r.Cookie("porter_token"); err == nil {
			tokenString = cookie.Value
		}
	}

	if tokenString == "" {
		return nil
	}

	claims, err := ValidateToken(tokenString)
	if err != nil {
		return nil
	}

	return claims
}

// HasPermission checks if a user has a specific permission
func HasPermission(permissions []string, required string) bool {
	for _, p := range permissions {
		if p == "*" || p == required {
			return true
		}
		// Check wildcard permissions (e.g., "machines:*" matches "machines:read")
		if strings.HasSuffix(p, ":*") {
			prefix := strings.TrimSuffix(p, "*")
			if strings.HasPrefix(required, prefix) {
				return true
			}
		}
	}
	return false
}

// AuthMiddleware validates JWT tokens and adds user to context
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for login endpoint
		if r.URL.Path == "/api/auth/login" || r.URL.Path == "/api/auth/status" {
			next.ServeHTTP(w, r)
			return
		}

		// Get token from Authorization header or cookie
		tokenString := ""

		// Check Authorization header first
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// Fall back to cookie
		if tokenString == "" {
			if cookie, err := r.Cookie("porter_token"); err == nil {
				tokenString = cookie.Value
			}
		}

		if tokenString == "" {
			http.Error(w, `{"error": "unauthorized", "message": "No token provided"}`, http.StatusUnauthorized)
			return
		}

		claims, err := ValidateToken(tokenString)
		if err != nil {
			http.Error(w, `{"error": "unauthorized", "message": "Invalid token"}`, http.StatusUnauthorized)
			return
		}

		// Add claims to request context
		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequirePermission middleware checks for specific permission
func RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(UserContextKey).(*JWTClaims)
			if !ok {
				http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
				return
			}

			if !HasPermission(claims.Permissions, permission) {
				http.Error(w, `{"error": "forbidden", "message": "Insufficient permissions"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetCurrentUser returns the current user from request context
func GetCurrentUser(r *http.Request) *JWTClaims {
	claims, ok := r.Context().Value(UserContextKey).(*JWTClaims)
	if !ok {
		return nil
	}
	return claims
}

// AuthRoutes sets up authentication API routes
func AuthRoutes(router *mux.Router) {
	// Login
	router.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid request body",
			})
			return
		}

		user, err := GetUserByUsername(req.Username)
		if err != nil {
			log.Printf("Login error: %v", err)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Authentication failed",
			})
			return
		}

		if user == nil || !CheckPassword(req.Password, user.Password) {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid username or password",
			})
			return
		}

		if !user.IsActive {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Account is disabled",
			})
			return
		}

		// Get permissions for user's role
		permissions, err := GetRolePermissions(user.Role)
		if err != nil {
			log.Printf("Failed to get permissions: %v", err)
			permissions = []string{}
		}

		// Generate token
		token, err := GenerateToken(user, permissions)
		if err != nil {
			log.Printf("Failed to generate token: %v", err)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to generate token",
			})
			return
		}

		// Update last login
		db.db.Exec("UPDATE users SET last_login = NOW() WHERE id = ?", user.ID)

		// Log audit
		LogAudit(user.ID, user.Username, "login", "user", user.ID, nil, r.RemoteAddr)

		// Set cookie
		http.SetCookie(w, &http.Cookie{
			Name:     "porter_token",
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   r.TLS != nil,
			SameSite: http.SameSiteStrictMode,
			MaxAge:   86400, // 24 hours
		})

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"token":   token,
			"user": map[string]interface{}{
				"id":           user.ID,
				"username":     user.Username,
				"email":        user.Email,
				"role":         user.Role,
				"display_name": user.DisplayName,
				"permissions":  permissions,
			},
		})
	}).Methods("POST")

	// Logout
	router.HandleFunc("/api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Clear cookie
		http.SetCookie(w, &http.Cookie{
			Name:     "porter_token",
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			MaxAge:   -1,
		})

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}).Methods("POST")

	// Get current user
	router.HandleFunc("/api/auth/me", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		claims := GetCurrentUser(r)
		if claims == nil {
			http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
			return
		}

		user, err := GetUserByID(claims.UserID)
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
			"permissions":  claims.Permissions,
			"created_at":   user.CreatedAt,
		})
	}).Methods("GET")

	// Check auth status (no auth required)
	router.HandleFunc("/api/auth/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// If database is not initialized, return 404 to indicate auth is not enabled
		if db == nil {
			http.NotFound(w, r)
			return
		}

		// Try to get token
		tokenString := ""
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}
		if tokenString == "" {
			if cookie, err := r.Cookie("porter_token"); err == nil {
				tokenString = cookie.Value
			}
		}

		if tokenString == "" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"authenticated": false,
			})
			return
		}

		claims, err := ValidateToken(tokenString)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"authenticated": false,
			})
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": true,
			"user": map[string]interface{}{
				"id":          claims.UserID,
				"username":    claims.Username,
				"role":        claims.Role,
				"permissions": claims.Permissions,
			},
		})
	}).Methods("GET")

	// Change password
	router.HandleFunc("/api/auth/change-password", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		claims := GetCurrentUser(r)
		if claims == nil {
			http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			CurrentPassword string `json:"current_password"`
			NewPassword     string `json:"new_password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid request body",
			})
			return
		}

		if len(req.NewPassword) < 6 {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Password must be at least 6 characters",
			})
			return
		}

		user, err := GetUserByID(claims.UserID)
		if err != nil || user == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "User not found",
			})
			return
		}

		if !CheckPassword(req.CurrentPassword, user.Password) {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Current password is incorrect",
			})
			return
		}

		hashedPassword, err := HashPassword(req.NewPassword)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to hash password",
			})
			return
		}

		_, err = db.db.Exec("UPDATE users SET password_hash = ? WHERE id = ?", hashedPassword, user.ID)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to update password",
			})
			return
		}

		LogAudit(user.ID, user.Username, "change_password", "user", user.ID, nil, r.RemoteAddr)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Password changed successfully",
		})
	}).Methods("POST")
}

// auditDedup tracks recent audit entries to prevent duplicates
var auditDedup = make(map[string]time.Time)
var auditDedupMutex sync.Mutex

// LogAudit logs an audit event with deduplication
func LogAudit(userID, username, action, resourceType, resourceID string, details interface{}, ipAddress string) {
	if db == nil {
		return
	}

	// Create dedup key from user, action, and resource
	dedupKey := fmt.Sprintf("%s:%s:%s:%s", userID, action, resourceType, resourceID)

	auditDedupMutex.Lock()
	if lastTime, exists := auditDedup[dedupKey]; exists {
		// Skip if same action within 2 seconds
		if time.Since(lastTime) < 2*time.Second {
			auditDedupMutex.Unlock()
			return
		}
	}
	auditDedup[dedupKey] = time.Now()
	// Clean old entries (keep map from growing indefinitely)
	for k, v := range auditDedup {
		if time.Since(v) > 10*time.Second {
			delete(auditDedup, k)
		}
	}
	auditDedupMutex.Unlock()

	detailsJSON := "{}"
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			detailsJSON = string(b)
		}
	}

	id := fmt.Sprintf("audit-%d", time.Now().UnixNano())
	db.db.Exec(`
		INSERT INTO audit_log (id, user_id, username, action, resource_type, resource_id, details, ip_address)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, userID, username, action, resourceType, resourceID, detailsJSON, ipAddress)
}
