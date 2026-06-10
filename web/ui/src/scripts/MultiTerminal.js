import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import TerminalIcon from '@mui/icons-material/Terminal'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewStreamIcon from '@mui/icons-material/ViewStream'
import SendIcon from '@mui/icons-material/Send'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import Chip from '@mui/material/Chip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'

// Built-in command snippets
const BUILTIN_SNIPPETS = [
    { name: 'System Info', cmd: 'uname -a && cat /etc/os-release', category: 'System' },
    { name: 'Disk Usage', cmd: 'df -h', category: 'System' },
    { name: 'Memory Usage', cmd: 'free -h', category: 'System' },
    { name: 'CPU Info', cmd: 'lscpu | head -20', category: 'System' },
    { name: 'Top Processes', cmd: 'ps aux --sort=-%mem | head -10', category: 'Processes' },
    { name: 'Network Interfaces', cmd: 'ip addr', category: 'Network' },
    { name: 'Open Ports', cmd: 'ss -tulpn', category: 'Network' },
    { name: 'Docker Containers', cmd: 'docker ps -a', category: 'Docker' },
    { name: 'Docker Images', cmd: 'docker images', category: 'Docker' },
    { name: 'Service Status', cmd: 'systemctl list-units --type=service --state=running', category: 'Services' },
    { name: 'Recent Logs', cmd: 'journalctl -n 50 --no-pager', category: 'Logs' },
    { name: 'Uptime', cmd: 'uptime', category: 'System' },
]

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

import { colors } from './theme'

