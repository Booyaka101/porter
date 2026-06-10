// Shared theme constants and reusable styles - Warm Orange Theme
export const colors = {
    primary: '#f97316',
    primaryLight: '#fb923c',
    primaryDark: '#ea580c',
    secondary: '#22c55e',
    secondaryLight: '#4ade80',
    tertiary: '#8b5cf6',
    tertiaryLight: '#a78bfa',
    error: '#ef4444',
    errorLight: '#f87171',
    warning: '#eab308',
    warningLight: '#facc15',
    info: '#3b82f6',
    background: {
        dark: '#0f0f0f',
        darker: '#0a0a0a',
        card: 'rgba(255,255,255,0.03)',
        cardHover: 'rgba(255,255,255,0.06)',
        cardActive: 'rgba(249, 115, 22, 0.08)',
        glass: 'rgba(255,255,255,0.02)',
        glassStrong: 'rgba(255,255,255,0.05)',
        elevated: 'linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(20, 20, 20, 0.98) 100%)',
    },
    text: {
        primary: '#fafafa',
        secondary: 'rgba(255,255,255,0.7)',
        muted: 'rgba(255,255,255,0.5)',
        disabled: 'rgba(255,255,255,0.3)',
        accent: '#f97316',
    },
    border: {
        light: 'rgba(255,255,255,0.08)',
        medium: 'rgba(255,255,255,0.12)',
        strong: 'rgba(255,255,255,0.18)',
        accent: 'rgba(249, 115, 22, 0.3)',
        accentStrong: 'rgba(249, 115, 22, 0.5)',
        success: 'rgba(34, 197, 94, 0.3)',
    },
    status: {
        online: '#22c55e',
        offline: '#ef4444',
        unknown: '#eab308',
        running: '#f97316',
        pending: '#8b5cf6',
    }
}

export const gradients = {
    primary: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    primaryHover: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
    primarySubtle: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)',
    secondary: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    tertiary: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    warm: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
    cool: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    header: 'linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, rgba(234, 88, 12, 0.03) 100%)',
    headerAlt: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(249, 115, 22, 0.03) 100%)',
    headerPurple: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(124, 58, 237, 0.03) 100%)',
    text: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
    textCyan: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
    textPurple: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
    cardGlow: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(234, 88, 12, 0.05) 100%)',
    darkOverlay: 'linear-gradient(180deg, rgba(15, 15, 15, 0) 0%, rgba(15, 15, 15, 0.8) 100%)',
}

export const shadows = {
    card: '0 4px 20px rgba(0, 0, 0, 0.3)',
    cardHover: '0 20px 40px rgba(0, 0, 0, 0.4)',
    cardElevated: '0 8px 32px rgba(0, 0, 0, 0.5)',
    glow: '0 0 30px rgba(249, 115, 22, 0.4)',
    glowStrong: '0 6px 30px rgba(249, 115, 22, 0.5)',
    glowSuccess: '0 0 30px rgba(34, 197, 94, 0.4)',
    glowPurple: '0 0 30px rgba(139, 92, 246, 0.4)',
    glowWarning: '0 0 30px rgba(234, 179, 8, 0.4)',
    button: '0 4px 20px rgba(249, 115, 22, 0.3)',
    buttonHover: '0 8px 30px rgba(249, 115, 22, 0.5)',
    inner: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    innerGlow: 'inset 0 0 20px rgba(249, 115, 22, 0.1)',
}

export const transitions = {
    fast: 'all 0.15s ease',
    normal: 'all 0.2s ease',
    slow: 'all 0.3s ease',
}

// Reusable component styles
export const cardStyles = {
    base: {
        background: colors.background.card,
        borderRadius: '20px',
        border: `1px solid ${colors.border.light}`,
        overflow: 'hidden',
        transition: transitions.slow,
    },
    hover: {
        border: `1px solid ${colors.border.accent}`,
        transform: 'translateY(-4px)',
        boxShadow: shadows.cardHover,
    },
    selected: {
        background: 'rgba(249, 115, 22, 0.08)',
        border: `1px solid rgba(249, 115, 22, 0.4)`,
    }
}

export const headerStyles = {
    container: {
        background: gradients.header,
        borderRadius: '24px',
        border: `1px solid ${colors.border.light}`,
        p: 3,
        mb: 4,
    },
    title: {
        fontSize: '2.2rem',
        fontWeight: 800,
        background: gradients.text,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-0.02em',
        mb: 0.5,
    },
    subtitle: {
        color: colors.text.muted,
        fontSize: '0.95rem',
    }
}

export const buttonStyles = {
    primary: {
        background: gradients.primary,
        color: colors.background.dark,
        fontWeight: 700,
        px: 3,
        py: 1.2,
        borderRadius: '12px',
        textTransform: 'none',
        fontSize: '0.95rem',
        boxShadow: shadows.button,
        '&:hover': {
            background: gradients.primaryHover,
            boxShadow: shadows.glowStrong,
            transform: 'translateY(-2px)',
        },
        transition: transitions.normal,
    },
    secondary: {
        color: colors.primary,
        borderColor: colors.border.accent,
        '&:hover': {
            borderColor: colors.primary,
            background: 'rgba(249, 115, 22, 0.1)',
        }
    },
    icon: {
        color: colors.text.muted,
        background: 'rgba(255,255,255,0.03)',
        '&:hover': {
            color: colors.primary,
            background: 'rgba(249, 115, 22, 0.1)',
        }
    }
}

