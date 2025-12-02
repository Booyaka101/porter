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
	task = Svc("game").Start().User().Build()
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
	task := Compose("/home/idx").Up().Build()
	if task.Action != "compose" {
		t.Errorf("expected action 'compose', got '%s'", task.Action)
	}
	if task.State != "up" {
		t.Errorf("expected state 'up', got '%s'", task.State)
	}

	task = Compose("/home/idx").Down().Build()
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
}

// =============================================================================
// MANIFEST BUILDING TESTS
// =============================================================================

func TestManifest_DeploymentPattern(t *testing.T) {
	// Test that a typical deployment manifest can be built
	vars := NewVars()
	vars.Set("game_type", "baccarat")
	vars.Set("game_variant", "standard")
	vars.Set("pivot_ip", "192.168.1.100")
	vars.SetBool("has_collector", true)

	tasks := Tasks(
		// File operations
		Upload("/local/binary", "/home/idx/game").Name("Upload game binary"),
		Chmod("/home/idx/game").Mode("755"),

		// Template
		Template("/etc/systemd/user/game.service", "ExecStart=/home/idx/game -game={{game_type}}"),

		// Service management
		DaemonReload().User(),
		Svc("game").Enable().User(),
		Svc("game").Start().User().Retry(2),

		// Conditional task
		Svc("collector").Start().When(If("has_collector")),

		// Health check
		WaitForPort("127.0.0.1", "4022").Timeout("30s"),
	)

	if len(tasks) != 8 {
		t.Errorf("expected 8 tasks, got %d", len(tasks))
	}

	// Verify conditional task
	collectorTask := tasks[6]
	if collectorTask.When == nil {
		t.Error("expected collector task to have When condition")
	}
	if !collectorTask.When(vars) {
		t.Error("expected collector task condition to be true")
	}

	// Test with collector disabled
	vars.SetBool("has_collector", false)
	if collectorTask.When(vars) {
		t.Error("expected collector task condition to be false when disabled")
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
		UploadBytes("renew_data", "/home/idx/renew"),
		WibuApply("/home/idx/renew"),
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
	vars.Set("service", "game")
	vars.Set("port", "4022")

	// Simulate what executor does with variable expansion
	task := Svc("{{service}}").Start().Build()
	expandedDest := vars.Expand(task.Dest)

	if expandedDest != "game" {
		t.Errorf("expected 'game', got '%s'", expandedDest)
	}
}

func TestLoopExpansion(t *testing.T) {
	vars := NewVars()

	task := Run("systemctl restart {{item}}").Loop("game", "trendboard", "collector").Build()

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
