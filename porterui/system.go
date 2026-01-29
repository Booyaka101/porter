package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// parseServices parses systemctl list-units output into service maps
// Format: name load active sub description...
func parseServices(output, svcType string, isUser bool) []map[string]interface{} {
	var services []map[string]interface{}
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 4 {
			name := fields[0]
			if svcType == "service" {
				name = strings.TrimSuffix(name, ".service")
			} else if svcType == "timer" {
				name = strings.TrimSuffix(name, ".timer")
			}

			// Skip OS-related services (common system services)
			if isOSService(name) {
				continue
			}

			// fields[1]=load, fields[2]=active, fields[3]=sub
			status := fields[2]   // active/inactive
			subState := fields[3] // running/exited/dead/etc

			services = append(services, map[string]interface{}{
				"name":        name,
				"status":      status,
				"subState":    subState,
				"description": strings.Join(fields[4:], " "),
				"enabled":     false, // Will be updated by enabled status check
				"type":        svcType,
				"isUser":      isUser,
			})
		}
	}
	return services
}

// isOSService returns true if the service is a core OS service or known 3rd party app
func isOSService(name string) bool {
	// Check exact matches first
	osServices := map[string]bool{
		// Core systemd services
		"systemd-ask-password-console": true, "systemd-ask-password-wall": true,
		"systemd-binfmt": true, "systemd-boot-check-no-failures": true,
		"systemd-fsck-root": true, "systemd-fsck@": true,
		"systemd-hibernate-resume": true, "systemd-hibernate": true,
		"systemd-hostnamed": true, "systemd-hwdb-update": true,
		"systemd-initctl": true, "systemd-journal-catalog-update": true,
		"systemd-journal-flush": true, "systemd-journald": true,
		"systemd-localed": true, "systemd-logind": true,
		"systemd-machine-id-commit": true, "systemd-modules-load": true,
		"systemd-networkd": true, "systemd-networkd-wait-online": true,
		"systemd-oomd": true, "systemd-pstore": true,
		"systemd-quotacheck": true, "systemd-random-seed": true,
		"systemd-remount-fs": true, "systemd-resolved": true,
		"systemd-rfkill": true, "systemd-suspend-then-hibernate": true,
		"systemd-suspend": true, "systemd-sysctl": true,
		"systemd-sysext": true, "systemd-sysusers": true,
		"systemd-time-wait-sync": true, "systemd-timedated": true,
		"systemd-timesyncd": true, "systemd-tmpfiles-clean": true,
		"systemd-tmpfiles-setup-dev": true, "systemd-tmpfiles-setup": true,
		"systemd-udev-settle": true, "systemd-udev-trigger": true,
		"systemd-udevd": true, "systemd-update-done": true,
		"systemd-update-utmp-runlevel": true, "systemd-update-utmp": true,
		"systemd-user-sessions": true, "systemd-vconsole-setup": true,

		// Core Linux/Ubuntu services
		"accounts-daemon": true, "acpid": true, "alsa-restore": true, "alsa-state": true,
		"anacron": true, "apparmor": true, "apport": true, "apport-autoreport": true,
		"apt-daily": true, "apt-daily-upgrade": true, "atd": true,
		"avahi-daemon": true, "bluetooth": true, "bolt": true,
		"colord": true, "console-setup": true, "cron": true,
		"cups": true, "cups-browsed": true, "dbus": true, "dbus-broker": true,
		"dm-event": true, "dmesg": true, "dpkg-db-backup": true,
		"e2scrub_all": true, "e2scrub_reap": true, "emergency": true,
		"finalrd": true, "fstrim": true, "fwupd-refresh": true, "fwupd": true,

		// Display managers and desktop
		"gdm": true, "gdm3": true, "lightdm": true, "sddm": true, "xdm": true,
		"display-manager": true, "graphical": true,
		"gnome-initial-setup": true, "gnome-remote-desktop": true,

		// Getty/TTY
		"getty@tty1": true, "getty@tty2": true, "getty@tty3": true,
		"getty@tty4": true, "getty@tty5": true, "getty@tty6": true,
		"serial-getty@ttyS0": true, "console-getty": true,
		"container-getty@": true, "getty-pre": true,

		// Boot/GRUB
		"grub-common": true, "grub-initrd-fallback": true,
		"initrd-cleanup": true, "initrd-parse-etc": true,
		"initrd-switch-root": true, "initrd-udevadm-cleanup-db": true,

		// Hardware/Kernel
		"irqbalance": true, "keyboard-setup": true, "kmod": true, "kmod-static-nodes": true,
		"ldconfig": true, "lm-sensors": true, "lvm2-lvmpolld": true,
		"lvm2-monitor": true, "lvm2-pvscan@": true,
		"ModemManager": true, "multipathd": true,

		// Network
		"networkd-dispatcher": true, "NetworkManager": true,
		"NetworkManager-dispatcher": true, "NetworkManager-wait-online": true,
		"network-online": true, "network-pre": true, "network": true,
		"nftables": true, "openvpn": true, "openvpn@": true,
		"wpa_supplicant": true, "wpa_supplicant-nl80211@": true,
		"wpa_supplicant-wired@": true, "wpa_supplicant@": true,

		// Package managers
		"packagekit": true, "packagekit-offline-update": true,
		"snapd": true, "snapd.apparmor": true, "snapd.autoimport": true,
		"snapd.core-fixup": true, "snapd.failure": true, "snapd.recovery-chooser-trigger": true,
		"snapd.seeded": true, "snapd.snap-repair": true, "snapd.system-shutdown": true,
		"flatpak-system-helper": true,

		// Plymouth (boot splash)
		"plymouth": true, "plymouth-halt": true, "plymouth-kexec": true,
		"plymouth-poweroff": true, "plymouth-quit": true, "plymouth-quit-wait": true,
		"plymouth-read-write": true, "plymouth-reboot": true,
		"plymouth-start": true, "plymouth-switch-root": true,

		// Polkit/Auth
		"polkit": true, "polkitd": true,

		// Power management
		"power-profiles-daemon": true, "thermald": true, "tlp": true,
		"upower": true, "hibernate": true, "hybrid-sleep": true,
		"sleep": true, "suspend": true, "suspend-then-hibernate": true,

		// Logging
		"rsyslog": true, "syslog": true, "journald": true,

		// Audio
		"rtkit-daemon": true, "pipewire": true, "pipewire-pulse": true,
		"pulseaudio": true, "wireplumber": true,

		// SSH
		"ssh": true, "sshd": true, "ssh@": true, "sshd@": true,

		// Misc system
		"rescue": true, "setvtrgb": true, "speech-dispatcher": true,
		"switcheroo-control": true, "udisks2": true, "ufw": true,
		"unattended-upgrades": true, "update-notifier-download": true,
		"whoopsie": true,

		// User sessions
		"user-runtime-dir@": true, "user@": true,
		"user-runtime-dir@1000": true, "user@1000": true,
		"user-runtime-dir@0": true, "user@0": true,

		// Targets (not services but sometimes listed)
		"basic": true, "cryptsetup": true,
		"default": true, "getty": true, "local-fs": true,
		"local-fs-pre": true, "machines": true, "multi-user": true,
		"paths": true, "printer": true, "reboot": true,
		"remote-fs": true, "remote-fs-pre": true, "shutdown": true,
		"slices": true, "sockets": true, "sound": true,
		"swap": true, "sysinit": true, "timers": true, "umount": true,

		// Common 3rd party apps that users typically don't manage
		"docker": true, "containerd": true, "docker.socket": true,
		"podman": true, "podman.socket": true, "podman-auto-update": true,
		"libvirtd": true, "libvirt-guests": true, "virtlogd": true,
		"mysql": true, "mysqld": true, "mariadb": true,
		"postgresql": true, "postgresql@": true,
		"redis": true, "redis-server": true,
		"mongodb": true, "mongod": true,
		"memcached": true,
		"nginx":     true, "apache2": true, "httpd": true,
		"php-fpm": true, "php7.4-fpm": true, "php8.0-fpm": true, "php8.1-fpm": true, "php8.2-fpm": true,
		"postfix": true, "dovecot": true, "sendmail": true,
		"fail2ban": true, "iptables": true, "ip6tables": true,
		"ntp": true, "ntpd": true, "chrony": true, "chronyd": true,
		"clamav-daemon": true, "clamav-freshclam": true,
		"smartd": true, "smartmontools": true,
		"mdmonitor": true, "mdadm": true,
		"zfs-import-cache": true, "zfs-import-scan": true, "zfs-mount": true, "zfs-share": true, "zfs-zed": true,
		"btrfs-scrub@": true,
		"earlyoom":     true, "oomd": true,
		"tuned":     true,
		"firewalld": true,
		"auditd":    true,
		"sssd":      true, "sssd-kcm": true,
		"nscd":       true,
		"nfs-server": true, "nfs-mountd": true, "nfs-idmapd": true, "nfs-blkmap": true,
		"rpcbind": true, "rpc-statd": true,
		"smbd": true, "nmbd": true, "winbind": true,
		"avahi-dnsconfd":    true,
		"blueman-mechanism": true,
		"pcscd":             true,
		"spice-vdagentd":    true, "qemu-guest-agent": true,
		"open-vm-tools": true, "vmtoolsd": true, "vgauthd": true,
		"VBoxService":  true,
		"walinuxagent": true, "cloud-init": true, "cloud-init-local": true, "cloud-config": true, "cloud-final": true,
		"amazon-ssm-agent": true, "snap.amazon-ssm-agent.amazon-ssm-agent": true,
		"google-guest-agent": true, "google-osconfig-agent": true, "google-shutdown-scripts": true, "google-startup-scripts": true,
	}

	if osServices[name] {
		return true
	}

	// Check prefix patterns for dynamic services
	prefixes := []string{
		"systemd-", "getty@", "serial-getty@", "container-getty@",
		"user@", "user-runtime-dir@", "session-", "scope",
		"lvm2-pvscan@", "dm-event", "mdmon@",
		"snap.", "flatpak-", "app-",
		"dbus-:", "org.freedesktop.", "org.gnome.", "org.kde.",
		"wpa_supplicant@", "openvpn@",
		"postgresql@", "php", "mysql@",
		"vboxadd", "vmware-",
		"cloud-", "amazon-", "google-",
		"apt-", "dpkg-", "unattended-",
		"fstrim", "e2scrub", "btrfs-",
		"rescue", "emergency", "initrd-",
		"plymouth-", "grub-",
		// User session services (GNOME, KDE, etc)
		"gnome-", "gvfs-", "at-spi-", "evolution-",
		"xdg-", "pipewire", "wireplumber", "pulseaudio",
		"tracker-", "gsd-", "gcr-", "goa-",
		"plasma-", "kded", "kscreen", "ksmserver",
		"obex", "geoclue", "colord",
	}

	for _, prefix := range prefixes {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}

	// Check suffix patterns
	suffixes := []string{
		".socket", ".path", ".slice", ".scope", ".mount", ".automount", ".swap", ".target", ".device",
	}

	for _, suffix := range suffixes {
		if strings.HasSuffix(name, suffix) {
			return true
		}
	}

	return false
}

