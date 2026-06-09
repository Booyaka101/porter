package porterui

import "strings"

// shellQuote returns s wrapped in single quotes, safe for POSIX shells
// (embedded single quotes are escaped via the '\” idiom).
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

// sudoStdin returns a command prefix that runs the command appended after it
// under sudo, feeding the password over stdin via printf (a shell builtin, so
// the password never appears in the remote process table) and shell-quoting it
// so a password containing quotes or metacharacters can neither break the
// command nor inject shell. -p ” suppresses the prompt that would otherwise
// pollute stdout. Append the command to run directly after this prefix.
func sudoStdin(password string) string {
	return "printf '%s\\n' " + shellQuote(password) + " | sudo -S -p '' "
}
