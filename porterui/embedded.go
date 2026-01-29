package porterui

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// EmbeddedScripts will be set from main.go
var EmbeddedScripts embed.FS

// DownloadConfig represents a file that needs to be downloaded
type DownloadConfig struct {
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	URL             string   `json:"url"`
	FallbackMessage string   `json:"fallback_message"`
	RequiredBy      []string `json:"required_by"`
	SizeMB          int      `json:"size_mb"`
}

// DownloadsConfig represents the downloads.json structure
type DownloadsConfig struct {
	Description string           `json:"description"`
	Files       []DownloadConfig `json:"files"`
	Note        string           `json:"note"`
}

// ExtractEmbeddedScripts extracts embedded scripts to a temporary directory
// scriptPath should be the directory containing the scripts (e.g., "embedded-scripts/ubuntu-setup")
func ExtractEmbeddedScripts(scriptPath string) (string, error) {
	// Create temp directory for this extraction
	tempDir, err := os.MkdirTemp("", "script-runner-")
	if err != nil {
		return "", fmt.Errorf("failed to create temp dir: %w", err)
	}

	// Normalize path to use forward slashes (embed.FS always uses forward slashes)
	scriptDir := strings.ReplaceAll(scriptPath, "\\", "/")

	// Extract all files from the script directory
	err = fs.WalkDir(EmbeddedScripts, scriptDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Get relative path from script directory (use strings since embed paths are always forward slash)
		relPath := strings.TrimPrefix(path, scriptDir)
		relPath = strings.TrimPrefix(relPath, "/")
		if relPath == "" {
			relPath = "."
		}

		destPath := filepath.Join(tempDir, relPath)

		if d.IsDir() {
			return os.MkdirAll(destPath, 0755)
		}

		// Read and write file
		content, err := EmbeddedScripts.ReadFile(path)
		if err != nil {
			return err
		}

		// Make scripts executable
		mode := os.FileMode(0644)
		if strings.HasSuffix(path, ".sh") {
			mode = 0755
		}

		return os.WriteFile(destPath, content, mode)
	})

	if err != nil {
		os.RemoveAll(tempDir)
		return "", fmt.Errorf("failed to extract scripts: %w", err)
	}

	return tempDir, nil
}

// GetRequiredDownloads returns list of files that need to be downloaded for given flags
func GetRequiredDownloads(scriptDir string, enabledFlags []string) ([]DownloadConfig, error) {
	downloadsPath := filepath.Join(scriptDir, "downloads.json")

	content, err := os.ReadFile(downloadsPath)
	if err != nil {
		// No downloads config, that's fine
		return nil, nil
	}

	var config DownloadsConfig
	if err := json.Unmarshal(content, &config); err != nil {
		return nil, err
	}

	var required []DownloadConfig
	for _, file := range config.Files {
		for _, flag := range enabledFlags {
			for _, requiredBy := range file.RequiredBy {
				if flag == requiredBy {
					required = append(required, file)
					break
				}
			}
		}
	}

	return required, nil
}
