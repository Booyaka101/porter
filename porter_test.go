package porter

import (
	"testing"
)

// =============================================================================
// VARS TESTS
// =============================================================================

func TestVars_SetGet(t *testing.T) {
	vars := NewVars()
	vars.Set("key1", "value1")
	vars.Set("key2", "value2")

	if vars.Get("key1") != "value1" {
		t.Errorf("expected 'value1', got '%s'", vars.Get("key1"))
	}
	if vars.Get("key2") != "value2" {
		t.Errorf("expected 'value2', got '%s'", vars.Get("key2"))
	}
	if vars.Get("nonexistent") != "" {
		t.Errorf("expected empty string for nonexistent key, got '%s'", vars.Get("nonexistent"))
	}
}

func TestVars_SetGetBool(t *testing.T) {
	vars := NewVars()
	vars.SetBool("enabled", true)
	vars.SetBool("disabled", false)

	if !vars.GetBool("enabled") {
		t.Error("expected true for 'enabled'")
	}
	if vars.GetBool("disabled") {
		t.Error("expected false for 'disabled'")
	}
	if vars.GetBool("nonexistent") {
		t.Error("expected false for nonexistent key")
	}
}

func TestVars_SetGetBytes(t *testing.T) {
	vars := NewVars()
	data := []byte{0x01, 0x02, 0x03, 0x04}
	vars.SetBytes("binary", data)

	result := vars.GetBytes("binary")
	if len(result) != len(data) {
		t.Errorf("expected %d bytes, got %d", len(data), len(result))
	}
	for i, b := range result {
		if b != data[i] {
			t.Errorf("byte %d: expected %x, got %x", i, data[i], b)
		}
	}
	if vars.GetBytes("nonexistent") != nil {
		t.Error("expected nil for nonexistent key")
	}
}

func TestVars_Clear(t *testing.T) {
	vars := NewVars()
	vars.Set("key", "value")
	vars.SetBytes("binary", []byte{1, 2, 3})
	vars.Item = "test"

	vars.Clear()

	if vars.Get("key") != "" {
		t.Error("expected empty string after Clear")
	}
	if vars.GetBytes("binary") != nil {
		t.Error("expected nil bytes after Clear")
	}
	if vars.Item != "" {
		t.Error("expected empty Item after Clear")
	}
}

func TestVars_Expand(t *testing.T) {
	vars := NewVars()
	vars.Set("name", "test-service")
	vars.Set("port", "8080")
	vars.Item = "item1"

	tests := []struct {
		input    string
		expected string
	}{
		{"{{name}}", "test-service"},
		{"{{port}}", "8080"},
		{"{{item}}", "item1"},
		{"service-{{name}}:{{port}}", "service-test-service:8080"},
		{"no-vars-here", "no-vars-here"},
		{"", ""},
		{"{{unknown}}", "{{unknown}}"},
	}

	for _, tt := range tests {
		result := vars.Expand(tt.input)
		if result != tt.expected {
			t.Errorf("Expand(%q): expected %q, got %q", tt.input, tt.expected, result)
		}
	}
}

// =============================================================================
// CONDITIONS TESTS
// =============================================================================

func TestConditions(t *testing.T) {
	vars := NewVars()
	vars.SetBool("enabled", true)
	vars.SetBool("disabled", false)
	vars.Set("value", "hello")

	tests := []struct {
		name     string
		cond     When
		expected bool
	}{
		{"Always", Always(), true},
		{"Never", Never(), false},
		{"If - true", If("enabled"), true},
		{"If - false", If("disabled"), false},
		{"IfNot - false", IfNot("disabled"), true},
		{"IfNot - true", IfNot("enabled"), false},
		{"IfSet - exists", IfSet("value"), true},
		{"IfSet - not exists", IfSet("nonexistent"), false},
		{"IfEquals - match", IfEquals("value", "hello"), true},
		{"IfEquals - no match", IfEquals("value", "world"), false},
	}

	for _, tt := range tests {
		result := tt.cond(vars)
		if result != tt.expected {
			t.Errorf("%s: expected %v, got %v", tt.name, tt.expected, result)
		}
	}
}

func TestConditions_And(t *testing.T) {
	vars := NewVars()
	vars.SetBool("a", true)
	vars.SetBool("b", true)
	vars.SetBool("c", false)

	if !And(If("a"), If("b"))(vars) {
		t.Error("And(true, true) should be true")
	}
	if And(If("a"), If("c"))(vars) {
		t.Error("And(true, false) should be false")
	}
}

