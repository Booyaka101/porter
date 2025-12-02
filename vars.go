package porter

import "strings"

// Vars holds variables for template expansion during task execution.
type Vars struct {
	data  map[string]string
	bytes map[string][]byte
	Item  string // Current loop item
}

// NewVars creates a new Vars instance.
func NewVars() *Vars {
	return &Vars{data: make(map[string]string), bytes: make(map[string][]byte)}
}

// Set stores a string value.
func (v *Vars) Set(key, val string) *Vars { v.data[key] = val; return v }

// Get retrieves a string value.
func (v *Vars) Get(key string) string { return v.data[key] }

// GetBool retrieves a boolean value (true if value is "true").
func (v *Vars) GetBool(key string) bool { return v.data[key] == "true" }

// SetBool stores a boolean value.
func (v *Vars) SetBool(key string, b bool) *Vars {
	if b {
		v.data[key] = "true"
	} else {
		v.data[key] = "false"
	}
	return v
}

// SetBytes stores binary data.
func (v *Vars) SetBytes(key string, data []byte) *Vars { v.bytes[key] = data; return v }

// GetBytes retrieves binary data.
func (v *Vars) GetBytes(key string) []byte { return v.bytes[key] }

// Clear removes all variables.
func (v *Vars) Clear() {
	v.data = make(map[string]string)
	v.bytes = make(map[string][]byte)
	v.Item = ""
}

// Expand replaces {{key}} placeholders with variable values.
func (v *Vars) Expand(s string) string {
	if s == "" {
		return s
	}
	s = strings.ReplaceAll(s, "{{item}}", v.Item)
	for key, val := range v.data {
		s = strings.ReplaceAll(s, "{{"+key+"}}", val)
	}
	return s
}