const TerminalPane = ({ machine, onClose, broadcastCommand, broadcastId }) => {
    const terminalRef = useRef(null)
    const terminalInstance = useRef(null)
    const fitAddon = useRef(null)
    const wsRef = useRef(null)
    const [connected, setConnected] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const lastBroadcastIdRef = useRef(0)

    // Handle broadcast commands
    useEffect(() => {
        if (broadcastId && broadcastId !== lastBroadcastIdRef.current && broadcastCommand) {
            lastBroadcastIdRef.current = broadcastId
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(broadcastCommand + '\n')
            }
        }
    }, [broadcastCommand, broadcastId])

    const connectTerminal = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close()
        }

        setConnecting(true)
        setConnected(false)

        if (terminalInstance.current) {
            terminalInstance.current.clear()
            terminalInstance.current.write('\x1b[33mConnecting to ' + machine.ip + '...\x1b[0m\r\n')
        }

        const cols = terminalInstance.current?.cols || 80
        const rows = terminalInstance.current?.rows || 24

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/machines/${machine.id}/terminal/ws?shell=fish&cols=${cols}&rows=${rows}`
        
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        ws.binaryType = 'arraybuffer'

        ws.onopen = () => {
            setConnecting(false)
            setConnected(true)
            if (terminalInstance.current) {
                terminalInstance.current.clear()
            }
        }

        ws.onmessage = (event) => {
            if (terminalInstance.current) {
                if (event.data instanceof ArrayBuffer) {
                    const text = new TextDecoder().decode(event.data)
                    terminalInstance.current.write(text)
                } else {
                    terminalInstance.current.write(event.data)
                }
            }
        }

        ws.onerror = () => {
            setConnecting(false)
            setConnected(false)
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n\x1b[31mConnection error\x1b[0m\r\n')
            }
        }

        ws.onclose = () => {
            setConnecting(false)
            setConnected(false)
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n\x1b[33mConnection closed\x1b[0m\r\n')
            }
        }
    }, [machine])

    useEffect(() => {
        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'block',
            fontSize: 12,
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, monospace',
            theme: {
                background: '#0d0d0d',
                foreground: '#e4e4e7',
                cursor: '#f97316',
                cursorAccent: '#0d0d0d',
                selectionBackground: 'rgba(249, 115, 22, 0.3)',
                black: '#18181b',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#e4e4e7',
            },
            allowTransparency: true,
            scrollback: 5000,
        })

        fitAddon.current = new FitAddon()
        term.loadAddon(fitAddon.current)

        if (terminalRef.current) {
            term.open(terminalRef.current)
            fitAddon.current.fit()
        }

        terminalInstance.current = term

        term.onData((data) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(data)
            }
        })

        connectTerminal()

        const handleResize = () => {
            if (fitAddon.current) {
                fitAddon.current.fit()
            }
        }

        window.addEventListener('resize', handleResize)
        const resizeObserver = new ResizeObserver(handleResize)
        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current)
        }

        return () => {
            window.removeEventListener('resize', handleResize)
            resizeObserver.disconnect()
            if (wsRef.current) {
                wsRef.current.close()
            }
            term.dispose()
        }
    }, [connectTerminal])

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            height: '100%',
            border: `1px solid ${colors.border.light}`,
            borderRadius: 1,
            overflow: 'hidden',
            background: '#0d0d0d'
        }}>
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                px: 1.5,
                py: 0.5,
                background: 'rgba(255,255,255,0.03)',
                borderBottom: `1px solid ${colors.border.light}`
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        background: connected ? colors.secondary : connecting ? colors.primary : colors.error 
                    }} />
                    <Typography sx={{ color: colors.text.primary, fontSize: '0.8rem', fontWeight: 600 }}>
                        {machine.name}
                    </Typography>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>
                        {machine.ip}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Reconnect">
                        <IconButton size="small" onClick={connectTerminal} sx={{ color: colors.text.muted, p: 0.5 }}>
                            <RefreshIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Close">
                        <IconButton size="small" onClick={() => onClose(machine.id)} sx={{ color: colors.text.muted, p: 0.5 }}>
                            <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
            <Box 
                ref={terminalRef} 
                sx={{ 
                    flex: 1,
                    '& .xterm': { height: '100%', padding: '4px' },
                    '& .xterm-viewport': { overflow: 'hidden !important' }
                }} 
            />
        </Box>
    )
}

const MultiTerminal = () => {
    const [machines, setMachines] = useState([])
    const [selectedMachines, setSelectedMachines] = useState([])
    const [activeSessions, setActiveSessions] = useState([])
    const [error, setError] = useState(null)
    const [gridView, setGridView] = useState(true)
    const [broadcastCmd, setBroadcastCmd] = useState('')
    const [lastBroadcast, setLastBroadcast] = useState({ cmd: '', id: 0 })
    const [customSnippets, setCustomSnippets] = useState([])
    const [snippetMenuAnchor, setSnippetMenuAnchor] = useState(null)
    const [showSnippets, setShowSnippets] = useState(true)

    // Load custom snippets from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('terminalSnippets')
        if (saved) {
            try {
                setCustomSnippets(JSON.parse(saved))
            } catch (e) {}
        }
    }, [])

    // Save custom snippet
    const saveCurrentAsSnippet = () => {
        if (!broadcastCmd.trim()) return
        const name = prompt('Enter snippet name:')
        if (!name) return
        const newSnippets = [...customSnippets, { name, cmd: broadcastCmd, category: 'Custom' }]
        setCustomSnippets(newSnippets)
        localStorage.setItem('terminalSnippets', JSON.stringify(newSnippets))
    }

    // Delete custom snippet
    const deleteSnippet = (index) => {
        const newSnippets = customSnippets.filter((_, i) => i !== index)
        setCustomSnippets(newSnippets)
        localStorage.setItem('terminalSnippets', JSON.stringify(newSnippets))
    }

    // Use snippet
    const useSnippet = (cmd) => {
        setBroadcastCmd(cmd)
        setSnippetMenuAnchor(null)
    }

    // All snippets combined
    const allSnippets = [...BUILTIN_SNIPPETS, ...customSnippets]

    useEffect(() => {
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => setMachines(data || []))
            .catch(err => setError(err.message))
    }, [])

    const toggleMachine = (id) => {
        setSelectedMachines(prev => 
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        )
    }

    const selectAll = () => {
        if (selectedMachines.length === machines.length) {
            setSelectedMachines([])
        } else {
            setSelectedMachines(machines.map(m => m.id))
        }
    }

    const startSessions = () => {
        const newSessions = selectedMachines
            .filter(id => !activeSessions.includes(id))
        setActiveSessions([...activeSessions, ...newSessions])
    }

    const closeSession = (machineId) => {
        setActiveSessions(prev => prev.filter(id => id !== machineId))
    }

    const closeAllSessions = () => {
        setActiveSessions([])
    }

    const getGridColumns = () => {
        const count = activeSessions.length
        if (count <= 1) return 1
        if (count <= 2) return 2
        if (count <= 4) return 2
        if (count <= 6) return 3
        return 4
    }

    const sendBroadcast = () => {
        if (broadcastCmd.trim() && activeSessions.length > 0) {
            setLastBroadcast({ cmd: broadcastCmd, id: Date.now() })
            setBroadcastCmd('')
        }
    }

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ color: colors.text.primary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TerminalIcon sx={{ color: colors.primary }} />
                    Multi-Machine Terminal
                </Typography>
                {activeSessions.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title={gridView ? "List View" : "Grid View"}>
                            <IconButton onClick={() => setGridView(!gridView)} sx={{ color: colors.text.muted }}>
                                {gridView ? <ViewStreamIcon /> : <GridViewIcon />}
                            </IconButton>
                        </Tooltip>
                        <Button size="small" color="error" onClick={closeAllSessions}>
                            Close All
                        </Button>
                    </Box>
                )}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
                {/* Machine Selection Sidebar */}
                <Paper sx={{ 
                    background: colors.background.card, 
                    border: `1px solid ${colors.border.light}`,
                    p: 2,
                    width: 220,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.9rem' }}>
                            Machines
                        </Typography>
                        <Button size="small" onClick={selectAll} sx={{ fontSize: '0.7rem', minWidth: 0, p: 0.5 }}>
                            {selectedMachines.length === machines.length ? 'None' : 'All'}
                        </Button>
                    </Box>

                    <Box sx={{ flex: 1, overflow: 'auto', mb: 1 }}>
                        {machines.map(machine => (
                            <FormControlLabel
                                key={machine.id}
                                control={
                                    <Checkbox 
                                        checked={selectedMachines.includes(machine.id)}
                                        onChange={() => toggleMachine(machine.id)}
                                        size="small"
                                        sx={{ p: 0.5 }}
                                    />
                                }
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box sx={{ 
                                            width: 6, 
                                            height: 6, 
                                            borderRadius: '50%', 
                                            background: activeSessions.includes(machine.id) ? colors.secondary : colors.text.disabled 
                                        }} />
                                        <Typography sx={{ color: colors.text.primary, fontSize: '0.8rem' }}>
                                            {machine.name}
                                        </Typography>
                                    </Box>
                                }
                                sx={{ display: 'flex', mb: 0.5, ml: 0 }}
                            />
                        ))}
                    </Box>

                    <Button
                        variant="contained"
                        onClick={startSessions}
                        disabled={selectedMachines.length === 0}
                        fullWidth
                        size="small"
                        sx={{ background: colors.primary }}
                    >
                        Connect ({selectedMachines.filter(id => !activeSessions.includes(id)).length})
                    </Button>
                </Paper>

                {/* Terminal Grid */}
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {activeSessions.length === 0 ? (
                        <Box sx={{ 
                            height: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: `1px dashed ${colors.border.light}`,
                            borderRadius: 1
                        }}>
                            <Typography sx={{ color: colors.text.muted }}>
                                Select machines and click Connect to start terminal sessions
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {/* Broadcast Command Input */}
                            <Paper sx={{ 
                                display: 'flex', 
                                gap: 1, 
                                p: 1, 
                                mb: 1,
                                background: '#0d0d0d',
                                border: `1px solid ${colors.border.light}`,
                                borderRadius: 1
                            }}>
                                <Tooltip title="Command Snippets">
                                    <IconButton 
                                        onClick={(e) => setSnippetMenuAnchor(e.currentTarget)}
                                        sx={{ color: '#8b5cf6' }}
                                    >
                                        <BookmarkIcon />
                                    </IconButton>
                                </Tooltip>
                                <Menu
                                    anchorEl={snippetMenuAnchor}
                                    open={Boolean(snippetMenuAnchor)}
                                    onClose={() => setSnippetMenuAnchor(null)}
                                    PaperProps={{
                                        sx: {
                                            background: 'rgba(17, 24, 39, 0.98)',
                                            backdropFilter: 'blur(20px)',
                                            border: `1px solid ${colors.border.light}`,
                                            borderRadius: '12px',
                                            maxHeight: 400,
                                            minWidth: 280,
                                        }
                                    }}
                                >
                                    <Typography sx={{ px: 2, py: 1, color: '#8b5cf6', fontWeight: 600, fontSize: '0.85rem' }}>
                                        📋 Command Snippets
                                    </Typography>
                                    <Divider sx={{ borderColor: colors.border.light }} />
                                    {['System', 'Processes', 'Network', 'Docker', 'Services', 'Logs'].map(category => {
                                        const categorySnippets = BUILTIN_SNIPPETS.filter(s => s.category === category)
                                        if (categorySnippets.length === 0) return null
                                        return [
                                            <Typography key={`cat-${category}`} sx={{ px: 2, py: 0.5, color: colors.text.muted, fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                {category}
                                            </Typography>,
                                            ...categorySnippets.map((snippet, i) => (
                                                <MenuItem 
                                                    key={`${category}-${i}`}
                                                    onClick={() => useSnippet(snippet.cmd)}
                                                    sx={{ py: 0.5 }}
                                                >
                                                    <ListItemText 
                                                        primary={snippet.name}
                                                        secondary={snippet.cmd.length > 35 ? snippet.cmd.substring(0, 35) + '...' : snippet.cmd}
                                                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                                                        secondaryTypographyProps={{ fontSize: '0.7rem', fontFamily: 'monospace', color: colors.text.disabled }}
                                                    />
                                                </MenuItem>
                                            ))
                                        ]
                                    })}
                                    {customSnippets.length > 0 && (
                                        <>
                                            <Divider sx={{ borderColor: colors.border.light, my: 1 }} />
                                            <Typography sx={{ px: 2, py: 0.5, color: colors.warning, fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                Custom
                                            </Typography>
                                            {customSnippets.map((snippet, i) => (
                                                <MenuItem 
                                                    key={`custom-${i}`}
                                                    sx={{ py: 0.5, display: 'flex', justifyContent: 'space-between' }}
                                                >
                                                    <ListItemText 
                                                        onClick={() => useSnippet(snippet.cmd)}
                                                        primary={snippet.name}
                                                        secondary={snippet.cmd.length > 30 ? snippet.cmd.substring(0, 30) + '...' : snippet.cmd}
                                                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                                                        secondaryTypographyProps={{ fontSize: '0.7rem', fontFamily: 'monospace', color: colors.text.disabled }}
                                                    />
                                                    <IconButton size="small" onClick={() => deleteSnippet(i)} sx={{ color: colors.error, ml: 1 }}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </MenuItem>
                                            ))}
                                        </>
                                    )}
                                </Menu>
                                <TextField
                                    value={broadcastCmd}
                                    onChange={(e) => setBroadcastCmd(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendBroadcast()}
                                    placeholder="Type command to send to all terminals..."
                                    size="small"
                                    fullWidth
                                    sx={{ 
                                        '& .MuiOutlinedInput-root': { 
                                            background: 'rgba(255,255,255,0.03)',
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem'
                                        }
                                    }}
                                />
                                <Tooltip title="Save as snippet">
                                    <IconButton 
                                        onClick={saveCurrentAsSnippet}
                                        disabled={!broadcastCmd.trim()}
                                        sx={{ color: broadcastCmd.trim() ? colors.warning : colors.text.disabled }}
                                    >
                                        <AddIcon />
                                    </IconButton>
                                </Tooltip>
                                <Button
                                    variant="contained"
                                    onClick={sendBroadcast}
                                    disabled={!broadcastCmd.trim()}
                                    sx={{ background: colors.primary, minWidth: 100 }}
                                    startIcon={<SendIcon />}
                                >
                                    Send All
                                </Button>
                            </Paper>

                            {/* Terminal Grid */}
                            <Box sx={{ 
                                display: 'grid',
                                gridTemplateColumns: gridView ? `repeat(${getGridColumns()}, 1fr)` : '1fr',
                                gap: 1,
                                flex: 1,
                                overflow: 'auto'
                            }}>
                                {activeSessions.map(machineId => {
                                    const machine = machines.find(m => m.id === machineId)
                                    if (!machine) return null
                                    return (
                                        <Box 
                                            key={machineId} 
                                            sx={{ 
                                                minHeight: gridView ? 250 : 300,
                                                height: gridView ? '100%' : 'auto'
                                            }}
                                        >
                                            <TerminalPane 
                                                machine={machine} 
                                                onClose={closeSession}
                                                broadcastCommand={lastBroadcast.cmd}
                                                broadcastId={lastBroadcast.id}
                                            />
                                        </Box>
                                    )
                                })}
                            </Box>
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    )
}

export default MultiTerminal
