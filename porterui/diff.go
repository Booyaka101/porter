package porterui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/booyaka101/porter"
	"github.com/gorilla/mux"
)

// DiffRoutes sets up file diff API routes
func DiffRoutes(r *mux.Router) {
	// Compare files between two machines
	r.HandleFunc("/api/diff/machines", func(w http.ResponseWriter, req *http.Request) {
		var reqBody struct {
			Machine1ID string `json:"machine1_id"`
			Machine2ID string `json:"machine2_id"`
			FilePath   string `json:"file_path"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		machine1, exists1 := machineRepo.Get(reqBody.Machine1ID)
		machine2, exists2 := machineRepo.Get(reqBody.Machine2ID)

		if !exists1 || !exists2 {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		// Get file content from machine 1
		client1, err := porter.Connect(machine1.IP, porter.DefaultConfig(machine1.Username, machine1.Password))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to connect to %s: %s", machine1.Name, err.Error()),
			})
			return
		}
		defer client1.Close()

		content1, err := client1.Run(fmt.Sprintf("cat '%s' 2>&1", reqBody.FilePath))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to read file from %s: %s", machine1.Name, err.Error()),
			})
			return
		}

		// Get file content from machine 2
		client2, err := porter.Connect(machine2.IP, porter.DefaultConfig(machine2.Username, machine2.Password))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to connect to %s: %s", machine2.Name, err.Error()),
			})
			return
		}
		defer client2.Close()

		content2, err := client2.Run(fmt.Sprintf("cat '%s' 2>&1", reqBody.FilePath))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to read file from %s: %s", machine2.Name, err.Error()),
			})
			return
		}

		// Generate diff
		diff := generateDiff(string(content1), string(content2))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   true,
			"machine1":  machine1.Name,
			"machine2":  machine2.Name,
			"file":      reqBody.FilePath,
			"content1":  string(content1),
			"content2":  string(content2),
			"diff":      diff,
			"identical": string(content1) == string(content2),
		})
	}).Methods("POST")

	// Compare two files on the same machine
	r.HandleFunc("/api/machines/{id}/diff", func(w http.ResponseWriter, req *http.Request) {
		machineID := mux.Vars(req)["id"]
		machine, exists := machineRepo.Get(machineID)
		if !exists {
			http.Error(w, "Machine not found", http.StatusNotFound)
			return
		}

		var reqBody struct {
			File1 string `json:"file1"`
			File2 string `json:"file2"`
		}
		if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		client, err := porter.Connect(machine.IP, porter.DefaultConfig(machine.Username, machine.Password))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Connection failed: " + err.Error(),
			})
			return
		}
		defer client.Close()

		// Use diff command on the machine
		output, _ := client.Run(fmt.Sprintf("diff -u '%s' '%s' 2>&1", reqBody.File1, reqBody.File2))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   true,
			"diff":      string(output),
			"identical": len(output) == 0,
		})
	}).Methods("POST")
}

// DiffLine represents a line in the diff output
type DiffLine struct {
	Line1    int    `json:"line1"`
	Line2    int    `json:"line2"`
	Content1 string `json:"content1"`
	Content2 string `json:"content2"`
	Status   string `json:"status"` // equal, added, removed, changed
}

// generateDiff creates a proper diff using LCS algorithm for line alignment
func generateDiff(content1, content2 string) []DiffLine {
	lines1 := strings.Split(content1, "\n")
	lines2 := strings.Split(content2, "\n")

	// Compute LCS (Longest Common Subsequence) for line alignment
	lcs := computeLCS(lines1, lines2)

	var diff []DiffLine
	i, j := 0, 0
	lcsIdx := 0

	for i < len(lines1) || j < len(lines2) {
		if lcsIdx < len(lcs) && i < len(lines1) && lines1[i] == lcs[lcsIdx] &&
			j < len(lines2) && lines2[j] == lcs[lcsIdx] {
			// Lines match - equal
			diff = append(diff, DiffLine{
				Line1:    i + 1,
				Line2:    j + 1,
				Content1: lines1[i],
				Content2: lines2[j],
				Status:   "equal",
			})
			i++
			j++
			lcsIdx++
		} else if lcsIdx < len(lcs) && i < len(lines1) && lines1[i] == lcs[lcsIdx] {
			// Line only in file2 - added
			diff = append(diff, DiffLine{
				Line1:    0,
				Line2:    j + 1,
				Content1: "",
				Content2: lines2[j],
				Status:   "added",
			})
			j++
		} else if lcsIdx < len(lcs) && j < len(lines2) && lines2[j] == lcs[lcsIdx] {
			// Line only in file1 - removed
			diff = append(diff, DiffLine{
				Line1:    i + 1,
				Line2:    0,
				Content1: lines1[i],
				Content2: "",
				Status:   "removed",
			})
			i++
		} else if i < len(lines1) && j < len(lines2) {
			// Both have lines but neither matches LCS - changed
			diff = append(diff, DiffLine{
				Line1:    i + 1,
				Line2:    j + 1,
				Content1: lines1[i],
				Content2: lines2[j],
				Status:   "changed",
			})
			i++
			j++
		} else if i < len(lines1) {
			// Only file1 has remaining lines
			diff = append(diff, DiffLine{
				Line1:    i + 1,
				Line2:    0,
				Content1: lines1[i],
				Content2: "",
				Status:   "removed",
			})
			i++
		} else if j < len(lines2) {
			// Only file2 has remaining lines
			diff = append(diff, DiffLine{
				Line1:    0,
				Line2:    j + 1,
				Content1: "",
				Content2: lines2[j],
				Status:   "added",
			})
			j++
		}
	}

	return diff
}

// computeLCS computes the Longest Common Subsequence of two string slices
func computeLCS(a, b []string) []string {
	m, n := len(a), len(b)

	// For very large files, limit LCS computation
	if m > 5000 || n > 5000 {
		return computeLCSHeuristic(a, b)
	}

	// DP table
	dp := make([][]int, m+1)
	for i := range dp {
		dp[i] = make([]int, n+1)
	}

	// Fill DP table
	for i := 1; i <= m; i++ {
		for j := 1; j <= n; j++ {
			if a[i-1] == b[j-1] {
				dp[i][j] = dp[i-1][j-1] + 1
			} else {
				if dp[i-1][j] > dp[i][j-1] {
					dp[i][j] = dp[i-1][j]
				} else {
					dp[i][j] = dp[i][j-1]
				}
			}
		}
	}

	// Backtrack to find LCS
	lcsLen := dp[m][n]
	lcs := make([]string, lcsLen)
	i, j := m, n
	for i > 0 && j > 0 {
		if a[i-1] == b[j-1] {
			lcsLen--
			lcs[lcsLen] = a[i-1]
			i--
			j--
		} else if dp[i-1][j] > dp[i][j-1] {
			i--
		} else {
			j--
		}
	}

	return lcs
}

// computeLCSHeuristic uses a faster heuristic for very large files
func computeLCSHeuristic(a, b []string) []string {
	// Build a map of lines in b for quick lookup
	bLines := make(map[string][]int)
	for i, line := range b {
		bLines[line] = append(bLines[line], i)
	}

	var lcs []string
	lastJ := -1

	for _, line := range a {
		if positions, ok := bLines[line]; ok {
			// Find the first position in b that's after our last match
			for _, pos := range positions {
				if pos > lastJ {
					lcs = append(lcs, line)
					lastJ = pos
					break
				}
			}
		}
	}

	return lcs
}
