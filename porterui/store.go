package porterui

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Store handles persistence for application data
type Store struct {
	dataDir string
	mu      sync.RWMutex
}

// NewStore creates a new store with the given data directory
func NewStore(dataDir string) *Store {
	os.MkdirAll(dataDir, 0755)
	return &Store{dataDir: dataDir}
}

// DefaultStore returns a store using ~/.idx-deploy
func DefaultStore() *Store {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	return NewStore(filepath.Join(homeDir, ".idx-deploy"))
}

// Save persists data to a JSON file with backup
func (s *Store) Save(filename string, data interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	// Don't save empty arrays - this prevents data loss on startup issues
	if len(bytes) <= 2 { // "[]" or "{}"
		return nil
	}

	filePath := filepath.Join(s.dataDir, filename)

	// Create backup of existing file before overwriting
	if _, err := os.Stat(filePath); err == nil {
		existingData, _ := os.ReadFile(filePath)
		if len(existingData) > len(bytes)+100 { // Only backup if existing is significantly larger
			backupPath := filePath + ".backup"
			os.WriteFile(backupPath, existingData, 0600)
		}
	}

	return os.WriteFile(filePath, bytes, 0600)
}

// Load reads data from a JSON file
func (s *Store) Load(filename string, data interface{}) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filePath := filepath.Join(s.dataDir, filename)
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	return json.Unmarshal(bytes, data)
}

// Exists checks if a file exists in the store
func (s *Store) Exists(filename string) bool {
	filePath := filepath.Join(s.dataDir, filename)
	_, err := os.Stat(filePath)
	return err == nil
}

// Delete removes a file from the store
func (s *Store) Delete(filename string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filePath := filepath.Join(s.dataDir, filename)
	return os.Remove(filePath)
}

// Global store instance
var store = DefaultStore()

// GetStore returns the global store instance
func GetStore() *Store {
	return store
}
