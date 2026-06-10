package porter

import "strings"

func init() {
	register("docker_pull", actDockerPull)
	register("docker_build", actDockerBuild)
	register("docker_save", actDockerSave)
	register("docker_load", actDockerLoad)
	register("docker_export", actDockerExport)
	register("docker_import", actDockerImport)
	register("docker_tag", actDockerTag)
	register("docker_push", actDockerPush)
	register("docker_rmi", actDockerRmi)
	register("docker_prune", actDockerPrune)
	register("docker_ps", actDockerPs)
	register("docker_images", actDockerImages)
	register("docker_volumes", actDockerVolumes)
	register("docker_networks", actDockerNetworks)
	register("docker_info", actDockerInfo)
	register("docker", actDocker)
	register("compose", actCompose)
}

func actDockerPull(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker pull " + dest)
}

func actDockerBuild(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker build -t " + dest + " " + src)
}

func actDockerSave(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker save -o " + dest + " " + src)
}

func actDockerLoad(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker load -i " + src)
}

func actDockerExport(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker export -o " + dest + " " + src)
}

func actDockerImport(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker import " + src + " " + dest)
}

func actDockerTag(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker tag " + src + " " + dest)
}

func actDockerPush(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker push " + dest)
}

func actDockerRmi(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker rmi " + dest)
}

func actDockerPrune(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("docker system prune -af")
}

func actDockerPs(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	all := ""
	if strings.Contains(body, "all:true") {
		all = "-a "
	}
	out, err := e.runCapture("sudo docker ps " + all + "--format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}|{{.State}}'")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actDockerImages(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("sudo docker images --format '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}'")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actDockerVolumes(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("sudo docker volume ls --format '{{.Name}}|{{.Driver}}|{{.Mountpoint}}'")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actDockerNetworks(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("sudo docker network ls --format '{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}'")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actDockerInfo(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	out, err := e.runCapture("sudo docker info --format '{{.Containers}}|{{.ContainersRunning}}|{{.Images}}'")
	if err != nil {
		return err
	}
	if t.Register != "" {
		vars.Set(t.Register, out)
	}
	return nil
}

func actDocker(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.dockerCtl(dest, t.State, t.Src, body)
}

func actCompose(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.composeCtl(dest, t.State, t.Src, body)
}
