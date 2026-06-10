package porter

func init() {
	register("secret", actSecret)
	register("secret_command", actSecretCommand)
	register("verify_blob", actVerifyBlob)
	register("verify_image", actVerifyImage)
}

func actSecret(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	plain, err := decryptSops(src)
	if err != nil {
		return err
	}
	return e.sftpWriteSecret(dest, plain, perm, own, t.Sudo)
}

func actSecretCommand(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	plain, err := fetchSecretCommand(body)
	if err != nil {
		return err
	}
	return e.sftpWriteSecret(dest, plain, perm, own, t.Sudo)
}

func actVerifyBlob(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return cosignVerify("verify-blob", body, src)
}

func actVerifyImage(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error {
	return cosignVerify("verify", body, src)
}
