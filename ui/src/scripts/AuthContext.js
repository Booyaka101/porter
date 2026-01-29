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
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Check authentication status on mount
    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/status')
            
            // If auth endpoint returns 404, auth is not enabled - allow access
            if (res.status === 404) {
                // Auth not enabled, create a fake admin user for full access
                setUser({
                    id: 'local',
                    username: 'local',
                    role: 'admin',
                    permissions: ['*'],
                    display_name: 'Local User'
                })
                setLoading(false)
                return
            }
            
            const data = await res.json()
            if (data.authenticated && data.user) {
                setUser(data.user)
            } else {
                setUser(null)
            }
        } catch (err) {
            console.error('Auth check failed:', err)
            // On network error, assume auth is not enabled
            setUser({
                id: 'local',
                username: 'local',
                role: 'admin',
                permissions: ['*'],
                display_name: 'Local User'
            })
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

    const isAdmin = () => user?.role === 'admin'
    const isOperator = () => user?.role === 'operator' || user?.role === 'admin'
    const isViewer = () => user?.role === 'viewer'
    const isViewerOnly = () => user?.role === 'viewer'

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
        isAuthenticated: !!user
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext
