import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import CircularProgress from '@mui/material/CircularProgress'
import { ThemeProvider } from '@mui/material/styles'
import ScriptRunner from './scripts/ScriptRunner'
import Login from './scripts/Login'
import { AuthProvider, useAuth } from './scripts/AuthContext'
import { ThemeContextProvider, useThemeContext } from './scripts/ThemeContext'

const AppContent = () => {
    const { theme, isDark } = useThemeContext()

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
                <Box sx={{
                    height: '100%',
                    width: '100%',
                    backgroundColor: theme.palette.background.default
                }}>
                    <BrowserRouter>
                        <AppRoutes />
                    </BrowserRouter>
                </Box>
            </AuthProvider>
        </ThemeProvider>
    )
}

const App = () => {
    return (
        <ThemeContextProvider>
            <AppContent />
        </ThemeContextProvider>
    )
}

// Separate component to use auth context
const AppRoutes = () => {
    const { isAuthenticated, loading } = useAuth()

    if (loading) {
        return (
            <Box sx={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f0f0f'
            }}>
                <CircularProgress sx={{ color: '#f97316' }} />
            </Box>
        )
    }

    // If auth is not configured (no MySQL), allow access without login
    // Check if auth endpoint returns 404 to determine if auth is enabled
    if (!isAuthenticated) {
        return <Login />
    }

    return (
        <Routes>
            <Route path='/*' element={<ScriptRunner />} />
        </Routes>
    )
}

export default App
