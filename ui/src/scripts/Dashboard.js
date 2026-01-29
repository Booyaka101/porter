import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import ComputerIcon from '@mui/icons-material/Computer'
import CodeIcon from '@mui/icons-material/Code'
import ScheduleIcon from '@mui/icons-material/Schedule'
import HistoryIcon from '@mui/icons-material/History'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RefreshIcon from '@mui/icons-material/Refresh'
import WifiIcon from '@mui/icons-material/Wifi'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import StorageIcon from '@mui/icons-material/Storage'
import MemoryIcon from '@mui/icons-material/Memory'
import SpeedIcon from '@mui/icons-material/Speed'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import TerminalIcon from '@mui/icons-material/Terminal'
import AddIcon from '@mui/icons-material/Add'
import BoltIcon from '@mui/icons-material/Bolt'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'
import FolderIcon from '@mui/icons-material/Folder'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import { useNavigate } from 'react-router-dom'
import { colors, scrollableStyles } from './theme'
import { useAuth } from './AuthContext'

// Stat Card Component - enhanced with gradients and glow
const StatCard = ({ icon: Icon, title, value, subtitle, color, trend, onClick, glowColor }) => (
    <Card 
        onClick={onClick}
        sx={{ 
            background: `linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)`,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            height: 140,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, ${color}, ${glowColor || color})`,
                opacity: 0.8,
            },
            '&:hover': onClick ? {
                transform: 'translateY(-4px)',
                background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`,
                borderColor: `${color}40`,
                boxShadow: `0 8px 32px ${color}20`,
            } : {},
        }}
    >
        <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '12px',
                    background: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Icon sx={{ color, fontSize: 22 }} />
                </Box>
                {trend !== undefined && (
                    <Chip 
                        label={`${trend > 0 ? '+' : ''}${trend}%`}
                        size="small"
                        sx={{
                            background: trend >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: trend >= 0 ? '#22c55e' : '#ef4444',
                            height: 22,
                            fontSize: '0.75rem',
                        }}
                    />
                )}
            </Box>
            <Box>
                <Typography sx={{ 
                    fontSize: '1.75rem', 
                    fontWeight: 600, 
                    color: '#fafafa',
                    lineHeight: 1,
                }}>
                    {value}
                </Typography>
                <Typography sx={{ 
                    color: 'rgba(255,255,255,0.5)', 
                    fontSize: '0.8rem', 
                    mt: 0.5 
                }}>
                    {title}
                </Typography>
            </Box>
        </CardContent>
    </Card>
)

// Activity Item Component - Larger Design
const ActivityItem = ({ execution, onClick }) => {
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000)
        if (seconds < 60) return 'Just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        return `${Math.floor(seconds / 86400)}d ago`
    }

    return (
        <Box 
            onClick={onClick}
            sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                p: 2,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                    background: 'rgba(255,255,255,0.03)',
                },
                '&:last-child': {
                    borderBottom: 'none',
                }
            }}
        >
            <Box sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: execution.success ? colors.secondary : colors.error,
                boxShadow: `0 0 10px ${execution.success ? colors.secondary : colors.error}`,
                flexShrink: 0,
            }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ 
                    color: colors.text.primary, 
                    fontWeight: 500, 
                    fontSize: '1rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {execution.script_name}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    {execution.machine_name}
                </Typography>
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                {timeAgo(execution.started_at)}
            </Typography>
        </Box>
    )
}

// Machine Health Card
const MachineHealthCard = ({ machine, health }) => {
    // Use health data if available, otherwise fall back to machine status
    const isOnline = health?.online || machine.status === 'online'
    
    const getStatusColor = () => {
        if (!isOnline) return colors.error
        return colors.secondary
    }

    const parsePercent = (str) => {
        if (!str) return 0
        const match = str.match(/(\d+\.?\d*)%?/)
        return match ? parseFloat(match[1]) : 0
    }

    return (
        <Card sx={{ 
            background: colors.background.glass,
            border: `1px solid ${colors.border.light}`,
            borderRadius: '8px',
            height: 60,
        }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Box sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: getStatusColor(),
                        boxShadow: `0 0 4px ${getStatusColor()}`,
                    }} />
                    <Typography sx={{ color: colors.text.primary, fontWeight: 600, flex: 1, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {machine.name}
                    </Typography>
                </Box>
                
                {isOnline ? (
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Tooltip title={`CPU: ${health?.load_avg || '-'}`}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <SpeedIcon sx={{ fontSize: 10, color: colors.text.disabled }} />
                                <Typography sx={{ fontSize: '0.6rem', color: colors.text.muted }}>
                                    {health?.load_avg?.split(' ')[0] || '-'}
                                </Typography>
                            </Box>
                        </Tooltip>
                        <Tooltip title={`RAM: ${health?.memory_usage || '-'}`}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <MemoryIcon sx={{ fontSize: 10, color: colors.text.disabled }} />
                                <Typography sx={{ fontSize: '0.6rem', color: colors.text.muted }}>
                                    {health?.memory_usage || '-'}
                                </Typography>
                            </Box>
                        </Tooltip>
                        <Tooltip title={`Disk: ${health?.disk_usage || '-'}`}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <StorageIcon sx={{ fontSize: 10, color: colors.text.disabled }} />
                                <Typography sx={{ fontSize: '0.6rem', color: colors.text.muted }}>
                                    {health?.disk_usage || '-'}
                                </Typography>
                            </Box>
                        </Tooltip>
                    </Box>
                ) : (
                    <Typography sx={{ color: colors.error, fontSize: '0.6rem' }}>
                        Offline
                    </Typography>
                )}
            </CardContent>
        </Card>
    )
}

// Upcoming Job Card
const UpcomingJobCard = ({ job }) => {
    const formatNextRun = (date) => {
        if (!date || date === '0001-01-01T00:00:00Z') return 'Not scheduled'
        const d = new Date(date)
        const now = new Date()
        const diff = d - now
        
        if (diff < 0) return 'Overdue'
        if (diff < 3600000) return `In ${Math.floor(diff / 60000)} min`
        if (diff < 86400000) return `In ${Math.floor(diff / 3600000)} hours`
        return d.toLocaleDateString()
    }

    return (
        <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            p: 2,
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.02)',
        }}>
            <Box sx={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: job.enabled ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <ScheduleIcon sx={{ 
                    color: job.enabled ? '#f97316' : 'rgba(255,255,255,0.3)', 
                    fontSize: 18 
                }} />
            </Box>
            <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: colors.text.primary, fontWeight: 500, fontSize: '0.9rem' }}>
                    {job.name}
                </Typography>
                <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                    {job.machine_ids?.length || 0} machines
                </Typography>
            </Box>
            <Chip 
                label={formatNextRun(job.next_run)}
                size="small"
                sx={{
                    background: 'rgba(249, 115, 22, 0.1)',
                    color: '#f97316',
                    fontSize: '0.75rem',
                    height: 24,
                }}
            />
        </Box>
    )
}

