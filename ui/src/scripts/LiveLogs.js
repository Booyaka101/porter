import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import PauseIcon from '@mui/icons-material/Pause'
import RefreshIcon from '@mui/icons-material/Refresh'

const LiveLogs = () => {
    const [machines, setMachines] = useState([])
    const [selectedMachine, setSelectedMachine] = useState('')
    const [logType, setLogType] = useState('journalctl')
    const [target, setTarget] = useState('')
    const [lines, setLines] = useState(50)
    const [filters, setFilters] = useState('')
    const [useSudo, setUseSudo] = useState(false)
    const [logs, setLogs] = useState([])
    const [isStreaming, setIsStreaming] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [error, setError] = useState(null)
    const eventSourceRef = useRef(null)
    const logsEndRef = useRef(null)
    const pausedLogsRef = useRef([])

    // Load machines on mount
    useEffect(() => {
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => setMachines(data || []))
            .catch(err => console.error('Failed to load machines:', err))
    }, [])

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (!isPaused && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, isPaused])

    // Cleanup on unmount and page unload/refresh
    useEffect(() => {
        const cleanup = () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }
        }

        // Handle page refresh/close - this ensures the backend stream is stopped
        const handleBeforeUnload = () => {
            cleanup()
            // Send a beacon to stop the stream on the server
            if (selectedMachine && isStreaming) {
                navigator.sendBeacon(`/api/logs/stop/${selectedMachine}`)
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            cleanup()
        }
    }, [selectedMachine, isStreaming])

    const startStreaming = () => {
        if (!selectedMachine) {
            setError('Please select a machine')
            return
        }

        setError(null)
        setLogs([])
        setIsStreaming(true)
        setIsPaused(false)

        // Build URL with query params
        const params = new URLSearchParams({
            type: logType,
            lines: lines.toString(),
        })
        if (target) params.set('target', target)
        if (filters) params.set('filters', filters)
        if (useSudo) params.set('sudo', 'true')

        const url = `/api/logs/live/${selectedMachine}?${params.toString()}`
        
        const eventSource = new EventSource(url)
        eventSourceRef.current = eventSource

        eventSource.addEventListener('connected', (e) => {
            const data = JSON.parse(e.data)
            setLogs(prev => [...prev, { 
                type: 'system', 
                line: `Connected to ${data.type} stream for ${data.target || 'all'}`,
                timestamp: new Date().toISOString()
            }])
        })

        eventSource.addEventListener('log', (e) => {
            const data = JSON.parse(e.data)
            const logEntry = {
                type: 'log',
                line: data.line,
                source: data.source,
                timestamp: new Date().toISOString()
            }
            
            if (isPaused) {
                pausedLogsRef.current.push(logEntry)
            } else {
                setLogs(prev => [...prev, logEntry])
            }
        })

        eventSource.addEventListener('error', (e) => {
            if (e.data) {
                const data = JSON.parse(e.data)
                setError(data.error)
            }
            setIsStreaming(false)
        })

        eventSource.addEventListener('closed', (e) => {
            const data = JSON.parse(e.data)
            setLogs(prev => [...prev, { 
                type: 'system', 
                line: `Stream closed: ${data.reason}`,
                timestamp: new Date().toISOString()
            }])
            setIsStreaming(false)
        })

        eventSource.onerror = (e) => {
            // Only reset streaming state if the connection is truly closed
            // and it wasn't closed by us (stopStreaming)
            if (eventSource.readyState === EventSource.CLOSED && eventSourceRef.current === eventSource) {
                console.log('SSE connection closed unexpectedly')
                setIsStreaming(false)
                setLogs(prev => [...prev, { 
                    type: 'system', 
                    line: 'Connection lost - stream ended',
                    timestamp: new Date().toISOString()
                }])
            }
        }
    }

    const stopStreaming = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
        setIsStreaming(false)
        setLogs(prev => [...prev, { 
            type: 'system', 
            line: 'Stream stopped by user',
            timestamp: new Date().toISOString()
        }])
    }

    const togglePause = () => {
        if (isPaused) {
            // Resume - add any buffered logs
            setLogs(prev => [...prev, ...pausedLogsRef.current])
            pausedLogsRef.current = []
        }
        setIsPaused(!isPaused)
    }

    const clearLogs = () => {
        setLogs([])
        pausedLogsRef.current = []
    }

    const downloadLogs = () => {
        const content = logs.map(l => `[${l.timestamp}] ${l.line}`).join('\n')
        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs-${selectedMachine}-${new Date().toISOString()}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    const getLogTypeLabel = (type) => {
        switch (type) {
            case 'journalctl': return 'Journalctl (System)'
            case 'journalctl-user': return 'Journalctl (User)'
            case 'tail': return 'Tail File'
            case 'docker': return 'Docker Container'
            case 'compose': return 'Docker Compose'
            default: return type
        }
    }

    const getTargetPlaceholder = () => {
        switch (logType) {
            case 'journalctl':
            case 'journalctl-user':
                return 'Unit name (e.g., nginx, sshd) - leave empty for all'
            case 'tail':
                return 'File path (e.g., /var/log/syslog)'
            case 'docker':
                return 'Container name or ID'
            case 'compose':
                return 'Compose file path:service (e.g., /app/docker-compose.yml:web)'
            default:
                return 'Target'
        }
    }

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
                Live Logs
            </Typography>

            {/* Controls */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {/* Machine Select */}
                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Machine</InputLabel>
                        <Select
                            value={selectedMachine}
                            onChange={(e) => setSelectedMachine(e.target.value)}
                            label="Machine"
                            disabled={isStreaming}
                        >
                            {machines.map(m => (
                                <MenuItem key={m.id} value={m.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            bgcolor: m.status === 'online' ? '#22c55e' : '#ff3366'
                                        }} />
                                        {m.name} ({m.ip})
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Log Type Select */}
                    <FormControl sx={{ minWidth: 180 }}>
                        <InputLabel>Log Type</InputLabel>
                        <Select
                            value={logType}
                            onChange={(e) => setLogType(e.target.value)}
                            label="Log Type"
                            disabled={isStreaming}
                        >
                            <MenuItem value="journalctl">Journalctl (System)</MenuItem>
                            <MenuItem value="journalctl-user">Journalctl (User)</MenuItem>
                            <MenuItem value="tail">Tail File</MenuItem>
                            <MenuItem value="docker">Docker Container</MenuItem>
                            <MenuItem value="compose">Docker Compose</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Target Input */}
                    <TextField
                        label="Target"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder={getTargetPlaceholder()}
                        disabled={isStreaming}
                        sx={{ minWidth: 300, flex: 1 }}
                    />

                    {/* Lines */}
                    <TextField
                        label="Initial Lines"
                        type="number"
                        value={lines}
                        onChange={(e) => setLines(parseInt(e.target.value) || 50)}
                        disabled={isStreaming}
                        sx={{ width: 120 }}
                    />
                </Box>

                {/* Additional Options */}
                {(logType === 'journalctl' || logType === 'journalctl-user') && (
                    <Box sx={{ mt: 2 }}>
                        <TextField
                            label="Filters"
                            value={filters}
                            onChange={(e) => setFilters(e.target.value)}
                            placeholder="e.g., --priority=err --grep=error"
                            disabled={isStreaming}
                            fullWidth
                            size="small"
                        />
                    </Box>
                )}

                {logType === 'tail' && (
                    <Box sx={{ mt: 2 }}>
                        <Chip
                            label="Use Sudo"
                            onClick={() => setUseSudo(!useSudo)}
                            color={useSudo ? 'primary' : 'default'}
                            variant={useSudo ? 'filled' : 'outlined'}
                            disabled={isStreaming}
                        />
                    </Box>
                )}

                {/* Action Buttons */}
                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    {!isStreaming ? (
                        <Button
                            variant="contained"
                            startIcon={<PlayArrowIcon />}
                            onClick={startStreaming}
                            disabled={!selectedMachine}
                        >
                            Start Streaming
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<StopIcon />}
                                onClick={stopStreaming}
                            >
                                Stop
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                                onClick={togglePause}
                            >
                                {isPaused ? 'Resume' : 'Pause'}
                            </Button>
                        </>
                    )}
                    <Button
                        variant="outlined"
                        startIcon={<DeleteIcon />}
                        onClick={clearLogs}
                        disabled={logs.length === 0}
                    >
                        Clear
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={downloadLogs}
                        disabled={logs.length === 0}
                    >
                        Download
                    </Button>
                </Box>

                {error && (
                    <Typography color="error" sx={{ mt: 2 }}>
                        {error}
                    </Typography>
                )}
            </Paper>

            {/* Status Bar */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                mb: 2,
                px: 1
            }}>
                {isStreaming && (
                    <Chip
                        icon={<CircularProgress size={14} />}
                        label={isPaused ? 'Paused' : 'Streaming'}
                        color={isPaused ? 'warning' : 'success'}
                        size="small"
                    />
                )}
                <Typography variant="body2" color="text.secondary">
                    {logs.length} lines
                </Typography>
                {isPaused && pausedLogsRef.current.length > 0 && (
                    <Typography variant="body2" color="warning.main">
                        ({pausedLogsRef.current.length} buffered)
                    </Typography>
                )}
            </Box>

            {/* Log Output */}
            <Paper sx={{ 
                p: 0, 
                bgcolor: '#0d1117',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                borderRadius: 2,
                overflow: 'hidden'
            }}>
                <Box sx={{
                    height: 500,
                    overflow: 'auto',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '0.8rem',
                    p: 2,
                }}>
                    {logs.length === 0 ? (
                        <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No logs yet. Select a machine and click "Start Streaming" to begin.
                        </Typography>
                    ) : (
                        logs.map((log, index) => (
                            <Box 
                                key={index}
                                sx={{
                                    py: 0.3,
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    color: log.type === 'system' ? '#f97316' : 
                                           log.source?.includes('stderr') ? '#ff6b6b' : '#e0f7ff',
                                    '&:hover': {
                                        bgcolor: 'rgba(255,255,255,0.02)'
                                    }
                                }}
                            >
                                <Typography 
                                    component="span" 
                                    sx={{ 
                                        color: 'rgba(255,255,255,0.3)', 
                                        fontSize: '0.7rem',
                                        mr: 1 
                                    }}
                                >
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </Typography>
                                {log.line}
                            </Box>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </Box>
            </Paper>
        </Box>
    )
}

export default LiveLogs
