import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    // authDisabled is true ONLY when the backend explicitly reports auth is
    // turned off server-side (status 404 == no auth DB). It is never inferred
    // from errors or unexpected responses — those fail closed.
    const [authDisabled, setAuthDisabled] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Check authentication status on mount
    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/status')

            // 404 == backend reports auth is NOT enabled (no auth DB).
            // This is the only path that grants access without a login, and it
            // does so WITHOUT fabricating an admin user — no user object, just
            // an explicit "auth disabled, access allowed" mode.
            if (res.status === 404) {
                setUser(null)
                setAuthDisabled(true)
                setLoading(false)
                return
            }

            // Any non-OK status (401/403/5xx/etc.) means auth IS enabled and the
            // session is not valid (or the server is unhealthy). Fail closed.
            if (!res.ok) {
                setUser(null)
                setAuthDisabled(false)
                setLoading(false)
                return
            }

            const data = await res.json()
            // Only an explicit authenticated:true with a real user object grants
            // access. Anything else (authenticated:false, missing user, malformed
            // payload) is treated as unauthenticated → login screen.
            if (data && data.authenticated === true && data.user) {
                setUser(data.user)
                setAuthDisabled(false)
            } else {
                setUser(null)
                setAuthDisabled(false)
            }
        } catch (err) {
            console.error('Auth check failed:', err)
            // Network error or unparseable response → fail closed.
            // NEVER fabricate a user or assume auth is disabled here.
            setUser(null)
            setAuthDisabled(false)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    const login = async (username, password) => {
        setError(null)
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            const data = await res.json()
            
            if (data.success && data.user) {
                setUser(data.user)
                setAuthDisabled(false)
                return { success: true }
            } else {
                setError(data.error || 'Login failed')
                return { success: false, error: data.error }
            }
        } catch (err) {
            const errorMsg = 'Network error. Please try again.'
            setError(errorMsg)
            return { success: false, error: errorMsg }
        }
    }

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
        } catch (err) {
            console.error('Logout error:', err)
        }
        setUser(null)
    }

    const hasPermission = (permission) => {
        // When the backend has explicitly disabled auth, there is no permission
        // system to enforce client-side — allow everything so the app functions.
        if (authDisabled) return true
        if (!user || !user.permissions) return false
        return user.permissions.includes('*') ||
               user.permissions.includes(permission) ||
               user.permissions.some(p => {
                   if (p.endsWith(':*')) {
                       const prefix = p.slice(0, -1)
                       return permission.startsWith(prefix)
                   }
                   return false
               })
    }

    // When auth is disabled server-side there is no role boundary to enforce,
    // so the app behaves as fully privileged (but note: user stays null — no
    // fabricated admin identity). On error/unauthenticated, authDisabled is
    // false and these all return false (fail closed).
    const isAdmin = () => authDisabled || user?.role === 'admin'
    const isOperator = () => authDisabled || user?.role === 'operator' || user?.role === 'admin'
    const isViewer = () => !authDisabled && user?.role === 'viewer'
    const isViewerOnly = () => !authDisabled && user?.role === 'viewer'

    const canWrite = (resource) => hasPermission(`${resource}:write`) || hasPermission('*')
    const canRead = (resource) => hasPermission(`${resource}:read`) || hasPermission('*')
    const canExecute = () => hasPermission('scripts:execute') || hasPermission('*')
    
    // Viewer-specific checks - viewers can ONLY view, nothing else
    const canAccessTerminal = () => hasPermission('terminal:access') || hasPermission('*')
    const canAccessFiles = () => hasPermission('files:read') || hasPermission('*')
    const canModifyFiles = () => hasPermission('files:write') || hasPermission('*')
    const canAccessTools = () => hasPermission('tools:access') || hasPermission('*')
    const canRunCommands = () => hasPermission('scripts:execute') || hasPermission('*')
    const hasSudoAccess = () => hasPermission('sudo:enabled') || hasPermission('*')

    const value = {
        user,
        authDisabled,
        loading,
        error,
        login,
        logout,
        checkAuth,
        hasPermission,
        isAdmin,
        isOperator,
        isViewer,
        isViewerOnly,
        canWrite,
        canRead,
        canExecute,
        canAccessTerminal,
        canAccessFiles,
        canModifyFiles,
        canAccessTools,
        canRunCommands,
        hasSudoAccess,
        // Authenticated for routing purposes when we have a real user OR the
        // backend has explicitly disabled auth. Errors/unauthenticated states
        // leave both false → login screen (fail closed).
        isAuthenticated: !!user || authDisabled
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext
