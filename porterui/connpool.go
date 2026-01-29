package porterui

import (
	"fmt"
	"sync"
	"time"

	"github.com/booyaka101/porter"
	"github.com/melbahja/goph"
)

// PooledConnection represents a connection in the pool
type PooledConnection struct {
	Client    *goph.Client
	MachineID string
	CreatedAt time.Time
	LastUsed  time.Time
	InUse     bool
}

// ConnectionPool manages SSH connections to machines
type ConnectionPool struct {
	mu          sync.RWMutex
	connections map[string]*PooledConnection
	maxAge      time.Duration
	maxIdle     time.Duration
	cleanupTick *time.Ticker
	stopCleanup chan struct{}
}

var (
	connPool     *ConnectionPool
	connPoolOnce sync.Once
)

// GetConnectionPool returns the singleton connection pool
func GetConnectionPool() *ConnectionPool {
	connPoolOnce.Do(func() {
		connPool = NewConnectionPool(5*time.Minute, 2*time.Minute)
		connPool.StartCleanup()
	})
	return connPool
}

// NewConnectionPool creates a new connection pool
func NewConnectionPool(maxAge, maxIdle time.Duration) *ConnectionPool {
	return &ConnectionPool{
		connections: make(map[string]*PooledConnection),
		maxAge:      maxAge,
		maxIdle:     maxIdle,
		stopCleanup: make(chan struct{}),
	}
}

// StartCleanup starts the background cleanup goroutine
func (p *ConnectionPool) StartCleanup() {
	p.cleanupTick = time.NewTicker(30 * time.Second)
	go func() {
		for {
			select {
			case <-p.cleanupTick.C:
				p.cleanup()
			case <-p.stopCleanup:
				p.cleanupTick.Stop()
				return
			}
		}
	}()
}

// StopCleanup stops the background cleanup goroutine
func (p *ConnectionPool) StopCleanup() {
	close(p.stopCleanup)
}

// cleanup removes stale connections
func (p *ConnectionPool) cleanup() {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now()
	for id, conn := range p.connections {
		// Remove if too old or idle too long
		if now.Sub(conn.CreatedAt) > p.maxAge || (!conn.InUse && now.Sub(conn.LastUsed) > p.maxIdle) {
			LogDebug("Closing stale connection", map[string]interface{}{
				"machine_id": id,
				"age":        now.Sub(conn.CreatedAt).String(),
				"idle":       now.Sub(conn.LastUsed).String(),
			})
			conn.Client.Close()
			delete(p.connections, id)
		}
	}
}

// Get retrieves or creates a connection for a machine
func (p *ConnectionPool) Get(machine *Machine) (*goph.Client, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Check for existing connection
	if conn, exists := p.connections[machine.ID]; exists {
		// Verify connection is still alive
		if p.isAlive(conn.Client) {
			conn.LastUsed = time.Now()
			conn.InUse = true
			LogDebug("Reusing pooled connection", map[string]interface{}{
				"machine_id": machine.ID,
				"age":        time.Since(conn.CreatedAt).String(),
			})
			return conn.Client, nil
		}
		// Connection is dead, remove it
		conn.Client.Close()
		delete(p.connections, machine.ID)
	}

	// Create new connection
	password := GetDecryptedPassword(machine)
	client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, password))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", machine.IP, err)
	}

	// Add to pool
	p.connections[machine.ID] = &PooledConnection{
		Client:    client,
		MachineID: machine.ID,
		CreatedAt: time.Now(),
		LastUsed:  time.Now(),
		InUse:     true,
	}

	LogDebug("Created new pooled connection", map[string]interface{}{
		"machine_id": machine.ID,
		"ip":         machine.IP,
	})

	return client, nil
}

// Release marks a connection as no longer in use
func (p *ConnectionPool) Release(machineID string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if conn, exists := p.connections[machineID]; exists {
		conn.InUse = false
		conn.LastUsed = time.Now()
	}
}

// Remove closes and removes a connection from the pool
func (p *ConnectionPool) Remove(machineID string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if conn, exists := p.connections[machineID]; exists {
		conn.Client.Close()
		delete(p.connections, machineID)
	}
}

// isAlive checks if a connection is still alive
func (p *ConnectionPool) isAlive(client *goph.Client) bool {
	// Try to run a simple command to verify connection
	_, err := client.Run("echo 1")
	return err == nil
}

// Stats returns pool statistics
func (p *ConnectionPool) Stats() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	inUse := 0
	idle := 0
	for _, conn := range p.connections {
		if conn.InUse {
			inUse++
		} else {
			idle++
		}
	}

	return map[string]interface{}{
		"total":  len(p.connections),
		"in_use": inUse,
		"idle":   idle,
	}
}

// Close closes all connections in the pool
func (p *ConnectionPool) Close() {
	p.StopCleanup()

	p.mu.Lock()
	defer p.mu.Unlock()

	for id, conn := range p.connections {
		conn.Client.Close()
		delete(p.connections, id)
	}
}

// GetPooledClient is a helper function to get a pooled connection for a machine
func GetPooledClient(machine *Machine) (*goph.Client, func(), error) {
	pool := GetConnectionPool()
	client, err := pool.Get(machine)
	if err != nil {
		return nil, nil, err
	}

	// Return a release function
	release := func() {
		pool.Release(machine.ID)
	}

	return client, release, nil
}
