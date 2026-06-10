package porter

import (
	"fmt"
	"os/exec"
	"strings"
)

// VerifyBlob verifies a Sigstore/cosign signature over a local artifact BEFORE
// it is deployed; a failed verification aborts the deploy (a pre-deploy
// admission gate — the thing no SSH-push tool ships natively). Pass cosign
// flags in args, e.g. key-based `--key cosign.pub --signature app.sig` or
// keyless `--certificate-identity=ci@org.com --certificate-oidc-issuer=https://token.actions.githubusercontent.com`.
// Requires the `cosign` CLI on the machine running porter. Args are split on
// whitespace (use simple `--flag=value` form).
func VerifyBlob(artifact, args string) TaskBuilder {
	return TaskBuilder{t: Task{
		Action: "verify_blob",
		Src:    artifact,
		Body:   args,
		Name:   "cosign verify-blob " + artifact,
	}}
}

// VerifyImage verifies a container image's cosign signature/attestation before
// deploy. Same gate semantics and args as VerifyBlob.
func VerifyImage(ref, args string) TaskBuilder {
	return TaskBuilder{t: Task{
		Action: "verify_image",
		Src:    ref,
		Body:   args,
		Name:   "cosign verify " + ref,
	}}
}

// cosign runs the cosign CLI locally and returns an error (the gate) if
// verification fails. verb is "verify-blob" or "verify"; args are extra flags;
// target is the artifact path or image ref.
func cosignVerify(verb, args, target string) error {
	argv := []string{verb}
	if strings.TrimSpace(args) != "" {
		argv = append(argv, strings.Fields(args)...)
	}
	argv = append(argv, target)
	out, err := exec.Command("cosign", argv...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("cosign %s failed for %s: %v: %s", verb, target, err, strings.TrimSpace(string(out)))
	}
	return nil
}