func TestConditions_Or(t *testing.T) {
	vars := NewVars()
	vars.SetBool("a", true)
	vars.SetBool("b", false)
	vars.SetBool("c", false)

	if !Or(If("a"), If("b"))(vars) {
		t.Error("Or(true, false) should be true")
	}
	if Or(If("b"), If("c"))(vars) {
		t.Error("Or(false, false) should be false")
	}
}

func TestConditions_Not(t *testing.T) {
	vars := NewVars()
	vars.SetBool("a", true)

	if Not(If("a"))(vars) {
		t.Error("Not(true) should be false")
	}
	if !Not(If("nonexistent"))(vars) {
		t.Error("Not(false) should be true")
	}
}

// =============================================================================
// DSL BUILDER TESTS
// =============================================================================

func TestDSL_Run(t *testing.T) {
	task := Run("echo hello").Build()
	if task.Action != "run" {
		t.Errorf("expected action 'run', got '%s'", task.Action)
	}
	if task.Body != "echo hello" {
		t.Errorf("expected body 'echo hello', got '%s'", task.Body)
	}
}

func TestDSL_RunSudo(t *testing.T) {
	task := Run("apt update").Sudo().Build()
	if task.Action != "run" {
		t.Errorf("expected action 'run', got '%s'", task.Action)
	}
	if !task.Sudo {
		t.Error("expected Sudo to be true")
	}
}

func TestDSL_Upload(t *testing.T) {
	task := Upload("/local/file", "/remote/file").Build()
	if task.Action != "upload" {
		t.Errorf("expected action 'upload', got '%s'", task.Action)
	}
	if task.Src != "/local/file" {
		t.Errorf("expected src '/local/file', got '%s'", task.Src)
	}
	if task.Dest != "/remote/file" {
		t.Errorf("expected dest '/remote/file', got '%s'", task.Dest)
	}
}

func TestDSL_Template(t *testing.T) {
	task := Template("/remote/file", "content {{var}}").Build()
	if task.Action != "template" {
		t.Errorf("expected action 'template', got '%s'", task.Action)
	}
	if task.Dest != "/remote/file" {
		t.Errorf("expected dest '/remote/file', got '%s'", task.Dest)
	}
	if task.Body != "content {{var}}" {
		t.Errorf("expected body 'content {{var}}', got '%s'", task.Body)
	}
}

func TestDSL_Svc(t *testing.T) {
	// Test start
	task := Svc("nginx").Start().Build()
	if task.Action != "service" {
		t.Errorf("expected action 'service', got '%s'", task.Action)
	}
	if task.State != "start" {
		t.Errorf("expected state 'start', got '%s'", task.State)
	}
	if task.Dest != "nginx" {
		t.Errorf("expected dest 'nginx', got '%s'", task.Dest)
	}

	// Test stop
	task = Svc("nginx").Stop().Build()
	if task.State != "stop" {
		t.Errorf("expected state 'stop', got '%s'", task.State)
	}

	// Test restart
	task = Svc("nginx").Restart().Build()
	if task.State != "restart" {
		t.Errorf("expected state 'restart', got '%s'", task.State)
	}

	// Test enable
	task = Svc("nginx").Enable().Build()
	if task.State != "enable" {
		t.Errorf("expected state 'enable', got '%s'", task.State)
	}

	// Test user service
	task = Svc("myapp").Start().User().Build()
	if !task.User {
		t.Error("expected User to be true")
	}
}

func TestDSL_Docker(t *testing.T) {
	task := Docker("nginx").Start().Build()
	if task.Action != "docker" {
		t.Errorf("expected action 'docker', got '%s'", task.Action)
	}
	if task.State != "start" {
		t.Errorf("expected state 'start', got '%s'", task.State)
	}
	if task.Dest != "nginx" {
		t.Errorf("expected dest 'nginx', got '%s'", task.Dest)
	}
}

func TestDSL_Compose(t *testing.T) {
	task := Compose("/app").Up().Build()
	if task.Action != "compose" {
		t.Errorf("expected action 'compose', got '%s'", task.Action)
	}
	if task.State != "up" {
		t.Errorf("expected state 'up', got '%s'", task.State)
	}

	task = Compose("/app").Down().Build()
	if task.State != "down" {
		t.Errorf("expected state 'down', got '%s'", task.State)
	}
}

