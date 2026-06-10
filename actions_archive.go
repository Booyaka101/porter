package porter

func init() {
	register("tar_create", actTarCreate)
	register("tar_extract", actTarExtract)
	register("targz_create", actTarGzCreate)
	register("targz_extract", actTarGzExtract)
	register("zip_create", actZipCreate)
	register("zip_extract", actZipExtract)
}

func actTarCreate(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("tar -cvf " + dest + " -C $(dirname " + src + ") $(basename " + src + ")")
}

func actTarExtract(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("tar -xvf " + src + " -C " + dest)
}

func actTarGzCreate(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("tar -czvf " + dest + " -C $(dirname " + src + ") $(basename " + src + ")")
}

func actTarGzExtract(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("tar -xzvf " + src + " -C " + dest)
}

func actZipCreate(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("zip -r " + dest + " " + src)
}

func actZipExtract(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return e.runSudo("unzip -o " + src + " -d " + dest)
}
