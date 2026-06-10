package porterui

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/booyaka101/porter"
)

// newDeployTracer creates a porter.Tracer that records the deploy's spans as
// JSONL under <dataDir>/traces/, plus a close func to release the file. The
// deploy environment comes from PORTER_ENV (default "production"). Tracing is
// best-effort: if the directory or file can't be created it returns a nil
// tracer (which the executor treats as "no tracing") and a no-op close.
func newDeployTracer(manifest, machine string) (*porter.Tracer, func()) {
	dir := filepath.Join(getDataDir(), "traces")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, func() {}
	}
	f, err := os.CreateTemp(dir, sanitizeTraceName(manifest)+"-*.jsonl")
	if err != nil {
		return nil, func() {}
	}
	env := os.Getenv("PORTER_ENV")
	if env == "" {
		env = "production"
	}
	tr := porter.NewTracer(f, env, manifest)
	if machine != "" {
		tr.SetAttribute("server.name", machine)
	}
	return tr, func() { _ = f.Close() }
}

// sanitizeTraceName makes a manifest name safe for a filename.
func sanitizeTraceName(s string) string {
	if s == "" {
		return "deploy"
	}
	mapped := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			return r
		default:
			return '-'
		}
	}, s)
	return strings.Trim(mapped, "-")
}
