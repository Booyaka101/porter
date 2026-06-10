package porterui

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gorilla/mux"
)

func TestTracesEndpoints(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("DATA_DIR", dir)
	if err := os.MkdirAll(filepath.Join(dir, "traces"), 0o755); err != nil {
		t.Fatal(err)
	}
	// One trace file with two JSONL spans.
	trace := `{"trace_id":"t1","span_id":"a","name":"deploy x","status":"ok","duration_ms":10}
{"trace_id":"t1","span_id":"b","parent_span_id":"a","name":"run step","status":"ok","duration_ms":3}`
	if err := os.WriteFile(filepath.Join(dir, "traces", "x-123.jsonl"), []byte(trace), 0o644); err != nil {
		t.Fatal(err)
	}

	r := mux.NewRouter()
	TracesRoutes(r)

	// list
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/api/traces", nil))
	if rec.Code != 200 {
		t.Fatalf("list status %d", rec.Code)
	}
	var files []traceFile
	if err := json.Unmarshal(rec.Body.Bytes(), &files); err != nil {
		t.Fatalf("list decode: %v", err)
	}
	if len(files) != 1 || files[0].Name != "x-123.jsonl" {
		t.Fatalf("list = %+v", files)
	}

	// get
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/api/traces/x-123.jsonl", nil))
	if rec.Code != 200 {
		t.Fatalf("get status %d", rec.Code)
	}
	var spans []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &spans); err != nil {
		t.Fatalf("get decode: %v", err)
	}
	if len(spans) != 2 || spans[1]["parent_span_id"] != "a" {
		t.Fatalf("spans = %+v", spans)
	}

	// path-traversal guard
	for _, bad := range []string{"/api/traces/..%2f..%2fetc%2fpasswd", "/api/traces/x.txt"} {
		rec = httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest("GET", bad, nil))
		if rec.Code == 200 {
			t.Errorf("bad path %q should not return 200", bad)
		}
	}

	// viewer HTML
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/traces", nil))
	if rec.Code != 200 || rec.Header().Get("Content-Type") == "application/json" {
		t.Fatalf("viewer status %d / ctype %s", rec.Code, rec.Header().Get("Content-Type"))
	}
}
