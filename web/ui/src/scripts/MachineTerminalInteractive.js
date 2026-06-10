import { useRef, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CircularProgress from '@mui/material/CircularProgress'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

const MachineTerminalInteractive = ({ machine, machineId }) => {
    const terminalRef = useRef(null)
    const terminalInstance = useRef(null)
    const fitAddon = useRef(null)
    const wsRef = useRef(null)
    const [connected, setConnected] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState(null)
    const [fontSize, setFontSize] = useState(14)
    const [isFullscreen, setIsFullscreen] = useState(false)

    const connectTerminal = () => {
        if (wsRef.current) {
            wsRef.current.close()
        }

        setConnecting(true)
        setError(null)
        setConnected(false)

        // Clear terminal
        if (terminalInstance.current) {
            terminalInstance.current.clear()
            terminalInstance.current.write('\x1b[33mConnecting to ' + machine.ip + '...\x1b[0m\r\n')
        }

        // Get terminal dimensions
        const cols = terminalInstance.current?.cols || 120
        const rows = terminalInstance.current?.rows || 40

        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/machines/${machineId}/terminal/ws?shell=fish&cols=${cols}&rows=${rows}`
        
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

        ws.onerror = (event) => {
            setConnecting(false)
            setConnected(false)
            setError('WebSocket connection failed')
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n\x1b[31mConnection error\x1b[0m\r\n')
            }
        }

        ws.onclose = (event) => {
            setConnecting(false)
            setConnected(false)
            if (terminalInstance.current) {
                terminalInstance.current.write('\r\n\x1b[33mConnection closed\x1b[0m\r\n')
            }
        }
    }

    useEffect(() => {
        // Initialize terminal
        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'block',
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
            theme: {
                background: '#0d1117',
                foreground: '#e0f7ff',
                cursor: '#f97316',
                cursorAccent: '#0d1117',
                selectionBackground: 'rgba(249, 115, 22, 0.3)',
                black: '#0d1117',
                red: '#ff6b6b',
                green: '#22c55e',
                yellow: '#ffaa00',
                blue: '#f97316',
                magenta: '#ff79c6',
                cyan: '#8be9fd',
                white: '#f8f8f2',
                brightBlack: '#6272a4',
                brightRed: '#ff6b6b',
                brightGreen: '#22c55e',
                brightYellow: '#ffaa00',
                brightBlue: '#f97316',
                brightMagenta: '#ff79c6',
                brightCyan: '#8be9fd',
                brightWhite: '#ffffff'
            },
            allowProposedApi: true
        })

        fitAddon.current = new FitAddon()
        term.loadAddon(fitAddon.current)
        term.loadAddon(new WebLinksAddon())

        if (terminalRef.current) {
            term.open(terminalRef.current)
            fitAddon.current.fit()
        }

        terminalInstance.current = term

        // Handle terminal input
        term.onData((data) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(data)
            }
        })

        // Handle resize
        const handleResize = () => {
            if (fitAddon.current) {
                fitAddon.current.fit()
                // Send resize command to server
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && terminalInstance.current) {
                    const cols = terminalInstance.current.cols
                    const rows = terminalInstance.current.rows
                    // Send resize message: 0x01 + cols (2 bytes) + rows (2 bytes)
                    const resizeMsg = new Uint8Array(5)
                    resizeMsg[0] = 0x01
                    resizeMsg[1] = (cols >> 8) & 0xff
                    resizeMsg[2] = cols & 0xff
                    resizeMsg[3] = (rows >> 8) & 0xff
                    resizeMsg[4] = rows & 0xff
                    wsRef.current.send(resizeMsg)
                }
            }
        }

        window.addEventListener('resize', handleResize)

        // Auto-connect
        setTimeout(() => {
            connectTerminal()
        }, 100)

        return () => {
            window.removeEventListener('resize', handleResize)
            if (wsRef.current) {
                wsRef.current.close()
            }
            if (terminalInstance.current) {
                terminalInstance.current.dispose()
            }
        }
    }, [machineId])

    // Refit on container resize
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (fitAddon.current) {
                fitAddon.current.fit()
            }
        })

        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current)
        }

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    return (
        <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            ...(isFullscreen && {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                bgcolor: '#0d1117',
                p: 2
            })
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Interactive Terminal</Typography>
                <Chip 
                    label={`${machine.username}@${machine.ip}`} 
                    size="small" 
                    sx={{ fontFamily: 'monospace', bgcolor: 'rgba(0,212,255,0.1)' }} 
                />
                <Chip 
                    label="fish" 
                    size="small" 
                    color="primary"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }} 
                />
                <Chip 
                    label={connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'} 
                    size="small" 
                    color={connected ? 'success' : connecting ? 'warning' : 'error'}
                    sx={{ fontFamily: 'monospace' }} 
                />
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Decrease font size">
                    <IconButton size="small" onClick={() => {
                        const newSize = Math.max(10, fontSize - 2)
                        setFontSize(newSize)
                        if (terminalInstance.current) {
                            terminalInstance.current.options.fontSize = newSize
                            fitAddon.current?.fit()
                        }
                    }}>
                        <RemoveIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ minWidth: 30, textAlign: 'center' }}>{fontSize}px</Typography>
                <Tooltip title="Increase font size">
                    <IconButton size="small" onClick={() => {
                        const newSize = Math.min(24, fontSize + 2)
                        setFontSize(newSize)
                        if (terminalInstance.current) {
                            terminalInstance.current.options.fontSize = newSize
                            fitAddon.current?.fit()
                        }
                    }}>
                        <AddIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Copy terminal content">
                    <IconButton size="small" onClick={() => {
                        if (terminalInstance.current) {
                            const selection = terminalInstance.current.getSelection()
                            if (selection) {
                                navigator.clipboard.writeText(selection)
                            }
                        }
                    }}>
                        <ContentCopyIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                    <IconButton size="small" onClick={() => {
                        setIsFullscreen(!isFullscreen)
                        setTimeout(() => fitAddon.current?.fit(), 100)
                    }}>
                        {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: 18 }} /> : <FullscreenIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                </Tooltip>
                <Tooltip title="Reconnect">
                    <IconButton 
                        size="small" 
                        onClick={connectTerminal}
                        disabled={connecting}
                    >
                        {connecting ? <CircularProgress size={18} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                </Tooltip>
            </Box>

            <Box 
                ref={terminalRef}
                sx={{ 
                    flex: 1, 
                    bgcolor: '#0d1117', 
                    border: '1px solid rgba(249, 115, 22, 0.2)', 
                    borderRadius: 2, 
                    overflow: 'hidden',
                    p: 1,
                    '& .xterm': {
                        height: '100%'
                    },
                    '& .xterm-viewport': {
                        overflow: 'hidden !important'
                    }
                }}
            />

            {error && (
                <Typography color="error" variant="caption" sx={{ mt: 1 }}>
                    {error}
                </Typography>
            )}

            <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    Full interactive terminal with fish shell • Ctrl+C to interrupt • Ctrl+D to exit
                </Typography>
            </Box>
        </Box>
    )
}

export default MachineTerminalInteractive
