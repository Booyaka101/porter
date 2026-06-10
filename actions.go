package porter

import "fmt"

// =============================================================================
// ACTION REGISTRY
//
// Each Task.Action is handled by a small registered function rather than one
// monolithic switch. Domain files (actions_*.go) register their handlers in an
// init(). A handler receives the Task plus its variable-expanded fields
// positionally and may ignore any it doesn't need.
// =============================================================================

// actionHandler executes one task action.
type actionHandler func(e *Executor, t Task, src, dest, body, perm, own string, vars *Vars) error

// actionHandlers maps an action name to its handler.
var actionHandlers = map[string]actionHandler{}

// register wires an action name to its handler. It panics on a duplicate name
// so a copy-paste mistake is caught at startup, not silently.
func register(action string, h actionHandler) {
	if _, dup := actionHandlers[action]; dup {
		panic("porter: duplicate action handler registered: " + action)
	}
	actionHandlers[action] = h
}

// dispatch expands the task's fields and routes it to its registered handler.
func (e *Executor) dispatch(t Task, vars *Vars) error {
	src := vars.Expand(t.Src)
	dest := vars.Expand(t.Dest)
	body := vars.Expand(t.Body)
	perm := vars.Expand(t.Perm)
	own := vars.Expand(t.Own)

	h, ok := actionHandlers[t.Action]
	if !ok {
		return fmt.Errorf("unknown action: %s", t.Action)
	}
	return h(e, t, src, dest, body, perm, own, vars)
}
