import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { createTheme } from '@mui/material/styles'

const ThemeContext = createContext()

// Dark theme - current default
const darkPalette = {
    mode: 'dark',
    primary: { main: '#f97316', light: '#fb923c', dark: '#ea580c' },
    secondary: { main: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed' },
    success: { main: '#22c55e', light: '#4ade80', dark: '#16a34a' },
    error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
    warning: { main: '#eab308', light: '#facc15', dark: '#ca8a04' },
    background: { default: '#0f0f0f', paper: '#1a1a1a' },
    text: { primary: '#fafafa', secondary: '#a3a3a3' },
    divider: 'rgba(249, 115, 22, 0.15)',
}

// Light theme
const lightPalette = {
    mode: 'light',
    primary: { main: '#ea580c', light: '#f97316', dark: '#c2410c' },
    secondary: { main: '#7c3aed', light: '#8b5cf6', dark: '#6d28d9' },
    success: { main: '#16a34a', light: '#22c55e', dark: '#15803d' },
    error: { main: '#dc2626', light: '#ef4444', dark: '#b91c1c' },
    warning: { main: '#ca8a04', light: '#eab308', dark: '#a16207' },
    background: { default: '#f5f5f5', paper: '#ffffff' },
    text: { primary: '#1a1a1a', secondary: '#525252' },
    divider: 'rgba(234, 88, 12, 0.2)',
}

const createAppTheme = (isDark) => createTheme({
    palette: isDark ? darkPalette : lightPalette,
    typography: {
        fontFamily: '"JetBrains Mono", "Fira Code", "Inter", monospace',
        h4: { fontWeight: 700, letterSpacing: '-0.02em', textShadow: isDark ? '0 0 20px rgba(249, 115, 22, 0.3)' : 'none' },
        h5: { fontWeight: 600, letterSpacing: '-0.01em' },
        h6: { fontWeight: 600 },
        subtitle1: { fontWeight: 500 },
        button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.02em' },
    },
    shape: { borderRadius: 8 },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    scrollbarWidth: 'thin',
                    scrollbarColor: isDark ? '#f9731633 #1a1a1a' : '#ea580c33 #f5f5f5',
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-track': { background: isDark ? '#1a1a1a' : '#f5f5f5' },
                    '&::-webkit-scrollbar-thumb': { 
                        background: isDark ? 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)' : 'linear-gradient(180deg, #ea580c 0%, #c2410c 100%)',
                        borderRadius: '4px' 
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '10px 24px',
                    boxShadow: 'none',
                    transition: 'all 0.2s ease',
                    '&:hover': { boxShadow: '0 4px 20px rgba(249, 115, 22, 0.3)', transform: 'translateY(-2px)' },
                },
                contained: {
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    '&:hover': { background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)' },
                },
                outlined: {
                    borderColor: '#f97316',
                    color: '#f97316',
                    '&:hover': { borderColor: '#fb923c', backgroundColor: 'rgba(249, 115, 22, 0.1)' },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                    backdropFilter: 'blur(10px)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease',
                    '&:hover': { 
                        borderColor: 'rgba(249, 115, 22, 0.3)', 
                        boxShadow: isDark ? '0 8px 30px rgba(0, 0, 0, 0.5)' : '0 8px 30px rgba(0, 0, 0, 0.15)' 
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: isDark ? '#141414' : '#fafafa',
                    borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.08)',
                    backdropFilter: 'blur(20px)',
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    margin: '4px 8px',
                    transition: 'all 0.2s ease',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        borderLeft: '3px solid #f97316',
                        '&:hover': { backgroundColor: 'rgba(249, 115, 22, 0.25)' },
                    },
                    '&:hover': { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { borderRadius: 6, fontWeight: 600 },
                filled: { backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#f97316' },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: { borderRadius: 8, backdropFilter: 'blur(10px)' },
                standardSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' },
                standardError: { backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' },
                standardWarning: { backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)' },
                standardInfo: { backgroundColor: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)' },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.02)',
                        '& fieldset': { borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.15)' },
                        '&:hover fieldset': { borderColor: 'rgba(249, 115, 22, 0.4)' },
                        '&.Mui-focused fieldset': { borderColor: '#f97316', boxShadow: '0 0 10px rgba(249, 115, 22, 0.2)' },
                    },
                },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                root: { borderRadius: 4, backgroundColor: 'rgba(249, 115, 22, 0.1)' },
                bar: { borderRadius: 4, background: 'linear-gradient(90deg, #f97316 0%, #22c55e 100%)' },
            },
        },
        MuiStepper: {
            styleOverrides: {
                root: {
                    '& .MuiStepIcon-root': {
                        color: 'rgba(249, 115, 22, 0.3)',
                        '&.Mui-active': { color: '#f97316', filter: 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.5))' },
                        '&.Mui-completed': { color: '#22c55e' },
                    },
                },
            },
        },
    },
})

export const ThemeContextProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('porter-theme')
        return saved ? saved === 'dark' : true
    })

    useEffect(() => {
        localStorage.setItem('porter-theme', isDark ? 'dark' : 'light')
    }, [isDark])

    const theme = useMemo(() => createAppTheme(isDark), [isDark])

    const toggleTheme = () => setIsDark(prev => !prev)

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useThemeContext = () => {
    const context = useContext(ThemeContext)
    if (!context) throw new Error('useThemeContext must be used within ThemeContextProvider')
    return context
}

export default ThemeContext