func TestDSL_Wibu(t *testing.T) {
	task := WibuGenerate("6000930", "/tmp/license").Build()
	if task.Action != "wibu_generate" {
		t.Errorf("expected action 'wibu_generate', got '%s'", task.Action)
	}
	if task.Src != "6000930" {
		t.Errorf("expected src '6000930', got '%s'", task.Src)
	}
	if task.Dest != "/tmp/license" {
		t.Errorf("expected dest '/tmp/license', got '%s'", task.Dest)
	}

	task = WibuApply("/tmp/renew").Build()
	if task.Action != "wibu_apply" {
		t.Errorf("expected action 'wibu_apply', got '%s'", task.Action)
	}

	task = WibuInfo().Build()
	if task.Action != "wibu_info" {
		t.Errorf("expected action 'wibu_info', got '%s'", task.Action)
	}

	task = WibuList().Build()
	if task.Action != "wibu_list" {
		t.Errorf("expected action 'wibu_list', got '%s'", task.Action)
	}
}

func TestDSL_SFTP(t *testing.T) {
	task := Download("/remote/file").Register("data").Build()
	if task.Action != "download" {
		t.Errorf("expected action 'download', got '%s'", task.Action)
	}
	if task.Register != "data" {
		t.Errorf("expected register 'data', got '%s'", task.Register)
	}

	task = UploadBytes("var", "/remote/file").Build()
	if task.Action != "upload_bytes" {
		t.Errorf("expected action 'upload_bytes', got '%s'", task.Action)
	}
}

func TestDSL_Wait(t *testing.T) {
	task := WaitForPort("127.0.0.1", "8080").Timeout("30s").Build()
	if task.Action != "wait_port" {
		t.Errorf("expected action 'wait_port', got '%s'", task.Action)
	}
	if task.Dest != "127.0.0.1" {
		t.Errorf("expected dest '127.0.0.1', got '%s'", task.Dest)
	}
	if task.Body != "8080" {
		t.Errorf("expected body '8080', got '%s'", task.Body)
	}
}

// =============================================================================
// TASK OPTIONS TESTS
// =============================================================================

func TestTaskBuilder_Retry(t *testing.T) {
	task := Run("flaky-command").Retry(3).Build()
	if task.Retry != 3 {
		t.Errorf("expected retry 3, got %d", task.Retry)
	}
}

func TestTaskBuilder_When(t *testing.T) {
	vars := NewVars()
	vars.SetBool("enabled", true)

	task := Run("conditional").When(If("enabled")).Build()
	if task.When == nil {
		t.Error("expected When to be set")
	}
	if !task.When(vars) {
		t.Error("expected When to return true")
	}
}

func TestTaskBuilder_Loop(t *testing.T) {
	task := Run("echo {{item}}").Loop("a", "b", "c").Build()
	if len(task.Loop) != 3 {
		t.Errorf("expected 3 loop items, got %d", len(task.Loop))
	}
	if task.Loop[0] != "a" || task.Loop[1] != "b" || task.Loop[2] != "c" {
		t.Errorf("unexpected loop items: %v", task.Loop)
	}
}

func TestTaskBuilder_Creates(t *testing.T) {
	task := Mkdir("/var/data").Creates("/var/data").Build()
	if task.Creates != "/var/data" {
		t.Errorf("expected creates '/var/data', got '%s'", task.Creates)
	}

	// Test with variable expansion path
	task = Install("/tmp/myapp", "/usr/bin/myapp").Creates("/usr/bin/myapp").Build()
	if task.Creates != "/usr/bin/myapp" {
		t.Errorf("expected creates '/usr/bin/myapp', got '%s'", task.Creates)
	}
}

func TestTaskBuilder_Name(t *testing.T) {
	task := Run("echo hello").Name("Say hello").Build()
	if task.Name != "Say hello" {
		t.Errorf("expected name 'Say hello', got '%s'", task.Name)
	}
}

// =============================================================================
// TASKS HELPER TESTS
// =============================================================================

func TestTasks(t *testing.T) {
	tasks := Tasks(
		Run("echo 1"),
		Run("echo 2"),
		Run("echo 3"),
	)
	if len(tasks) != 3 {
		t.Errorf("expected 3 tasks, got %d", len(tasks))
	}
}

// =============================================================================
// STATS TESTS
// =============================================================================

