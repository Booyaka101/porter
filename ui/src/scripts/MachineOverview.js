import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'
import MemoryIcon from '@mui/icons-material/Memory'
import StorageIcon from '@mui/icons-material/Storage'
import SpeedIcon from '@mui/icons-material/Speed'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'
import DnsIcon from '@mui/icons-material/Dns'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import UpdateIcon from '@mui/icons-material/Update'
import TerminalIcon from '@mui/icons-material/Terminal'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import TimelineIcon from '@mui/icons-material/Timeline'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useAuth } from './AuthContext'

const MachineOverview = ({ machine, machineId }) => {
    const navigate = useNavigate()
    const { canAccessTools, canAccessTerminal } = useAuth()
    const [health, setHealth] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionLoading, setActionLoading] = useState(null)
    const [historyData, setHistoryData] = useState([])
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [agentConnected, setAgentConnected] = useState(false)
    const [agentMode, setAgentMode] = useState(false)
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
    const abortControllerRef = useRef(null)
    const isMountedRef = useRef(true)
    const wsRef = useRef(null)

    const loadHealth = useCallback(async () => {
        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        
        setLoading(true)
        setError(null)
        
        try {
            const res = await fetch(`/api/machines/${machineId}/health`, {
                signal: abortControllerRef.current.signal
            })
            const data = await res.json()
            if (isMountedRef.current) {
                setHealth(data)
                setLoading(false)
            }
        } catch (err) {
            if (err.name !== 'AbortError' && isMountedRef.current) {
                console.error('Failed to load health:', err)
                setError(err.message)
                setLoading(false)
            }
        }
    }, [machineId])

    useEffect(() => {
        isMountedRef.current = true
        loadHealth()
        
        // Always try to connect to agent WebSocket for live updates
        const connectToAgent = () => {
            if (wsRef.current) {
                wsRef.current.close()
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const wsUrl = `${protocol}//${window.location.host}/api/standalone-agent/connect/${machineId}`
            
            console.log('Attempting agent connection:', wsUrl)
            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                console.log('Agent WebSocket connected!')
                setAgentConnected(true)
                setAgentMode(true)
            }

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (isMountedRef.current) {
                        setHealth({
                            cpu_usage: `${data.cpu_usage?.toFixed(1) || 0}%`,
                            memory_usage: `${data.memory_usage?.toFixed(1) || 0}%`,
                            disk_usage: `${data.disk_usage?.toFixed(1) || 0}%`,
                            uptime: data.uptime,
                            load_avg: data.load_average,
                            memory_total: data.memory_total,
                            memory_free: data.memory_used ? `${data.memory_total} - ${data.memory_used}` : '-',
                            disk_total: data.disk_total,
                            disk_free: data.disk_used ? `${data.disk_total} - ${data.disk_used}` : '-',
                            process_count: data.process_count,
                            hostname: data.hostname,
                            os_info: data.os_info,
                            kernel_version: data.kernel_version,
                            cpu_model: data.cpu_model,
                            network_rx: data.network_rx,
                            network_tx: data.network_tx
                        })
                        setLoading(false)
                    }
                } catch (e) {
                    console.error('Failed to parse agent data:', e)
                }
            }

            ws.onclose = () => {
                console.log('Agent WebSocket disconnected, will retry in 5s')
                setAgentConnected(false)
                if (isMountedRef.current) {
                    setTimeout(connectToAgent, 5000)
                }
            }

            ws.onerror = (err) => {
                console.log('Agent WebSocket error (agent may not be running):', err)
                setAgentConnected(false)
            }
        }

        connectToAgent()
        
        return () => {
            isMountedRef.current = false
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [loadHealth, machineId])

    useEffect(() => {
        if (!autoRefresh || agentMode) return
        const interval = setInterval(() => {
            if (isMountedRef.current) loadHealth()
        }, 30000)
        return () => clearInterval(interval)
    }, [autoRefresh, loadHealth])

    useEffect(() => {
        if (health) {
            const timestamp = new Date().toLocaleTimeString()
            setHistoryData(prev => {
                const newData = [...prev, {
                    time: timestamp,
                    cpu: parsePercent(health.cpu_usage),
                    memory: parsePercent(health.memory_usage),
                    disk: parsePercent(health.disk_usage)
                }]
                return newData.slice(-30)
            })
        }
    }, [health])

    const parsePercent = (str) => {
        if (!str) return 0
        const match = str.match(/([\d.]+)%?/)
        return match ? parseFloat(match[1]) : 0
    }

    const parseLoad = (loadStr) => {
        if (!loadStr) return 0
        const parts = loadStr.split(' ')
        return parseFloat(parts[0]) || 0
    }

    const copySystemInfo = () => {
        const info = [
            `Machine: ${machine?.name || 'Unknown'}`,
            `IP: ${machine?.ip || 'Unknown'}`,
            `Hostname: ${health?.hostname || 'Unknown'}`,
            `OS: ${health?.os_info || 'Unknown'}`,
            `Kernel: ${health?.kernel_version || 'Unknown'}`,
            `CPU: ${health?.cpu_model || 'Unknown'} (${health?.cpu_cores || '?'} cores)`,
            `Uptime: ${health?.uptime || 'Unknown'}`,
            `Load: ${health?.load_avg || 'Unknown'}`,
            `CPU Usage: ${health?.cpu_usage || 'Unknown'}`,
            `Memory: ${health?.memory_usage || 'Unknown'} (${health?.memory_total || '?'} total)`,
            `Disk: ${health?.disk_usage || 'Unknown'} (${health?.disk_total || '?'} total)`,
            `Network RX: ${health?.network_rx || 'Unknown'}`,
            `Network TX: ${health?.network_tx || 'Unknown'}`,
            `Processes: ${health?.process_count || 'Unknown'}`,
        ].join('\n')
        navigator.clipboard.writeText(info)
        setToast({ open: true, message: 'System info copied to clipboard', severity: 'success' })
    }

    const memoryPercent = parsePercent(health?.memory_usage)
    const diskPercent = parsePercent(health?.disk_usage)
    const cpuPercent = parsePercent(health?.cpu_usage)
    const loadValue = parseLoad(health?.load_avg)

    const MetricCard = ({ icon: Icon, title, value, subtitle, color, progress }) => (
        <Card sx={{ 
            background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.9) 0%, rgba(17, 23, 35, 0.95) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            height: '100%',
            transition: 'all 0.2s ease',
            '&:hover': {
                border: `1px solid ${color}40`,
                transform: 'translateY(-2px)',
            }
        }}>
            <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', mb: 0.5 }}>
                            {title}
                        </Typography>
                        <Typography sx={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace' }}>
                            {value || '-'}
                        </Typography>
                    </Box>
                    <Box sx={{
                        width: 44, height: 44, borderRadius: '12px',
                        background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
                        border: `1px solid ${color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Icon sx={{ color, fontSize: 22 }} />
                    </Box>
                </Box>
                {progress !== undefined && (
                    <Box sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>Usage</Typography>
                            <Typography sx={{ color: progress > 80 ? '#ff3366' : progress > 60 ? '#ffaa00' : color, fontSize: '0.65rem', fontWeight: 600 }}>
                                {Math.round(progress)}%
                            </Typography>
                        </Box>
                        <LinearProgress 
                            variant="determinate" 
                            value={Math.min(progress, 100)}
                            sx={{
                                height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)',
                                '& .MuiLinearProgress-bar': {
                                    background: progress > 80 ? '#ff3366' : progress > 60 ? '#ffaa00' : color,
                                    borderRadius: 2,
                                }
                            }}
                        />
                    </Box>
                )}
                {subtitle && (
                    <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', mt: 1 }}>
                        {subtitle}
                    </Typography>
                )}
            </CardContent>
        </Card>
    )

    return (
        <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>System Health</Typography>
                    {agentMode && (
                        <Chip 
                            icon={agentConnected ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <CircularProgress size={12} sx={{ color: 'inherit' }} />}
                            label={agentConnected ? "Agent Live" : "Agent Connecting..."}
                            size="small"
                            color={agentConnected ? "success" : "warning"}
                            sx={{ height: 24, fontSize: '0.7rem', '& .MuiChip-icon': { ml: 0.5 } }}
                        />
                    )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {!agentMode && (
                        <>
                            <Tooltip title={autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}>
                                <IconButton onClick={() => setAutoRefresh(!autoRefresh)} size="small">
                                    {autoRefresh ? <PauseIcon sx={{ color: '#ffaa00', fontSize: 18 }} /> : <PlayArrowIcon sx={{ color: '#22c55e', fontSize: 18 }} />}
                                </IconButton>
                            </Tooltip>
                            <Chip label={autoRefresh ? "Polling" : "Paused"} size="small" color={autoRefresh ? "info" : "default"} sx={{ height: 22, fontSize: '0.7rem' }} />
                        </>
                    )}
                    <Tooltip title="Copy System Info">
                        <IconButton onClick={copySystemInfo} size="small" disabled={!health}>
                            <ContentCopyIcon sx={{ color: '#8be9fd', fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                    <IconButton onClick={loadHealth} disabled={loading} size="small">
                        {loading ? <CircularProgress size={20} /> : <RefreshIcon sx={{ color: '#f97316' }} />}
                    </IconButton>
                </Box>
            </Box>

            {health ? (
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                        <MetricCard
                            icon={SpeedIcon}
                            title="CPU Usage"
                            value={health.cpu_usage || '-'}
                            color="#f97316"
                            progress={cpuPercent}
                            subtitle={`Load: ${health.load_avg || '-'}`}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <MetricCard
                            icon={MemoryIcon}
                            title="Memory"
                            value={health.memory_usage || '-'}
                            color="#ff00ff"
                            progress={memoryPercent}
                            subtitle={`${health.memory_free || '-'} free of ${health.memory_total || '-'}`}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <MetricCard
                            icon={StorageIcon}
                            title="Disk"
                            value={health.disk_usage || '-'}
                            color="#22c55e"
                            progress={diskPercent}
                            subtitle={`${health.disk_free || '-'} free of ${health.disk_total || '-'}`}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <MetricCard
                            icon={AccessTimeIcon}
                            title="Uptime"
                            value={health.uptime || '-'}
                            color="#ffaa00"
                            subtitle={`${health.process_count || '-'} processes`}
                        />
                    </Grid>
                </Grid>
            ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">Unable to fetch health data</Typography>
                </Box>
            )}

            {/* Performance History Chart */}
            {historyData.length > 1 && (
                <Box sx={{ mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <TimelineIcon sx={{ color: '#f97316' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>Performance History</Typography>
                        <Chip label={`${historyData.length} samples`} size="small" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />
                    </Box>
                    <Card sx={{ background: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(255,255,255,0.05)', p: 2 }}>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={historyData}>
                                <defs>
                                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff00ff" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ff00ff" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                <RechartsTooltip 
                                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8 }}
                                    labelStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="cpu" stroke="#f97316" fill="url(#cpuGrad)" strokeWidth={2} name="CPU" />
                                <Area type="monotone" dataKey="memory" stroke="#ff00ff" fill="url(#memGrad)" strokeWidth={2} name="Memory" />
                            </AreaChart>
                        </ResponsiveContainer>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 12, height: 3, bgcolor: '#f97316', borderRadius: 1 }} />
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>CPU</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 12, height: 3, bgcolor: '#ff00ff', borderRadius: 1 }} />
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Memory</Typography>
                            </Box>
                        </Box>
                    </Card>
                </Box>
            )}

            {/* Quick Actions - hidden for viewers */}
            {canAccessTools() && (
            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Quick Actions</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {canAccessTerminal() && (
                    <Tooltip title="Open interactive terminal">
                        <Button 
                            variant="outlined" 
                            startIcon={<TerminalIcon />}
                            onClick={() => navigate(`/machines/${machineId}/terminal`)}
                            sx={{ borderColor: 'rgba(0,212,255,0.5)', color: '#f97316', '&:hover': { borderColor: '#f97316', bgcolor: 'rgba(0,212,255,0.1)' } }}
                        >
                            Terminal
                        </Button>
                    </Tooltip>
                    )}
                    <Tooltip title="Update system packages">
                        <Button 
                            variant="outlined" 
                            startIcon={actionLoading === 'update' ? <CircularProgress size={18} /> : <UpdateIcon />}
                            disabled={actionLoading !== null}
                            onClick={async () => {
                                setActionLoading('update')
                                try {
                                    await fetch(`/api/machines/${machineId}/command`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ command: 'sudo apt update && sudo apt upgrade -y' })
                                    })
                                } finally {
                                    setActionLoading(null)
                                }
                            }}
                            sx={{ borderColor: 'rgba(0,255,136,0.5)', color: '#22c55e', '&:hover': { borderColor: '#22c55e', bgcolor: 'rgba(0,255,136,0.1)' } }}
                        >
                            Update System
                        </Button>
                    </Tooltip>
                    <Tooltip title="Clean up disk space">
                        <Button 
                            variant="outlined" 
                            startIcon={actionLoading === 'cleanup' ? <CircularProgress size={18} /> : <CleaningServicesIcon />}
                            disabled={actionLoading !== null}
                            onClick={async () => {
                                setActionLoading('cleanup')
                                try {
                                    await fetch(`/api/machines/${machineId}/command`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ command: 'sudo apt autoremove -y && sudo apt clean && sudo journalctl --vacuum-time=7d' })
                                    })
                                } finally {
                                    setActionLoading(null)
                                    loadHealth()
                                }
                            }}
                            sx={{ borderColor: 'rgba(255,170,0,0.5)', color: '#ffaa00', '&:hover': { borderColor: '#ffaa00', bgcolor: 'rgba(255,170,0,0.1)' } }}
                        >
                            Cleanup
                        </Button>
                    </Tooltip>
                    <Tooltip title="Reboot the machine">
                        <Button 
                            variant="outlined" 
                            startIcon={actionLoading === 'reboot' ? <CircularProgress size={18} /> : <RestartAltIcon />}
                            disabled={actionLoading !== null}
                            onClick={async () => {
                                if (window.confirm('Are you sure you want to reboot this machine?')) {
                                    setActionLoading('reboot')
                                    try {
                                        await fetch(`/api/machines/${machineId}/command`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ command: 'sudo reboot' })
                                        })
                                    } finally {
                                        setActionLoading(null)
                                    }
                                }
                            }}
                            sx={{ borderColor: 'rgba(255,51,102,0.5)', color: '#ff3366', '&:hover': { borderColor: '#ff3366', bgcolor: 'rgba(255,51,102,0.1)' } }}
                        >
                            Reboot
                        </Button>
                    </Tooltip>
                    <Tooltip title="Shutdown the machine">
                        <Button 
                            variant="outlined" 
                            startIcon={actionLoading === 'shutdown' ? <CircularProgress size={18} /> : <PowerSettingsNewIcon />}
                            disabled={actionLoading !== null}
                            onClick={async () => {
                                if (window.confirm('Are you sure you want to shutdown this machine?')) {
                                    setActionLoading('shutdown')
                                    try {
                                        await fetch(`/api/machines/${machineId}/command`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ command: 'sudo shutdown now' })
                                        })
                                    } finally {
                                        setActionLoading(null)
                                    }
                                }
                            }}
                            sx={{ borderColor: 'rgba(255,0,0,0.5)', color: '#ff0000', '&:hover': { borderColor: '#ff0000', bgcolor: 'rgba(255,0,0,0.1)' } }}
                        >
                            Shutdown
                        </Button>
                    </Tooltip>
                </Box>
            </Box>
            )}

            {/* System Info */}
            {health && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>System Information</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Card sx={{ background: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>Hostname</Typography>
                                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{health.hostname || machine.name}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>OS</Typography>
                                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{health.os_info || '-'}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>Kernel</Typography>
                                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{health.kernel_version || '-'}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>CPU</Typography>
                                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem', maxWidth: 200, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{health.cpu_model || '-'}</Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card sx={{ background: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>IP Address</Typography>
                                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{machine.ip}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>Username</Typography>
                                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{machine.username}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>Status</Typography>
                                            <Chip 
                                                label={machine.status === 'online' ? 'Online' : 'Offline'}
                                                size="small"
                                                color={machine.status === 'online' ? 'success' : 'error'}
                                                sx={{ height: 22 }}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>Network</Typography>
                                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>↓{health.network_rx || '-'} ↑{health.network_tx || '-'}</Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* Toast Notification */}
            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} sx={{ width: '100%' }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default MachineOverview
