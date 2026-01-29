import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ErrorIcon from '@mui/icons-material/Error'
import RefreshIcon from '@mui/icons-material/Refresh'
import { colors } from './theme'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo })
        console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        if (this.props.onReset) {
            this.props.onReset()
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: this.props.fullPage ? '100vh' : 300,
                    p: 4,
                    background: this.props.fullPage ? 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)' : 'transparent'
                }}>
                    <ErrorIcon sx={{ fontSize: 64, color: colors.error, mb: 2 }} />
                    <Typography variant="h5" sx={{ color: colors.text.primary, mb: 1 }}>
                        Something went wrong
                    </Typography>
                    <Typography sx={{ color: colors.text.muted, mb: 3, textAlign: 'center', maxWidth: 400 }}>
                        {this.props.fallbackMessage || 'An unexpected error occurred. Please try again.'}
                    </Typography>
                    {this.state.error && (
                        <Box sx={{
                            background: 'rgba(255, 68, 102, 0.1)',
                            border: '1px solid rgba(255, 68, 102, 0.3)',
                            borderRadius: '8px',
                            p: 2,
                            mb: 3,
                            maxWidth: 500,
                            overflow: 'auto'
                        }}>
                            <Typography sx={{ 
                                color: colors.error, 
                                fontFamily: 'monospace', 
                                fontSize: '0.8rem',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {this.state.error.toString()}
                            </Typography>
                        </Box>
                    )}
                    <Button
                        variant="contained"
                        startIcon={<RefreshIcon />}
                        onClick={this.handleReset}
                        sx={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            color: '#fff',
                            '&:hover': { background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)' }
                        }}
                    >
                        Try Again
                    </Button>
                </Box>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
