import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'

import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Slider from '@mui/material/Slider'

import { colors } from './theme'

const RemoteDesktop = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const canvasRef = useRef(null)
    const rfbRef = useRef(null)
    const containerRef = useRef(null)

    const [machine, setMachine] = useState(null)
    const [session, setSession] = useState(null)
    const [connecting, setConnecting] = useState(false)
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [keyMenuAnchor, setKeyMenuAnchor] = useState(null)
    const [viewOnly, setViewOnly] = useState(false)
    const [qualityLevel, setQualityLevel] = useState(6)
    const [showToolbar, setShowToolbar] = useState(true)

    // Load machine info
    useEffect(() => {
        const loadMachine = async () => {
            try {
                const res = await fetch('/api/machines')
                const machines = await res.json()
                const m = machines.find(m => m.id === id)
                if (m) {
                    setMachine(m)
                } else {
                    setError('Machine not found')
                }
            } catch (err) {
                setError('Failed to load machine info')
            }
        }
        loadMachine()
    }, [id])

    // Load noVNC library dynamically
    const loadNoVNC = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (window.RFB) {
                resolve(window.RFB)
                return
            }

            const script = document.createElement('script')
            script.src = 'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/lib/rfb.js'
            script.type = 'module'
            script.onload = () => {
                import('https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js')
                    .then(module => {
                        window.RFB = module.default
                        resolve(module.default)
                    })
                    .catch(reject)
            }
            script.onerror = reject
            document.head.appendChild(script)
        })
    }, [])

    // Start VNC session
    const startSession = async () => {
        if (!machine) return

        setConnecting(true)
        setError(null)

        try {
            // Start x11vnc on the remote machine
            const res = await fetch(`/api/vnc/${id}/start`, { method: 'POST' })
            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || 'Failed to start VNC server')
            }

            setSession(data.session)

            // Connect via WebSocket
            await connectVNC(data.session)
        } catch (err) {
            setError(err.message)
            setConnecting(false)
        }
    }

    // Connect to VNC via WebSocket
    const connectVNC = async (sessionData) => {
        try {
            const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/vnc/${id}/websocket`
            
            try {
                const RFB = await loadNoVNC()
                
                if (canvasRef.current && RFB) {
                    rfbRef.current = new RFB(canvasRef.current, wsUrl, {
                        credentials: { password: '' }
                    })

                    rfbRef.current.addEventListener('connect', () => {
                        setConnected(true)
                        setConnecting(false)
                    })

                    rfbRef.current.addEventListener('disconnect', (e) => {
                        setConnected(false)
                        if (e.detail.clean) {
                            setError(null)
                        } else {
                            setError('Connection lost')
                        }
                    })

                    rfbRef.current.addEventListener('securityfailure', (e) => {
                        setError(`Security error: ${e.detail.reason}`)
                    })

                    rfbRef.current.scaleViewport = true
                    rfbRef.current.resizeSession = true
                    rfbRef.current.focusOnClick = true
                    rfbRef.current.clipViewport = true
                    
                    // Focus the canvas to capture keyboard input
                    if (canvasRef.current) {
                        canvasRef.current.focus()
                    }
                }
            } catch (noVncErr) {
                console.log('noVNC not available, using fallback')
                setConnected(true)
                setConnecting(false)
            }
        } catch (err) {
            setError(`Connection failed: ${err.message}`)
            setConnecting(false)
        }
    }

    // Stop VNC session
    const stopSession = async () => {
        if (rfbRef.current) {
            rfbRef.current.disconnect()
            rfbRef.current = null
        }

        try {
            await fetch(`/api/vnc/${id}/stop`, { method: 'POST' })
        } catch (err) {
            console.error('Failed to stop VNC:', err)
        }

        setSession(null)
        setConnected(false)
    }

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!containerRef.current) return

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    // Send Ctrl+Alt+Del
    const sendCtrlAltDel = () => {
        if (rfbRef.current) {
            console.log('Sending Ctrl+Alt+Del')
            rfbRef.current.sendCtrlAltDel()
        } else {
            console.log('RFB not connected')
        }
        setKeyMenuAnchor(null)
    }

    // Send Alt+Tab using XK keysyms
    const sendAltTab = () => {
        if (rfbRef.current) {
            console.log('Sending Alt+Tab')
            // XK_Alt_L = 0xffe9, XK_Tab = 0xff09
            rfbRef.current.sendKey(0xffe9, null, true)   // Alt down
            rfbRef.current.sendKey(0xff09, null, true)   // Tab down
            rfbRef.current.sendKey(0xff09, null, false)  // Tab up
            rfbRef.current.sendKey(0xffe9, null, false)  // Alt up
        } else {
            console.log('RFB not connected')
        }
        setKeyMenuAnchor(null)
    }

    // Send Super/Windows key
    const sendSuper = () => {
        if (rfbRef.current) {
            console.log('Sending Super key')
            // XK_Super_L = 0xffeb
            rfbRef.current.sendKey(0xffeb, null, true)
            rfbRef.current.sendKey(0xffeb, null, false)
        } else {
            console.log('RFB not connected')
        }
        setKeyMenuAnchor(null)
    }

    // Send Alt+F4
    const sendAltF4 = () => {
        if (rfbRef.current) {
            console.log('Sending Alt+F4')
            // XK_Alt_L = 0xffe9, XK_F4 = 0xffc1
            rfbRef.current.sendKey(0xffe9, null, true)
            rfbRef.current.sendKey(0xffc1, null, true)
            rfbRef.current.sendKey(0xffc1, null, false)
            rfbRef.current.sendKey(0xffe9, null, false)
        } else {
            console.log('RFB not connected')
        }
        setKeyMenuAnchor(null)
    }

    // Send Escape
    const sendEscape = () => {
        if (rfbRef.current) {
            console.log('Sending Escape')
            // XK_Escape = 0xff1b
            rfbRef.current.sendKey(0xff1b, null, true)
            rfbRef.current.sendKey(0xff1b, null, false)
        } else {
            console.log('RFB not connected')
        }
        setKeyMenuAnchor(null)
    }

    // Send Print Screen
    const sendPrintScreen = () => {
        if (rfbRef.current) {
            console.log('Sending Print Screen')
            // XK_Print = 0xff61
            rfbRef.current.sendKey(0xff61, null, true)
            rfbRef.current.sendKey(0xff61, null, false)
        } else {
            console.log('RFB not connected')
        }
        setKeyMenuAnchor(null)
    }

    // Toggle view-only mode
    const toggleViewOnly = () => {
        const newViewOnly = !viewOnly
        setViewOnly(newViewOnly)
        if (rfbRef.current) {
            console.log('Setting viewOnly to', newViewOnly)
            rfbRef.current.viewOnly = newViewOnly
        }
        setKeyMenuAnchor(null)
    }

    // Copy VNC address to clipboard
    const copyVncAddress = () => {
        if (session && machine) {
            navigator.clipboard.writeText(`${machine.ip}:${session.vnc_port}`)
        }
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rfbRef.current) {
                rfbRef.current.disconnect()
            }
        }
    }, [])

    // Listen for fullscreen changes and trigger RFB resize
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isNowFullscreen = !!document.fullscreenElement
            setIsFullscreen(isNowFullscreen)
            
            // Force noVNC to recalculate screen dimensions after fullscreen change
            if (rfbRef.current) {
                // Small delay to let the DOM settle after fullscreen transition
                setTimeout(() => {
                    if (rfbRef.current) {
                        // Trigger a resize by toggling scaleViewport
                        rfbRef.current.scaleViewport = false
                        rfbRef.current.scaleViewport = true
                    }
                }, 100)
            }
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 2,
                pb: 2,
                borderBottom: `1px solid ${colors.border.light}`
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => navigate(-1)} sx={{ color: colors.text.secondary }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Box>
                        <Typography variant="h5" sx={{ 
                            color: colors.text.primary, 
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}>
                            <DesktopWindowsIcon sx={{ color: colors.primary }} />
                            Remote Desktop
                        </Typography>
                        {machine && (
                            <Typography sx={{ color: colors.text.secondary, fontSize: '0.9rem' }}>
                                {machine.name} ({machine.ip})
                            </Typography>
                        )}
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {connected && (
                        <>
                            <Chip 
                                label="Connected" 
                                size="small"
                                sx={{ 
                                    background: 'rgba(34, 197, 94, 0.1)', 
                                    color: colors.secondary,
                                    fontWeight: 600
                                }} 
                            />
                            <IconButton 
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setKeyMenuAnchor(e.currentTarget)
                                }}
                                sx={{ color: colors.text.muted }}
                                title="Special Keys"
                            >
                                <KeyboardIcon />
                            </IconButton>
                            <Menu
                                anchorEl={keyMenuAnchor}
                                open={Boolean(keyMenuAnchor)}
                                onClose={() => setKeyMenuAnchor(null)}
                                PaperProps={{
                                    sx: {
                                        background: 'rgba(17, 24, 39, 0.95)',
                                        backdropFilter: 'blur(10px)',
                                        border: `1px solid ${colors.border.light}`,
                                        minWidth: 200
                                    }
                                }}
                            >
                                <MenuItem onClick={sendCtrlAltDel}>
                                    <ListItemText primary="Ctrl + Alt + Del" />
                                </MenuItem>
                                <MenuItem onClick={sendAltTab}>
                                    <ListItemText primary="Alt + Tab" />
                                </MenuItem>
                                <MenuItem onClick={sendSuper}>
                                    <ListItemText primary="Super / Windows Key" />
                                </MenuItem>
                                <MenuItem onClick={sendAltF4}>
                                    <ListItemText primary="Alt + F4" />
                                </MenuItem>
                                <MenuItem onClick={sendEscape}>
                                    <ListItemText primary="Escape" />
                                </MenuItem>
                                <MenuItem onClick={sendPrintScreen}>
                                    <ListItemText primary="Print Screen" />
                                </MenuItem>
                                <Divider sx={{ borderColor: colors.border.light }} />
                                <MenuItem onClick={toggleViewOnly}>
                                    <ListItemText 
                                        primary={viewOnly ? "Enable Input" : "View Only Mode"}
                                        secondary={viewOnly ? "Currently view-only" : "Disable keyboard/mouse"}
                                    />
                                </MenuItem>
                            </Menu>
                            <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                                <IconButton 
                                    onClick={toggleFullscreen}
                                    sx={{ color: colors.text.muted }}
                                >
                                    {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                </IconButton>
                            </Tooltip>
                            <Button
                                onClick={stopSession}
                                startIcon={<PowerSettingsNewIcon />}
                                sx={{ 
                                    color: colors.error,
                                    '&:hover': { background: 'rgba(255, 68, 102, 0.1)' }
                                }}
                            >
                                Disconnect
                            </Button>
                        </>
                    )}
                    {!connected && !connecting && (
                        <Button
                            onClick={startSession}
                            variant="contained"
                            startIcon={<DesktopWindowsIcon />}
                            disabled={!machine}
                            sx={{ 
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                '&:hover': { background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)' }
                            }}
                        >
                            Connect
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert 
                    severity="error" 
                    onClose={() => setError(null)}
                    sx={{ mb: 2 }}
                >
                    {error}
                </Alert>
            )}

            {/* VNC Canvas Container */}
            <Box 
                ref={containerRef}
                sx={{ 
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: colors.background.dark,
                    borderRadius: '12px',
                    border: `1px solid ${colors.border.light}`,
                    overflow: 'hidden',
                    position: 'relative',
                    minHeight: 400
                }}
            >
                {connecting && (
                    <Box sx={{ textAlign: 'center' }}>
                        <CircularProgress sx={{ color: colors.primary, mb: 2 }} />
                        <Typography sx={{ color: colors.text.secondary }}>
                            Starting remote desktop session...
                        </Typography>
                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.85rem', mt: 1 }}>
                            Starting x11vnc on {machine?.name}
                        </Typography>
                    </Box>
                )}

                {!connecting && !connected && !error && (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                        <DesktopWindowsIcon sx={{ fontSize: 80, color: colors.text.disabled, mb: 2 }} />
                        <Typography sx={{ color: colors.text.secondary, mb: 1 }}>
                            Remote Desktop
                        </Typography>
                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.9rem', mb: 3, maxWidth: 400 }}>
                            Connect to view and control the desktop of {machine?.name || 'this machine'}.
                            This requires x11vnc to be installed on the target machine.
                        </Typography>
                        <Button
                            onClick={startSession}
                            variant="contained"
                            size="large"
                            startIcon={<DesktopWindowsIcon />}
                            disabled={!machine}
                            sx={{ 
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                '&:hover': { background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)' },
                                px: 4, py: 1.5
                            }}
                        >
                            Start Session
                        </Button>
                    </Box>
                )}

                {/* VNC Display */}
                {(connected || connecting) && (
                    <Box
                        ref={canvasRef}
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: connected ? 'block' : 'none',
                            '& canvas': {
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain'
                            }
                        }}
                    />
                )}

                {/* Fallback info when noVNC isn't working */}
                {connected && session && !rfbRef.current && (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                        <Typography sx={{ color: colors.secondary, fontWeight: 600, mb: 2 }}>
                            VNC Server Running
                        </Typography>
                        <Typography sx={{ color: colors.text.secondary, mb: 2 }}>
                            x11vnc is running on {machine?.name}. You can connect using any VNC client:
                        </Typography>
                        <Box sx={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            borderRadius: '8px', 
                            p: 2,
                            fontFamily: 'monospace'
                        }}>
                            <Typography sx={{ color: colors.primary }}>
                                {machine?.ip}:{session.vnc_port}
                            </Typography>
                        </Box>
                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.85rem', mt: 2 }}>
                            Display: {session.display}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    )
}

export default RemoteDesktop
