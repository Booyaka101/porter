package porter

import "fmt"

func init() {
	register("disk_space", actDiskSpace)
	register("memory_info", actMemoryInfo)
	register("cpu_info", actCPUInfo)
	register("load_avg", actLoadAvg)
	register("nproc", actNproc)
	register("command_exists", actCommandExists)
	register("require_disk", actRequireDisk)
	register("require_memory", actRequireMemory)
	register("require_command", actRequireCommand)
}

func actDiskSpace(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("df -BG " + dest + " | awk 'NR==2 {print $4}' | tr -d 'G'")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actMemoryInfo(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("awk '/MemAvailable/ {print int($2/1024/1024)}' /proc/meminfo")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actCPUInfo(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("nproc")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actLoadAvg(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("cat /proc/loadavg | cut -d' ' -f1-3")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actNproc(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("nproc")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actCommandExists(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	_, err := e.runCapture("command -v " + dest)
	if t.Register != "" {
		if err == nil {
			vars.Set(t.Register, "true")
		} else {
			vars.Set(t.Register, "false")
		}
	}
	return nil
}

func actRequireDisk(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("df -BG " + dest + " | awk 'NR==2 {print $4}' | tr -d 'G'")
	if err != nil {
		return err
	}
	// Parse and compare
	var avail int
	fmt.Sscanf(out, "%d", &avail)
	var required int
	fmt.Sscanf(body, "%d", &required)
	if avail < required {
		return fmt.Errorf("insufficient disk space: %dGB available, %dGB required", avail, required)
	}
	return nil
}

func actRequireMemory(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("awk '/MemAvailable/ {print int($2/1024/1024)}' /proc/meminfo")
	if err != nil {
		return err
	}
	var avail int
	fmt.Sscanf(out, "%d", &avail)
	var required int
	fmt.Sscanf(body, "%d", &required)
	if avail < required {
		return fmt.Errorf("insufficient memory: %dGB available, %dGB required", avail, required)
	}
	return nil
}

func actRequireCommand(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	_, err := e.runCapture("command -v " + dest)
	if err != nil {
		return fmt.Errorf("required command not found: %s", dest)
	}
	return nil
}
