package porter

import (
	"errors"
	"io"
	"net"
	"strconv"
	"testing"
	"time"
)

// TestConnectBoundsHandshakeAndDoesNotLeak verifies that Connect bounds the
// SSH handshake — not just the TCP dial — and closes the socket when a server
// accepts the connection but stalls before sending its banner. Without the
// fix, ssh.NewClientConn blocks forever and leaks the connection (the failure
// that turned a brief sshd hiccup into a self-sustaining deploy stall).
func TestConnectBoundsHandshakeAndDoesNotLeak(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()

	accepted := make(chan net.Conn, 1)
	go func() {
		c, err := ln.Accept()
		if err != nil {
			return
		}
		accepted <- c // accept, then never write a banner: stall the handshake
	}()

	host, portStr, _ := net.SplitHostPort(ln.Addr().String())
	port, _ := strconv.Atoi(portStr)

	start := time.Now()
	_, err = Connect(host, Config{
		User:     "probe",
		Password: "irrelevant",
		Port:     uint(port),
		Timeout:  300 * time.Millisecond,
	})
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("expected handshake to fail against a banner-less server, got nil")
	}
	if elapsed > 2*time.Second {
		t.Fatalf("handshake was not bounded: Connect took %v (timeout was 300ms)", elapsed)
	}

	// Leak guard: the client must have closed the socket. Drain the client's
	// own banner, then the next read returns io.EOF if we closed it. A leaked
	// connection (client still blocked in the handshake) would instead leave
	// the read blocking until our deadline — a timeout error, not EOF.
	select {
	case c := <-accepted:
		defer c.Close()
		_ = c.SetReadDeadline(time.Now().Add(2 * time.Second))
		buf := make([]byte, 4096)
		var closedByClient bool
		for {
			if _, rerr := c.Read(buf); rerr != nil {
				closedByClient = errors.Is(rerr, io.EOF)
				break
			}
		}
		if !closedByClient {
			t.Fatal("server-side connection was not closed by the client — handshake attempt leaked the socket")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("server never accepted a connection")
	}
}
