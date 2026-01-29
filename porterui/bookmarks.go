package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/gorilla/mux"
)

// Bookmark represents a saved script or command for quick access
type Bookmark struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Type        string   `json:"type"` // "script" or "command"
	ScriptPath  string   `json:"script_path,omitempty"`
	Command     string   `json:"command,omitempty"`
	Args        string   `json:"args,omitempty"`
	MachineIDs  []string `json:"machine_ids,omitempty"`
	Description string   `json:"description,omitempty"`
	Color       string   `json:"color,omitempty"`
	CreatedAt   string   `json:"created_at"`
}

// BookmarkStore manages bookmarks
type BookmarkStore struct {
	mu        sync.RWMutex
	bookmarks []Bookmark
	filePath  string
}

var bookmarkStore *BookmarkStore

// InitBookmarkStore initializes the bookmark store
func InitBookmarkStore() error {
	dataDir := getDataDir()
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	bookmarkStore = &BookmarkStore{
		filePath: filepath.Join(dataDir, "bookmarks.json"),
	}

	return bookmarkStore.load()
}

func (b *BookmarkStore) load() error {
	b.mu.Lock()
	defer b.mu.Unlock()

	// If using database, load from there
	if db != nil {
		bookmarks, err := loadBookmarksFromDB()
		if err != nil {
			b.bookmarks = []Bookmark{}
			return nil
		}
		b.bookmarks = bookmarks
		return nil
	}

	// Fallback to JSON file
	data, err := os.ReadFile(b.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			b.bookmarks = []Bookmark{}
			return nil
		}
		return err
	}

	return json.Unmarshal(data, &b.bookmarks)
}

// loadBookmarksFromDB loads bookmarks from the database
func loadBookmarksFromDB() ([]Bookmark, error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	rows, err := db.db.Query(`
		SELECT id, name, type, COALESCE(script_path, ''), COALESCE(command, ''),
		       COALESCE(args, ''), COALESCE(machine_ids, '[]'), COALESCE(description, ''),
		       COALESCE(color, '')
		FROM bookmarks ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bookmarks []Bookmark
	for rows.Next() {
		var b Bookmark
		var machineIDsJSON string

		if err := rows.Scan(&b.ID, &b.Name, &b.Type, &b.ScriptPath, &b.Command,
			&b.Args, &machineIDsJSON, &b.Description, &b.Color); err != nil {
			continue
		}

		if machineIDsJSON != "" && machineIDsJSON != "[]" {
			json.Unmarshal([]byte(machineIDsJSON), &b.MachineIDs)
		}

		bookmarks = append(bookmarks, b)
	}

	return bookmarks, nil
}

func (b *BookmarkStore) save() error {
	data, err := json.MarshalIndent(b.bookmarks, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(b.filePath, data, 0644)
}

// Add adds a new bookmark
func (b *BookmarkStore) Add(bookmark Bookmark) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.bookmarks = append(b.bookmarks, bookmark)
	return b.save()
}

// Remove removes a bookmark by ID
func (b *BookmarkStore) Remove(id string) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	for i, bm := range b.bookmarks {
		if bm.ID == id {
			b.bookmarks = append(b.bookmarks[:i], b.bookmarks[i+1:]...)
			return b.save()
		}
	}
	return nil
}

// List returns all bookmarks
func (b *BookmarkStore) List() []Bookmark {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.bookmarks
}

// Update updates an existing bookmark
func (b *BookmarkStore) Update(bookmark Bookmark) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	for i, bm := range b.bookmarks {
		if bm.ID == bookmark.ID {
			b.bookmarks[i] = bookmark
			return b.save()
		}
	}
	return nil
}

// BookmarkRoutes sets up bookmark API routes
func BookmarkRoutes(r *mux.Router) {
	// Get all bookmarks
	r.HandleFunc("/api/bookmarks", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if bookmarkStore == nil {
			json.NewEncoder(w).Encode([]Bookmark{})
			return
		}
		json.NewEncoder(w).Encode(bookmarkStore.List())
	}).Methods("GET")

	// Add a bookmark
	r.HandleFunc("/api/bookmarks", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if bookmarkStore == nil {
			http.Error(w, "Bookmark store not initialized", http.StatusInternalServerError)
			return
		}

		var bookmark Bookmark
		if err := json.NewDecoder(req.Body).Decode(&bookmark); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := bookmarkStore.Add(bookmark); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(bookmark)
	}).Methods("POST")

	// Update a bookmark
	r.HandleFunc("/api/bookmarks/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if bookmarkStore == nil {
			http.Error(w, "Bookmark store not initialized", http.StatusInternalServerError)
			return
		}

		vars := mux.Vars(req)
		id := vars["id"]

		var bookmark Bookmark
		if err := json.NewDecoder(req.Body).Decode(&bookmark); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		bookmark.ID = id

		if err := bookmarkStore.Update(bookmark); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(bookmark)
	}).Methods("PUT")

	// Delete a bookmark
	r.HandleFunc("/api/bookmarks/{id}", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if bookmarkStore == nil {
			http.Error(w, "Bookmark store not initialized", http.StatusInternalServerError)
			return
		}

		vars := mux.Vars(req)
		id := vars["id"]

		if err := bookmarkStore.Remove(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}).Methods("DELETE")
}