// SystemRoutes sets up system management API routes
func SystemRoutes(r *mux.Router) {
	// Get systemd services list (system services, user services, and timers)
	r.HandleFunc("/api/machines/{id}/services", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		var services []map[string]interface{}

		// Get enabled status for all services
		enabledMap := make(map[string]bool)
		enabledOutput, _ := client.Run("systemctl list-unit-files --type=service --no-pager --no-legend")
		for _, line := range strings.Split(string(enabledOutput), "\n") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				name := strings.TrimSuffix(fields[0], ".service")
				enabledMap[name] = fields[1] == "enabled"
			}
		}

		// List system services
		output, _ := client.Run("systemctl list-units --type=service --all --no-pager --plain --no-legend")
		svcList := parseServices(string(output), "service", false)
		for i := range svcList {
			name := svcList[i]["name"].(string)
			svcList[i]["enabled"] = enabledMap[name]
		}
		services = append(services, svcList...)

		// List user services
		userOutput, _ := client.Run("systemctl --user list-units --type=service --all --no-pager --plain --no-legend 2>/dev/null || true")
		if len(userOutput) > 0 {
			userSvcList := parseServices(string(userOutput), "service", true)
			// User services enabled status
			userEnabledOutput, _ := client.Run("systemctl --user list-unit-files --type=service --no-pager --no-legend 2>/dev/null || true")
			userEnabledMap := make(map[string]bool)
			for _, line := range strings.Split(string(userEnabledOutput), "\n") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					name := strings.TrimSuffix(fields[0], ".service")
					userEnabledMap[name] = fields[1] == "enabled"
				}
			}
			for i := range userSvcList {
				name := userSvcList[i]["name"].(string)
				userSvcList[i]["enabled"] = userEnabledMap[name]
			}
			services = append(services, userSvcList...)
		}

		// List system timers
		timerOutput, _ := client.Run("systemctl list-units --type=timer --all --no-pager --plain --no-legend")
		timerList := parseServices(string(timerOutput), "timer", false)
		// Timer enabled status
		timerEnabledOutput, _ := client.Run("systemctl list-unit-files --type=timer --no-pager --no-legend")
		timerEnabledMap := make(map[string]bool)
		for _, line := range strings.Split(string(timerEnabledOutput), "\n") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				name := strings.TrimSuffix(fields[0], ".timer")
				timerEnabledMap[name] = fields[1] == "enabled"
			}
		}
		for i := range timerList {
			name := timerList[i]["name"].(string)
			timerList[i]["enabled"] = timerEnabledMap[name]
		}
		services = append(services, timerList...)

		// List user timers
		userTimerOutput, _ := client.Run("systemctl --user list-units --type=timer --all --no-pager --plain --no-legend 2>/dev/null || true")
		if len(userTimerOutput) > 0 {
			userTimerList := parseServices(string(userTimerOutput), "timer", true)
			services = append(services, userTimerList...)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"services": services})
	}).Methods("GET")

	// Get service dependencies for visualization
	r.HandleFunc("/api/machines/{id}/services/dependencies", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Get list of running services first
		output, _ := client.Run("systemctl list-units --type=service --state=running --no-pager --plain --no-legend | awk '{print $1}' | sed 's/.service$//'")
		serviceNames := strings.Split(strings.TrimSpace(string(output)), "\n")

		var nodes []map[string]interface{}
		var edges []map[string]interface{}
		nodeMap := make(map[string]bool)

		// For each service, get its dependencies
		for _, svcName := range serviceNames {
			if svcName == "" || isOSService(svcName) {
				continue
			}

			// Get service status
			statusOut, _ := client.Run(fmt.Sprintf("systemctl is-active %s.service 2>/dev/null || echo inactive", svcName))
			status := strings.TrimSpace(string(statusOut))

			if !nodeMap[svcName] {
				nodeMap[svcName] = true
				nodes = append(nodes, map[string]interface{}{
					"id":     svcName,
					"label":  svcName,
					"status": status,
				})
			}

			// Get dependencies (Requires, Wants, After)
			depsOut, _ := client.Run(fmt.Sprintf("systemctl show %s.service --property=Requires,Wants,After --no-pager 2>/dev/null", svcName))
			for _, line := range strings.Split(string(depsOut), "\n") {
				if strings.HasPrefix(line, "Requires=") || strings.HasPrefix(line, "Wants=") || strings.HasPrefix(line, "After=") {
					parts := strings.SplitN(line, "=", 2)
					if len(parts) != 2 {
						continue
					}
					depType := parts[0]
					deps := strings.Fields(parts[1])
					for _, dep := range deps {
						depName := strings.TrimSuffix(dep, ".service")
						depName = strings.TrimSuffix(depName, ".target")
						depName = strings.TrimSuffix(depName, ".socket")

						// Skip OS services and non-service dependencies
						if isOSService(depName) || strings.Contains(dep, ".slice") || strings.Contains(dep, ".mount") {
							continue
						}

						// Add dependency node if not exists
						if !nodeMap[depName] && !strings.Contains(dep, ".target") {
							nodeMap[depName] = true
							depStatus, _ := client.Run(fmt.Sprintf("systemctl is-active %s.service 2>/dev/null || echo inactive", depName))
							nodes = append(nodes, map[string]interface{}{
								"id":     depName,
								"label":  depName,
								"status": strings.TrimSpace(string(depStatus)),
							})
						}

						// Add edge
						if !strings.Contains(dep, ".target") {
							edges = append(edges, map[string]interface{}{
								"source": depName,
								"target": svcName,
								"type":   depType,
							})
						}
					}
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"nodes": nodes,
			"edges": edges,
		})
	}).Methods("GET")

	// Service actions (start, stop, restart, enable, disable) - uses Porter's Svc task
	r.HandleFunc("/api/machines/{id}/service/{name}/{action}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		serviceName := vars["name"]
		action := vars["action"]
		isUser := req.URL.Query().Get("user") == "true"

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Validate action
		switch action {
		case "start", "stop", "restart", "enable", "disable":
			// Valid actions
		default:
			http.Error(w, "Invalid action", http.StatusBadRequest)
			return
		}

		password := GetDecryptedPassword(machine)
		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Use Porter's Svc task for service management (Ansible-like)
		task := BuildServiceTask(serviceName, action, isUser)
		stats, err := RunPorterManifest(client, password, fmt.Sprintf("Service %s: %s", action, serviceName), []porter.Task{task})

		w.Header().Set("Content-Type", "application/json")
		if err != nil || stats.Failed > 0 {
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			} else {
				errMsg = fmt.Sprintf("Service %s failed", action)
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": errMsg})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Service status (detailed)
	r.HandleFunc("/api/machines/{id}/service/{name}/status", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		serviceName := vars["name"]
		isUser := req.URL.Query().Get("user") == "true"

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Build systemctl status command - use || true to prevent non-zero exit on inactive services
		var cmd string
		if isUser {
			cmd = "systemctl --user status " + serviceName + ".service 2>&1 || true"
		} else {
			cmd = "systemctl status " + serviceName + ".service 2>&1 || true"
		}

		output, err := client.Run(cmd)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"status": "", "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"status": string(output)})
		}
	}).Methods("GET")

	// Service logs
	r.HandleFunc("/api/machines/{id}/service/{name}/logs", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		serviceName := vars["name"]
		lines := req.URL.Query().Get("lines")
		if lines == "" {
			lines = "100"
		}

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Build journalctl command for proper log retrieval
		isUser := req.URL.Query().Get("user") == "true"
		var cmd string
		if isUser {
			cmd = "journalctl --user -u " + serviceName + " -n " + lines + " --no-pager 2>&1 || true"
		} else {
			cmd = "journalctl -u " + serviceName + " -n " + lines + " --no-pager 2>&1 || true"
		}

		output, err := client.Run(cmd)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"logs": "", "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"logs": string(output)})
		}
	}).Methods("GET")

	// Docker endpoints
	r.HandleFunc("/api/machines/{id}/docker/containers", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Check if Docker is available
		checkOutput, _ := client.Run("which docker 2>/dev/null || echo 'not_found'")
		if strings.Contains(string(checkOutput), "not_found") {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"containers": []interface{}{},
				"error":      "Docker is not installed on this machine",
			})
			return
		}

		// Use password for sudo
		password := GetDecryptedPassword(machine)
		sudoCmd := "echo '" + password + "' | sudo -S docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}|{{.State}}' 2>/dev/null"
		output, err := client.Run(sudoCmd)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"containers": []interface{}{},
				"error":      "Failed to list containers: " + err.Error(),
			})
			return
		}

		var containers []map[string]interface{}
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		for _, line := range lines {
			if line == "" {
				continue
			}
			parts := strings.Split(line, "|")
			if len(parts) >= 7 {
				containers = append(containers, map[string]interface{}{
					"id":      parts[0],
					"name":    parts[1],
					"image":   parts[2],
					"status":  parts[3],
					"ports":   parts[4],
					"created": parts[5],
					"state":   parts[6],
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"containers": containers})
	}).Methods("GET")

	r.HandleFunc("/api/machines/{id}/docker/images", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		output, err := client.Run("echo '" + password + "' | sudo -S docker images --format '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}' 2>/dev/null")
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"images": []interface{}{}})
			return
		}

		var images []map[string]interface{}
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		for _, line := range lines {
			if line == "" {
				continue
			}
			parts := strings.Split(line, "|")
			if len(parts) >= 5 {
				images = append(images, map[string]interface{}{
					"id":         parts[0],
					"repository": parts[1],
					"tag":        parts[2],
					"size":       parts[3],
					"created":    parts[4],
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"images": images})
	}).Methods("GET")

	r.HandleFunc("/api/machines/{id}/docker/volumes", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		output, err := client.Run("echo '" + password + "' | sudo -S docker volume ls --format '{{.Name}}|{{.Driver}}|{{.Mountpoint}}' 2>/dev/null")
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"volumes": []interface{}{}})
			return
		}

		var volumes []map[string]interface{}
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		for _, line := range lines {
			if line == "" {
				continue
			}
			parts := strings.Split(line, "|")
			if len(parts) >= 2 {
				vol := map[string]interface{}{
					"name":   parts[0],
					"driver": parts[1],
				}
				if len(parts) >= 3 {
					vol["mountpoint"] = parts[2]
				}
				volumes = append(volumes, vol)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"volumes": volumes})
	}).Methods("GET")

	r.HandleFunc("/api/machines/{id}/docker/networks", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		output, err := client.Run("echo '" + password + "' | sudo -S docker network ls --format '{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}' 2>/dev/null")
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"networks": []interface{}{}})
			return
		}

		var networks []map[string]interface{}
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		for _, line := range lines {
			if line == "" {
				continue
			}
			parts := strings.Split(line, "|")
			if len(parts) >= 4 {
				networks = append(networks, map[string]interface{}{
					"id":     parts[0],
					"name":   parts[1],
					"driver": parts[2],
					"scope":  parts[3],
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"networks": networks})
	}).Methods("GET")

	r.HandleFunc("/api/machines/{id}/docker/info", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Check if Docker is available
		checkOutput, _ := client.Run("which docker 2>/dev/null || echo 'not_found'")
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(string(checkOutput), "not_found") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Docker is not installed on this machine",
			})
			return
		}

		password := GetDecryptedPassword(machine)
		output, err := client.Run("echo '" + password + "' | sudo -S docker info --format '{{.Containers}}|{{.ContainersRunning}}|{{.Images}}' 2>/dev/null")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Failed to get Docker info: " + err.Error(),
			})
			return
		}

		parts := strings.Split(strings.TrimSpace(string(output)), "|")
		info := map[string]interface{}{}
		if len(parts) >= 3 {
			info["containers"] = parts[0]
			info["containersRunning"] = parts[1]
			info["images"] = parts[2]
		}
		json.NewEncoder(w).Encode(info)
	}).Methods("GET")

	// Docker container actions
	r.HandleFunc("/api/machines/{id}/docker/container/{containerId}/{action}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		containerID := vars["containerId"]
		action := vars["action"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		sudoPrefix := "echo '" + password + "' | sudo -S "

		var cmd string
		switch action {
		case "start":
			cmd = sudoPrefix + "docker start " + containerID + " 2>/dev/null"
		case "stop":
			cmd = sudoPrefix + "docker stop " + containerID + " 2>/dev/null"
		case "restart":
			cmd = sudoPrefix + "docker restart " + containerID + " 2>/dev/null"
		case "remove":
			cmd = sudoPrefix + "docker rm -f " + containerID + " 2>/dev/null"
		case "logs":
			lines := req.URL.Query().Get("lines")
			if lines == "" {
				lines = "100"
			}
			output, err := client.Run(sudoPrefix + "docker logs --tail " + lines + " " + containerID + " 2>&1")
			w.Header().Set("Content-Type", "application/json")
			if err != nil {
				json.NewEncoder(w).Encode(map[string]interface{}{"logs": "", "error": err.Error()})
			} else {
				json.NewEncoder(w).Encode(map[string]interface{}{"logs": string(output)})
			}
			return
		case "inspect":
			output, err := client.Run(sudoPrefix + "docker inspect " + containerID + " 2>/dev/null")
			w.Header().Set("Content-Type", "application/json")
			if err != nil {
				json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
			} else {
				var data interface{}
				if jsonErr := json.Unmarshal(output, &data); jsonErr != nil {
					json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "Failed to parse: " + jsonErr.Error()})
				} else {
					json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": data})
				}
			}
			return
		case "stats":
			output, err := client.Run(sudoPrefix + "docker stats " + containerID + " --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}' 2>/dev/null")
			w.Header().Set("Content-Type", "application/json")
			if err != nil {
				json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
			} else {
				parts := strings.Split(strings.TrimSpace(string(output)), "|")
				stats := map[string]string{"cpu": "0%", "memory": "0MB"}
				if len(parts) >= 2 {
					stats["cpu"] = parts[0]
					stats["memory"] = parts[1]
				}
				json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "stats": stats})
			}
			return
		case "rename":
			var request struct {
				Name string `json:"name"`
			}
			if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
				http.Error(w, "Invalid request", http.StatusBadRequest)
				return
			}
			_, err = client.Run(sudoPrefix + "docker rename " + containerID + " " + request.Name + " 2>&1")
			w.Header().Set("Content-Type", "application/json")
			if err != nil {
				json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
			} else {
				json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
			}
			return
		default:
			http.Error(w, "Invalid action", http.StatusBadRequest)
			return
		}

		_, err = client.Run(cmd)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST", "GET")

	// Docker bulk actions
	r.HandleFunc("/api/machines/{id}/docker/bulk/{action}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		action := vars["action"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		sudoPrefix := "echo '" + password + "' | sudo -S "

		var cmd string
		switch action {
		case "stop":
			cmd = sudoPrefix + "docker stop $(docker ps -q) 2>/dev/null || true"
		case "prune":
			cmd = sudoPrefix + "docker container prune -f 2>&1"
		default:
			http.Error(w, "Invalid action", http.StatusBadRequest)
			return
		}

		output, err := client.Run(cmd)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "output": string(output)})
		}
	}).Methods("POST")

	// Docker prune
	r.HandleFunc("/api/machines/{id}/docker/prune/{type}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		pruneType := vars["type"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		sudoPrefix := "echo '" + password + "' | sudo -S "

		var cmd string
		switch pruneType {
		case "system":
			cmd = sudoPrefix + "docker system prune -af 2>&1"
		case "images":
			cmd = sudoPrefix + "docker image prune -af 2>&1"
		case "volumes":
			cmd = sudoPrefix + "docker volume prune -f 2>&1"
		case "networks":
			cmd = sudoPrefix + "docker network prune -f 2>&1"
		default:
			http.Error(w, "Invalid prune type", http.StatusBadRequest)
			return
		}

		output, err := client.Run(cmd)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "output": string(output)})
		}
	}).Methods("POST")

	// Docker pull image
	r.HandleFunc("/api/machines/{id}/docker/pull", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var request struct {
			Image string `json:"image"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		_, err = client.Run("echo '" + password + "' | sudo -S docker pull " + request.Image + " 2>&1")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Run docker container
	r.HandleFunc("/api/machines/{id}/docker/run", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var request struct {
			Image   string `json:"image"`
			Name    string `json:"name"`
			Ports   string `json:"ports"`
			Volumes string `json:"volumes"`
			Env     string `json:"env"`
			Network string `json:"network"`
			Detach  bool   `json:"detach"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)

		// Build docker run command
		cmd := "docker run"
		if request.Detach {
			cmd += " -d"
		}
		if request.Name != "" {
			cmd += " --name " + request.Name
		}
		if request.Ports != "" {
			for _, p := range strings.Split(request.Ports, ",") {
				p = strings.TrimSpace(p)
				if p != "" {
					cmd += " -p " + p
				}
			}
		}
		if request.Volumes != "" {
			for _, v := range strings.Split(request.Volumes, ",") {
				v = strings.TrimSpace(v)
				if v != "" {
					cmd += " -v " + v
				}
			}
		}
		if request.Env != "" {
			for _, e := range strings.Split(request.Env, ",") {
				e = strings.TrimSpace(e)
				if e != "" {
					cmd += " -e " + e
				}
			}
		}
		if request.Network != "" {
			cmd += " --network " + request.Network
		}
		cmd += " " + request.Image

		output, err := client.Run("echo '" + password + "' | sudo -S " + cmd + " 2>&1")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "containerId": strings.TrimSpace(string(output))})
		}
	}).Methods("POST")

	// Container inspect
	r.HandleFunc("/api/machines/{id}/docker/container/{containerId}/inspect", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		containerID := vars["containerId"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		output, err := client.Run("echo '" + password + "' | sudo -S docker inspect " + containerID + " 2>/dev/null")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			var data interface{}
			if jsonErr := json.Unmarshal(output, &data); jsonErr != nil {
				json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "Failed to parse inspect data"})
			} else {
				json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": data})
			}
		}
	}).Methods("GET")

	// Container stats
	r.HandleFunc("/api/machines/{id}/docker/container/{containerId}/stats", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		containerID := vars["containerId"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		output, err := client.Run("echo '" + password + "' | sudo -S docker stats " + containerID + " --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}' 2>/dev/null")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			parts := strings.Split(strings.TrimSpace(string(output)), "|")
			stats := map[string]string{"cpu": "0%", "memory": "0MB"}
			if len(parts) >= 2 {
				stats["cpu"] = parts[0]
				stats["memory"] = parts[1]
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "stats": stats})
		}
	}).Methods("GET")

	// Create docker volume
	r.HandleFunc("/api/machines/{id}/docker/volume", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var request struct {
			Name   string `json:"name"`
			Driver string `json:"driver"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		driver := request.Driver
		if driver == "" {
			driver = "local"
		}
		_, err = client.Run("echo '" + password + "' | sudo -S docker volume create --driver " + driver + " " + request.Name + " 2>&1")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Delete docker volume
	r.HandleFunc("/api/machines/{id}/docker/volume/{volumeName}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		volumeName := vars["volumeName"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		_, err = client.Run("echo '" + password + "' | sudo -S docker volume rm " + volumeName + " 2>/dev/null")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("DELETE")

	// Create docker network
	r.HandleFunc("/api/machines/{id}/docker/network", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var request struct {
			Name   string `json:"name"`
			Driver string `json:"driver"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		driver := request.Driver
		if driver == "" {
			driver = "bridge"
		}
		_, err = client.Run("echo '" + password + "' | sudo -S docker network create --driver " + driver + " " + request.Name + " 2>&1")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("POST")

	// Delete docker network
	r.HandleFunc("/api/machines/{id}/docker/network/{networkId}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		networkID := vars["networkId"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		_, err = client.Run("echo '" + password + "' | sudo -S docker network rm " + networkID + " 2>/dev/null")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("DELETE")

	// Delete docker image
	r.HandleFunc("/api/machines/{id}/docker/image/{imageId}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		machineID := vars["id"]
		imageID := vars["imageId"]

		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			http.Error(w, "Connection failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		password := GetDecryptedPassword(machine)
		_, err = client.Run("echo '" + password + "' | sudo -S docker rmi " + imageID + " 2>/dev/null")
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		}
	}).Methods("DELETE")

	// Machine command execution endpoint (for terminal)
	r.HandleFunc("/api/machines/{id}/command", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var request struct {
			Command string `json:"command"`
		}
		if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Invalid request body",
			})
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Connection failed: " + err.Error(),
			})
			return
		}
		defer client.Close()

		// Execute command with exit code capture
		cmdWithExitCode := request.Command + " 2>&1; echo \"EXIT_CODE:$?\""
		output, err := client.Run(cmdWithExitCode)

		w.Header().Set("Content-Type", "application/json")

		outputStr := string(output)
		exitCode := 0
		cleanOutput := outputStr

		// Parse exit code from output
		if strings.Contains(outputStr, "EXIT_CODE:") {
			parts := strings.Split(outputStr, "EXIT_CODE:")
			if len(parts) > 1 {
				fmt.Sscanf(strings.TrimSpace(parts[len(parts)-1]), "%d", &exitCode)
				cleanOutput = strings.TrimSpace(parts[0])
			}
		}

		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":  false,
				"error":    err.Error(),
				"output":   cleanOutput,
				"exitCode": exitCode,
			})
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"output":   cleanOutput,
			"exitCode": exitCode,
		})
	}).Methods("POST")
}
