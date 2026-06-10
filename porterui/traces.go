package porterui

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gorilla/mux"
)

// TracesRoutes serves the deploy traces written by the manifest deploy path
// (see deploytrace.go) — a list endpoint, a per-trace span endpoint, and a
// self-contained waterfall viewer at /traces. Registered behind AuthMiddleware
// when PORTER_AUTH is on.
func TracesRoutes(r *mux.Router) {
	r.HandleFunc("/api/traces", listTraces).Methods("GET")
	r.HandleFunc("/api/traces/{name}", getTrace).Methods("GET")
	r.HandleFunc("/traces", traceViewer).Methods("GET")
}

func tracesDir() string { return filepath.Join(getDataDir(), "traces") }

type traceFile struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	Modified int64  `json:"modified"` // unix seconds
}

func listTraces(w http.ResponseWriter, _ *http.Request) {
	entries, err := os.ReadDir(tracesDir())
	out := []traceFile{}
	if err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
				continue
			}
			info, err := e.Info()
			if err != nil {
				continue
			}
			out = append(out, traceFile{Name: e.Name(), Size: info.Size(), Modified: info.ModTime().Unix()})
		}
	}
	// Newest first.
	sort.Slice(out, func(i, j int) bool { return out[i].Modified > out[j].Modified })
	writeJSON(w, out)
}

func getTrace(w http.ResponseWriter, r *http.Request) {
	name := mux.Vars(r)["name"]
	// Path-traversal guard: only a bare .jsonl basename is allowed.
	if name != filepath.Base(name) || !strings.HasSuffix(name, ".jsonl") || strings.Contains(name, "..") {
		http.Error(w, `{"error":"invalid trace name"}`, http.StatusBadRequest)
		return
	}
	f, err := os.Open(filepath.Join(tracesDir(), name))
	if err != nil {
		http.Error(w, `{"error":"trace not found"}`, http.StatusNotFound)
		return
	}
	defer f.Close()

	spans := []json.RawMessage{}
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		spans = append(spans, json.RawMessage(line))
	}
	writeJSON(w, spans)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func traceViewer(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(traceViewerHTML))
}

const traceViewerHTML = `<!doctype html><html><head><meta charset="utf-8">
<title>Porter · Deploy Traces</title>
<style>
 body{font:14px/1.4 ui-monospace,Menlo,monospace;margin:0;background:#0e1116;color:#d6deeb}
 header{padding:12px 16px;background:#141a22;border-bottom:1px solid #232b36;font-weight:600}
 .wrap{display:flex;height:calc(100vh - 46px)}
 aside{width:320px;border-right:1px solid #232b36;overflow:auto}
 main{flex:1;overflow:auto;padding:12px 16px}
 .t{padding:8px 12px;border-bottom:1px solid #1c2430;cursor:pointer}
 .t:hover{background:#19212b}
 .t.sel{background:#1f2b3a}
 .t small{color:#7e8aa0;display:block}
 .row{display:flex;align-items:center;margin:2px 0}
 .lbl{width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px}
 .bar{height:14px;border-radius:3px;background:#3b82f6}
 .bar.err{background:#ef4444}
 .meta{color:#7e8aa0}
 .track{flex:1;background:#141a22;border-radius:3px;position:relative}
 h2{font-size:13px;color:#9fb0c9;margin:8px 0}
 code{color:#9fd0ff}
</style></head><body>
<header>Porter · Deploy Traces</header>
<div class="wrap">
 <aside id="list">loading…</aside>
 <main id="view"><div class="meta">Select a deploy on the left.</div></main>
</div>
<script>
async function loadList(){
 const r=await fetch('/api/traces'); const files=await r.json();
 const el=document.getElementById('list');
 if(!files.length){el.innerHTML='<div class="t meta">No traces yet. Run a deploy.</div>';return;}
 el.innerHTML='';
 for(const f of files){
  const d=document.createElement('div'); d.className='t';
  const when=new Date(f.modified*1000).toLocaleString();
  d.innerHTML='<div>'+f.name.replace(/\.jsonl$/,'')+'</div><small>'+when+' · '+f.size+' B</small>';
  d.onclick=()=>{document.querySelectorAll('.t').forEach(x=>x.classList.remove('sel'));d.classList.add('sel');loadTrace(f.name);};
  el.appendChild(d);
 }
}
async function loadTrace(name){
 const r=await fetch('/api/traces/'+encodeURIComponent(name)); const spans=await r.json();
 const view=document.getElementById('view');
 if(!spans.length){view.innerHTML='<div class="meta">empty trace</div>';return;}
 let min=Infinity,max=-Infinity;
 for(const s of spans){const st=new Date(s.start).getTime();const en=new Date(s.end).getTime();if(st<min)min=st;if(en>max)max=en;}
 const span=Math.max(1,max-min);
 // root first, then children by start
 spans.sort((a,b)=>(a.parent_span_id?1:0)-(b.parent_span_id?1:0)||new Date(a.start)-new Date(b.start));
 let html='<h2>'+name.replace(/\.jsonl$/,'')+' · '+spans.length+' spans · '+span+' ms</h2>';
 for(const s of spans){
  const st=new Date(s.start).getTime();const en=new Date(s.end).getTime();
  const left=((st-min)/span*100), width=Math.max(0.5,(en-st)/span*100);
  const err=s.status==='error';
  const attrs=s.attributes||{};
  const env=attrs['deployment.environment.name']?(' · '+attrs['deployment.environment.name']):'';
  html+='<div class="row"><div class="lbl" title="'+(s.name||'')+'">'+(s.parent_span_id?'&nbsp;&nbsp;↳ ':'')+(s.name||'')+'</div>'+
        '<div class="track"><div class="bar'+(err?' err':'')+'" style="margin-left:'+left+'%;width:'+width+'%" title="'+s.duration_ms+' ms'+(s.attributes&&s.attributes['error.message']?(' — '+s.attributes['error.message']):'')+'"></div></div>'+
        '<div class="meta" style="width:80px;text-align:right">'+s.duration_ms+'ms'+env+'</div></div>';
 }
 view.innerHTML=html;
}
loadList();
</script></body></html>`