func TestStats(t *testing.T) {
	stats := Stats{
		Total:   10,
		OK:      7,
		Changed: 2,
		Skipped: 1,
		Failed:  0,
	}

	if stats.Total != 10 {
		t.Errorf("expected Total 10, got %d", stats.Total)
	}
	if stats.OK != 7 {
		t.Errorf("expected OK 7, got %d", stats.OK)
	}
	if stats.Changed != 2 {
		t.Errorf("expected Changed 2, got %d", stats.Changed)
	}
	if stats.Skipped != 1 {
		t.Errorf("expected Skipped 1, got %d", stats.Skipped)
	}
	if stats.Failed != 0 {
		t.Errorf("expected Failed 0, got %d", stats.Failed)
	}
}

// =============================================================================
// MANIFEST BUILDING TESTS
// =============================================================================

func TestManifest_DeploymentPattern(t *testing.T) {
	// Test that a typical deployment manifest can be built
	vars := NewVars()
	vars.Set("app_mode", "production")
	vars.Set("app_version", "1.0.0")
	vars.Set("server_ip", "192.168.1.100")
	vars.SetBool("has_worker", true)

	tasks := Tasks(
		// File operations
		Upload("/local/binary", "/opt/myapp").Name("Upload app binary"),
		Chmod("/opt/myapp").Mode("755"),

		// Template
		Template("/etc/systemd/user/myapp.service", "ExecStart=/opt/myapp -mode={{app_mode}}"),

		// Service management
		DaemonReload().User(),
		Svc("myapp").Enable().User(),
		Svc("myapp").Start().User().Retry(2),

		// Conditional task
		Svc("worker").Start().When(If("has_worker")),

		// Health check
		WaitForPort("127.0.0.1", "4022").Timeout("30s"),
	)

	if len(tasks) != 8 {
		t.Errorf("expected 8 tasks, got %d", len(tasks))
	}

	// Verify conditional task
	workerTask := tasks[6]
	if workerTask.When == nil {
		t.Error("expected worker task to have When condition")
	}
	if !workerTask.When(vars) {
		t.Error("expected worker task condition to be true")
	}

	// Test with worker disabled
	vars.SetBool("has_worker", false)
	if workerTask.When(vars) {
		t.Error("expected worker task condition to be false when disabled")
	}
}

func TestManifest_WibuFetchPattern(t *testing.T) {
	// Test Wibu license fetch pattern
	tasks := Tasks(
		WibuGenerate("6000930", "testing"),
		Download("testing").Register("license_data"),
	)

	if len(tasks) != 2 {
		t.Errorf("expected 2 tasks, got %d", len(tasks))
	}

	if tasks[0].Action != "wibu_generate" {
		t.Errorf("expected wibu_generate, got %s", tasks[0].Action)
	}
	if tasks[1].Register != "license_data" {
		t.Errorf("expected register 'license_data', got %s", tasks[1].Register)
	}
}

func TestManifest_WibuApplyPattern(t *testing.T) {
	// Test Wibu license apply pattern
	tasks := Tasks(
		UploadBytes("renew_data", "/tmp/renew"),
		WibuApply("/tmp/renew"),
	)

	if len(tasks) != 2 {
		t.Errorf("expected 2 tasks, got %d", len(tasks))
	}

	if tasks[0].Action != "upload_bytes" {
		t.Errorf("expected upload_bytes, got %s", tasks[0].Action)
	}
	if tasks[1].Action != "wibu_apply" {
		t.Errorf("expected wibu_apply, got %s", tasks[1].Action)
	}
}

// =============================================================================
// VARIABLE EXPANSION IN TASKS
// =============================================================================

func TestTaskExpansion(t *testing.T) {
	vars := NewVars()
	vars.Set("service", "myapp")
	vars.Set("port", "8080")

	// Simulate what executor does with variable expansion
	task := Svc("{{service}}").Start().Build()
	expandedDest := vars.Expand(task.Dest)

	if expandedDest != "myapp" {
		t.Errorf("expected 'myapp', got '%s'", expandedDest)
	}
}

func TestLoopExpansion(t *testing.T) {
	vars := NewVars()

	task := Run("systemctl restart {{item}}").Loop("myapp", "worker", "scheduler").Build()

	// Simulate loop execution
	for _, item := range task.Loop {
		vars.Item = item
		expanded := vars.Expand(task.Body)

		expected := "systemctl restart " + item
		if expanded != expected {
			t.Errorf("expected '%s', got '%s'", expected, expanded)
		}
	}
}

// =============================================================================
// SYSTEMD SERVICE FILE MANAGEMENT TESTS
// =============================================================================

