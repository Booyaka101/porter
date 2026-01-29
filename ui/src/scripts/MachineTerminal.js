import { useState, useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import SendIcon from '@mui/icons-material/Send'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

const MachineTerminal = ({ machine, machineId }) => {
    const [command, setCommand] = useState('')
    const [history, setHistory] = useState([])
    const [running, setRunning] = useState(false)
    const [historyIndex, setHistoryIndex] = useState(-1)
    const [commandHistory, setCommandHistory] = useState([])
    const outputEndRef = useRef(null)
    const inputRef = useRef(null)
    const abortControllerRef = useRef(null)
    const isMountedRef = useRef(true)

    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [])

    useEffect(() => {
        if (outputEndRef.current) {
            outputEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [history])

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const executeCommand = useCallback(async () => {
        if (!command.trim() || running) return

        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        const cmd = command.trim()
        setCommand('')
        setRunning(true)
        setHistoryIndex(-1)
        setCommandHistory(prev => [cmd, ...prev.slice(0, 49)])

        setHistory(prev => [...prev, { type: 'command', content: cmd, timestamp: new Date() }])

        try {
            const res = await fetch(`/api/machines/${machineId}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd }),
                signal: abortControllerRef.current.signal
            })
            const data = await res.json()

            if (isMountedRef.current) {
                if (data.output) {
                    setHistory(prev => [...prev, { type: 'output', content: data.output, timestamp: new Date() }])
                }
                if (data.error) {
                    setHistory(prev => [...prev, { type: 'error', content: data.error, timestamp: new Date() }])
                }
                if (data.exitCode !== undefined && data.exitCode !== 0) {
                    setHistory(prev => [...prev, { type: 'info', content: `Exit code: ${data.exitCode}`, timestamp: new Date() }])
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError' && isMountedRef.current) {
                setHistory(prev => [...prev, { type: 'error', content: `Failed to execute: ${err.message}`, timestamp: new Date() }])
            }
        } finally {
            if (isMountedRef.current) {
                setRunning(false)
                inputRef.current?.focus()
            }
        }
    }, [command, running, machineId])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            executeCommand()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (commandHistory.length > 0) {
                const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
                setHistoryIndex(newIndex)
                setCommand(commandHistory[newIndex])
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1
                setHistoryIndex(newIndex)
                setCommand(commandHistory[newIndex])
            } else if (historyIndex === 0) {
                setHistoryIndex(-1)
                setCommand('')
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault()
            setHistory([])
        }
    }

    const clearHistory = () => setHistory([])

    const copyOutput = () => {
        const text = history
            .map(h => h.type === 'command' ? `$ ${h.content}` : h.content)
            .join('\n')
        navigator.clipboard.writeText(text)
    }

    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Terminal</Typography>
                <Chip 
                    label={`${machine.username}@${machine.ip}`} 
                    size="small" 
                    sx={{ fontFamily: 'monospace', bgcolor: 'rgba(0,212,255,0.1)' }} 
                />
                <Box sx={{ flex: 1 }} />
                <IconButton size="small" onClick={copyOutput} disabled={history.length === 0}>
                    <ContentCopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" onClick={clearHistory} disabled={history.length === 0}>
                    <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>

            <Paper sx={{ 
                flex: 1, 
                bgcolor: '#0d1117', 
                border: '1px solid rgba(249, 115, 22, 0.2)', 
                borderRadius: 2, 
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Box sx={{ 
                    flex: 1, 
                    overflow: 'auto', 
                    p: 2,
                    fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
                    fontSize: '0.85rem',
                    lineHeight: 1.6
                }}>
                    {history.length === 0 ? (
                        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                            Type a command and press Enter to execute. Use ↑/↓ for history, Ctrl+L to clear.
                        </Typography>
                    ) : (
                        history.map((item, index) => (
                            <Box key={index} sx={{ mb: 1 }}>
                                {item.type === 'command' && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography component="span" sx={{ color: '#22c55e', fontWeight: 600 }}>$</Typography>
                                        <Typography component="span" sx={{ color: '#fff' }}>{item.content}</Typography>
                                    </Box>
                                )}
                                {item.type === 'output' && (
                                    <Typography component="pre" sx={{ 
                                        color: '#e0f7ff', 
                                        whiteSpace: 'pre-wrap', 
                                        wordBreak: 'break-all',
                                        m: 0,
                                        pl: 2
                                    }}>
                                        {item.content}
                                    </Typography>
                                )}
                                {item.type === 'error' && (
                                    <Typography component="pre" sx={{ 
                                        color: '#ff6b6b', 
                                        whiteSpace: 'pre-wrap', 
                                        wordBreak: 'break-all',
                                        m: 0,
                                        pl: 2
                                    }}>
                                        {item.content}
                                    </Typography>
                                )}
                                {item.type === 'info' && (
                                    <Typography sx={{ color: '#ffaa00', pl: 2, fontSize: '0.8rem' }}>
                                        {item.content}
                                    </Typography>
                                )}
                            </Box>
                        ))
                    )}
                    <div ref={outputEndRef} />
                </Box>

                <Box sx={{ 
                    borderTop: '1px solid rgba(255,255,255,0.1)', 
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: 'rgba(0,0,0,0.3)'
                }}>
                    <Typography sx={{ color: '#22c55e', fontWeight: 600, fontFamily: 'monospace' }}>$</Typography>
                    <TextField
                        inputRef={inputRef}
                        fullWidth
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter command..."
                        disabled={running}
                        variant="standard"
                        InputProps={{
                            disableUnderline: true,
                            sx: {
                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                fontSize: '0.9rem',
                                color: '#fff',
                            }
                        }}
                        sx={{ 
                            '& .MuiInputBase-input::placeholder': { 
                                color: 'rgba(255,255,255,0.3)',
                                opacity: 1
                            }
                        }}
                    />
                    <IconButton 
                        onClick={executeCommand} 
                        disabled={running || !command.trim()}
                        size="small"
                    >
                        {running ? (
                            <CircularProgress size={20} />
                        ) : (
                            <SendIcon sx={{ color: command.trim() ? '#f97316' : 'rgba(255,255,255,0.3)' }} />
                        )}
                    </IconButton>
                </Box>
            </Paper>

            <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    Press Enter to execute • ↑/↓ for history • Ctrl+L to clear
                </Typography>
            </Box>
        </Box>
    )
}

export default MachineTerminal