// Quick Action Button - larger and more prominent
const QuickAction = ({ icon: Icon, label, color, onClick, description }) => (
    <Button
        onClick={onClick}
        sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            p: 3,
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            flex: 1,
            minWidth: 140,
            minHeight: 100,
            textTransform: 'none',
            transition: 'all 0.2s ease',
            '&:hover': {
                background: `${color}15`,
                borderColor: `${color}40`,
                transform: 'translateY(-2px)',
            },
        }}
    >
        <Icon sx={{ color, fontSize: 32 }} />
        <Typography sx={{ color: '#fafafa', fontSize: '0.9rem', fontWeight: 500 }}>
            {label}
        </Typography>
        {description && (
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                {description}
            </Typography>
        )}
    </Button>
)

// Alerts Banner Component - Shows critical issues
const AlertsBanner = ({ healthData, machines, navigate }) => {
    const alerts = []
    
    // Check for offline machines
    const offlineMachines = machines.filter(m => {
        const h = healthData[m.id]
        return !h?.online && m.status !== 'offline'
    })
    if (offlineMachines.length > 0) {
        alerts.push({
            type: 'error',
            icon: CloudOffIcon,
            message: `${offlineMachines.length} machine${offlineMachines.length > 1 ? 's' : ''} offline`,
            details: offlineMachines.map(m => m.name).join(', '),
            action: () => navigate('/machines'),
        })
    }
    
    // Check for high CPU usage (>90%)
    const highCpuMachines = Object.entries(healthData).filter(([id, h]) => {
        if (!h?.online) return false
        const cpu = parseFloat(h.cpu_usage?.replace('%', '') || h.load_avg?.split(' ')[0] || '0')
        return cpu > 90
    })
    if (highCpuMachines.length > 0) {
        alerts.push({
            type: 'warning',
            icon: SpeedIcon,
            message: `High CPU on ${highCpuMachines.length} machine${highCpuMachines.length > 1 ? 's' : ''}`,
            details: highCpuMachines.map(([id, h]) => `${h.machine_name || id}: ${h.cpu_usage || h.load_avg}`).join(', '),
            action: () => navigate('/machines'),
        })
    }
    
    // Check for low disk space (<10% free = >90% used)
    const lowDiskMachines = Object.entries(healthData).filter(([id, h]) => {
        if (!h?.online) return false
        const disk = parseFloat(h.disk_usage?.replace('%', '') || '0')
        return disk > 90
    })
    if (lowDiskMachines.length > 0) {
        alerts.push({
            type: 'error',
            icon: StorageIcon,
            message: `Low disk space on ${lowDiskMachines.length} machine${lowDiskMachines.length > 1 ? 's' : ''}`,
            details: lowDiskMachines.map(([id, h]) => `${h.machine_name || id}: ${h.disk_usage}`).join(', '),
            action: () => navigate('/machines'),
        })
    }
    
    // Check for high memory (>90%)
    const highMemMachines = Object.entries(healthData).filter(([id, h]) => {
        if (!h?.online) return false
        const mem = parseFloat(h.memory_usage?.replace('%', '') || '0')
        return mem > 90
    })
    if (highMemMachines.length > 0) {
        alerts.push({
            type: 'warning',
            icon: MemoryIcon,
            message: `High memory on ${highMemMachines.length} machine${highMemMachines.length > 1 ? 's' : ''}`,
            details: highMemMachines.map(([id, h]) => `${h.machine_name || id}: ${h.memory_usage}`).join(', '),
            action: () => navigate('/machines'),
        })
    }
    
    if (alerts.length === 0) return null
    
    return (
        <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {alerts.map((alert, idx) => (
                <Box
                    key={idx}
                    onClick={alert.action}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        background: alert.type === 'error' 
                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)'
                            : 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)',
                        border: `1px solid ${alert.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            transform: 'translateX(4px)',
                            borderColor: alert.type === 'error' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(234, 179, 8, 0.5)',
                        }
                    }}
                >
                    <Box sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        background: alert.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <alert.icon sx={{ 
                            color: alert.type === 'error' ? '#ef4444' : '#eab308',
                            fontSize: 22 
                        }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography sx={{ 
                            color: alert.type === 'error' ? '#ef4444' : '#eab308',
                            fontWeight: 600,
                            fontSize: '0.95rem'
                        }}>
                            {alert.message}
                        </Typography>
                        <Typography sx={{ 
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: '0.8rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {alert.details}
                        </Typography>
                    </Box>
                    <KeyboardArrowRightIcon sx={{ 
                        color: alert.type === 'error' ? '#ef4444' : '#eab308',
                        fontSize: 20 
                    }} />
                </Box>
            ))}
        </Box>
    )
}

// Mini Sparkline Chart Component
const MiniSparkline = ({ data, color, height = 30 }) => {
    if (!data || data.length < 2) return null
    
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100
        const y = height - ((val - min) / range) * height
        return `${x},${y}`
    }).join(' ')
    
    return (
        <svg width="100%" height={height} style={{ overflow: 'visible' }}>
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle
                cx="100"
                cy={height - ((data[data.length - 1] - min) / range) * height}
                r="3"
                fill={color}
            />
        </svg>
    )
}

// System Status Indicator
const SystemStatusBadge = ({ online, total }) => {
    const percentage = total > 0 ? Math.round((online / total) * 100) : 0
    const statusColor = percentage === 100 ? '#22c55e' : percentage >= 50 ? '#eab308' : '#ef4444'
    
    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 0.75,
            borderRadius: '8px',
            background: `${statusColor}15`,
            border: `1px solid ${statusColor}30`,
        }}>
            <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusColor,
                boxShadow: `0 0 8px ${statusColor}`,
            }} />
            <Typography sx={{ color: statusColor, fontSize: '0.85rem', fontWeight: 600 }}>
                {online}/{total} Online
            </Typography>
        </Box>
    )
}

const Dashboard = () => {
    const navigate = useNavigate()
    const { canExecute, canWrite, canAccessFiles, canAccessTools, isViewerOnly } = useAuth()
    const canRunScripts = canExecute()
    const canEditMachines = canWrite('machines')
    const isViewer = isViewerOnly()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        machines: { total: 0, online: 0 },
        scripts: { total: 0, custom: 0 },
        jobs: { total: 0, enabled: 0 },
        executions: { total: 0, success: 0, today: 0 }
    })
    const [recentExecutions, setRecentExecutions] = useState([])
    const [upcomingJobs, setUpcomingJobs] = useState([])
    const [machines, setMachines] = useState([])
    const [healthData, setHealthData] = useState({})
    const [healthPollerConfig, setHealthPollerConfig] = useState({ enabled: true, interval_mins: 5, running: false })
    const [showSettings, setShowSettings] = useState(false)
    const [checkingHealth, setCheckingHealth] = useState(false)
    const [lastRefresh, setLastRefresh] = useState(new Date())
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [metricsHistory, setMetricsHistory] = useState({ cpu: [], memory: [], disk: [] })

    const loadDashboardData = useCallback(async () => {
        setLoading(true)
        try {
            const [
                machinesRes,
                scriptsRes,
                customScriptsRes,
                jobsRes,
                historyRes,
                historyStatsRes,
                healthRes
            ] = await Promise.all([
                fetch('/api/machines'),
                fetch('/api/scripts'),
                fetch('/api/custom-scripts'),
                fetch('/api/scheduler/jobs'),
                fetch('/api/history?limit=10'),
                fetch('/api/history/stats'),
                fetch('/api/health/cached')
            ])

            const machinesData = await machinesRes.json() || []
            const scriptsData = await scriptsRes.json() || []
            const customScriptsData = await customScriptsRes.json() || []
            const jobsData = await jobsRes.json() || []
            const historyData = await historyRes.json() || []
            const historyStats = await historyStatsRes.json() || {}
            const healthDataRes = await healthRes.json() || {}

            // Calculate stats - use machine status field or health data
            const onlineMachines = machinesData.filter(m => {
                const h = healthDataRes[m.id]
                // Use health data if available, otherwise fall back to machine status
                return h?.online || m.status === 'online'
            }).length

            const enabledJobs = jobsData.filter(j => j.enabled).length
            
            // Today's executions
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const todayExecutions = historyData.filter(e => 
                new Date(e.started_at) >= today
            ).length

            setStats({
                machines: { total: machinesData.length, online: onlineMachines },
                scripts: { total: scriptsData.length, custom: customScriptsData.length },
                jobs: { total: jobsData.length, enabled: enabledJobs },
                executions: { 
                    total: historyStats.total || 0, 
                    success: historyStats.successful || 0,
                    today: todayExecutions
                }
            })

            setRecentExecutions(historyData.slice(0, 5))
            setUpcomingJobs(jobsData.filter(j => j.enabled).slice(0, 3))
            setMachines(machinesData)
            setHealthData(healthDataRes)

        } catch (err) {
            console.error('Failed to load dashboard data:', err)
        }
        setLoading(false)
    }, [])

    // Load health poller config
    const loadHealthPollerConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/health/poller/config')
            const data = await res.json()
            setHealthPollerConfig(data)
        } catch (err) {
            console.error('Failed to load health poller config:', err)
        }
    }, [])

    // Run health check on all machines
    const runHealthCheck = useCallback(async () => {
        setCheckingHealth(true)
        try {
            const res = await fetch('/api/health', { method: 'GET' })
            const data = await res.json() || {}
            setHealthData(data)
            // Reload dashboard data to update stats
            loadDashboardData()
        } catch (err) {
            console.error('Failed to run health check:', err)
        }
        setCheckingHealth(false)
    }, [loadDashboardData])

    // Update health poller config
    const updateHealthPollerConfig = async (newConfig) => {
        try {
            await fetch('/api/health/poller/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            })
            setHealthPollerConfig(newConfig)
        } catch (err) {
            console.error('Failed to update health poller config:', err)
        }
    }

    useEffect(() => {
        loadDashboardData()
        loadHealthPollerConfig()
        // Run health check on initial load to get fresh status
        runHealthCheck()
    }, [loadDashboardData, loadHealthPollerConfig, runHealthCheck])

    // Auto-refresh interval (respects toggle)
    useEffect(() => {
        if (!autoRefresh) return
        const interval = setInterval(loadDashboardData, 30000)
        return () => clearInterval(interval)
    }, [autoRefresh, loadDashboardData])

    // Live websocket updates for machines with agents
    const wsConnectionsRef = useRef([])
    
    useEffect(() => {
        // Clean up existing connections first
        wsConnectionsRef.current.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close()
            }
        })
        wsConnectionsRef.current = []
        
        if (machines.length === 0) return
        
        const agentMachines = machines.filter(m => m.has_agent && m.agent_port)
        let isMounted = true
        
        agentMachines.forEach(machine => {
            try {
                const wsUrl = `ws://${machine.ip}:${machine.agent_port}/ws`
                const ws = new WebSocket(wsUrl)
                
                ws.onmessage = (event) => {
                    if (!isMounted) return
                    try {
                        const data = JSON.parse(event.data)
                        if (data.type === 'metrics') {
                            setHealthData(prev => ({
                                ...prev,
                                [machine.id]: {
                                    ...prev[machine.id],
                                    machine_id: machine.id,
                                    machine_name: machine.name,
                                    ip: machine.ip,
                                    online: true,
                                    last_checked: new Date().toISOString(),
                                    cpu_usage: data.metrics?.cpu_usage ? `${data.metrics.cpu_usage.toFixed(1)}%` : prev[machine.id]?.cpu_usage,
                                    memory_usage: data.metrics?.memory_usage ? `${data.metrics.memory_usage.toFixed(1)}%` : prev[machine.id]?.memory_usage,
                                    disk_usage: data.metrics?.disk_usage ? `${data.metrics.disk_usage.toFixed(1)}%` : prev[machine.id]?.disk_usage,
                                    load_avg: data.metrics?.load_average || prev[machine.id]?.load_avg,
                                    uptime: data.metrics?.uptime || prev[machine.id]?.uptime,
                                }
                            }))
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
                
                wsConnectionsRef.current.push(ws)
            } catch (e) {
                // Ignore connection errors
            }
        })
        
        return () => {
            isMounted = false
            wsConnectionsRef.current.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close()
                }
            })
            wsConnectionsRef.current = []
        }
    }, [machines])

    const successRate = stats.executions.total > 0 
        ? Math.round((stats.executions.success / stats.executions.total) * 100)
        : 0

    // Update lastRefresh when data loads
    useEffect(() => {
        if (!loading) setLastRefresh(new Date())
    }, [loading])

    // Track metrics history for sparkline charts
    useEffect(() => {
        if (Object.keys(healthData).length === 0) return
        
        const onlineMachines = Object.values(healthData).filter(h => h.online)
        if (onlineMachines.length === 0) return
        
        const avgCpu = Math.round(onlineMachines.reduce((sum, h) => {
            const cpu = parseFloat(h.cpu_usage?.replace('%', '') || h.load_avg?.split(' ')[0] || '0')
            return sum + cpu
        }, 0) / onlineMachines.length)
        
        const avgMem = Math.round(onlineMachines.reduce((sum, h) => {
            const mem = parseFloat(h.memory_usage?.replace('%', '') || '0')
            return sum + mem
        }, 0) / onlineMachines.length)
        
        const avgDisk = Math.round(onlineMachines.reduce((sum, h) => {
            const disk = parseFloat(h.disk_usage?.replace('%', '') || '0')
            return sum + disk
        }, 0) / onlineMachines.length)
        
        setMetricsHistory(prev => ({
            cpu: [...prev.cpu.slice(-19), avgCpu],
            memory: [...prev.memory.slice(-19), avgMem],
            disk: [...prev.disk.slice(-19), avgDisk],
        }))
    }, [healthData])

    return (
        <Box sx={scrollableStyles.pageContainer}>
            {/* Enhanced Header with gradient background */}
            <Box sx={{ 
                mb: 4, 
                p: 3,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(34, 197, 94, 0.05) 50%, rgba(139, 92, 246, 0.05) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.5), rgba(34, 197, 94, 0.5), transparent)',
                }
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography sx={{ 
                            fontSize: '2rem', 
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            mb: 0.5,
                            letterSpacing: '-0.02em',
                        }}>
                            Dashboard
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem' }}>
                            Real-time overview of your infrastructure
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            px: 2,
                            py: 0.75,
                            borderRadius: '10px',
                            background: 'rgba(0,0,0,0.2)',
                        }}>
                            <AccessTimeIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
                            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                {lastRefresh.toLocaleTimeString()}
                            </Typography>
                        </Box>
                        <Chip
                            icon={autoRefresh ? <BoltIcon sx={{ fontSize: 14, color: '#22c55e' }} /> : <RefreshIcon sx={{ fontSize: 14 }} />}
                            label={autoRefresh ? 'Live' : 'Paused'}
                            size="small"
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            sx={{
                                background: autoRefresh ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.05)',
                                color: autoRefresh ? '#22c55e' : 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                border: autoRefresh ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                                '&:hover': { background: autoRefresh ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.08)' }
                            }}
                        />
                        <Button
                            size="small"
                            startIcon={checkingHealth ? <CircularProgress size={14} /> : <RefreshIcon />}
                            onClick={runHealthCheck}
                            disabled={checkingHealth}
                            sx={{ 
                                textTransform: 'none',
                                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0.1) 100%)',
                                border: '1px solid rgba(249, 115, 22, 0.3)',
                                color: '#f97316',
                                fontWeight: 600,
                                borderRadius: '10px',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.25) 0%, rgba(249, 115, 22, 0.15) 100%)',
                                    borderColor: 'rgba(249, 115, 22, 0.5)',
                                }
                            }}
                        >
                            Refresh
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Alerts Banner - Shows critical issues */}
            <AlertsBanner healthData={healthData} machines={machines} navigate={navigate} />

            {/* Online Machines - Full Width Grid */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: '12px', 
                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                        }}>
                            <ComputerIcon sx={{ color: '#22c55e', fontSize: 22 }} />
                        </Box>
                        <Box>
                            <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '1.15rem' }}>
                                Online Machines
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                Active deployment targets
                            </Typography>
                        </Box>
                    </Box>
                    <Chip 
                        icon={<WifiIcon sx={{ fontSize: 14, color: '#22c55e' }} />}
                        label={`${machines.filter(m => healthData[m.id]?.online === true).length} / ${machines.length}`}
                        size="small"
                        sx={{ 
                            background: 'rgba(34, 197, 94, 0.1)', 
                            color: '#22c55e', 
                            fontSize: '0.85rem', 
                            height: 30,
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            fontWeight: 600,
                        }}
                    />
                </Box>
                <Grid container spacing={2}>
                    {loading ? (
                        [1, 2, 3, 4].map(i => (
                            <Grid item xs={12} sm={6} md={3} key={i}>
                                <Skeleton variant="rounded" height={120} sx={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px' }} />
                            </Grid>
                        ))
                    ) : machines.filter(m => healthData[m.id]?.online === true).length === 0 ? (
                        <Grid item xs={12}>
                            <Box sx={{ 
                                p: 4, 
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '16px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                textAlign: 'center',
                            }}>
                                <ComputerIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>
                                    No machines online
                                </Typography>
                            </Box>
                        </Grid>
                    ) : (
                        machines
                            .filter(m => healthData[m.id]?.online === true)
                            .map((machine, index) => {
                                const health = healthData[machine.id]
                                const cpuVal = parseFloat(health?.cpu_usage?.replace('%', '') || health?.load_avg?.split(' ')[0] || '0')
                                const memVal = parseFloat(health?.memory_usage?.replace('%', '') || '0')
                                const diskVal = parseFloat(health?.disk_usage?.replace('%', '') || '0')
                                return (
                                    <Grid item xs={12} sm={6} md={3} key={machine.id}>
                                        <Card 
                                            onClick={() => navigate(`/machines/${machine.id}`)}
                                            sx={{ 
                                                background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.03) 0%, rgba(255,255,255,0.01) 100%)',
                                                border: '1px solid rgba(34, 197, 94, 0.15)',
                                                borderRadius: '16px',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                height: '100%',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                animation: `fadeInUp 0.4s ease ${index * 0.05}s both`,
                                                '@keyframes fadeInUp': {
                                                    from: { opacity: 0, transform: 'translateY(10px)' },
                                                    to: { opacity: 1, transform: 'translateY(0)' },
                                                },
                                                '&::before': {
                                                    content: '""',
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '4px',
                                                    height: '100%',
                                                    background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                                                },
                                                '&:hover': {
                                                    transform: 'translateY(-4px) scale(1.01)',
                                                    background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.08) 0%, rgba(255,255,255,0.03) 100%)',
                                                    borderColor: 'rgba(34, 197, 94, 0.4)',
                                                    boxShadow: '0 12px 40px rgba(34, 197, 94, 0.15)',
                                                }
                                            }}
                                        >
                                            <CardContent sx={{ p: 2.5, pl: 3, '&:last-child': { pb: 2.5 } }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                                    <Box sx={{ 
                                                        width: 36, 
                                                        height: 36, 
                                                        borderRadius: '10px', 
                                                        background: 'rgba(34, 197, 94, 0.15)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        position: 'relative',
                                                    }}>
                                                        <ComputerIcon sx={{ color: '#22c55e', fontSize: 20 }} />
                                                        {machine.has_agent && (
                                                            <Box sx={{
                                                                position: 'absolute',
                                                                top: -2,
                                                                right: -2,
                                                                width: 10,
                                                                height: 10,
                                                                borderRadius: '50%',
                                                                background: '#8b5cf6',
                                                                border: '2px solid #0f0f0f',
                                                                animation: 'pulse 2s infinite',
                                                                '@keyframes pulse': {
                                                                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.4)' },
                                                                    '50%': { boxShadow: '0 0 0 4px rgba(139, 92, 246, 0)' },
                                                                },
                                                            }} />
                                                        )}
                                                    </Box>
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography sx={{ color: '#fafafa', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {machine.name}
                                                        </Typography>
                                                        {machine.has_agent && (
                                                            <Typography sx={{ color: '#8b5cf6', fontSize: '0.7rem', fontWeight: 500 }}>
                                                                Live Agent
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                                {health && (
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                                        <Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>CPU</Typography>
                                                                <Typography sx={{ fontSize: '0.8rem', color: cpuVal > 80 ? colors.error : cpuVal > 60 ? colors.warning : colors.secondary, fontFamily: 'monospace', fontWeight: 600 }}>
                                                                    {health.cpu_usage || health.load_avg?.split(' ')[0] || '-'}
                                                                </Typography>
                                                            </Box>
                                                            <LinearProgress variant="determinate" value={Math.min(cpuVal, 100)} sx={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: cpuVal > 80 ? colors.error : cpuVal > 60 ? colors.warning : colors.secondary } }} />
                                                        </Box>
                                                        <Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>RAM</Typography>
                                                                <Typography sx={{ fontSize: '0.8rem', color: memVal > 85 ? colors.error : memVal > 70 ? colors.warning : colors.primary, fontFamily: 'monospace', fontWeight: 600 }}>
                                                                    {health.memory_usage || '-'}
                                                                </Typography>
                                                            </Box>
                                                            <LinearProgress variant="determinate" value={Math.min(memVal, 100)} sx={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: memVal > 85 ? colors.error : memVal > 70 ? colors.warning : colors.primary } }} />
                                                        </Box>
                                                        <Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Disk</Typography>
                                                                <Typography sx={{ fontSize: '0.8rem', color: diskVal > 90 ? colors.error : diskVal > 75 ? colors.warning : colors.tertiary, fontFamily: 'monospace', fontWeight: 600 }}>
                                                                    {health.disk_usage || '-'}
                                                                </Typography>
                                                            </Box>
                                                            <LinearProgress variant="determinate" value={Math.min(diskVal, 100)} sx={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: diskVal > 90 ? colors.error : diskVal > 75 ? colors.warning : colors.tertiary } }} />
                                                        </Box>
                                                    </Box>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                )
                            })
                    )}
                </Grid>
            </Box>

            {/* Quick Actions - Full Width Grid */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '12px', 
                        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(249, 115, 22, 0.2)',
                    }}>
                        <RocketLaunchIcon sx={{ color: '#f97316', fontSize: 22 }} />
                    </Box>
                    <Box>
                        <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '1.15rem' }}>
                            Quick Actions
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                            Common tasks at your fingertips
                        </Typography>
                    </Box>
                </Box>
                <Grid container spacing={2}>
                    {canRunScripts && (
                        <Grid item xs={6} sm={4} md={2.4}>
                            <QuickAction 
                                icon={PlayArrowIcon} 
                                label="Run Script" 
                                description="Execute scripts"
                                color={colors.primary}
                                onClick={() => navigate('/scripts')}
                            />
                        </Grid>
                    )}
                    {canRunScripts && (
                        <Grid item xs={6} sm={4} md={2.4}>
                            <QuickAction 
                                icon={TerminalIcon} 
                                label="Run Command" 
                                description="Ad-hoc commands"
                                color={colors.secondary}
                                onClick={() => navigate('/run-command')}
                            />
                        </Grid>
                    )}
                    {canEditMachines && (
                        <Grid item xs={6} sm={4} md={2.4}>
                            <QuickAction 
                                icon={AddIcon} 
                                label="Add Machine" 
                                description="New server"
                                color={colors.tertiary}
                                onClick={() => navigate('/machines')}
                            />
                        </Grid>
                    )}
                    {canRunScripts && (
                        <Grid item xs={6} sm={4} md={2.4}>
                            <QuickAction 
                                icon={ScheduleIcon} 
                                label="Schedule Job" 
                                description="Automation"
                                color={colors.warning}
                                onClick={() => navigate('/settings')}
                            />
                        </Grid>
                    )}
                    <Grid item xs={6} sm={4} md={2.4}>
                        <QuickAction 
                            icon={HistoryIcon} 
                            label="View History" 
                            description="Past runs"
                            color={colors.info}
                            onClick={() => navigate('/history')}
                        />
                    </Grid>
                                        {!isViewer && (
                        <Grid item xs={6} sm={4} md={2.4}>
                            <QuickAction 
                                icon={NetworkCheckIcon} 
                                label="Network" 
                                description="Diagnostics"
                                color="#ec4899"
                                onClick={() => navigate('/network-tools')}
                            />
                        </Grid>
                    )}
                </Grid>
            </Box>

            {/* Aggregate Health Summary - Enhanced */}
            {Object.keys(healthData).length > 0 && (
                <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                        <Box sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: '12px', 
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                        }}>
                            <TrendingUpIcon sx={{ color: '#8b5cf6', fontSize: 22 }} />
                        </Box>
                        <Box>
                            <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '1.15rem' }}>
                                Fleet Health
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                Aggregate resource utilization
                            </Typography>
                        </Box>
                    </Box>
                    <Grid container spacing={2}>
                        {(() => {
                            const onlineMachines = Object.values(healthData).filter(h => h.online)
                            const avgCpu = onlineMachines.length > 0 
                                ? Math.round(onlineMachines.reduce((sum, h) => {
                                    const cpu = parseFloat(h.cpu_usage?.replace('%', '') || h.load_avg?.split(' ')[0] || '0')
                                    return sum + cpu
                                }, 0) / onlineMachines.length)
                                : 0
                            const avgMem = onlineMachines.length > 0
                                ? Math.round(onlineMachines.reduce((sum, h) => {
                                    const mem = parseFloat(h.memory_usage?.replace('%', '') || '0')
                                    return sum + mem
                                }, 0) / onlineMachines.length)
                                : 0
                            const avgDisk = onlineMachines.length > 0
                                ? Math.round(onlineMachines.reduce((sum, h) => {
                                    const disk = parseFloat(h.disk_usage?.replace('%', '') || '0')
                                    return sum + disk
                                }, 0) / onlineMachines.length)
                                : 0
                            
                            const cpuColor = avgCpu > 80 ? colors.error : avgCpu > 60 ? colors.warning : colors.secondary
                            const memColor = avgMem > 85 ? colors.error : avgMem > 70 ? colors.warning : colors.primary
                            const diskColor = avgDisk > 90 ? colors.error : avgDisk > 75 ? colors.warning : colors.tertiary
                            
                            return (
                                <>
                                    <Grid item xs={12} md={4}>
                                        <Box sx={{ 
                                            background: `linear-gradient(135deg, ${cpuColor}08 0%, rgba(255,255,255,0.01) 100%)`,
                                            border: `1px solid ${cpuColor}20`,
                                            borderRadius: '16px',
                                            p: 3,
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                borderColor: `${cpuColor}40`,
                                                transform: 'translateY(-2px)',
                                            },
                                            '&::before': {
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '4px',
                                                height: '100%',
                                                background: cpuColor,
                                            }
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: `${cpuColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <SpeedIcon sx={{ color: cpuColor, fontSize: 22 }} />
                                                    </Box>
                                                    <Box>
                                                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CPU Usage</Typography>
                                                        <Typography sx={{ color: '#fafafa', fontSize: '0.85rem', fontWeight: 500 }}>{onlineMachines.length} machines</Typography>
                                                    </Box>
                                                </Box>
                                                <Typography sx={{ color: cpuColor, fontSize: '2rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                                    {avgCpu}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress variant="determinate" value={avgCpu} sx={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${cpuColor}, ${cpuColor}cc)`, borderRadius: 3 } }} />
                                            {metricsHistory.cpu.length > 1 && (
                                                <Box sx={{ mt: 2, opacity: 0.8 }}>
                                                    <MiniSparkline data={metricsHistory.cpu} color={cpuColor} height={24} />
                                                </Box>
                                            )}
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Box sx={{ 
                                            background: `linear-gradient(135deg, ${memColor}08 0%, rgba(255,255,255,0.01) 100%)`,
                                            border: `1px solid ${memColor}20`,
                                            borderRadius: '16px',
                                            p: 3,
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                borderColor: `${memColor}40`,
                                                transform: 'translateY(-2px)',
                                            },
                                            '&::before': {
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '4px',
                                                height: '100%',
                                                background: memColor,
                                            }
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: `${memColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <MemoryIcon sx={{ color: memColor, fontSize: 22 }} />
                                                    </Box>
                                                    <Box>
                                                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Memory Usage</Typography>
                                                        <Typography sx={{ color: '#fafafa', fontSize: '0.85rem', fontWeight: 500 }}>{onlineMachines.length} machines</Typography>
                                                    </Box>
                                                </Box>
                                                <Typography sx={{ color: memColor, fontSize: '2rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                                    {avgMem}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress variant="determinate" value={avgMem} sx={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${memColor}, ${memColor}cc)`, borderRadius: 3 } }} />
                                            {metricsHistory.memory.length > 1 && (
                                                <Box sx={{ mt: 2, opacity: 0.8 }}>
                                                    <MiniSparkline data={metricsHistory.memory} color={memColor} height={24} />
                                                </Box>
                                            )}
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Box sx={{ 
                                            background: `linear-gradient(135deg, ${diskColor}08 0%, rgba(255,255,255,0.01) 100%)`,
                                            border: `1px solid ${diskColor}20`,
                                            borderRadius: '16px',
                                            p: 3,
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                borderColor: `${diskColor}40`,
                                                transform: 'translateY(-2px)',
                                            },
                                            '&::before': {
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '4px',
                                                height: '100%',
                                                background: diskColor,
                                            }
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: `${diskColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <StorageIcon sx={{ color: diskColor, fontSize: 22 }} />
                                                    </Box>
                                                    <Box>
                                                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Disk Usage</Typography>
                                                        <Typography sx={{ color: '#fafafa', fontSize: '0.85rem', fontWeight: 500 }}>{onlineMachines.length} machines</Typography>
                                                    </Box>
                                                </Box>
                                                <Typography sx={{ color: diskColor, fontSize: '2rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                                    {avgDisk}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress variant="determinate" value={avgDisk} sx={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${diskColor}, ${diskColor}cc)`, borderRadius: 3 } }} />
                                            {metricsHistory.disk.length > 1 && (
                                                <Box sx={{ mt: 2, opacity: 0.8 }}>
                                                    <MiniSparkline data={metricsHistory.disk} color={diskColor} height={24} />
                                                </Box>
                                            )}
                                        </Box>
                                    </Grid>
                                </>
                            )
                        })()}
                    </Grid>
                </Box>
            )}

            {/* Stats Grid */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '12px', 
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}>
                        <AutoAwesomeIcon sx={{ color: '#3b82f6', fontSize: 22 }} />
                    </Box>
                    <Box>
                        <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '1.15rem' }}>
                            System Overview
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                            Key metrics at a glance
                        </Typography>
                    </Box>
                </Box>
                <Grid container spacing={2.5}>
                    <Grid item xs={6} sm={6} md={3}>
                        <StatCard 
                            icon={ComputerIcon}
                            title="Machines"
                            value={loading ? '-' : `${stats.machines.online}/${stats.machines.total}`}
                            subtitle={`${stats.machines.online} online`}
                            color={colors.primary}
                            glowColor={colors.secondary}
                            onClick={() => navigate('/machines')}
                        />
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                        <StatCard 
                            icon={CodeIcon}
                            title="Scripts"
                            value={loading ? '-' : stats.scripts.total + stats.scripts.custom}
                            subtitle={`${stats.scripts.custom} custom scripts`}
                            color={colors.secondary}
                            glowColor={colors.primary}
                            onClick={() => navigate('/scripts')}
                        />
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                        <StatCard 
                            icon={ScheduleIcon}
                            title="Scheduled"
                            value={loading ? '-' : stats.jobs.enabled}
                            subtitle={`${stats.jobs.total} total jobs`}
                            color={colors.warning}
                            glowColor={colors.warningLight}
                            onClick={() => navigate('/settings')}
                        />
                    </Grid>
                    <Grid item xs={6} sm={6} md={3}>
                        <StatCard 
                            icon={CheckCircleIcon}
                            title="Success Rate"
                            value={loading ? '-' : `${successRate}%`}
                            subtitle={`${stats.executions.today} runs today`}
                            color={successRate >= 90 ? colors.secondary : successRate >= 70 ? colors.warning : colors.error}
                            glowColor={successRate >= 90 ? colors.secondaryLight : colors.warningLight}
                            onClick={() => navigate('/history')}
                        />
                    </Grid>
                </Grid>
            </Box>

            {/* Main Content Grid */}
            <Grid container spacing={3}>
                {/* Recent Activity */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ 
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '16px',
                        height: '100%',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            background: 'linear-gradient(90deg, #f97316, #22c55e)',
                        }
                    }}>
                        <CardContent sx={{ p: 0, height: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, pb: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Box sx={{ 
                                        width: 36, 
                                        height: 36, 
                                        borderRadius: '10px', 
                                        background: 'rgba(249, 115, 22, 0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <HistoryIcon sx={{ color: '#f97316', fontSize: 20 }} />
                                    </Box>
                                    <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '1.1rem' }}>
                                        Recent Activity
                                    </Typography>
                                </Box>
                                <Button 
                                    size="small" 
                                    onClick={() => navigate('/history')}
                                    endIcon={<KeyboardArrowRightIcon />}
                                    sx={{ 
                                        color: '#f97316', 
                                        textTransform: 'none', 
                                        fontSize: '0.85rem',
                                        '&:hover': { background: 'rgba(249, 115, 22, 0.1)' }
                                    }}
                                >
                                    View All
                                </Button>
                            </Box>
                            
                            <Box sx={{ 
                                maxHeight: 350, 
                                overflowY: 'auto',
                                '&::-webkit-scrollbar': { width: '6px' },
                                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: '3px' }
                            }}>
                                {loading ? (
                                    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <Skeleton key={i} variant="rounded" height={60} sx={{ background: 'rgba(255,255,255,0.05)' }} />
                                        ))}
                                    </Box>
                                ) : recentExecutions.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 6 }}>
                                        <HistoryIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
                                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>No recent activity</Typography>
                                    </Box>
                                ) : (
                                    <Box sx={{ px: 1.5 }}>
                                        {recentExecutions.map(exec => (
                                            <ActivityItem 
                                                key={exec.id} 
                                                execution={exec}
                                                onClick={() => navigate('/history')}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Upcoming Jobs */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ 
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '16px',
                        height: '100%',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            background: 'linear-gradient(90deg, #eab308, #8b5cf6)',
                        }
                    }}>
                        <CardContent sx={{ p: 0, height: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, pb: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Box sx={{ 
                                        width: 36, 
                                        height: 36, 
                                        borderRadius: '10px', 
                                        background: 'rgba(234, 179, 8, 0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <ScheduleIcon sx={{ color: '#eab308', fontSize: 20 }} />
                                    </Box>
                                    <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '1.1rem' }}>
                                        Scheduled Jobs
                                    </Typography>
                                </Box>
                                <Button 
                                    size="small" 
                                    onClick={() => navigate('/settings')}
                                    endIcon={<KeyboardArrowRightIcon />}
                                    sx={{ 
                                        color: '#eab308', 
                                        textTransform: 'none', 
                                        fontSize: '0.85rem',
                                        '&:hover': { background: 'rgba(234, 179, 8, 0.1)' }
                                    }}
                                >
                                    Manage
                                </Button>
                            </Box>
                            
                            <Box sx={{ 
                                maxHeight: 350, 
                                overflowY: 'auto',
                                '&::-webkit-scrollbar': { width: '6px' },
                                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: '3px' }
                            }}>
                                {loading ? (
                                    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        {[1, 2, 3].map(i => (
                                            <Skeleton key={i} variant="rounded" height={70} sx={{ background: 'rgba(255,255,255,0.05)' }} />
                                        ))}
                                    </Box>
                                ) : upcomingJobs.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 6 }}>
                                        <ScheduleIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
                                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>No scheduled jobs</Typography>
                                        <Button 
                                            size="small"
                                            onClick={() => navigate('/settings')}
                                            sx={{ color: '#f97316', mt: 2, textTransform: 'none', fontSize: '0.85rem' }}
                                        >
                                            Create one
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box sx={{ p: 2.5, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        {upcomingJobs.map(job => (
                                            <UpcomingJobCard key={job.id} job={job} />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

            </Grid>
        </Box>
    )
}

export default Dashboard