func TestEscapeSed(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"simple", "simple"},
		{"192.168.1.1", "192.168.1.1"},
		{"path/to/file", `path\/to\/file`},
		{"a&b", `a\&b`},
		{`back\slash`, `back\\slash`},
		{`/path/with&special\chars`, `\/path\/with\&special\\chars`},
		{"", ""},
	}

	for _, tt := range tests {
		result := EscapeSed(tt.input)
		if result != tt.expected {
			t.Errorf("EscapeSed(%q): expected %q, got %q", tt.input, tt.expected, result)
		}
	}
}

func TestUpdateServiceParam(t *testing.T) {
	// Test that the pattern is correctly generated
	pattern := UpdateServiceParam("port", "3099")
	expected := `s%-port=\("\{0,1\}\)\([^" ]*\)\1%-port=\13099\1%g`
	if pattern != expected {
		t.Errorf("UpdateServiceParam pattern mismatch:\nexpected: %s\ngot:      %s", expected, pattern)
	}

	// Test with special characters in value
	pattern = UpdateServiceParam("host", "192.168.1.1")
	expected = `s%-host=\("\{0,1\}\)\([^" ]*\)\1%-host=\1192.168.1.1\1%g`
	if pattern != expected {
		t.Errorf("UpdateServiceParam with IP:\nexpected: %s\ngot:      %s", expected, pattern)
	}

	// Test with path containing slashes
	pattern = UpdateServiceParam("config", "/etc/myapp/config.json")
	expected = `s%-config=\("\{0,1\}\)\([^" ]*\)\1%-config=\1\/etc\/myapp\/config.json\1%g`
	if pattern != expected {
		t.Errorf("UpdateServiceParam with path:\nexpected: %s\ngot:      %s", expected, pattern)
	}
}

func TestUpdateServiceParamTask(t *testing.T) {
	task := UpdateServiceParamTask("/etc/systemd/system/myapp.service", "port", "8080").Build()

	if task.Action != "sed" {
		t.Errorf("expected action 'sed', got '%s'", task.Action)
	}
	if task.Dest != "/etc/systemd/system/myapp.service" {
		t.Errorf("expected dest '/etc/systemd/system/myapp.service', got '%s'", task.Dest)
	}
	expectedPattern := `s%-port=\("\{0,1\}\)\([^" ]*\)\1%-port=\18080\1%g`
	if task.Body != expectedPattern {
		t.Errorf("expected pattern %q, got %q", expectedPattern, task.Body)
	}
}

func TestServiceFileConfig_servicePath(t *testing.T) {
	// Test user service path
	userCfg := ServiceFileConfig{Name: "myapp", IsUser: true}
	if userCfg.servicePath() != "~/.config/systemd/user/myapp.service" {
		t.Errorf("unexpected user service path: %s", userCfg.servicePath())
	}

	// Test system service path
	sysCfg := ServiceFileConfig{Name: "worker", IsUser: false}
	if sysCfg.servicePath() != "/etc/systemd/system/worker.service" {
		t.Errorf("unexpected system service path: %s", sysCfg.servicePath())
	}
}

func TestManageServiceFile_UserService(t *testing.T) {
	cfg := ServiceFileConfig{
		Name:     "myapp",
		Template: "[Unit]\nDescription=MyApp\n[Service]\nExecStart=/usr/bin/myapp -port=8080",
		IsUser:   true,
		Params: map[string]string{
			"port": "8080",
		},
	}

	tasks := ManageServiceFile(cfg)

	// Should have: 1 check + 1 create + 1 param update = 3 tasks
	if len(tasks) != 3 {
		t.Errorf("expected 3 tasks, got %d", len(tasks))
	}

	// First task: file_exists check
	if tasks[0].Action != "file_exists" {
		t.Errorf("expected first task action 'file_exists', got '%s'", tasks[0].Action)
	}
	if tasks[0].Register != "myapp_service_exists" {
		t.Errorf("expected register 'myapp_service_exists', got '%s'", tasks[0].Register)
	}

	// Second task: template creation (conditional)
	if tasks[1].Action != "template" {
		t.Errorf("expected second task action 'template', got '%s'", tasks[1].Action)
	}
	if !tasks[1].User {
		t.Error("expected template task to have User=true for user service")
	}
	if tasks[1].When == nil {
		t.Error("expected template task to have When condition")
	}

	// Third task: sed update (conditional)
	if tasks[2].Action != "sed" {
		t.Errorf("expected third task action 'sed', got '%s'", tasks[2].Action)
	}
	if tasks[2].When == nil {
		t.Error("expected sed task to have When condition")
	}
}

