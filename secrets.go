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
