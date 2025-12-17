package porter

// =============================================================================
// USER MANAGEMENT
// =============================================================================

// UserAdd creates a new user account.
func UserAdd(username string) TaskBuilder {
	return TaskBuilder{Task{Action: "user_add", Dest: username, Name: "Add user " + username}}
}

// UserDel deletes a user account.
func UserDel(username string) TaskBuilder {
	return TaskBuilder{Task{Action: "user_del", Dest: username, Name: "Delete user " + username}}
}

// UserMod modifies a user account.
// Chain with .Groups(), .Shell(), or .Home() to set properties.
func UserMod(username string) TaskBuilder {
	return TaskBuilder{Task{Action: "user_mod", Dest: username, Name: "Modify user " + username}}
}

// =============================================================================
// USER MODIFICATION OPTIONS
// =============================================================================

// Groups sets the supplementary groups for a user.
func (b TaskBuilder) Groups(g string) TaskBuilder { return b.appendOpt("groups", g) }

// Shell sets the login shell for a user.
func (b TaskBuilder) Shell(s string) TaskBuilder { return b.appendOpt("shell", s) }

// Home sets the home directory for a user.
func (b TaskBuilder) Home(h string) TaskBuilder { return b.appendOpt("home", h) }
