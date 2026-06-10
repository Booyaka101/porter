package porter

// =============================================================================
// CERTIFICATE / TRUST-STORE OPERATIONS
// =============================================================================

// TrustCA installs the CA certificate at certPath into the machine's OS trust
// store (/usr/local/share/ca-certificates + update-ca-certificates), so the
// machine trusts HTTPS peers signed by that authority without warnings.
//
// certPath is a path to a PEM cert already present on the remote host (stage it
// first with Write). The trust-store anchor filename defaults to certPath's
// base name; override it with .As(name) when several hosts would otherwise
// collide on a generic name like "ca.crt".
func TrustCA(certPath string) TaskBuilder {
	return TaskBuilder{Task{Action: "trust_ca", Dest: certPath, Name: "Trust CA " + certPath}}
}

// As sets the trust-store anchor filename for TrustCA (the name the cert is
// installed under in /usr/local/share/ca-certificates). A ".crt" suffix is
// added if missing, since update-ca-certificates only consumes *.crt.
func (b TaskBuilder) As(anchor string) TaskBuilder { b.t.Src = anchor; return b }

// TrustCAContent installs an in-memory PEM CA certificate into the machine's OS
// trust store in one step: it writes the PEM straight into
// /usr/local/share/ca-certificates/<anchor>.crt (atomically, mode 0644, with
// sudo) and runs update-ca-certificates. Unlike TrustCA, the certificate does
// not need to already be on the remote host — pass the PEM directly (e.g. a CA
// root your program holds in memory). Set the anchor filename with .As(name)
// (defaults to "custom-ca").
//
//	porter.TrustCAContent(rootCAPEM).As("idx-root-ca")
func TrustCAContent(pem string) TaskBuilder {
	return TaskBuilder{Task{Action: "trust_ca_content", Body: pem, Name: "Trust CA (inline PEM)"}}
}
