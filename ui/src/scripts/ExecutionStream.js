import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { colors } from './theme'
import StageView from './StageView'

// Real-time execution output streaming component
const ExecutionStream = ({ execId, machineName, machineId, onComplete, useStageView = true }) => {
    const [events, setEvents] = useState([])
    const [status, setStatus] = useState('connecting') // connecting, running, complete, error
    const [expanded, setExpanded] = useState(true)
    const [copied, setCopied] = useState(false)
    const outputRef = useRef(null)
    const eventSourceRef = useRef(null)

    useEffect(() => {
        if (!execId) return

        // Connect to SSE stream
        const eventSource = new EventSource(`/api/stream/${execId}`)
        eventSourceRef.current = eventSource

        eventSource.addEventListener('connected', (e) => {
            setStatus('running')
        })

        eventSource.addEventListener('status', (e) => {
            try {
                const data = JSON.parse(e.data)
                setEvents(prev => [...prev, { type: 'status', ...data }])
            } catch (err) {
                console.error('Failed to parse status event:', err)
            }
        })

        eventSource.addEventListener('output', (e) => {
            try {
                const data = JSON.parse(e.data)
                setEvents(prev => [...prev, { type: 'output', ...data }])
            } catch (err) {
                console.error('Failed to parse output event:', err)
            }
        })

        eventSource.addEventListener('error', (e) => {
            try {
                const data = JSON.parse(e.data)
                setEvents(prev => [...prev, { type: 'error', ...data }])
                setStatus('error')
            } catch (err) {
                // SSE connection error
                if (eventSource.readyState === EventSource.CLOSED) {
                    setStatus('error')
                }
            }
        })

        eventSource.addEventListener('complete', (e) => {
            try {
                const data = JSON.parse(e.data)
                setEvents(prev => [...prev, { type: 'complete', ...data }])
                setStatus(data.data?.includes('true') ? 'complete' : 'error')
                onComplete?.(data)
            } catch (err) {
                setStatus('complete')
            }
            eventSource.close()
        })

        eventSource.onerror = () => {
            if (eventSource.readyState === EventSource.CLOSED) {
                setStatus('error')
            }
        }

        return () => {
            eventSource.close()
        }
    }, [execId, onComplete])

    // Auto-scroll to bottom
    useEffect(() => {
        if (outputRef.current && expanded) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [events, expanded])

    const getStatusIcon = () => {
        switch (status) {
            case 'complete':
                return <CheckCircleIcon sx={{ color: colors.secondary }} />
            case 'error':
                return <ErrorIcon sx={{ color: colors.error }} />
            default:
                return <HourglassEmptyIcon sx={{ color: colors.warning, animation: 'spin 1s linear infinite', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />
        }
    }

    const getStatusColor = () => {
        switch (status) {
            case 'complete': return colors.secondary
            case 'error': return colors.error
            default: return colors.warning
        }
    }

    const copyOutput = () => {
        const output = events
            .filter(e => e.type === 'output' || e.type === 'status')
            .map(e => e.data)
            .join('\n')
        navigator.clipboard.writeText(output)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const formatTimestamp = (ts) => {
        if (!ts) return ''
        return new Date(ts).toLocaleTimeString()
    }

    // Use StageView for scripts that output PLAY/TASK markers
    if (useStageView) {
        return (
            <StageView 
                events={events} 
                status={status} 
                machineName={machineName} 
            />
        )
    }

    return (
        <Box sx={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            border: `1px solid ${getStatusColor()}33`,
            overflow: 'hidden',
        }}>
            {/* Header */}
            <Box 
                onClick={() => setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    cursor: 'pointer',
                    background: `${getStatusColor()}10`,
                    borderBottom: expanded ? `1px solid ${colors.border.light}` : 'none',
                }}
            >
                {getStatusIcon()}
                <Box sx={{ flex: 1 }}>
                    <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>
                        {machineName}
                    </Typography>
                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                        {status === 'connecting' && 'Connecting...'}
                        {status === 'running' && 'Running...'}
                        {status === 'complete' && 'Completed successfully'}
                        {status === 'error' && 'Failed'}
                    </Typography>
                </Box>
                <Chip 
                    label={status}
                    size="small"
                    sx={{
                        background: `${getStatusColor()}20`,
                        color: getStatusColor(),
                        textTransform: 'capitalize',
                    }}
                />
                <Tooltip title="Copy output">
                    <IconButton 
                        size="small" 
                        onClick={(e) => { e.stopPropagation(); copyOutput(); }}
                        sx={{ color: copied ? colors.secondary : colors.text.disabled }}
                    >
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <IconButton size="small" sx={{ color: colors.text.disabled }}>
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
            </Box>

            {/* Progress bar for running state */}
            {status === 'running' && (
                <LinearProgress 
                    sx={{
                        height: 2,
                        background: 'rgba(0,0,0,0.2)',
                        '& .MuiLinearProgress-bar': {
                            background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                        }
                    }}
                />
            )}

            {/* Output */}
            {expanded && (
                <Box 
                    ref={outputRef}
                    sx={{
                        maxHeight: '60vh',
                        minHeight: 200,
                        overflow: 'auto',
                        p: 2,
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        background: 'rgba(0, 0, 0, 0.4)',
                    }}
                >
                    {events.length === 0 ? (
                        <Typography sx={{ color: colors.text.disabled, fontStyle: 'italic' }}>
                            Waiting for output...
                        </Typography>
                    ) : (
                        events.map((event, idx) => (
                            <Box 
                                key={idx}
                                sx={{
                                    display: 'flex',
                                    gap: 1,
                                    mb: 0.5,
                                    color: event.type === 'error' ? colors.error : 
                                           event.type === 'status' ? colors.primary : 
                                           colors.text.secondary,
                                }}
                            >
                                <Typography 
                                    component="span" 
                                    sx={{ 
                                        color: colors.text.disabled, 
                                        fontSize: '0.75rem',
                                        minWidth: 85,
                                        flexShrink: 0,
                                        opacity: 0.7,
                                    }}
                                >
                                    {formatTimestamp(event.timestamp)}
                                </Typography>
                                <Typography 
                                    component="span"
                                    sx={{ 
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {event.data}
                                </Typography>
                            </Box>
                        ))
                    )}
                </Box>
            )}
        </Box>
    )
}

// Multi-machine execution stream container
export const ExecutionStreamContainer = ({ executions, onAllComplete }) => {
    const [completedCount, setCompletedCount] = useState(0)
    const totalCount = executions?.length || 0

    const handleComplete = () => {
        setCompletedCount(prev => {
            const newCount = prev + 1
            if (newCount >= totalCount) {
                onAllComplete?.()
            }
            return newCount
        })
    }

    if (!executions || executions.length === 0) {
        return null
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Progress summary */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                p: 2,
                background: colors.background.glass,
                borderRadius: '12px',
                border: `1px solid ${colors.border.light}`,
            }}>
                <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>
                    Execution Progress
                </Typography>
                <Box sx={{ flex: 1 }}>
                    <LinearProgress 
                        variant="determinate"
                        value={(completedCount / totalCount) * 100}
                        sx={{
                            height: 8,
                            borderRadius: 4,
                            background: 'rgba(255,255,255,0.1)',
                            '& .MuiLinearProgress-bar': {
                                background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                                borderRadius: 4,
                            }
                        }}
                    />
                </Box>
                <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem' }}>
                    {completedCount} / {totalCount}
                </Typography>
            </Box>

            {/* Individual streams */}
            {executions.map((exec) => (
                <ExecutionStream
                    key={exec.machineId}
                    execId={exec.execId}
                    machineName={exec.machineName}
                    machineId={exec.machineId}
                    onComplete={handleComplete}
                />
            ))}
        </Box>
    )
}

export default ExecutionStream
