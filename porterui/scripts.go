package porterui

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gorilla/mux"
)

type ScriptFlag struct {
	Short       string `json:"short"`
	Long        string `json:"long"`
	Description string `json:"description"`
	HasValue    bool   `json:"has_value"`
	ValueHint   string `json:"value_hint,omitempty"`
}

type Script struct {
	Path         string       `json:"path"`
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	Category     string       `json:"category"`
	Flags        []ScriptFlag `json:"flags"`
	IsTopLevel   bool         `json:"is_top_level"`
	IsCustom     bool         `json:"is_custom,omitempty"`
	CustomID     string       `json:"custom_id,omitempty"`
	RequiredTags []string     `json:"required_tags,omitempty"`
}

// ScriptDiscoveryConfig allows customization of script discovery
type ScriptDiscoveryConfig struct {
	// TopLevelScripts are scripts that should always be shown prominently
	TopLevelScripts map[string]bool
	// HiddenScripts are scripts that should not be shown in the UI
	HiddenScripts map[string]bool
	// EmbeddedRoot is the root directory name for embedded scripts (default: "embedded-scripts")
	EmbeddedRoot string
	// ScriptRequiredTags maps script names to required machine tags
	// Scripts will only show when a machine with matching tags is selected
	ScriptRequiredTags map[string][]string
}

// DefaultScriptDiscoveryConfig returns a config with no hidden/top-level scripts
var scriptDiscoveryConfig = &ScriptDiscoveryConfig{
	TopLevelScripts: map[string]bool{},
	HiddenScripts:   map[string]bool{},
	EmbeddedRoot:    "embedded-scripts",
}

// SetScriptDiscoveryConfig allows customization of script discovery behavior
func SetScriptDiscoveryConfig(config *ScriptDiscoveryConfig) {
	if config != nil {
		scriptDiscoveryConfig = config
	}
}

// ParseScriptFlagsFromContent parses flags from script content (exported for use by embedders)
func ParseScriptFlagsFromContent(content string) ([]ScriptFlag, string, bool) {
	var flags []ScriptFlag
	var description string
	isTopLevel := false
	scanner := bufio.NewScanner(strings.NewReader(content))

	flagPattern := regexp.MustCompile(`^\s*#?\s*(-[a-zA-Z]),?\s*(--[a-zA-Z][a-zA-Z0-9-]*)\s+(.+)$`)
	longOnlyPattern := regexp.MustCompile(`^\s*#?\s*(--[a-zA-Z][a-zA-Z0-9-]*)\s+(.+)$`)
	casePattern := regexp.MustCompile(`^\s*(-[a-zA-Z])\|?(--[a-zA-Z][a-zA-Z0-9-]*)?\).*$`)
	caseLongPattern := regexp.MustCompile(`^\s*(--[a-zA-Z][a-zA-Z0-9-]*)\).*$`)
	valuePattern := regexp.MustCompile(`<([^>]+)>`)

	lineNum := 0
	inUsage := false
	seenFlags := make(map[string]bool)

	for scanner.Scan() {
		line := scanner.Text()
		lineNum++

		if strings.Contains(line, "usage()") || strings.Contains(line, "Usage:") || strings.Contains(line, "--help") {
			isTopLevel = true
			inUsage = true
		}

		if lineNum <= 10 && strings.HasPrefix(strings.TrimSpace(line), "#") && description == "" {
			comment := strings.TrimPrefix(strings.TrimSpace(line), "#")
			comment = strings.TrimSpace(comment)
			if comment != "" && !strings.HasPrefix(comment, "!") && !strings.Contains(comment, "bin/") {
				description = comment
			}
		}

		if inUsage {
			if matches := flagPattern.FindStringSubmatch(line); matches != nil {
				shortFlag := matches[1]
				longFlag := matches[2]
				desc := strings.TrimSpace(matches[3])
				key := longFlag
				if !seenFlags[key] {
					hasValue := valuePattern.MatchString(line)
					valueHint := ""
					if vMatches := valuePattern.FindStringSubmatch(line); vMatches != nil {
						valueHint = vMatches[1]
					}
					flags = append(flags, ScriptFlag{
						Short:       shortFlag,
						Long:        longFlag,
						Description: desc,
						HasValue:    hasValue,
						ValueHint:   valueHint,
					})
					seenFlags[key] = true
				}
			} else if matches := longOnlyPattern.FindStringSubmatch(line); matches != nil {
				longFlag := matches[1]
				desc := strings.TrimSpace(matches[2])
				if !seenFlags[longFlag] && !strings.HasPrefix(desc, "#") {
					hasValue := valuePattern.MatchString(line)
					valueHint := ""
					if vMatches := valuePattern.FindStringSubmatch(line); vMatches != nil {
						valueHint = vMatches[1]
					}
					flags = append(flags, ScriptFlag{
						Long:        longFlag,
						Description: desc,
						HasValue:    hasValue,
						ValueHint:   valueHint,
					})
					seenFlags[longFlag] = true
				}
			}
		}

		if matches := casePattern.FindStringSubmatch(line); matches != nil {
			shortFlag := matches[1]
			longFlag := matches[2]
			key := shortFlag
			if longFlag != "" {
				key = longFlag
			}
			if !seenFlags[key] && longFlag != "" {
				flags = append(flags, ScriptFlag{
					Short: shortFlag,
					Long:  longFlag,
				})
				seenFlags[key] = true
				isTopLevel = true
			}
		} else if matches := caseLongPattern.FindStringSubmatch(line); matches != nil {
			longFlag := matches[1]
			if !seenFlags[longFlag] {
				flags = append(flags, ScriptFlag{
					Long: longFlag,
				})
				seenFlags[longFlag] = true
				isTopLevel = true
			}
		}

		if lineNum > 500 {
			break
		}
	}

	return flags, description, isTopLevel
}

