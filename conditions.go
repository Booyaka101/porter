package porter

// When is a condition function that determines if a task should run.
type When func(*Vars) bool

// Always returns a condition that is always true.
func Always() When { return func(*Vars) bool { return true } }

// Never returns a condition that is always false.
func Never() When { return func(*Vars) bool { return false } }

// If returns true if the variable value is "true".
func If(key string) When { return func(v *Vars) bool { return v.GetBool(key) } }

// IfNot returns true if the variable value is not "true".
func IfNot(key string) When { return func(v *Vars) bool { return !v.GetBool(key) } }

// IfSet returns true if the variable is set (non-empty).
func IfSet(key string) When { return func(v *Vars) bool { return v.Get(key) != "" } }

// IfEquals returns true if the variable equals the given value.
func IfEquals(key, val string) When { return func(v *Vars) bool { return v.Get(key) == val } }

// Not negates a condition.
func Not(c When) When { return func(v *Vars) bool { return !c(v) } }

// And returns true if all conditions are true.
func And(conds ...When) When {
	return func(v *Vars) bool {
		for _, c := range conds {
			if !c(v) {
				return false
			}
		}
		return true
	}
}

// Or returns true if any condition is true.
func Or(conds ...When) When {
	return func(v *Vars) bool {
		for _, c := range conds {
			if c(v) {
				return true
			}
		}
		return false
	}
}
