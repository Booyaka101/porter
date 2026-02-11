package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// BuildClient represents a saved build configuration for quick 1-click builds
type BuildClient struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Customer  string `json:"customer"`
	Pack      string `json:"pack"`
	Branch    string `json:"branch"`
	Version   string `json:"version,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
	UpdatedAt string `json:"updated_at,omitempty"`
}

// BuildClientStore manages build clients
type BuildClientStore struct {
	mu       sync.RWMutex
	clients  []BuildClient
	filePath string
}

var buildClientStore *BuildClientStore

// InitBuildClientStore initializes the build client store
func InitBuildClientStore() error {
	dataDir := getDataDir()
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	buildClientStore = &BuildClientStore{
		filePath: filepath.Join(dataDir, "build_clients.json"),
	}

	return buildClientStore.load()
}

func (s *BuildClientStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// If using database, load from there
	if db != nil {
		clients, err := loadBuildClientsFromDB()
		if err != nil {
			s.clients = []BuildClient{}
			return nil
		}
		s.clients = clients
		return nil
	}

	// Fallback to JSON file
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			s.clients = []BuildClient{}
			return nil
		}
		return err
	}

	return json.Unmarshal(data, &s.clients)
}

// loadBuildClientsFromDB loads build clients from the database
func loadBuildClientsFromDB() ([]BuildClient, error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	rows, err := db.db.Query(`
		SELECT id, name, customer, pack, branch, COALESCE(version, ''),
		       COALESCE(created_at, ''), COALESCE(updated_at, '')
		FROM build_clients ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []BuildClient
	for rows.Next() {
		var c BuildClient
		if err := rows.Scan(&c.ID, &c.Name, &c.Customer, &c.Pack, &c.Branch,
			&c.Version, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		clients = append(clients, c)
	}

	return clients, nil
}

func (s *BuildClientStore) save() error {
	if db != nil {
		return nil // Database saves are done individually
	}
	data, err := json.MarshalIndent(s.clients, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

// saveBuildClientToDB saves a build client to the database
func saveBuildClientToDB(client BuildClient) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	now := time.Now().Format(time.RFC3339)
	_, err := db.db.Exec(`
		INSERT OR REPLACE INTO build_clients 
		(id, name, customer, pack, branch, version, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM build_clients WHERE id = ?), ?), ?)`,
		client.ID, client.Name, client.Customer, client.Pack, client.Branch, client.Version,
		client.ID, now, now)

	return err
}

// deleteBuildClientFromDB deletes a build client from the database
func deleteBuildClientFromDB(id string) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.db.Exec("DELETE FROM build_clients WHERE id = ?", id)
	return err
}

// Add adds a new build client and returns the created client with ID
func (s *BuildClientStore) Add(client *BuildClient) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if client.ID == "" {
		client.ID = uuid.New().String()
	}
	client.CreatedAt = time.Now().Format(time.RFC3339)
	client.UpdatedAt = client.CreatedAt

	s.clients = append(s.clients, *client)

	if db != nil {
		return saveBuildClientToDB(*client)
	}
	return s.save()
}

// Remove removes a build client by ID
func (s *BuildClientStore) Remove(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, c := range s.clients {
		if c.ID == id {
			s.clients = append(s.clients[:i], s.clients[i+1:]...)
			if db != nil {
				return deleteBuildClientFromDB(id)
			}
			return s.save()
		}
	}
	return nil
}

// List returns all build clients
func (s *BuildClientStore) List() []BuildClient {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.clients == nil {
		return []BuildClient{}
	}
	return s.clients
}

// Update updates an existing build client
func (s *BuildClientStore) Update(client BuildClient) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, c := range s.clients {
		if c.ID == client.ID {
			client.CreatedAt = c.CreatedAt
			client.UpdatedAt = time.Now().Format(time.RFC3339)
			s.clients[i] = client
			if db != nil {
				return saveBuildClientToDB(client)
			}
			return s.save()
		}
	}
	return fmt.Errorf("build client not found")
}

// Get returns a build client by ID
func (s *BuildClientStore) Get(id string) (*BuildClient, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, c := range s.clients {
		if c.ID == id {
			return &c, nil
		}
	}
	return nil, fmt.Errorf("build client not found")
}

// BuildClientRoutes sets up build client API routes
func BuildClientRoutes(r *mux.Router) {
	// Get all build clients
	r.HandleFunc("/api/build-clients", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if buildClientStore == nil {
			json.NewEncoder(w).Encode([]BuildClient{})
			return
		}
		json.NewEncoder(w).Encode(buildClientStore.List())
	}).Methods("GET")

	// Add a build client
	r.HandleFunc("/api/build-clients", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if buildClientStore == nil {
			http.Error(w, "Build client store not initialized", http.StatusInternalServerError)
			return
		}

		var client BuildClient
		if err := json.NewDecoder(req.Body).Decode(&client); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := buildClientStore.Add(&client); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(client)
	}).Methods("POST")

	// Get a single build client
	r.HandleFunc("/api/build-clients/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if buildClientStore == nil {
			http.Error(w, "Build client store not initialized", http.StatusInternalServerError)
			return
		}

		vars := mux.Vars(req)
		id := vars["id"]

		client, err := buildClientStore.Get(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(client)
	}).Methods("GET")

	// Update a build client
	r.HandleFunc("/api/build-clients/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if buildClientStore == nil {
			http.Error(w, "Build client store not initialized", http.StatusInternalServerError)
			return
		}

		vars := mux.Vars(req)
		id := vars["id"]

		var client BuildClient
		if err := json.NewDecoder(req.Body).Decode(&client); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		client.ID = id

		if err := buildClientStore.Update(client); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(client)
	}).Methods("PUT")

	// Delete a build client
	r.HandleFunc("/api/build-clients/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if buildClientStore == nil {
			http.Error(w, "Build client store not initialized", http.StatusInternalServerError)
			return
		}

		vars := mux.Vars(req)
		id := vars["id"]

		if err := buildClientStore.Remove(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("DELETE")
}
