package porterui

import (
	"net/http"
	"net/url"
	"os"
	"strings"
)

// checkWSOrigin defends WebSocket upgrades against cross-site WebSocket
// hijacking (CSWSH). With the previous `return true`, any web page the user
// visited could open a socket that rode their porter_token cookie — terminal,
// agent, dashboard, all reachable cross-origin. This permits a request only
// when:
//   - there is no Origin header (non-browser clients: agents, CLIs, tests), or
//   - the Origin's host matches the request Host (same-origin), or
//   - the Origin is listed in PORTER_ALLOWED_ORIGINS (comma-separated, for a
//     reverse-proxied or split-frontend deployment).
func checkWSOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // non-browser client (agent/CLI) — no CSRF surface
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	if strings.EqualFold(u.Host, r.Host) {
		return true
	}
	for _, allowed := range strings.Split(os.Getenv("PORTER_ALLOWED_ORIGINS"), ",") {
		allowed = strings.TrimSpace(allowed)
		if allowed == "" {
			continue
		}
		if strings.EqualFold(allowed, origin) || strings.EqualFold(allowed, u.Host) {
			return true
		}
	}
	return false
}

// allowSSEOrigin sets a precise, same-origin-or-allowlisted CORS header for a
// Server-Sent-Events endpoint instead of the wildcard "*". With "*", any
// cross-origin page could read the stream (logs, command output) riding the
// user's porter_token cookie. A same-origin request needs no header at all, so
// when the origin isn't trusted we set nothing and the browser blocks the
// cross-origin read.
func allowSSEOrigin(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" && checkWSOrigin(r) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Add("Vary", "Origin")
	}
}
