package porter

// =============================================================================
// NGINX OPERATIONS
// =============================================================================

// NginxTest tests the nginx configuration for syntax errors.
func NginxTest() TaskBuilder {
	return TaskBuilder{Task{Action: "nginx_test", Name: "Nginx config test"}}
}

// NginxReload reloads the nginx configuration without downtime.
func NginxReload() TaskBuilder {
	return TaskBuilder{Task{Action: "nginx_reload", Name: "Nginx reload"}}
}
