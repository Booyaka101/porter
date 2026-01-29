import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import PersonIcon from '@mui/icons-material/Person'
import LockIcon from '@mui/icons-material/Lock'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { useAuth } from './AuthContext'
import { colors } from './theme'

const Login = () => {
    const navigate = useNavigate()
    const { login, error: authError, isAuthenticated } = useAuth()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Always redirect to home page when Login component mounts (clears any previous URL)
    // and after successful login
    useEffect(() => {
        // Force navigate to home when showing login page
        if (window.location.pathname !== '/') {
            navigate('/', { replace: true })
        }
    }, [navigate])

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true })
        }
    }, [isAuthenticated, navigate])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!username || !password) {
            setError('Please enter username and password')
            return
        }

        setLoading(true)
        setError('')

        const result = await login(username, password)
        
        if (!result.success) {
            setError(result.error || 'Login failed')
        }
        setLoading(false)
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 50%, #0a0e17 100%)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Background decoration */}
            <Box sx={{
                position: 'absolute',
                top: '20%',
                left: '10%',
                width: 300,
                height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
                filter: 'blur(60px)',
            }} />
            <Box sx={{
                position: 'absolute',
                bottom: '20%',
                right: '10%',
                width: 400,
                height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(34, 197, 94, 0.08) 0%, transparent 70%)',
                filter: 'blur(80px)',
            }} />

            <Card sx={{
                width: '100%',
                maxWidth: 420,
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #f97316, #22c55e)',
                }
            }}>
                <CardContent sx={{ p: 4 }}>
                    {/* Logo and Title */}
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Box
                            component="img"
                            src="/porter-logo.svg"
                            alt="Porter"
                            sx={{
                                width: 120,
                                height: 180,
                                margin: '0 auto 16px',
                                filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.4))',
                                borderRadius: '16px',
                            }}
                        />
                        <Typography sx={{
                            fontSize: '1.75rem',
                            fontWeight: 700,
                            color: '#fafafa',
                            letterSpacing: '-0.02em',
                        }}>
                            Porter
                        </Typography>
                        <Typography sx={{
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: '0.9rem',
                            mt: 0.5,
                        }}>
                            Sign in to continue
                        </Typography>
                    </Box>

                    {/* Error Alert */}
                    {(error || authError) && (
                        <Alert 
                            severity="error" 
                            sx={{ 
                                mb: 3,
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#fca5a5',
                                '& .MuiAlert-icon': { color: '#ef4444' }
                            }}
                        >
                            {error || authError}
                        </Alert>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                            autoFocus
                            sx={{ mb: 2 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <PersonIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            sx={{ mb: 3 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LockIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                            sx={{ color: 'rgba(255,255,255,0.4)' }}
                                        >
                                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{
                                py: 1.5,
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                boxShadow: '0 4px 20px rgba(249, 115, 22, 0.3)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                                    boxShadow: '0 6px 30px rgba(249, 115, 22, 0.4)',
                                },
                                '&:disabled': {
                                    background: 'rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.3)',
                                }
                            }}
                        >
                            {loading ? (
                                <CircularProgress size={24} sx={{ color: '#fff' }} />
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                    </form>

                    {/* Footer */}
                    <Typography sx={{
                        textAlign: 'center',
                        mt: 3,
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: '0.8rem',
                    }}>
                        Porter Script Runner • {new Date().getFullYear()}
                    </Typography>
                </CardContent>
            </Card>
        </Box>
    )
}

export default Login
