import { useRef, useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import EditIcon from '@mui/icons-material/Edit'
import MinimizeIcon from '@mui/icons-material/Minimize'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import DockIcon from '@mui/icons-material/Dock'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import StopIcon from '@mui/icons-material/Stop'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import VideocamIcon from '@mui/icons-material/Videocam'
import SearchIcon from '@mui/icons-material/Search'
import PaletteIcon from '@mui/icons-material/Palette'
import HistoryIcon from '@mui/icons-material/History'
import CodeIcon from '@mui/icons-material/Code'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import TerminalIcon from '@mui/icons-material/Terminal'
import SendIcon from '@mui/icons-material/Send'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import DeleteIcon from '@mui/icons-material/Delete'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'

const THEMES = {
    cyberpunk: {
        name: 'Cyberpunk',
        background: '#0a0e14',
        foreground: '#b3b1ad',
        cursor: '#f97316',
        cursorAccent: '#0a0e14',
        selectionBackground: 'rgba(249, 115, 22, 0.3)',
        black: '#0a0e14', red: '#ff3333', green: '#22c55e', yellow: '#ff8f40',
        blue: '#f97316', magenta: '#ff79c6', cyan: '#39bae6', white: '#b3b1ad',
        brightBlack: '#4d5566', brightRed: '#ff6666', brightGreen: '#7fff7f', brightYellow: '#ffb454',
        brightBlue: '#73d0ff', brightMagenta: '#ff9fec', brightCyan: '#95e6cb', brightWhite: '#ffffff'
    },
    matrix: {
        name: 'Matrix',
        background: '#0d0d0d',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#0d0d0d',
        selectionBackground: 'rgba(0, 255, 0, 0.3)',
        black: '#0d0d0d', red: '#ff0000', green: '#00ff00', yellow: '#ffff00',
        blue: '#0000ff', magenta: '#ff00ff', cyan: '#00ffff', white: '#ffffff',
        brightBlack: '#333333', brightRed: '#ff3333', brightGreen: '#33ff33', brightYellow: '#ffff33',
        brightBlue: '#3333ff', brightMagenta: '#ff33ff', brightCyan: '#33ffff', brightWhite: '#ffffff'
    },
    dracula: {
        name: 'Dracula',
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        cursorAccent: '#282a36',
        selectionBackground: 'rgba(68, 71, 90, 0.5)',
        black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
        blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
        brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
        brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
    },
    monokai: {
        name: 'Monokai',
        background: '#272822',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        cursorAccent: '#272822',
        selectionBackground: 'rgba(73, 72, 62, 0.5)',
        black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75',
        blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
        brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e', brightYellow: '#f4bf75',
        brightBlue: '#66d9ef', brightMagenta: '#ae81ff', brightCyan: '#a1efe4', brightWhite: '#f9f8f5'
    },
    nord: {
        name: 'Nord',
        background: '#2e3440',
        foreground: '#d8dee9',
        cursor: '#d8dee9',
        cursorAccent: '#2e3440',
        selectionBackground: 'rgba(67, 76, 94, 0.5)',
        black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
        blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
        brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b',
        brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4'
    }
}

const SNIPPETS = [
    { name: 'System Update', cmd: 'sudo apt update && sudo apt upgrade -y', icon: '🔄' },
    { name: 'Disk Usage', cmd: 'df -h', icon: '💾' },
    { name: 'Memory Info', cmd: 'free -h', icon: '🧠' },
    { name: 'Process List', cmd: 'htop || top', icon: '📊' },
    { name: 'Docker PS', cmd: 'docker ps -a', icon: '🐳' },
    { name: 'Docker Stats', cmd: 'docker stats --no-stream', icon: '📈' },
    { name: 'Network Info', cmd: 'ip addr show', icon: '🌐' },
    { name: 'Port Scan', cmd: 'ss -tulpn', icon: '🔌' },
    { name: 'System Info', cmd: 'neofetch || fastfetch || uname -a', icon: '💻' },
    { name: 'Tail Syslog', cmd: 'sudo tail -f /var/log/syslog', icon: '📜' },
]

const TerminalInstance = ({ id, machine, machineId, isVisible, onStatusChange, fontSize, theme, onSendCommand }) => {
    const terminalRef = useRef(null)
    const terminalInstance = useRef(null)
    const fitAddon = useRef(null)
    const searchAddon = useRef(null)
    const wsRef = useRef(null)
    const initialized = useRef(false)
    const onStatusChangeRef = useRef(onStatusChange)
    const [showSearch, setShowSearch] = useState(false)
    const [searchText, setSearchText] = useState('')
    onStatusChangeRef.current = onStatusChange

    const connectTerminal = useCallback(() => {
        if (wsRef.current) wsRef.current.close()
        onStatusChangeRef.current?.(id, 'connecting')

        if (terminalInstance.current) {
            terminalInstance.current.clear()
            terminalInstance.current.write('\x1b[38;5;45m⚡ Connecting to ' + machine.ip + '...\x1b[0m\r\n')
        }

        const cols = terminalInstance.current?.cols || 120
        const rows = terminalInstance.current?.rows || 30
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/machines/${machineId}/terminal/ws?shell=fish&cols=${cols}&rows=${rows}`
        
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        ws.binaryType = 'arraybuffer'

        ws.onopen = () => {
            onStatusChangeRef.current?.(id, 'connected')
            if (terminalInstance.current) terminalInstance.current.clear()
        }

        ws.onmessage = (event) => {
            if (terminalInstance.current) {
                const text = event.data instanceof ArrayBuffer ? new TextDecoder().decode(event.data) : event.data
                terminalInstance.current.write(text)
            }
        }

        ws.onerror = () => {
            onStatusChangeRef.current?.(id, 'error')
            if (terminalInstance.current) terminalInstance.current.write('\r\n\x1b[38;5;196m✖ Connection error\x1b[0m\r\n')
        }

        ws.onclose = () => {
            onStatusChangeRef.current?.(id, 'disconnected')
            if (terminalInstance.current) terminalInstance.current.write('\r\n\x1b[38;5;208m⚠ Connection closed\x1b[0m\r\n')
        }
    }, [id, machine.ip, machineId])

    const sendCommand = useCallback((cmd) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(cmd + '\n')
        }
    }, [])

    useEffect(() => {
        if (onSendCommand) onSendCommand.current = sendCommand
    }, [sendCommand, onSendCommand])

    useEffect(() => {
        if (initialized.current || !terminalRef.current) return
        initialized.current = true

        const currentTheme = THEMES[theme] || THEMES.cyberpunk

        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'block',
            fontSize: fontSize || 14,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            scrollback: 5000,
            theme: currentTheme,
            allowProposedApi: true
        })

        fitAddon.current = new FitAddon()
        searchAddon.current = new SearchAddon()
        term.loadAddon(fitAddon.current)
        term.loadAddon(new WebLinksAddon())
        term.loadAddon(searchAddon.current)
        term.open(terminalRef.current)
        terminalInstance.current = term

        term.onData((data) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(data)
        })

        term.attachCustomKeyEventHandler((e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault()
                setShowSearch(s => !s)
                return false
            }
            return true
        })

        setTimeout(() => {
            fitAddon.current?.fit()
            connectTerminal()
        }, 100)

        return () => {
            wsRef.current?.close()
            term.dispose()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (isVisible && fitAddon.current) {
            setTimeout(() => fitAddon.current?.fit(), 50)
        }
    }, [isVisible])

    useEffect(() => {
        if (!terminalRef.current) return
        const resizeObserver = new ResizeObserver(() => {
            if (fitAddon.current && isVisible) {
                fitAddon.current.fit()
                if (wsRef.current?.readyState === WebSocket.OPEN && terminalInstance.current) {
                    const { cols, rows } = terminalInstance.current
                    const msg = new Uint8Array([0x01, (cols >> 8) & 0xff, cols & 0xff, (rows >> 8) & 0xff, rows & 0xff])
                    wsRef.current.send(msg)
                }
            }
        })
        resizeObserver.observe(terminalRef.current)
        return () => resizeObserver.disconnect()
    }, [isVisible])

    useEffect(() => {
        if (terminalInstance.current && fontSize) {
            terminalInstance.current.options.fontSize = fontSize
            fitAddon.current?.fit()
        }
    }, [fontSize])

    useEffect(() => {
        if (terminalInstance.current && theme) {
            terminalInstance.current.options.theme = THEMES[theme] || THEMES.cyberpunk
        }
    }, [theme])

    const handleSearch = (direction) => {
        if (!searchAddon.current || !searchText) return
        if (direction === 'next') searchAddon.current.findNext(searchText)
        else searchAddon.current.findPrevious(searchText)
    }

    return (
        <Box sx={{ display: isVisible ? 'block' : 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {showSearch && (
                <Box sx={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 8, 
                    zIndex: 10, 
                    display: 'flex', 
                    gap: 0.5, 
                    bgcolor: 'rgba(0,0,0,0.9)', 
                    p: 0.5, 
                    borderRadius: 1,
                    border: '1px solid rgba(0,212,255,0.3)'
                }}>
                    <TextField
                        size="small"
                        placeholder="Search..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSearch(e.shiftKey ? 'prev' : 'next')
                            if (e.key === 'Escape') setShowSearch(false)
                        }}
                        autoFocus
                        sx={{ '& input': { py: 0.5, px: 1, fontSize: '0.8rem', width: 150 } }}
                    />
                    <IconButton size="small" onClick={() => handleSearch('prev')}><KeyboardArrowUpIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => handleSearch('next')}><KeyboardArrowDownIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => setShowSearch(false)}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
                </Box>
            )}
            <Box 
                ref={terminalRef}
                sx={{ 
                    width: '100%',
                    height: '100%',
                    bgcolor: THEMES[theme]?.background || '#0a0e14', 
                    '& .xterm': { height: '100%', padding: '8px' },
                    '& .xterm-viewport': { overflowY: 'auto !important' },
                    '& .xterm-screen': { height: '100%' }
                }}
            />
        </Box>
    )
}

const FloatingTerminal = ({ tab, machine, machineId, onClose, onDock, onStatusChange, onRename, fontSize, theme }) => {
    const [position, setPosition] = useState(tab.position || { x: 100 + tab.id * 30, y: 100 + tab.id * 30 })
    const [size, setSize] = useState(tab.size || { width: 700, height: 450 })
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(tab.name)
    const [isMinimized, setIsMinimized] = useState(false)
    const dragStart = useRef({ x: 0, y: 0 })
    const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

    const handleMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return
        setIsDragging(true)
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    }

    const handleResizeStart = (e) => {
        e.stopPropagation()
        setIsResizing(true)
        resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }
    }

    useEffect(() => {
        if (!isDragging && !isResizing) return
        const handleMove = (e) => {
            if (isDragging) setPosition({ x: Math.max(0, e.clientX - dragStart.current.x), y: Math.max(0, e.clientY - dragStart.current.y) })
            else if (isResizing) setSize({ width: Math.max(400, resizeStart.current.w + e.clientX - resizeStart.current.x), height: Math.max(250, resizeStart.current.h + e.clientY - resizeStart.current.y) })
        }
        const handleUp = () => { setIsDragging(false); setIsResizing(false) }
        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
        return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
    }, [isDragging, isResizing])

    const statusColor = tab.status === 'connected' ? '#22c55e' : tab.status === 'connecting' ? '#ff8f40' : '#ff3333'

    return (
        <Box sx={{
            position: 'fixed', left: position.x, top: position.y, width: size.width, height: isMinimized ? 40 : size.height,
            zIndex: 10000, display: 'flex', flexDirection: 'column', bgcolor: THEMES[theme]?.background || '#0a0e14',
            border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(249, 115, 22, 0.1)',
            overflow: 'hidden', transition: 'height 0.2s ease'
        }}>
            <Box onMouseDown={handleMouseDown} sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5,
                bgcolor: 'rgba(249, 115, 22, 0.05)', borderBottom: '1px solid rgba(249, 115, 22, 0.1)',
                cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', flexShrink: 0
            }}>
                <DragIndicatorIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />
                <FiberManualRecordIcon sx={{ fontSize: 10, color: statusColor }} />
                {isEditing ? (
                    <TextField size="small" value={editName} onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => { onRename(tab.id, editName); setIsEditing(false) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { onRename(tab.id, editName); setIsEditing(false) } }}
                        autoFocus sx={{ '& input': { py: 0, fontSize: '0.75rem', color: '#f97316' } }} />
                ) : (
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#f97316', cursor: 'pointer' }} onDoubleClick={() => setIsEditing(true)}>{tab.name}</Typography>
                )}
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>{machine.ip}</Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Rename"><IconButton size="small" onClick={() => setIsEditing(true)}><EditIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
                <Tooltip title="Dock"><IconButton size="small" onClick={() => onDock(tab.id)}><DockIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
                <Tooltip title={isMinimized ? "Restore" : "Minimize"}><IconButton size="small" onClick={() => setIsMinimized(!isMinimized)}><MinimizeIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
                <Tooltip title="Close"><IconButton size="small" onClick={() => onClose(tab.id)}><CloseIcon sx={{ fontSize: 12, '&:hover': { color: '#ff3333' } }} /></IconButton></Tooltip>
            </Box>
            {!isMinimized && (
                <Box sx={{ flex: 1, position: 'relative', minHeight: 200 }}>
                    <TerminalInstance id={tab.id} machine={machine} machineId={machineId} isVisible={true} onStatusChange={onStatusChange} fontSize={fontSize} theme={theme} />
                </Box>
            )}
            {!isMinimized && (
                <Box onMouseDown={handleResizeStart} sx={{
                    position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, cursor: 'se-resize',
                    '&::after': { content: '""', position: 'absolute', right: 4, bottom: 4, width: 8, height: 8, borderRight: '2px solid rgba(0,212,255,0.5)', borderBottom: '2px solid rgba(0,212,255,0.5)' }
                }} />
            )}
        </Box>
    )
}

const MachineTerminalTabs = ({ machine, machineId }) => {
    const [tabs, setTabs] = useState([{ id: 1, name: 'Terminal 1', status: 'disconnected', floating: false, recording: false }])
    const [activeTab, setActiveTab] = useState(1)
    const [fontSize, setFontSize] = useState(14)
    const [theme, setTheme] = useState('cyberpunk')
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [editingTab, setEditingTab] = useState(null)
    const [editName, setEditName] = useState('')
    const [themeMenu, setThemeMenu] = useState(null)
    const [snippetsOpen, setSnippetsOpen] = useState(false)
    const [recordingsOpen, setRecordingsOpen] = useState(false)
    const [recordings, setRecordings] = useState([])
    const [playbackOpen, setPlaybackOpen] = useState(false)
    const [playbackData, setPlaybackData] = useState(null)
    const [customSnippets, setCustomSnippets] = useState(() => {
        try { return JSON.parse(localStorage.getItem('terminalSnippets') || '[]') } catch { return [] }
    })
    const [newSnippet, setNewSnippet] = useState({ name: '', cmd: '' })
    const nextId = useRef(2)
    const sendCommandRef = useRef(null)

    // Load recordings
    const loadRecordings = async () => {
        try {
            const res = await fetch('/api/terminal/recordings')
            const data = await res.json()
            setRecordings(data.recordings || [])
        } catch (err) {
            console.error('Failed to load recordings:', err)
        }
    }

    // Toggle recording for active tab
    const toggleRecording = async (tabId) => {
        const tab = tabs.find(t => t.id === tabId)
        if (!tab) return

        const action = tab.recording ? 'stop' : 'start'
        try {
            const res = await fetch(`/api/terminal/sessions/${tabId}/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, machineName: machine.name || machine.ip })
            })
            const data = await res.json()
            if (data.success) {
                setTabs(prev => prev.map(t => t.id === tabId ? { ...t, recording: !t.recording } : t))
                if (action === 'stop') {
                    loadRecordings()
                }
            }
        } catch (err) {
            console.error('Failed to toggle recording:', err)
        }
    }

    // Delete recording
    const deleteRecording = async (id) => {
        try {
            await fetch(`/api/terminal/recordings/${id}`, { method: 'DELETE' })
            loadRecordings()
        } catch (err) {
            console.error('Failed to delete recording:', err)
        }
    }

    // Play recording
    const playRecording = async (id) => {
        try {
            const res = await fetch(`/api/terminal/recordings/${id}`)
            const data = await res.json()
            setPlaybackData(data)
            setPlaybackOpen(true)
            setRecordingsOpen(false)
        } catch (err) {
            console.error('Failed to load recording:', err)
        }
    }

    const dockedTabs = tabs.filter(t => !t.floating)
    const floatingTabs = tabs.filter(t => t.floating)

    const addTab = () => {
        const id = nextId.current++
        setTabs(prev => [...prev, { id, name: `Terminal ${id}`, status: 'disconnected', floating: false }])
        setActiveTab(id)
    }

    const closeTab = (tabId) => {
        if (tabs.length === 1) return
        const idx = tabs.findIndex(t => t.id === tabId)
        setTabs(prev => prev.filter(t => t.id !== tabId))
        if (activeTab === tabId) {
            const remaining = tabs.filter(t => t.id !== tabId && !t.floating)
            if (remaining.length > 0) setActiveTab(remaining[Math.min(idx, remaining.length - 1)].id)
        }
    }

    const floatTab = (tabId) => {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, floating: true } : t))
        const remaining = tabs.filter(t => t.id !== tabId && !t.floating)
        if (remaining.length > 0 && activeTab === tabId) setActiveTab(remaining[0].id)
    }

    const dockTab = (tabId) => {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, floating: false } : t))
        setActiveTab(tabId)
    }

    const renameTab = (tabId, name) => setTabs(prev => prev.map(t => t.id === tabId ? { ...t, name: name || t.name } : t))
    const handleStatusChange = (tabId, status) => setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status } : t))
    const startRename = (tabId, currentName) => { setEditingTab(tabId); setEditName(currentName) }
    const finishRename = () => { if (editingTab && editName.trim()) renameTab(editingTab, editName.trim()); setEditingTab(null) }

    const runSnippet = (cmd) => {
        if (sendCommandRef.current) sendCommandRef.current(cmd)
        setSnippetsOpen(false)
    }

    const addCustomSnippet = () => {
        if (!newSnippet.name || !newSnippet.cmd) return
        const updated = [...customSnippets, { ...newSnippet, icon: '⚡' }]
        setCustomSnippets(updated)
        localStorage.setItem('terminalSnippets', JSON.stringify(updated))
        setNewSnippet({ name: '', cmd: '' })
    }

    const deleteCustomSnippet = (idx) => {
        const updated = customSnippets.filter((_, i) => i !== idx)
        setCustomSnippets(updated)
        localStorage.setItem('terminalSnippets', JSON.stringify(updated))
    }

    return (
        <Box sx={{ 
            display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
            ...(isFullscreen && { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, bgcolor: THEMES[theme]?.background || '#0a0e14', p: 2 })
        }}>
            <Box sx={{ 
                display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0,
                background: 'linear-gradient(90deg, rgba(0,212,255,0.1) 0%, transparent 100%)',
                borderRadius: 1, p: 1
            }}>
                <TerminalIcon sx={{ color: '#f97316' }} />
                <Typography variant="h6" sx={{ fontWeight: 700, background: 'linear-gradient(90deg, #f97316, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Terminal
                </Typography>
                <Chip label={`${machine.username}@${machine.ip}`} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', bgcolor: 'rgba(0,212,255,0.1)' }} />
                <Box sx={{ flex: 1 }} />
                
                <Tooltip title="Command Snippets">
                    <IconButton size="small" onClick={() => setSnippetsOpen(true)}>
                        <CodeIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Recordings">
                    <IconButton size="small" onClick={() => { loadRecordings(); setRecordingsOpen(true) }}>
                        <VideocamIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                {tabs.find(t => t.id === activeTab)?.status === 'connected' && (
                    <Tooltip title={tabs.find(t => t.id === activeTab)?.recording ? "Stop Recording" : "Start Recording"}>
                        <IconButton 
                            size="small" 
                            onClick={() => toggleRecording(activeTab)}
                            sx={{ 
                                color: tabs.find(t => t.id === activeTab)?.recording ? '#ff3333' : 'inherit',
                                animation: tabs.find(t => t.id === activeTab)?.recording ? 'pulse 1s infinite' : 'none',
                                '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } }
                            }}
                        >
                            {tabs.find(t => t.id === activeTab)?.recording ? <StopIcon sx={{ fontSize: 18 }} /> : <FiberManualRecordIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip title="Theme">
                    <IconButton size="small" onClick={(e) => setThemeMenu(e.currentTarget)}>
                        <PaletteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <Menu anchorEl={themeMenu} open={Boolean(themeMenu)} onClose={() => setThemeMenu(null)}>
                    {Object.entries(THEMES).map(([key, t]) => (
                        <MenuItem key={key} onClick={() => { setTheme(key); setThemeMenu(null) }} selected={theme === key}>
                            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: t.background, border: '2px solid', borderColor: t.cursor, mr: 1 }} />
                            {t.name}
                        </MenuItem>
                    ))}
                </Menu>
                
                <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(255,255,255,0.1)', mx: 0.5 }} />
                <Tooltip title="Font -"><IconButton size="small" onClick={() => setFontSize(s => Math.max(10, s - 1))}><RemoveIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                <Typography variant="caption" sx={{ minWidth: 35, textAlign: 'center', fontFamily: 'monospace' }}>{fontSize}px</Typography>
                <Tooltip title="Font +"><IconButton size="small" onClick={() => setFontSize(s => Math.min(24, s + 1))}><AddIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(255,255,255,0.1)', mx: 0.5 }} />
                <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                    <IconButton size="small" onClick={() => setIsFullscreen(!isFullscreen)}>
                        {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: 18 }} /> : <FullscreenIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                </Tooltip>
            </Box>

            <Box sx={{ 
                display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexShrink: 0, overflowX: 'auto', pb: 0.5,
                '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,212,255,0.3)', borderRadius: 2 }
            }}>
                {dockedTabs.map(tab => (
                    <Box key={tab.id} onClick={() => setActiveTab(tab.id)} sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 1, cursor: 'pointer',
                        bgcolor: activeTab === tab.id ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                        border: activeTab === tab.id ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                        transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' }, minWidth: 'fit-content'
                    }}>
                        <FiberManualRecordIcon sx={{ fontSize: 8, color: tab.status === 'connected' ? '#22c55e' : tab.status === 'connecting' ? '#ff8f40' : '#ff3333' }} />
                        {editingTab === tab.id ? (
                            <TextField size="small" value={editName} onChange={(e) => setEditName(e.target.value)}
                                onBlur={finishRename} onKeyDown={(e) => e.key === 'Enter' && finishRename()} autoFocus
                                onClick={(e) => e.stopPropagation()} sx={{ '& input': { py: 0, px: 0.5, fontSize: '0.75rem', width: 80 } }} />
                        ) : (
                            <Typography variant="caption" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }} onDoubleClick={(e) => { e.stopPropagation(); startRename(tab.id, tab.name) }}>{tab.name}</Typography>
                        )}
                        <Tooltip title="Float"><IconButton size="small" onClick={(e) => { e.stopPropagation(); floatTab(tab.id) }} sx={{ p: 0.25 }}><OpenInNewIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
                        {tabs.length > 1 && <Tooltip title="Close"><IconButton size="small" onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }} sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>}
                    </Box>
                ))}
                <Tooltip title="New Terminal">
                    <IconButton size="small" onClick={addTab} sx={{ bgcolor: 'rgba(0,212,255,0.1)', '&:hover': { bgcolor: 'rgba(0,212,255,0.2)' } }}>
                        <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            <Box sx={{ flex: 1, minHeight: 300, position: 'relative', borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(0,212,255,0.1)' }}>
                {dockedTabs.map(tab => (
                    <TerminalInstance key={tab.id} id={tab.id} machine={machine} machineId={machineId}
                        isVisible={activeTab === tab.id} onStatusChange={handleStatusChange} fontSize={fontSize} theme={theme}
                        onSendCommand={activeTab === tab.id ? sendCommandRef : null} />
                ))}
            </Box>

            {floatingTabs.map(tab => (
                <FloatingTerminal key={tab.id} tab={tab} machine={machine} machineId={machineId}
                    onClose={closeTab} onDock={dockTab} onStatusChange={handleStatusChange} onRename={renameTab} fontSize={fontSize} theme={theme} />
            ))}

            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                    Ctrl+F search • Double-click tab to rename • Drag floating windows
                </Typography>
            </Box>

            <Dialog open={snippetsOpen} onClose={() => setSnippetsOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CodeIcon /> Command Snippets
                </DialogTitle>
                <DialogContent>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Quick Commands</Typography>
                    <List dense>
                        {SNIPPETS.map((s, i) => (
                            <ListItem key={i} button onClick={() => runSnippet(s.cmd)} sx={{ borderRadius: 1, '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' } }}>
                                <ListItemIcon sx={{ minWidth: 32 }}>{s.icon}</ListItemIcon>
                                <ListItemText primary={s.name} secondary={<Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{s.cmd}</Typography>} />
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(s.cmd) }}><ContentCopyIcon sx={{ fontSize: 14 }} /></IconButton>
                            </ListItem>
                        ))}
                    </List>
                    
                    {customSnippets.length > 0 && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Custom Snippets</Typography>
                            <List dense>
                                {customSnippets.map((s, i) => (
                                    <ListItem key={i} button onClick={() => runSnippet(s.cmd)} sx={{ borderRadius: 1, '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' } }}>
                                        <ListItemIcon sx={{ minWidth: 32 }}>{s.icon}</ListItemIcon>
                                        <ListItemText primary={s.name} secondary={<Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{s.cmd}</Typography>} />
                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteCustomSnippet(i) }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
                                    </ListItem>
                                ))}
                            </List>
                        </>
                    )}
                    
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Add Custom Snippet</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField size="small" placeholder="Name" value={newSnippet.name} onChange={(e) => setNewSnippet(p => ({ ...p, name: e.target.value }))} sx={{ flex: 1 }} />
                        <TextField size="small" placeholder="Command" value={newSnippet.cmd} onChange={(e) => setNewSnippet(p => ({ ...p, cmd: e.target.value }))} sx={{ flex: 2 }} />
                        <Button variant="contained" size="small" onClick={addCustomSnippet} disabled={!newSnippet.name || !newSnippet.cmd}>Add</Button>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSnippetsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Recordings Dialog */}
            <Dialog open={recordingsOpen} onClose={() => setRecordingsOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VideocamIcon sx={{ color: '#f97316' }} />
                    Terminal Recordings
                </DialogTitle>
                <DialogContent>
                    {recordings.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                            <VideocamIcon sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                            <Typography>No recordings yet</Typography>
                            <Typography variant="body2">Click the record button while connected to start recording</Typography>
                        </Box>
                    ) : (
                        <List>
                            {recordings.map(rec => (
                                <ListItem key={rec.id} sx={{ borderRadius: 1, mb: 1, bgcolor: 'rgba(255,255,255,0.03)', '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' } }}>
                                    <ListItemIcon><VideocamIcon sx={{ color: '#f97316' }} /></ListItemIcon>
                                    <ListItemText 
                                        primary={rec.machineName || 'Unknown Machine'}
                                        secondary={
                                            <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(rec.startTime).toLocaleString()}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Duration: {Math.round(rec.duration)}s
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {rec.eventCount} events
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    <Tooltip title="Play">
                                        <IconButton onClick={() => playRecording(rec.id)} sx={{ color: '#22c55e' }}>
                                            <PlayArrowIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton onClick={() => deleteRecording(rec.id)} sx={{ color: '#ff3333' }}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRecordingsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Playback Dialog */}
            <Dialog open={playbackOpen} onClose={() => { setPlaybackOpen(false); setPlaybackData(null) }} maxWidth="lg" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PlayArrowIcon sx={{ color: '#22c55e' }} />
                    Playback: {playbackData?.machineName}
                    <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                        {playbackData && new Date(playbackData.startTime).toLocaleString()} • {Math.round(playbackData?.duration || 0)}s
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {playbackData && <TerminalPlayback recording={playbackData} theme={theme} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setPlaybackOpen(false); setPlaybackData(null) }}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

// Terminal Playback Component
const TerminalPlayback = ({ recording, theme }) => {
    const terminalRef = useRef(null)
    const terminalInstance = useRef(null)
    const [playing, setPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [speed, setSpeed] = useState(1)
    const timeoutRef = useRef(null)
    const eventIndexRef = useRef(0)

    useEffect(() => {
        if (!terminalRef.current || terminalInstance.current) return

        const currentTheme = THEMES[theme] || THEMES.cyberpunk
        const term = new Terminal({
            cursorBlink: false,
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            scrollback: 5000,
            theme: currentTheme,
            disableStdin: true
        })
        
        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(terminalRef.current)
        fitAddon.fit()
        terminalInstance.current = term

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            term.dispose()
        }
    }, [theme])

    const playEvents = useCallback(() => {
        if (!recording?.events || eventIndexRef.current >= recording.events.length) {
            setPlaying(false)
            return
        }

        const event = recording.events[eventIndexRef.current]
        const nextEvent = recording.events[eventIndexRef.current + 1]

        if (event.type === 'o' && terminalInstance.current) {
            terminalInstance.current.write(event.data)
        }

        setProgress((eventIndexRef.current / recording.events.length) * 100)
        eventIndexRef.current++

        if (nextEvent) {
            const delay = Math.max(10, ((nextEvent.time - event.time) * 1000) / speed)
            timeoutRef.current = setTimeout(playEvents, delay)
        } else {
            setPlaying(false)
        }
    }, [recording, speed])

    const handlePlay = () => {
        if (playing) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setPlaying(false)
        } else {
            setPlaying(true)
            playEvents()
        }
    }

    const handleRestart = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        eventIndexRef.current = 0
        setProgress(0)
        setPlaying(false)
        if (terminalInstance.current) terminalInstance.current.clear()
    }

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <IconButton onClick={handlePlay} sx={{ color: playing ? '#ff8f40' : '#22c55e' }}>
                    {playing ? <StopIcon /> : <PlayArrowIcon />}
                </IconButton>
                <IconButton onClick={handleRestart}>
                    <RefreshIcon />
                </IconButton>
                <Box sx={{ flex: 1, mx: 2 }}>
                    <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: '#f97316', transition: 'width 0.1s' }} />
                    </Box>
                </Box>
                <Typography variant="caption" sx={{ minWidth: 50 }}>{Math.round(progress)}%</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption">Speed:</Typography>
                    {[0.5, 1, 2, 4].map(s => (
                        <Button key={s} size="small" variant={speed === s ? 'contained' : 'text'} onClick={() => setSpeed(s)} sx={{ minWidth: 32, px: 1 }}>
                            {s}x
                        </Button>
                    ))}
                </Box>
            </Box>
            <Box ref={terminalRef} sx={{ flex: 1, bgcolor: THEMES[theme]?.background || '#0a0e14' }} />
        </Box>
    )
}

export default MachineTerminalTabs
