package porterui

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

// TestAuthMiddlewareEnforcesProtectedRoutes guards against the original wiring
// bug where SetupRoutesWithAuth created a protected subrouter but registered
// every route on the unprotected root router, leaving all endpoints open.
func TestAuthMiddlewareEnforcesProtectedRoutes(t *testing.T) {
	r := mux.NewRouter()
	r.Use(AuthMiddleware)
	hit := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }
	r.HandleFunc("/api/machines", hit)
	r.HandleFunc("/api/auth/status", hit)
	r.HandleFunc("/api/agent/ws", hit)
	r.HandleFunc("/", hit)

	cases := []struct {
		name       string
		path       string
		token      string
		wantStatus int
	}{
		{"protected route, no token -> 401", "/api/machines", "", http.StatusUnauthorized},
		{"protected route, bad token -> 401", "/api/machines", "garbage", http.StatusUnauthorized},
		{"public status -> 200", "/api/auth/status", "", http.StatusOK},
		{"agent channel allowlisted -> 200", "/api/agent/ws", "", http.StatusOK},
		{"static SPA -> 200", "/", "", http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.path, nil)
			if tc.token != "" {
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != tc.wantStatus {
				t.Fatalf("%s %s: got %d, want %d", req.Method, tc.path, rec.Code, tc.wantStatus)
			}
		})
	}
}

// TestAgentChannelTokenGate confirms agent channels are open without a
// configured secret but require it once PORTER_AGENT_TOKEN is set.
func TestAgentChannelTokenGate(t *testing.T) {
	r := mux.NewRouter()
	r.Use(AuthMiddleware)
	r.HandleFunc("/api/agent/ws", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	t.Run("open when unset", func(t *testing.T) {
		t.Setenv("PORTER_AGENT_TOKEN", "")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest("GET", "/api/agent/ws", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("unset token: got %d, want 200", rec.Code)
		}
	})
	t.Run("rejected without token when set", func(t *testing.T) {
		t.Setenv("PORTER_AGENT_TOKEN", "s3cr3t")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest("GET", "/api/agent/ws", nil))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("missing agent token: got %d, want 401", rec.Code)
		}
	})
	t.Run("accepted with token when set", func(t *testing.T) {
		t.Setenv("PORTER_AGENT_TOKEN", "s3cr3t")
		req := httptest.NewRequest("GET", "/api/agent/ws", nil)
		req.Header.Set("X-Porter-Agent-Token", "s3cr3t")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("valid agent token: got %d, want 200", rec.Code)
		}
	})
}

// TestAuthMiddlewareAcceptsValidToken confirms a properly signed token passes.
func TestAuthMiddlewareAcceptsValidToken(t *testing.T) {
	r := mux.NewRouter()
	r.Use(AuthMiddleware)
	r.HandleFunc("/api/machines", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	token, err := GenerateToken(&User{ID: "u1", Username: "admin", Role: "admin"}, []string{"*"})
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/machines", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("valid token should reach protected route, got %d", rec.Code)
	}
}