export const inputStyles = {
    search: {
        width: 220,
        '& .MuiOutlinedInput-root': {
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px',
            '& fieldset': { borderColor: colors.border.light },
            '&:hover fieldset': { borderColor: colors.border.accent },
            '&.Mui-focused fieldset': { borderColor: colors.primary },
        }
    }
}

// Status indicator styles
export const getStatusStyles = (status) => {
    const statusColors = {
        online: { color: colors.status.online, bg: 'rgba(34, 197, 94, 0.1)' },
        offline: { color: colors.status.offline, bg: 'rgba(239, 68, 68, 0.1)' },
        unknown: { color: colors.status.unknown, bg: 'rgba(234, 179, 8, 0.1)' },
    }
    return statusColors[status] || statusColors.unknown
}

// Animation keyframes (for use with sx prop)
export const animations = {
    fadeIn: {
        '@keyframes fadeIn': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: 'fadeIn 0.3s ease forwards',
    },
    fadeInUp: {
        '@keyframes fadeInUp': {
            from: { opacity: 0, transform: 'translateY(20px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: 'fadeInUp 0.4s ease forwards',
    },
    fadeInScale: {
        '@keyframes fadeInScale': {
            from: { opacity: 0, transform: 'scale(0.95)' },
            to: { opacity: 1, transform: 'scale(1)' },
        },
        animation: 'fadeInScale 0.3s ease forwards',
    },
    pulse: {
        '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.7 },
        },
        animation: 'pulse 2s ease-in-out infinite',
    },
    pulseFast: {
        '@keyframes pulseFast': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.5 },
        },
        animation: 'pulseFast 1s ease-in-out infinite',
    },
    glow: {
        '@keyframes glow': {
            '0%, 100%': { boxShadow: '0 0 5px rgba(249, 115, 22, 0.3)' },
            '50%': { boxShadow: '0 0 20px rgba(249, 115, 22, 0.6)' },
        },
        animation: 'glow 2s ease-in-out infinite',
    },
    shimmer: {
        '@keyframes shimmer': {
            '0%': { backgroundPosition: '-200% 0' },
            '100%': { backgroundPosition: '200% 0' },
        },
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite',
    },
    float: {
        '@keyframes float': {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-5px)' },
        },
        animation: 'float 3s ease-in-out infinite',
    },
    spin: {
        '@keyframes spin': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' },
        },
        animation: 'spin 1s linear infinite',
    },
}

// Chip styles for categories/tags
export const chipStyles = {
    active: {
        background: gradients.primary,
        color: colors.background.dark,
        fontWeight: 600,
    },
    inactive: {
        background: 'rgba(255,255,255,0.05)',
        color: colors.text.secondary,
        fontWeight: 600,
        '&:hover': {
            background: 'rgba(255,255,255,0.1)',
        }
    }
}

// Skeleton styles
export const skeletonStyles = {
    base: { bgcolor: 'rgba(255,255,255,0.05)' },
    light: { bgcolor: 'rgba(255,255,255,0.03)' },
}

// Scrollable container styles
export const scrollableStyles = {
    // Custom scrollbar for any scrollable container
    customScrollbar: {
        '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
        },
        '&::-webkit-scrollbar-track': {
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
            background: 'rgba(249, 115, 22, 0.3)',
            borderRadius: '4px',
            '&:hover': {
                background: 'rgba(249, 115, 22, 0.5)',
            }
        },
    },
    // Page container with scroll
    pageContainer: {
        height: 'calc(100vh - 100px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        pr: 1,
        '&::-webkit-scrollbar': {
            width: '8px',
        },
        '&::-webkit-scrollbar-track': {
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
            background: 'rgba(249, 115, 22, 0.3)',
            borderRadius: '4px',
            '&:hover': {
                background: 'rgba(249, 115, 22, 0.5)',
            }
        },
    },
    // Horizontal scroll container
    horizontalScroll: {
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
        pb: 1,
        '&::-webkit-scrollbar': {
            height: '6px',
        },
        '&::-webkit-scrollbar-track': {
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb': {
            background: 'rgba(249, 115, 22, 0.3)',
            borderRadius: '3px',
            '&:hover': {
                background: 'rgba(249, 115, 22, 0.5)',
            }
        },
    },
    // Fixed height scrollable list
    scrollableList: (maxHeight = 400) => ({
        maxHeight,
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
            width: '6px',
        },
        '&::-webkit-scrollbar-track': {
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb': {
            background: 'rgba(249, 115, 22, 0.3)',
            borderRadius: '3px',
            '&:hover': {
                background: 'rgba(249, 115, 22, 0.5)',
            }
        },
    }),
}

// Glass card with glow effect
export const glassCard = {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'all 0.3s ease',
    '&:hover': {
        border: '1px solid rgba(249, 115, 22, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    }
}

export default {
    colors,
    gradients,
    shadows,
    transitions,
    cardStyles,
    headerStyles,
    buttonStyles,
    inputStyles,
    getStatusStyles,
    animations,
    chipStyles,
    skeletonStyles,
    scrollableStyles,
    glassCard,
}
