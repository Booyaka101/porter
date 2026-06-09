package porter

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"sync"
	"time"
)

// Tracer records a deployment as a trace: one root span per Run, one child
// span per task. Spans are emitted as JSON lines (one object per line) to an
// io.Writer, so a deploy can be replayed as a waterfall in the dashboard or
// piped to an OTLP/JSONL consumer (e.g. otel-tui). It deliberately has no
// OpenTelemetry SDK dependency — the schema mirrors the OTel span model and
// uses the stable `deployment.environment.name` attribute (2026 semconv).
//
// A Tracer is safe for concurrent span emission.
type Tracer struct {
	mu      sync.Mutex
	enc     *json.Encoder
	traceID string
	env     string
	service string
	attrs   map[string]any
}

// Span is a single emitted span (OTel-shaped, JSON-serialisable).
type Span struct {
	TraceID    string         `json:"trace_id"`
	SpanID     string         `json:"span_id"`
	ParentID   string         `json:"parent_span_id,omitempty"`
	Name       string         `json:"name"`
	Start      time.Time      `json:"start"`
	End        time.Time      `json:"end"`
	DurationMs int64          `json:"duration_ms"`
	Status     string         `json:"status"` // "ok" or "error"
	Attributes map[string]any `json:"attributes,omitempty"`
}

// ActiveSpan is an in-flight span; call End to emit it.
type ActiveSpan struct {
	tracer *Tracer
	span   Span
}

// NewTracer creates a Tracer that writes JSONL spans to w. env is the
// deployment environment ("production", "staging", …) and service is the
// logical service being deployed; both are attached to every span. Passing a
// nil writer yields a no-op tracer (every method is safe to call).
func NewTracer(w io.Writer, env, service string) *Tracer {
	t := &Tracer{traceID: randomID(16), env: env, service: service}
	if w != nil {
		t.enc = json.NewEncoder(w)
	}
	return t
}

// TraceID returns the trace's id (a deploy is one trace).
func (t *Tracer) TraceID() string {
	if t == nil {
		return ""
	}
	return t.traceID
}

// SetAttribute attaches a key/value to every subsequently emitted span
// (e.g. vcs.commit.sha, deployment.id). Safe before or during a deploy.
func (t *Tracer) SetAttribute(key string, value any) {
	if t == nil {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.attrs == nil {
		t.attrs = map[string]any{}
	}
	t.attrs[key] = value
}

// StartSpan begins a span named name, optionally as a child of parentID
// (empty for a root span). Returns an ActiveSpan whose End emits it.
func (t *Tracer) StartSpan(name, parentID string) *ActiveSpan {
	if t == nil {
		return nil
	}
	s := Span{
		TraceID:    t.traceID,
		SpanID:     randomID(8),
		ParentID:   parentID,
		Name:       name,
		Start:      time.Now(),
		Attributes: map[string]any{},
	}
	if t.env != "" {
		s.Attributes["deployment.environment.name"] = t.env
	}
	if t.service != "" {
		s.Attributes["service.name"] = t.service
	}
	return &ActiveSpan{tracer: t, span: s}
}

// ID returns the span's id (use as a parent for child spans).
func (a *ActiveSpan) ID() string {
	if a == nil {
		return ""
	}
	return a.span.SpanID
}

// SetAttribute attaches a key/value to this span only.
func (a *ActiveSpan) SetAttribute(key string, value any) {
	if a == nil {
		return
	}
	a.span.Attributes[key] = value
}

// End finalises the span with a status ("ok"/"error") and emits it. err, if
// non-nil, is recorded as the error.message attribute and forces error status.
func (a *ActiveSpan) End(err error) {
	if a == nil || a.tracer == nil || a.tracer.enc == nil {
		return
	}
	a.span.End = time.Now()
	a.span.DurationMs = a.span.End.Sub(a.span.Start).Milliseconds()
	a.span.Status = "ok"
	if err != nil {
		a.span.Status = "error"
		a.span.Attributes["error.message"] = err.Error()
	}
	t := a.tracer
	t.mu.Lock()
	defer t.mu.Unlock()
	for k, v := range t.attrs {
		if _, ok := a.span.Attributes[k]; !ok {
			a.span.Attributes[k] = v
		}
	}
	_ = t.enc.Encode(a.span) // emission failures must never break a deploy
}

func randomID(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// rand.Read essentially never fails; fall back to a time-seeded value.
		ns := time.Now().UnixNano()
		for i := range b {
			b[i] = byte(ns >> (uint(i%8) * 8))
		}
	}
	return hex.EncodeToString(b)
}