func TestManageServiceFile_SystemService(t *testing.T) {
	cfg := ServiceFileConfig{
		Name:     "worker",
		Template: "[Unit]\nDescription=Worker\n[Service]\nExecStart=/usr/bin/worker",
		IsUser:   false,
		Params:   map[string]string{},
	}

	tasks := ManageServiceFile(cfg)

	// Should have: 1 check + 1 create = 2 tasks (no params)
	if len(tasks) != 2 {
		t.Errorf("expected 2 tasks, got %d", len(tasks))
	}

	// Template task should use Sudo for system services
	if !tasks[1].Sudo {
		t.Error("expected template task to have Sudo=true for system service")
	}
}

func TestManageServiceFileWithReload(t *testing.T) {
	cfg := ServiceFileConfig{
		Name:     "myapp",
		Template: "[Unit]\nDescription=MyApp",
		IsUser:   true,
		Params:   map[string]string{},
	}

	tasks := ManageServiceFileWithReload(cfg)

	// Should have: 1 check + 1 create + 1 daemon-reload + 1 restart = 4 tasks
	if len(tasks) != 4 {
		t.Errorf("expected 4 tasks, got %d", len(tasks))
	}

	// Third task: daemon_reload
	if tasks[2].Action != "daemon_reload" {
		t.Errorf("expected third task action 'daemon_reload', got '%s'", tasks[2].Action)
	}
	if !tasks[2].User {
		t.Error("expected daemon_reload to have User=true for user service")
	}

	// Fourth task: service restart
	if tasks[3].Action != "service" {
		t.Errorf("expected fourth task action 'service', got '%s'", tasks[3].Action)
	}
	if tasks[3].State != "restart" {
		t.Errorf("expected state 'restart', got '%s'", tasks[3].State)
	}
	if tasks[3].Dest != "myapp" {
		t.Errorf("expected dest 'myapp', got '%s'", tasks[3].Dest)
	}
}

func TestManageServiceFile_MultipleParams(t *testing.T) {
	cfg := ServiceFileConfig{
		Name:     "myapp",
		Template: "[Service]\nExecStart=/usr/bin/myapp -port=8080 -host=127.0.0.1 -mode=default",
		IsUser:   true,
		Params: map[string]string{
			"port": "9000",
			"host": "192.168.1.100",
			"mode": "production",
		},
	}

	tasks := ManageServiceFile(cfg)

	// Should have: 1 check + 1 create + 3 param updates = 5 tasks
	if len(tasks) != 5 {
		t.Errorf("expected 5 tasks, got %d", len(tasks))
	}

	// Count sed tasks
	sedCount := 0
	for _, task := range tasks {
		if task.Action == "sed" {
			sedCount++
		}
	}
	if sedCount != 3 {
		t.Errorf("expected 3 sed tasks, got %d", sedCount)
	}
}

func TestManageServiceFile_NeedsSudo(t *testing.T) {
	// User service without NeedsSudo - should NOT have sudo on sed tasks
	cfg := ServiceFileConfig{
		Name:      "myapp",
		Template:  "[Service]\nExecStart=/usr/bin/myapp -port=8080",
		IsUser:    true,
		NeedsSudo: false,
		Params:    map[string]string{"port": "9000"},
	}

	tasks := ManageServiceFile(cfg)

	// Template task should have User=true but Sudo=false
	if !tasks[1].User {
		t.Error("expected template task to have User=true")
	}
	if tasks[1].Sudo {
		t.Error("expected template task to have Sudo=false when NeedsSudo=false")
	}

	// Sed task should NOT have sudo
	if tasks[2].Sudo {
		t.Error("expected sed task to have Sudo=false when NeedsSudo=false")
	}

	// User service WITH NeedsSudo - should have sudo on all file operations
	cfgWithSudo := ServiceFileConfig{
		Name:      "myapp",
		Template:  "[Service]\nExecStart=/usr/bin/myapp -port=8080",
		IsUser:    true,
		NeedsSudo: true,
		Params:    map[string]string{"port": "9000"},
	}

	tasksWithSudo := ManageServiceFile(cfgWithSudo)

	// Template task should have both User=true AND Sudo=true
	if !tasksWithSudo[1].User {
		t.Error("expected template task to have User=true")
	}
	if !tasksWithSudo[1].Sudo {
		t.Error("expected template task to have Sudo=true when NeedsSudo=true")
	}

	// Sed task should have sudo
	if !tasksWithSudo[2].Sudo {
		t.Error("expected sed task to have Sudo=true when NeedsSudo=true")
	}
}
