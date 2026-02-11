import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import RefreshIcon from '@mui/icons-material/Refresh'
import TerminalIcon from '@mui/icons-material/Terminal'
import ViewStreamIcon from '@mui/icons-material/ViewStream'
import { colors } from './theme'

const BuildOutput = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const executionId = searchParams.get('id')
    
    const [execution, setExecution] = useState(null)
    const [output, setOutput] = useState('')
    const [stages, setStages] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState(0)
    const [autoScroll, setAutoScroll] = useState(true)
    
    const outputRef = useRef(null)
    const pollRef = useRef(null)

    useEffect(() => {
        if (!executionId) {
            navigate('/build-clients')
            return
        }
        
        loadExecution()
        
        // Poll for updates
        pollRef.current = setInterval(() => {
            loadExecution()
        }, 2000)
        
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [executionId])

    useEffect(() => {
        if (autoScroll && outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [output, autoScroll])

    const loadExecution = async () => {
        try {
            const res = await fetch(`/api/history/${executionId}`)
            if (!res.ok) throw new Error('Failed to load execution')
            const data = await res.json()
            setExecution(data)
            setOutput(data.output || '')
            setStages(data.stages || [])
            
            // Stop polling if execution is complete
            if (data.status === 'completed' || data.status === 'failed') {
                if (pollRef.current) {
                    clearInterval(pollRef.current)
                    pollRef.current = null
                }
            }
        } catch (err) {
            console.error('Failed to load execution:', err)
        } finally {
            setLoading(false)
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
            case 'success':
                return <CheckCircleIcon sx={{ color: '#22c55e' }} />
            case 'failed':
            case 'error':
                return <ErrorIcon sx={{ color: '#ff4466' }} />
            case 'running':
                return <CircularProgress size={20} sx={{ color: '#f97316' }} />
            default:
                return <HourglassEmptyIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
            case 'success':
                return '#22c55e'
            case 'failed':
            case 'error':
                return '#ff4466'
            case 'running':
                return '#f97316'
            default:
                return 'rgba(255,255,255,0.5)'
        }
    }

    const formatDuration = (ms) => {
        if (!ms) return '-'
        const seconds = Math.floor(ms / 1000)
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`
        }
        return `${seconds}s`
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
                <CircularProgress sx={{ color: colors.primary }} />
            </Box>
        )
    }

    if (!execution) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ color: colors.text.muted }}>Execution not found</Typography>
                <Button onClick={() => navigate('/build-clients')} sx={{ mt: 2 }}>
                    Back to Build Clients
                </Button>
            </Box>
        )
    }

    const isRunning = execution.status === 'running'
    const completedStages = stages.filter(s => s.status === 'completed' || s.status === 'success').length
    const progress = stages.length > 0 ? (completedStages / stages.length) * 100 : 0

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                mb: 3,
                pb: 2,
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <IconButton onClick={() => navigate('/build-clients')} sx={{ color: colors.text.muted }}>
                    <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getStatusIcon(execution.status)}
                        Build Output
                    </Typography>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                        {execution.script_path} • {execution.machine_name || 'Unknown Machine'}
                    </Typography>
                </Box>
                <Chip 
                    label={execution.status?.toUpperCase() || 'UNKNOWN'}
                    sx={{ 
                        bgcolor: `${getStatusColor(execution.status)}20`,
                        color: getStatusColor(execution.status),
                        fontWeight: 600
                    }}
                />
                {isRunning && (
                    <CircularProgress size={24} sx={{ color: colors.primary }} />
                )}
            </Box>

            {/* Progress Bar */}
            {stages.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                            Progress: {completedStages} / {stages.length} stages
                        </Typography>
                        <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                            {Math.round(progress)}%
                        </Typography>
                    </Box>
                    <LinearProgress 
                        variant="determinate" 
                        value={progress}
                        sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: 'rgba(255,255,255,0.1)',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: isRunning ? colors.primary : (execution.status === 'completed' ? '#22c55e' : '#ff4466'),
                                borderRadius: 4
                            }
                        }}
                    />
                </Box>
            )}

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 2 }}>
                <Tabs 
                    value={activeTab} 
                    onChange={(e, v) => setActiveTab(v)}
                    sx={{
                        '& .MuiTab-root': { color: colors.text.muted },
                        '& .Mui-selected': { color: colors.primary },
                        '& .MuiTabs-indicator': { bgcolor: colors.primary }
                    }}
                >
                    <Tab icon={<ViewStreamIcon />} iconPosition="start" label="Stages" />
                    <Tab icon={<TerminalIcon />} iconPosition="start" label="Raw Output" />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {activeTab === 0 ? (
                    /* Stages View */
                    <Box sx={{ 
                        flex: 1, 
                        overflow: 'auto',
                        ...scrollableStyles
                    }}>
                        {stages.length === 0 ? (
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                height: '100%',
                                color: colors.text.muted
                            }}>
                                <HourglassEmptyIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                                <Typography>No stages detected yet</Typography>
                                <Typography sx={{ fontSize: '0.85rem', mt: 1 }}>
                                    Stages will appear as the build progresses
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {stages.map((stage, index) => (
                                    <Box 
                                        key={index}
                                        sx={{
                                            p: 2,
                                            borderRadius: 2,
                                            bgcolor: 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${stage.status === 'running' ? colors.primary : 'rgba(255,255,255,0.1)'}`,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            {getStatusIcon(stage.status)}
                                            <Box sx={{ flex: 1 }}>
                                                <Typography sx={{ 
                                                    color: colors.text.primary, 
                                                    fontWeight: 500,
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {stage.name || `Stage ${index + 1}`}
                                                </Typography>
                                                {stage.description && (
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                                                        {stage.description}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Typography sx={{ 
                                                color: colors.text.muted, 
                                                fontSize: '0.85rem',
                                                fontFamily: 'monospace'
                                            }}>
                                                {formatDuration(stage.duration_ms)}
                                            </Typography>
                                        </Box>
                                        {stage.output && (
                                            <Box sx={{ 
                                                mt: 2, 
                                                p: 1.5, 
                                                bgcolor: 'rgba(0,0,0,0.3)', 
                                                borderRadius: 1,
                                                fontFamily: 'monospace',
                                                fontSize: '0.8rem',
                                                color: colors.text.muted,
                                                whiteSpace: 'pre-wrap',
                                                maxHeight: 200,
                                                overflow: 'auto'
                                            }}>
                                                {stage.output}
                                            </Box>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Box>
                ) : (
                    /* Raw Output View */
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, gap: 1 }}>
                            <Button
                                size="small"
                                onClick={() => setAutoScroll(!autoScroll)}
                                sx={{ 
                                    color: autoScroll ? colors.primary : colors.text.muted,
                                    fontSize: '0.75rem'
                                }}
                            >
                                Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
                            </Button>
                            <IconButton 
                                size="small" 
                                onClick={loadExecution}
                                sx={{ color: colors.text.muted }}
                            >
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        <Box 
                            ref={outputRef}
                            sx={{ 
                                flex: 1,
                                bgcolor: '#0a0a0f',
                                borderRadius: 2,
                                p: 2,
                                overflow: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.85rem',
                                lineHeight: 1.6,
                                color: '#22c55e',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            {output || (isRunning ? 'Waiting for output...' : 'No output available')}
                            {isRunning && (
                                <Box component="span" sx={{ 
                                    display: 'inline-block',
                                    width: 8,
                                    height: 16,
                                    bgcolor: '#22c55e',
                                    ml: 0.5,
                                    animation: 'blink 1s infinite'
                                }} />
                            )}
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Footer Actions */}
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mt: 2,
                pt: 2,
                borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
                <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                    Started: {execution.started_at ? new Date(execution.started_at).toLocaleString() : '-'}
                    {execution.completed_at && ` • Completed: ${new Date(execution.completed_at).toLocaleString()}`}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/build-clients')}
                        sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                        Back to Build Clients
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/history')}
                        sx={{ color: colors.primary, borderColor: colors.primary }}
                    >
                        View History
                    </Button>
                </Box>
            </Box>

            <style>{`
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
            `}</style>
        </Box>
    )
}

const scrollableStyles = {
    '&::-webkit-scrollbar': { width: 8 },
    '&::-webkit-scrollbar-track': { background: 'rgba(255,255,255,0.05)', borderRadius: 4 },
    '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.2)', borderRadius: 4 },
    '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.3)' }
}

export default BuildOutput