func discoverScripts() ([]Script, error) {
	var scripts []Script

	config := scriptDiscoveryConfig
	embeddedRoot := config.EmbeddedRoot
	if embeddedRoot == "" {
		embeddedRoot = "embedded-scripts"
	}

	// Walk embedded scripts
	err := fs.WalkDir(EmbeddedScripts, embeddedRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".sh") {
			return nil
		}

		// Read script content
		content, err := EmbeddedScripts.ReadFile(path)
		if err != nil {
			return nil
		}

		name := d.Name()
		relPath := strings.TrimPrefix(path, embeddedRoot+"/")
		category := filepath.Dir(relPath)
		if category == "." {
			category = "root"
		}

		flags, description, parsedTopLevel := ParseScriptFlagsFromContent(string(content))

		isTopLevel := config.TopLevelScripts[name] || parsedTopLevel
		// Skip hidden scripts entirely - don't show in UI
		if config.HiddenScripts[name] {
			return nil
		}

		if description == "" {
			description = fmt.Sprintf("Script: %s", relPath)
		}

		// Get required tags for this script
		var requiredTags []string
		if config.ScriptRequiredTags != nil {
			requiredTags = config.ScriptRequiredTags[name]
		}

		scripts = append(scripts, Script{
			Path:         path, // embedded path
			Name:         name,
			Description:  description,
			Category:     category,
			Flags:        flags,
			IsTopLevel:   isTopLevel,
			RequiredTags: requiredTags,
		})
		return nil
	})

	return scripts, err
}

func ScriptsRoutes(r *mux.Router) {
	// Get all scripts (embedded + custom)
	r.HandleFunc("/api/scripts", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		scripts, err := discoverScripts()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Include custom scripts
		if customScriptStore != nil {
			for _, cs := range customScriptStore.List() {
				scripts = append(scripts, Script{
					Path:        "custom:" + cs.ID,
					Name:        cs.FileName,
					Description: cs.Description,
					Category:    "custom/" + cs.Category,
					Flags:       []ScriptFlag{},
					IsTopLevel:  true,
					IsCustom:    true,
					CustomID:    cs.ID,
				})
			}
		}

		json.NewEncoder(w).Encode(scripts)
	}).Methods("GET")
}
