package porter

import (
	"bytes"
	"fmt"
	"io/fs"
	"os/exec"
	"strconv"
)

// parseFileMode parses an octal mode string like "0600"/"600" into an fs.FileMode,
// returning def if s is empty or unparseable.
func parseFileMode(s string, def fs.FileMode) fs.FileMode {
	if s == "" {
		return def
	}
	v, err := strconv.ParseUint(s, 8, 32)
	if err != nil {
		return def
	}
	return fs.FileMode(v)
}

// Secret decrypts a SOPS-encrypted file locally (via the `sops` CLI) and writes
// the plaintext to the remote dest over SFTP with mode 0600. This is the 2026
// file-based deploy-secret pattern (SOPS + age): the encrypted file is
// committable to git, decrypted only at deploy time, and the plaintext:
//   - never lands on the controller's disk (held in memory),
//   - never appears in a shell command (written via SFTP, not a heredoc),
//   - is never logged (only the task name, which is the destination path).
//
// Requires `sops` and the relevant decryption key (age/PGP/KMS) on the machine
// running porter. Override the remote mode with .Mode(); set ownership with
// .Owner().
func Secret(sopsFile, dest string) TaskBuilder {
	return TaskBuilder{t: Task{
		Action: "secret",
		Src:    sopsFile,
		Dest:   dest,
		Perm:   "0600",
		Name:   "deploy secret -> " + dest,
	}}
}

// SecretCommand fetches a secret by running fetchCmd locally and writing its
// stdout to the remote dest at 0600 over SFTP (never logged, never in a remote
// shell command). This is the pluggable backend escape hatch — works with any
// secrets manager that has a CLI:
//
//	porter.SecretCommand("vault kv get -field=env secret/myapp", "/etc/myapp/env")
//	porter.SecretCommand("bao kv get -field=env secret/myapp", "/etc/myapp/env")   // OpenBao
//	porter.SecretCommand("op read op://vault/myapp/env", "/etc/myapp/env")          // 1Password
//	porter.SecretCommand("infisical secrets get FOO --plain", "/etc/myapp/foo")
//
// Override the remote mode with .Mode() and ownership with .Owner().
func SecretCommand(fetchCmd, dest string) TaskBuilder {
	return TaskBuilder{t: Task{
		Action: "secret_command",
		Body:   fetchCmd,
		Dest:   dest,
		Perm:   "0600",
		Name:   "fetch secret -> " + dest,
	}}
}

// fetchSecretCommand runs cmd via the local shell and returns its stdout. On
// failure it returns only stderr (never stdout, which may hold partial secret).
func fetchSecretCommand(cmd string) ([]byte, error) {
	c := exec.Command("sh", "-c", cmd)
	var out, errBuf bytes.Buffer
	c.Stdout = &out
	c.Stderr = &errBuf
	if err := c.Run(); err != nil {
		return nil, fmt.Errorf("secret command failed: %v: %s", err, errBuf.String())
	}
	return out.Bytes(), nil
}

// decryptSops runs `sops -d <file>` and returns the plaintext. On failure it
// returns only stderr (never stdout, which could contain partial plaintext).
func decryptSops(file string) ([]byte, error) {
	cmd := exec.Command("sops", "-d", file)
	var out, errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("sops decrypt %s failed: %v: %s", file, err, errBuf.String())
	}
	return out.Bytes(), nil
}
