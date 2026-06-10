import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import ComputerIcon from '@mui/icons-material/Computer'
import CodeIcon from '@mui/icons-material/Code'
import TerminalIcon from '@mui/icons-material/Terminal'
import FolderIcon from '@mui/icons-material/Folder'
import HistoryIcon from '@mui/icons-material/History'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SettingsIcon from '@mui/icons-material/Settings'
import LayersIcon from '@mui/icons-material/Layers'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import KeyboardIcon from '@mui/icons-material/Keyboard'

const CommandPalette = ({ open, onClose }) => {
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [machines, setMachines] = useState([])
    const [scripts, setScripts] = useState([])
    const [history, setHistory] = useState([])
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Load data when opened
    useEffect(() => {
        if (open) {
            setQuery('')
            setSelectedIndex(0)
            // Load machines
            fetch('/api/machines')
                .then(res => res.json())
                .then(data => setMachines(data || []))
                .catch(() => {})
            // Load scripts
            fetch('/api/scripts')
                .then(res => res.json())
                .then(data => setScripts((data || []).filter(s => s.is_top_level)))
                .catch(() => {})
            // Load recent history
            fetch('/api/history?limit=20')
                .then(res => res.json())
                .then(data => setHistory(data.history || []))
                .catch(() => {})
        }
    }, [open])

    // Build command list
    const commands = useMemo(() => {
        const items = []
        const q = query.toLowerCase()

        // Navigation commands
        const navCommands = [
            { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <DashboardIcon />, action: () => navigate('/'), category: 'Navigation' },
            { id: 'nav-machines', label: 'Go to Machines', icon: <ComputerIcon />, action: () => navigate('/machines'), category: 'Navigation' },
            { id: 'nav-scripts', label: 'Go to Scripts', icon: <CodeIcon />, action: () => navigate('/scripts'), category: 'Navigation' },
            { id: 'nav-history', label: 'Go to History', icon: <HistoryIcon />, action: () => navigate('/history'), category: 'Navigation' },
            { id: 'nav-run', label: 'Run Command', icon: <TerminalIcon />, action: () => navigate('/run'), category: 'Navigation' },
        ]

        // Action commands
        const actionCommands = [
            { id: 'action-add-machine', label: 'Add New Machine', icon: <AddIcon />, action: () => { navigate('/machines'); setTimeout(() => document.querySelector('[data-action="add-machine"]')?.click(), 100) }, category: 'Actions' },
            { id: 'action-refresh', label: 'Refresh Page', icon: <RefreshIcon />, action: () => window.location.reload(), category: 'Actions' },
        ]

        // Filter and add navigation commands
        navCommands.forEach(cmd => {
            if (!q || cmd.label.toLowerCase().includes(q)) {
                items.push(cmd)
            }
        })

        // Filter and add action commands
        actionCommands.forEach(cmd => {
            if (!q || cmd.label.toLowerCase().includes(q)) {
                items.push(cmd)
            }
        })

        // Add machines
        machines.forEach(m => {
            if (!q || m.name.toLowerCase().includes(q) || m.ip.toLowerCase().includes(q)) {
                items.push({
                    id: `machine-${m.id}`,
                    label: m.name,
                    sublabel: m.ip,
                    icon: <ComputerIcon />,
                    action: () => navigate(`/machines/${m.id}`),
                    category: 'Machines',
                    status: m.status
                })
                // Add quick actions for machines
                if (q.includes('terminal') || q.includes('ssh')) {
                    items.push({
                        id: `machine-terminal-${m.id}`,
                        label: `Terminal: ${m.name}`,
                        sublabel: m.ip,
                        icon: <TerminalIcon />,
                        action: () => navigate(`/machines/${m.id}/terminal`),
                        category: 'Quick Actions'
                    })
                }
                if (q.includes('files') || q.includes('browse')) {
                    items.push({
                        id: `machine-files-${m.id}`,
                        label: `Files: ${m.name}`,
                        sublabel: m.ip,
                        icon: <FolderIcon />,
                        action: () => navigate(`/machines/${m.id}/files`),
                        category: 'Quick Actions'
                    })
                }
                if (q.includes('docker') || q.includes('container')) {
                    items.push({
                        id: `machine-docker-${m.id}`,
                        label: `Docker: ${m.name}`,
                        sublabel: m.ip,
                        icon: <LayersIcon />,
                        action: () => navigate(`/machines/${m.id}/docker`),
                        category: 'Quick Actions'
                    })
                }
            }
        })

        // Add scripts
        scripts.forEach(s => {
            if (!q || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)) {
                items.push({
                    id: `script-${s.path}`,
                    label: s.name,
                    sublabel: s.description,
                    icon: <CodeIcon />,
                    action: () => navigate(`/scripts/${encodeURIComponent(s.path)}`),
                    category: 'Scripts'
                })
            }
        })

        // Add history entries
        if (q.length >= 2) {
            history.forEach(h => {
                const scriptName = h.script_name || h.script_path?.split('/').pop() || 'Unknown'
                if (scriptName.toLowerCase().includes(q) || h.machine_name?.toLowerCase().includes(q)) {
                    items.push({
                        id: `history-${h.id}`,
                        label: `${scriptName} → ${h.machine_name || 'Unknown'}`,
                        sublabel: `${h.status} • ${new Date(h.started_at).toLocaleString()}`,
                        icon: <HistoryIcon />,
                        action: () => navigate(`/history`),
                        category: 'History',
                        status: h.status
                    })
                }
            })
        }

        return items
    }, [query, machines, scripts, history, navigate])

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => Math.min(prev + 1, commands.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter' && commands[selectedIndex]) {
            e.preventDefault()
            commands[selectedIndex].action()
            onClose()
        } else if (e.key === 'Escape') {
            onClose()
        }
    }, [commands, selectedIndex, onClose])

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0)
    }, [query])

    // Group commands by category
    const groupedCommands = useMemo(() => {
        const groups = {}
        commands.forEach((cmd, idx) => {
            if (!groups[cmd.category]) groups[cmd.category] = []
            groups[cmd.category].push({ ...cmd, globalIndex: idx })
        })
        return groups
    }, [commands])

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(10, 14, 23, 0.98) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(249, 115, 22, 0.2)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    maxHeight: '70vh',
                }
            }}
        >
            <Box sx={{ p: 0 }}>
                <TextField
                    autoFocus
                    fullWidth
                    placeholder="Search commands, machines, scripts..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: '#f97316' }} />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>↑↓</Box>
                                    <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>Enter</Box>
                                    <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>Esc</Box>
                                </Box>
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 0,
                            fontSize: '1.1rem',
                            py: 1,
                            '& fieldset': { border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)' },
                        }
                    }}
                />

                <Box sx={{ maxHeight: 400, overflow: 'auto', py: 1 }}>
                    {commands.length === 0 ? (
                        <Box sx={{ p: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary">No results found</Typography>
                        </Box>
                    ) : (
                        Object.entries(groupedCommands).map(([category, items]) => (
                            <Box key={category}>
                                <Typography sx={{ px: 2, py: 0.5, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>
                                    {category}
                                </Typography>
                                {items.map((cmd) => (
                                    <Box
                                        key={cmd.id}
                                        onClick={() => { cmd.action(); onClose() }}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            px: 2,
                                            py: 1.5,
                                            cursor: 'pointer',
                                            bgcolor: cmd.globalIndex === selectedIndex ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                                            borderLeft: cmd.globalIndex === selectedIndex ? '3px solid #f97316' : '3px solid transparent',
                                            '&:hover': { bgcolor: 'rgba(249, 115, 22, 0.1)' },
                                            transition: 'all 0.1s',
                                        }}
                                    >
                                        <Box sx={{ 
                                            color: cmd.status === 'online' ? '#22c55e' : cmd.status === 'offline' ? '#ff4466' : '#f97316',
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}>
                                            {cmd.icon}
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ fontWeight: 500, fontSize: '0.95rem' }}>{cmd.label}</Typography>
                                            {cmd.sublabel && (
                                                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {cmd.sublabel}
                                                </Typography>
                                            )}
                                        </Box>
                                        {cmd.status && (
                                            <Box sx={{ 
                                                width: 8, height: 8, borderRadius: '50%',
                                                bgcolor: cmd.status === 'online' ? '#22c55e' : '#ff4466',
                                                boxShadow: cmd.status === 'online' ? '0 0 8px #22c55e' : 'none'
                                            }} />
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        ))
                    )}
                </Box>

                <Box sx={{ 
                    p: 1.5, 
                    borderTop: '1px solid rgba(255,255,255,0.1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2,
                    bgcolor: 'rgba(0,0,0,0.2)'
                }}>
                    <KeyboardIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />
                    <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                        Type "terminal [name]" for quick SSH • "files [name]" for file browser • "docker [name]" for containers
                    </Typography>
                </Box>
            </Box>
        </Dialog>
    )
}

export default CommandPalette
