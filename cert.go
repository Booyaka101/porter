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
