import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import ComputerIcon from '@mui/icons-material/Computer'
import RefreshIcon from '@mui/icons-material/Refresh'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import StorageIcon from '@mui/icons-material/Storage'
import MemoryIcon from '@mui/icons-material/Memory'
import SpeedIcon from '@mui/icons-material/Speed'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HistoryIcon from '@mui/icons-material/History'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TerminalIcon from '@mui/icons-material/Terminal'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DnsIcon from '@mui/icons-material/Dns'
import TimerIcon from '@mui/icons-material/Timer'
import ListIcon from '@mui/icons-material/List'
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet'
import BuildIcon from '@mui/icons-material/Build'
import SendIcon from '@mui/icons-material/Send'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import StopIcon from '@mui/icons-material/Stop'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ArticleIcon from '@mui/icons-material/Article'
import DescriptionIcon from '@mui/icons-material/Description'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import HomeIcon from '@mui/icons-material/Home'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteIcon from '@mui/icons-material/Delete'
import VisibilityIcon from '@mui/icons-material/Visibility'
import TimelineIcon from '@mui/icons-material/Timeline'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import TextField from '@mui/material/TextField'
import Collapse from '@mui/material/Collapse'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import { useNavigate, useParams } from 'react-router-dom'
import { colors, gradients } from './theme'

// Circular Gauge Component for visual metrics
const CircularGauge = ({ value, max = 100, size = 120, strokeWidth = 8, color, label, sublabel }) => {
    const percentage = Math.min((value / max) * 100, 100)
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (percentage / 100) * circumference
    
    // Color based on percentage
    const getColor = () => {
        if (percentage > 80) return colors.error
        if (percentage > 60) return colors.warning
        return color || colors.secondary
    }
    
    return (
        <Box sx={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ position: 'relative', width: size, height: size }}>
                {/* Background circle */}
                <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={strokeWidth}
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={getColor()}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
                    />
                </svg>
                {/* Center text */}
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Typography sx={{ 
                        color: colors.text.primary, 
                        fontSize: size > 100 ? '1.5rem' : '1.2rem', 
                        fontWeight: 700,
                        fontFamily: '"SF Mono", monospace',
                        lineHeight: 1
                    }}>
                        {typeof value === 'number' ? value.toFixed(1) : value}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                        {sublabel || '%'}
                    </Typography>
                </Box>
            </Box>
            <Typography sx={{ 
                color: 'rgba(255,255,255,0.6)', 
                fontSize: '0.75rem', 
                fontWeight: 500,
                mt: 1,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                {label}
            </Typography>
        </Box>
    )
}

// Mini Stat Card for compact info display
const MiniStat = ({ icon: Icon, label, value, color = colors.primary }) => (
    <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        p: 1.5,
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
    }}>
        <Box sx={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <Icon sx={{ color, fontSize: 18 }} />
        </Box>
        <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                {label}
            </Typography>
            <Typography sx={{ color: colors.text.primary, fontSize: '0.9rem', fontWeight: 600, fontFamily: 'monospace' }}>
                {value || '-'}
            </Typography>
        </Box>
    </Box>
)

// Large Stat Card with icon
const StatCard = ({ icon: Icon, title, value, subtitle, color, trend }) => (
    <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        height: '100%',
    }}>
        <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${color}30 0%, ${color}10 100%)`,
                    border: `1px solid ${color}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Icon sx={{ color, fontSize: 24 }} />
                </Box>
                {trend && (
                    <Chip 
                        label={trend} 
                        size="small" 
                        sx={{ 
                            background: 'rgba(0,255,136,0.15)', 
                            color: colors.secondary,
                            fontSize: '0.65rem',
                            height: 22
                        }} 
                    />
                )}
            </Box>
            <Typography sx={{ 
                color: colors.text.primary, 
                fontSize: '1.75rem', 
                fontWeight: 700,
                fontFamily: '"SF Mono", monospace',
                mb: 0.5
            }}>
                {value || '-'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {title}
            </Typography>
            {subtitle && (
                <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', mt: 1 }}>
                    {subtitle}
                </Typography>
            )}
        </CardContent>
    </Card>
)

// Stat Card for displaying metrics - clean professional design
const MetricCard = ({ icon: Icon, title, value, subtitle, color, progress }) => (
    <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.9) 0%, rgba(17, 23, 35, 0.95) 100%)',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: '16px',
        height: '100%',
        transition: 'all 0.2s ease',
        '&:hover': {
            border: `1px solid ${color}40`,
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 24px ${color}15`,
        }
    }}>
        <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                    <Typography sx={{ 
                        color: 'rgba(255,255,255,0.5)', 
                        fontSize: '0.7rem', 
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        mb: 0.5
                    }}>
                        {title}
                    </Typography>
                    <Typography sx={{ 
                        color: colors.text.primary, 
                        fontSize: '1.5rem', 
                        fontWeight: 700,
                        lineHeight: 1.2,
                        fontFamily: '"SF Mono", "Roboto Mono", monospace'
                    }}>
                        {value || '-'}
                    </Typography>
                </Box>
                <Box sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
                    border: `1px solid ${color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Icon sx={{ color, fontSize: 22 }} />
                </Box>
            </Box>
            {progress !== undefined && (
                <Box sx={{ mt: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>
                            Usage
                        </Typography>
                        <Typography sx={{ 
                            color: progress > 80 ? colors.error : progress > 60 ? colors.warning : color, 
                            fontSize: '0.65rem',
                            fontWeight: 600
                        }}>
                            {Math.round(progress)}%
                        </Typography>
                    </Box>
                    <LinearProgress 
                        variant="determinate" 
                        value={Math.min(progress, 100)}
                        sx={{
                            height: 4,
                            borderRadius: 2,
                            background: 'rgba(255,255,255,0.08)',
                            '& .MuiLinearProgress-bar': {
                                background: progress > 80 
                                    ? `linear-gradient(90deg, ${colors.warning} 0%, ${colors.error} 100%)`
                                    : progress > 60 
                                        ? `linear-gradient(90deg, ${color} 0%, ${colors.warning} 100%)`
                                        : color,
                                borderRadius: 2,
                            }
                        }}
                    />
                </Box>
            )}
            {subtitle && (
                <Typography sx={{ 
                    color: 'rgba(255,255,255,0.35)', 
                    fontSize: '0.68rem',
                    mt: progress !== undefined ? 1 : 0,
                    lineHeight: 1.4
                }}>
                    {subtitle}
                </Typography>
            )}
        </CardContent>
    </Card>
)

const MachineMonitor = () => {
    const navigate = useNavigate()
    const { machineId } = useParams()
    const [machine, setMachine] = useState(null)
    const [health, setHealth] = useState(null)
    const [loading, setLoading] = useState(true)
    const [checking, setChecking] = useState(false)
    const [recentExecutions, setRecentExecutions] = useState([])
    const [agentConnected, setAgentConnected] = useState(false)
    const [agentMetrics, setAgentMetrics] = useState(null)
    const wsRef = useRef(null)
    
    // New monitoring features state
    const [activeTab, setActiveTab] = useState(0)
    const [processes, setProcesses] = useState([])
    const [services, setServices] = useState([])
    const [connections, setConnections] = useState([])
    const [loadingProcesses, setLoadingProcesses] = useState(false)
    const [loadingServices, setLoadingServices] = useState(false)
    const [loadingConnections, setLoadingConnections] = useState(false)
    
    // Quick terminal state
    const [terminalCommand, setTerminalCommand] = useState('')
    const [terminalOutput, setTerminalOutput] = useState([])
    const [terminalRunning, setTerminalRunning] = useState(false)
    const [terminalExpanded, setTerminalExpanded] = useState(true)
    
    // Additional monitoring state
    const [diskUsage, setDiskUsage] = useState([])
    const [loadingDisk, setLoadingDisk] = useState(false)
    const [systemLogs, setSystemLogs] = useState([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [logFilter, setLogFilter] = useState('syslog')
    const [fileBrowser, setFileBrowser] = useState({ path: '/home', files: [], loading: false })
    const [fileViewDialog, setFileViewDialog] = useState({ open: false, content: '', filename: '' })
    const [fileEditDialog, setFileEditDialog] = useState({ open: false, content: '', originalContent: '', filename: '', path: '', saving: false, error: '' })
    const [fileUploadDialog, setFileUploadDialog] = useState({ 
        open: false, 
        file: null, 
        filename: '', 
        permissions: '644', 
        owner: '', 
        makeExecutable: false, 
        createDirs: true,
        uploading: false, 
        error: '',
        progress: '',
        uploadPercent: 0
    })
    const [performanceHistory, setPerformanceHistory] = useState([])
    const terminalRef = useRef(null)

    const loadMachine = useCallback(async () => {
        try {
            const res = await fetch('/api/machines')
            const machines = await res.json() || []
            const found = machines.find(m => m.id === machineId)
            setMachine(found)
        } catch (err) {
            console.error('Failed to load machine:', err)
        }
    }, [machineId])

    const loadHealth = useCallback(async () => {
        try {
            const res = await fetch('/api/health/cached')
            const data = await res.json() || {}
            setHealth(data[machineId])
        } catch (err) {
            console.error('Failed to load health:', err)
        }
    }, [machineId])

    const loadExecutions = useCallback(async () => {
        try {
            const res = await fetch('/api/history?limit=50')
            const data = await res.json() || []
            // Filter executions for this machine
            const machineExecs = data.filter(e => e.machine_id === machineId).slice(0, 10)
            setRecentExecutions(machineExecs)
        } catch (err) {
            console.error('Failed to load executions:', err)
        }
    }, [machineId])

    const connectToAgent = useCallback(() => {
        // Always try to connect to agent if we have an IP - don't rely on has_agent flag
        if (!machine?.ip || wsRef.current) return

        // Set connecting state to prevent multiple connections
        wsRef.current = { connecting: true }
        
        // Connect directly to the agent on the machine (always try port 8083)
        const agentPort = machine.agent_port || 8083
        const wsUrl = `ws://${machine.ip}:${agentPort}/ws`
        console.log('Attempting to connect to agent at:', wsUrl)
        
        const ws = new WebSocket(wsUrl)
        
        ws.onopen = () => {
            console.log('Connected to agent at', wsUrl)
            wsRef.current = ws
            setAgentConnected(true)
        }
        
        ws.onmessage = (event) => {
            try {
                const metrics = JSON.parse(event.data)
                // Only store agent metrics - don't mix with SSH health data
                setAgentMetrics(metrics)
            } catch (err) {
                console.error('Failed to parse agent metrics:', err)
            }
        }
        
        ws.onclose = () => {
            console.log('Disconnected from agent')
            setAgentConnected(false)
            if (wsRef.current === ws) {
                wsRef.current = null
            }
            // Try to reconnect after 10 seconds (longer delay since agent might not exist)
            setTimeout(() => {
                if (machine?.ip && !wsRef.current) {
                    connectToAgent()
                }
            }, 10000)
        }
        
        ws.onerror = (error) => {
            // Agent might not be installed - this is expected, don't spam console
            console.log('Agent not available at', wsUrl)
            setAgentConnected(false)
            if (wsRef.current === ws) {
                wsRef.current = null
            }
        }
        
        // Set timeout for connection attempt (shorter since we're auto-detecting)
        setTimeout(() => {
            if (wsRef.current?.connecting) {
                wsRef.current = null
                ws.close()
                // Retry after 15 seconds if agent not found
                setTimeout(connectToAgent, 15000)
            }
        }, 5000)
    }, [machine])

    const runHealthCheck = async () => {
        setChecking(true)
        try {
            const res = await fetch(`/api/health/check?id=${machineId}`, { method: 'POST' })
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`)
            }
            const text = await res.text()
            if (!text) {
                throw new Error('Empty response')
            }
            const data = JSON.parse(text)
            setHealth(data)
        } catch (err) {
            console.error('Failed to run health check:', err)
        }
        setChecking(false)
    }

    // Fetch top processes
    const fetchProcesses = async () => {
        if (!machine?.id) return
        setLoadingProcesses(true)
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: 'ps aux --sort=-%cpu | head -16',
                    skip_validate: true
                })
            })
            const data = await res.json()
            if (data.success && data.output) {
                const lines = data.output.trim().split('\n')
                const procs = lines.slice(1).map(line => {
                    const parts = line.trim().split(/\s+/)
                    return {
                        user: parts[0],
                        pid: parts[1],
                        cpu: parts[2],
                        mem: parts[3],
                        command: parts.slice(10).join(' ')
                    }
                }).filter(p => p.pid)
                setProcesses(procs)
            }
        } catch (err) {
            console.error('Failed to fetch processes:', err)
        }
        setLoadingProcesses(false)
    }

    // Fetch services status
    const fetchServices = async () => {
        if (!machine?.id) return
        setLoadingServices(true)
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: 'systemctl list-units --type=service --state=running,failed --no-pager --no-legend | head -20',
                    skip_validate: true
                })
            })
            const data = await res.json()
            if (data.success && data.output) {
                const lines = data.output.trim().split('\n')
                const svcs = lines.map(line => {
                    const parts = line.trim().split(/\s+/)
                    return {
                        name: parts[0]?.replace('.service', ''),
                        load: parts[1],
                        active: parts[2],
                        sub: parts[3],
                        description: parts.slice(4).join(' ')
                    }
                }).filter(s => s.name)
                setServices(svcs)
            }
        } catch (err) {
            console.error('Failed to fetch services:', err)
        }
        setLoadingServices(false)
    }

    // Fetch network connections
    const fetchConnections = async () => {
        if (!machine?.id) return
        setLoadingConnections(true)
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: 'ss -tuln | head -20',
                    skip_validate: true
                })
            })
            const data = await res.json()
            if (data.success && data.output) {
                const lines = data.output.trim().split('\n')
                const conns = lines.slice(1).map(line => {
                    const parts = line.trim().split(/\s+/)
                    return {
                        protocol: parts[0],
                        state: parts[1],
                        recv: parts[2],
                        send: parts[3],
                        local: parts[4],
                        peer: parts[5]
                    }
                }).filter(c => c.protocol)
                setConnections(conns)
            }
        } catch (err) {
            console.error('Failed to fetch connections:', err)
        }
        setLoadingConnections(false)
    }

    // Run terminal command with dangerous command confirmation
    const runTerminalCommand = async (confirmed = false) => {
        if (!terminalCommand.trim() || !machine?.id) return
        setTerminalRunning(true)
        const cmd = terminalCommand.trim()
        
        if (!confirmed) {
            setTerminalOutput(prev => [...prev, { type: 'input', text: `$ ${cmd}` }])
            setTerminalCommand('')
        }
        
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: cmd,
                    confirmed: confirmed
                })
            })
            const data = await res.json()
            
            // Handle dangerous command warning
            if (data.dangerous && data.requires_confirm) {
                setTerminalOutput(prev => [...prev, { 
                    type: 'warning', 
                    text: `⚠️ WARNING: ${data.error}\n${data.dangerous_pattern}\n\nType 'yes' to confirm or any other key to cancel.`
                }])
                // Store pending command for confirmation
                setTerminalCommand(`CONFIRM:${cmd}`)
                setTerminalRunning(false)
                return
            }
            
            // Handle rate limiting
            if (data.rate_limited) {
                setTerminalOutput(prev => [...prev, { 
                    type: 'error', 
                    text: `⏱️ ${data.error}`
                }])
                setTerminalRunning(false)
                return
            }
            
            setTerminalOutput(prev => [...prev, { 
                type: data.success ? 'output' : 'error', 
                text: data.output || data.error || 'No output'
            }])
        } catch (err) {
            setTerminalOutput(prev => [...prev, { type: 'error', text: err.message }])
        }
        setTerminalRunning(false)
    }
    
    // Handle terminal input including confirmations
    const handleTerminalSubmit = () => {
        if (terminalCommand.startsWith('CONFIRM:')) {
            // This is a pending dangerous command
            const pendingCmd = terminalCommand.substring(8)
            setTerminalCommand(pendingCmd)
            runTerminalCommand(true) // Run with confirmation
        } else if (terminalCommand.toLowerCase() === 'yes' && terminalOutput.length > 0) {
            // Check if last output was a warning requiring confirmation
            const lastOutput = terminalOutput[terminalOutput.length - 1]
            if (lastOutput?.type === 'warning' && lastOutput?.text?.includes('CONFIRM:')) {
                // Extract and run the confirmed command
                const match = lastOutput.text.match(/CONFIRM:(.+)/)
                if (match) {
                    setTerminalCommand(match[1])
                    runTerminalCommand(true)
                    return
                }
            }
            runTerminalCommand()
        } else {
            runTerminalCommand()
        }
    }

    // Fetch disk usage
    const fetchDiskUsage = async () => {
        if (!machine?.id) return
        setLoadingDisk(true)
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: 'df -h --output=source,size,used,avail,pcent,target | grep -E "^/dev" | head -10',
                    skip_validate: true
                })
            })
            const data = await res.json()
            if (data.success && data.output) {
                const lines = data.output.trim().split('\n')
                const disks = lines.map(line => {
                    const parts = line.trim().split(/\s+/)
                    return {
                        device: parts[0],
                        size: parts[1],
                        used: parts[2],
                        avail: parts[3],
                        percent: parseInt(parts[4]) || 0,
                        mount: parts[5]
                    }
                }).filter(d => d.device)
                setDiskUsage(disks)
            }
        } catch (err) {
            console.error('Failed to fetch disk usage:', err)
        }
        setLoadingDisk(false)
    }

    // Fetch system logs
    const fetchSystemLogs = async (logType = logFilter) => {
        if (!machine?.id) return
        setLoadingLogs(true)
        const logCommands = {
            syslog: 'tail -50 /var/log/syslog 2>/dev/null || journalctl -n 50 --no-pager 2>/dev/null || tail -50 /var/log/messages',
            auth: 'tail -50 /var/log/auth.log 2>/dev/null || journalctl -u sshd -n 50 --no-pager',
            kern: 'dmesg | tail -50',
            boot: 'journalctl -b -n 50 --no-pager 2>/dev/null || tail -50 /var/log/boot.log'
        }
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: logCommands[logType] || logCommands.syslog,
                    skip_validate: true
                })
            })
            const data = await res.json()
            if (data.success && data.output) {
                const lines = data.output.trim().split('\n').map((line, idx) => ({
                    id: idx,
                    text: line,
                    level: line.toLowerCase().includes('error') ? 'error' : 
                           line.toLowerCase().includes('warn') ? 'warning' : 
                           line.toLowerCase().includes('fail') ? 'error' : 'info'
                }))
                setSystemLogs(lines)
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err)
        }
        setLoadingLogs(false)
    }

    // File browser functions
    const browseDirectory = async (path) => {
        if (!machine?.id) return
        setFileBrowser(prev => ({ ...prev, loading: true, path }))
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: `ls -la "${path}" 2>/dev/null | tail -n +2`,
                    skip_validate: true
                })
            })
            const data = await res.json()
            if (data.success && data.output) {
                const lines = data.output.trim().split('\n')
                const files = lines.map(line => {
                    const parts = line.trim().split(/\s+/)
                    if (parts.length < 9) return null
                    const perms = parts[0]
                    const isDir = perms.startsWith('d')
                    const isLink = perms.startsWith('l')
                    const size = parts[4]
                    const date = `${parts[5]} ${parts[6]} ${parts[7]}`
                    const name = parts.slice(8).join(' ').split(' -> ')[0]
                    if (name === '.' || name === '..') return null
                    return { name, isDir, isLink, size, date, perms }
                }).filter(Boolean).sort((a, b) => {
                    if (a.isDir && !b.isDir) return -1
                    if (!a.isDir && b.isDir) return 1
                    return a.name.localeCompare(b.name)
                })
                setFileBrowser({ path, files, loading: false })
            } else {
                setFileBrowser(prev => ({ ...prev, loading: false, files: [] }))
            }
        } catch (err) {
            console.error('Failed to browse directory:', err)
            setFileBrowser(prev => ({ ...prev, loading: false }))
        }
    }

    // View file content
    const viewFile = async (filename) => {
        if (!machine?.id) return
        const fullPath = `${fileBrowser.path}/${filename}`
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: `head -500 "${fullPath}" 2>/dev/null`,
                    skip_validate: true
                })
            })
            const data = await res.json()
            setFileViewDialog({
                open: true,
                filename,
                content: data.success ? data.output : data.error || 'Failed to read file'
            })
        } catch (err) {
            setFileViewDialog({ open: true, filename, content: `Error: ${err.message}` })
        }
    }

    // Upload file to remote machine using multipart form with progress tracking
    const uploadFile = async () => {
        const file = fileUploadDialog.file
        if (!machine?.id || !file) return
        
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1)
        const destPath = `${fileBrowser.path}/${fileUploadDialog.filename || file.name}`
        
        setFileUploadDialog(prev => ({ ...prev, uploading: true, error: '', progress: `Preparing ${fileSizeMB} MB...`, uploadPercent: 0 }))
        
        // Create FormData for multipart upload
        const formData = new FormData()
        formData.append('file', file)
        formData.append('machine_id', machine.id)
        formData.append('path', destPath)
        formData.append('permissions', fileUploadDialog.permissions || '644')
        formData.append('owner', fileUploadDialog.owner || '')
        formData.append('make_executable', fileUploadDialog.makeExecutable ? 'true' : 'false')
        formData.append('create_dirs', fileUploadDialog.createDirs ? 'true' : 'false')
        
        // Use XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest()
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100)
                const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1)
                setFileUploadDialog(prev => ({ 
                    ...prev, 
                    progress: `Uploading: ${loadedMB} / ${fileSizeMB} MB (${percent}%)`,
                    uploadPercent: percent
                }))
            }
        })
        
        xhr.upload.addEventListener('load', () => {
            setFileUploadDialog(prev => ({ 
                ...prev, 
                progress: `Transferring to remote machine...`,
                uploadPercent: 100
            }))
        })
        
        xhr.addEventListener('load', () => {
            try {
                const data = JSON.parse(xhr.responseText)
                if (data.success) {
                    setFileUploadDialog(prev => ({ ...prev, uploading: false, progress: 'Upload complete!', uploadPercent: 100 }))
                    // Refresh file browser
                    setTimeout(() => {
                        browseDirectory(fileBrowser.path)
                        setFileUploadDialog({ 
                            open: false, file: null, filename: '', permissions: '644', 
                            owner: '', makeExecutable: false, createDirs: true, 
                            uploading: false, error: '', progress: '', uploadPercent: 0
                        })
                    }, 1000)
                } else {
                    setFileUploadDialog(prev => ({ 
                        ...prev, 
                        uploading: false, 
                        error: data.error || 'Upload failed',
                        progress: '',
                        uploadPercent: 0
                    }))
                }
            } catch (err) {
                setFileUploadDialog(prev => ({ ...prev, uploading: false, error: 'Invalid response from server', progress: '', uploadPercent: 0 }))
            }
        })
        
        xhr.addEventListener('error', () => {
            setFileUploadDialog(prev => ({ ...prev, uploading: false, error: 'Upload failed - network error', progress: '', uploadPercent: 0 }))
        })
        
        xhr.open('POST', '/api/upload-file')
        xhr.send(formData)
    }

    // Edit file - load content for editing
    const editFile = async (filename) => {
        if (!machine?.id) return
        const fullPath = `${fileBrowser.path}/${filename}`
        setFileEditDialog({ open: true, content: '', originalContent: '', filename, path: fullPath, saving: false, error: '', loading: true })
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: `cat "${fullPath}" 2>/dev/null`,
                    skip_validate: true
                })
            })
            const data = await res.json()
            if (data.success) {
                setFileEditDialog(prev => ({ 
                    ...prev, 
                    content: data.output || '', 
                    originalContent: data.output || '',
                    loading: false 
                }))
            } else {
                setFileEditDialog(prev => ({ ...prev, error: data.error || 'Failed to read file', loading: false }))
            }
        } catch (err) {
            setFileEditDialog(prev => ({ ...prev, error: err.message, loading: false }))
        }
    }

    // Save file content
    const saveFile = async () => {
        if (!machine?.id || !fileEditDialog.path) return
        setFileEditDialog(prev => ({ ...prev, saving: true, error: '' }))
        
        // Escape content for shell - use base64 encoding to handle special characters
        const base64Content = btoa(unescape(encodeURIComponent(fileEditDialog.content)))
        
        try {
            const res = await fetch('/api/run-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: machine.id,
                    command: `echo "${base64Content}" | base64 -d > "${fileEditDialog.path}"`,
                    skip_validate: true
                })
            })
            const data = await res.json()
            if (data.success) {
                setFileEditDialog(prev => ({ ...prev, saving: false, originalContent: prev.content }))
                // Show success briefly then close or keep open
            } else {
                setFileEditDialog(prev => ({ ...prev, saving: false, error: data.error || 'Failed to save file' }))
            }
        } catch (err) {
            setFileEditDialog(prev => ({ ...prev, saving: false, error: err.message }))
        }
    }

    // Track performance history from agent metrics
    useEffect(() => {
        if (agentMetrics) {
            setPerformanceHistory(prev => {
                const newEntry = {
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    cpu: parseFloat(agentMetrics.cpu_usage) || 0,
                    mem: parseFloat(agentMetrics.memory_usage) || 0
                }
                const updated = [...prev, newEntry].slice(-30) // Keep last 30 data points
                return updated
            })
        }
    }, [agentMetrics])

    // Load monitoring data when tab changes
    useEffect(() => {
        if (activeTab === 1 && processes.length === 0) fetchProcesses()
        if (activeTab === 2 && services.length === 0) fetchServices()
        if (activeTab === 3 && connections.length === 0) fetchConnections()
        if (activeTab === 4 && diskUsage.length === 0) fetchDiskUsage()
        if (activeTab === 5 && fileBrowser.files.length === 0) browseDirectory(fileBrowser.path)
        if (activeTab === 6 && systemLogs.length === 0) fetchSystemLogs()
    }, [activeTab, machine?.id])

    useEffect(() => {
        const loadAll = async () => {
            setLoading(true)
            await Promise.all([loadMachine(), loadHealth(), loadExecutions()])
            setLoading(false)
        }
        loadAll()
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            loadHealth()
            loadExecutions()
        }, 30000)
        
        return () => {
            clearInterval(interval)
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [loadMachine, loadHealth, loadExecutions])

    // Connect to agent when machine data is loaded - always try, don't check has_agent
    useEffect(() => {
        // Only connect if machine is loaded with IP and not already connecting
        if (machine?.ip && !wsRef.current && !loading) {
            // Small delay to ensure everything is rendered
            const timer = setTimeout(() => {
                connectToAgent()
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [machine, loading, connectToAgent])

    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [])

    const parsePercent = (str) => {
        if (!str) return 0
        const match = str.match(/(\d+\.?\d*)%?/)
        return match ? parseFloat(match[1]) : 0
    }

    const formatDuration = (ms) => {
        if (!ms) return '-'
        if (ms < 1000) return `${ms}ms`
        return `${(ms / 1000).toFixed(1)}s`
    }

    const timeAgo = (date) => {
        if (!date || date === '0001-01-01T00:00:00Z') return 'Never'
        const seconds = Math.floor((new Date() - new Date(date)) / 1000)
        if (seconds < 60) return 'Just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        return `${Math.floor(seconds / 86400)}d ago`
    }

    const isOnline = agentConnected || health?.online === true

    // Helper to normalize data format
    const normalizeData = (raw, source) => {
        if (!raw) return null;
        
        // Format percentage consistently
        const formatPercent = (val) => {
            if (val === undefined || val === null || val === '-') return '-';
            if (typeof val === 'number') return `${val.toFixed(1)}%`;
            if (typeof val === 'string' && val.includes('%')) return val;
            const num = parseFloat(val);
            return isNaN(num) ? val : `${num.toFixed(1)}%`;
        };
        
        // Format string consistently
        const formatStr = (val, fallback = '-') => val || fallback;
        
        return {
            hostname: formatStr(raw.hostname, machine.name),
            os_info: formatStr(raw.os_info, 'Linux'),
            cpu_usage: formatPercent(raw.cpu_usage),
            cpu_cores: formatStr(String(raw.cpu_cores || '-')),
            cpu_model: formatStr(raw.cpu_model, 'Unknown'),
            kernel_version: formatStr(raw.kernel_version),
            uptime: formatStr(raw.uptime?.replace?.('up ', '') || raw.uptime),
            load_avg: formatStr(raw.load_average || raw.load_avg),
            memory_usage: formatPercent(raw.memory_usage),
            memory_total: formatStr(raw.memory_total),
            memory_used: formatStr(raw.memory_used || raw.memory_free),
            disk_usage: formatPercent(raw.disk_usage),
            disk_total: formatStr(raw.disk_total),
            disk_used: formatStr(raw.disk_used || raw.disk_free),
            network_rx: formatStr(raw.network_rx),
            network_tx: formatStr(raw.network_tx),
            process_count: formatStr(String(raw.process_count || '-')),
            logged_users: formatStr(
                Array.isArray(raw.logged_in_users) 
                    ? raw.logged_in_users.join(', ') 
                    : raw.logged_users
            ),
            last_checked: raw.last_checked || new Date().toISOString(),
            source: source,
        };
    };

    // Use ONLY agent data when connected, ONLY SSH data when not
    const displayData = !machine ? null : (
        agentConnected && agentMetrics 
            ? normalizeData(agentMetrics, 'agent')
            : normalizeData(health, 'ssh')
    )

    if (loading) {
        return (
            <Box sx={{ p: 3 }}>
                <Skeleton variant="text" width={200} height={40} sx={{ background: 'rgba(255,255,255,0.05)' }} />
                <Grid container spacing={2} sx={{ mt: 2 }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <Grid item xs={12} sm={6} md={4} key={i}>
                            <Skeleton variant="rounded" height={120} sx={{ background: 'rgba(255,255,255,0.05)' }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        )
    }

    if (!machine) {
        return (
            <Box sx={{ textAlign: 'center', py: 8 }}>
                <ComputerIcon sx={{ fontSize: 64, color: colors.text.disabled, mb: 2 }} />
                <Typography sx={{ color: colors.text.muted, mb: 2 }}>Machine not found</Typography>
                <Button 
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/machines')}
                    sx={{ color: colors.primary }}
                >
                    Back to Machines
                </Button>
            </Box>
        )
    }

    return (
        <Box sx={{ 
            maxHeight: 'calc(100vh - 120px)', 
            overflowY: 'auto',
            overflowX: 'hidden',
            pr: 1,
            '&::-webkit-scrollbar': {
                width: '6px',
            },
            '&::-webkit-scrollbar-track': {
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '3px',
                '&:hover': {
                    background: 'rgba(255,255,255,0.25)',
                }
            }
        }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <IconButton 
                    onClick={() => navigate('/machines')}
                    sx={{ color: colors.text.secondary }}
                >
                    <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{ 
                            fontSize: '1.5rem', 
                            fontWeight: 800,
                            background: gradients.text,
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            {machine.name}
                        </Typography>
                        <Chip 
                            icon={isOnline ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <ErrorIcon sx={{ fontSize: 14 }} />}
                            label={isOnline ? 'Online' : 'Offline'}
                            size="small"
                            sx={{
                                background: isOnline ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 68, 102, 0.2)',
                                color: isOnline ? colors.secondary : colors.error,
                                '& .MuiChip-icon': { color: 'inherit' }
                            }}
                        />
                    </Box>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {machine.ip} • {machine.username}@{machine.ip} • {machine.category || 'Uncategorized'}
                    </Typography>
                </Box>
                
                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                        startIcon={<PlayArrowIcon />}
                        onClick={() => navigate(`/scripts?machines=${machine.id}`)}
                        sx={{
                            background: 'linear-gradient(135deg, #f97316 0%, #00a8cc 100%)',
                            color: '#0a0a0f',
                            fontWeight: 600,
                            '&:hover': { 
                                background: 'linear-gradient(135deg, #5ce1ff 0%, #f97316 100%)',
                            }
                        }}
                    >
                        Run Script
                    </Button>
                    <Button
                        startIcon={<TerminalIcon />}
                        onClick={() => navigate(`/run-command?machines=${machine.id}`)}
                        sx={{
                            background: 'linear-gradient(135deg, #22c55e 0%, #00cc6a 100%)',
                            color: '#0a0a0f',
                            fontWeight: 600,
                            '&:hover': { 
                                background: 'linear-gradient(135deg, #66ffaa 0%, #22c55e 100%)',
                            }
                        }}
                    >
                        Run Command
                    </Button>
                </Box>
            </Box>

            {/* Main Dashboard - Resource Gauges */}
            <Card sx={{ 
                background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '20px',
                mb: 3,
                overflow: 'hidden'
            }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography sx={{ 
                        color: colors.text.primary, 
                        fontWeight: 600, 
                        fontSize: '0.85rem', 
                        textTransform: 'uppercase', 
                        letterSpacing: '1px',
                        mb: 3
                    }}>
                        Resource Utilization
                    </Typography>
                    
                    {/* Circular Gauges Row */}
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-around', 
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 3,
                        mb: 3
                    }}>
                        <CircularGauge 
                            value={parsePercent(displayData?.cpu_usage)} 
                            label="CPU" 
                            color={colors.warning}
                            size={110}
                        />
                        <CircularGauge 
                            value={parsePercent(displayData?.memory_usage)} 
                            label="Memory" 
                            color={colors.primary}
                            size={110}
                        />
                        <CircularGauge 
                            value={parsePercent(displayData?.disk_usage)} 
                            label="Disk" 
                            color={colors.secondary}
                            size={110}
                        />
                    </Box>

                    {/* Quick Stats Row */}
                    <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 2,
                        pt: 2,
                        borderTop: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        <MiniStat icon={SpeedIcon} label="Load Average" value={displayData?.load_avg} color={colors.warning} />
                        <MiniStat icon={TerminalIcon} label="Processes" value={displayData?.process_count} color={colors.primary} />
                        <MiniStat icon={DnsIcon} label="Users" value={displayData?.logged_users} color={colors.secondary} />
                    </Box>
                </CardContent>
            </Card>

            {/* System Info & Network Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {/* System Info Card */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ 
                        background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '16px',
                        height: '100%'
                    }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                <ComputerIcon sx={{ color: colors.primary, fontSize: 20 }} />
                                <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    System Info
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Hostname</Typography>
                                    <Typography sx={{ color: colors.text.primary, fontSize: '0.85rem', fontWeight: 500, fontFamily: 'monospace' }}>{displayData?.hostname || '-'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>OS</Typography>
                                    <Typography sx={{ color: colors.text.primary, fontSize: '0.85rem', fontWeight: 500 }}>{displayData?.os_info || '-'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Kernel</Typography>
                                    <Typography sx={{ color: colors.text.primary, fontSize: '0.85rem', fontWeight: 500, fontFamily: 'monospace' }}>{displayData?.kernel_version || '-'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>CPU</Typography>
                                    <Typography sx={{ color: colors.text.primary, fontSize: '0.8rem', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{displayData?.cpu_cores || '-'} cores • {displayData?.cpu_model || '-'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Uptime</Typography>
                                    <Typography sx={{ color: colors.secondary, fontSize: '0.85rem', fontWeight: 500 }}>{displayData?.uptime || '-'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Storage</Typography>
                                    <Typography sx={{ color: colors.text.primary, fontSize: '0.85rem', fontWeight: 500, fontFamily: 'monospace' }}>{displayData?.disk_used || '-'} / {displayData?.disk_total || '-'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Memory</Typography>
                                    <Typography sx={{ color: colors.text.primary, fontSize: '0.85rem', fontWeight: 500, fontFamily: 'monospace' }}>{displayData?.memory_used || '-'} / {displayData?.memory_total || '-'}</Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Network Card - Only network stats */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ 
                        background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '16px',
                        height: '100%'
                    }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                <NetworkCheckIcon sx={{ color: colors.secondary, fontSize: 20 }} />
                                <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Network Traffic
                                </Typography>
                            </Box>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Box sx={{ 
                                        p: 2.5, 
                                        borderRadius: '12px', 
                                        background: 'rgba(249, 115, 22, 0.08)',
                                        border: '1px solid rgba(249, 115, 22, 0.15)',
                                        textAlign: 'center'
                                    }}>
                                        <CloudDownloadIcon sx={{ color: colors.primary, fontSize: 32, mb: 1 }} />
                                        <Typography sx={{ color: colors.text.primary, fontSize: '1.3rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                            {displayData?.network_rx || '-'}
                                        </Typography>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', mt: 0.5 }}>
                                            Downloaded
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={6}>
                                    <Box sx={{ 
                                        p: 2.5, 
                                        borderRadius: '12px', 
                                        background: 'rgba(34, 197, 94, 0.08)',
                                        border: '1px solid rgba(34, 197, 94, 0.15)',
                                        textAlign: 'center'
                                    }}>
                                        <CloudUploadIcon sx={{ color: colors.secondary, fontSize: 32, mb: 1 }} />
                                        <Typography sx={{ color: colors.text.primary, fontSize: '1.3rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                            {displayData?.network_tx || '-'}
                                        </Typography>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', mt: 0.5 }}>
                                            Uploaded
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Quick Terminal */}
            <Card sx={{ 
                background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                mb: 3,
            }}>
                <Box 
                    sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': { background: 'rgba(255,255,255,0.02)' }
                    }}
                    onClick={() => setTerminalExpanded(!terminalExpanded)}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <TerminalIcon sx={{ color: colors.secondary, fontSize: 20 }} />
                        <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Quick Terminal
                        </Typography>
                        <Chip 
                            label="SSH" 
                            size="small" 
                            sx={{ 
                                background: 'rgba(34, 197, 94, 0.15)', 
                                color: colors.secondary,
                                fontSize: '0.65rem',
                                height: 20,
                            }} 
                        />
                    </Box>
                    <IconButton size="small" sx={{ color: colors.text.muted }}>
                        {terminalExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </Box>
                <Collapse in={terminalExpanded}>
                    <CardContent sx={{ p: 2, pt: 0 }}>
                        {/* Terminal Output */}
                        <Box sx={{ 
                            background: '#0d1117',
                            borderRadius: '8px',
                            p: 2,
                            mb: 2,
                            minHeight: 150,
                            maxHeight: 250,
                            overflowY: 'auto',
                            fontFamily: '"SF Mono", "Fira Code", monospace',
                            fontSize: '0.8rem',
                            '&::-webkit-scrollbar': { width: '4px' },
                            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }
                        }}>
                            {terminalOutput.length === 0 ? (
                                <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                                    Type a command below and press Enter to execute...
                                </Typography>
                            ) : (
                                terminalOutput.map((line, idx) => (
                                    <Box key={idx} sx={{ mb: 0.5 }}>
                                        <Typography 
                                            component="pre" 
                                            sx={{ 
                                                color: line.type === 'input' ? colors.primary : 
                                                       line.type === 'error' ? colors.error : 
                                                       line.type === 'warning' ? colors.warning : 
                                                       'rgba(255,255,255,0.8)',
                                                fontFamily: 'inherit',
                                                fontSize: 'inherit',
                                                m: 0,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-all',
                                                ...(line.type === 'warning' && {
                                                    background: 'rgba(255, 170, 0, 0.1)',
                                                    p: 1,
                                                    borderRadius: '4px',
                                                    border: '1px solid rgba(255, 170, 0, 0.3)'
                                                })
                                            }}
                                        >
                                            {line.text}
                                        </Typography>
                                    </Box>
                                ))
                            )}
                        </Box>
                        {/* Command Input */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Enter command..."
                                value={terminalCommand}
                                onChange={(e) => setTerminalCommand(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTerminalSubmit()}
                                disabled={terminalRunning || !isOnline}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        background: 'rgba(0,0,0,0.3)',
                                        fontFamily: '"SF Mono", monospace',
                                        fontSize: '0.85rem',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                        '&:hover fieldset': { borderColor: 'rgba(34, 197, 94, 0.3)' },
                                        '&.Mui-focused fieldset': { borderColor: colors.secondary },
                                    },
                                    '& .MuiOutlinedInput-input': { color: colors.text.primary }
                                }}
                            />
                            <Button
                                variant="contained"
                                onClick={handleTerminalSubmit}
                                disabled={terminalRunning || !terminalCommand.trim() || !isOnline}
                                sx={{
                                    background: 'linear-gradient(135deg, #22c55e 0%, #00cc6a 100%)',
                                    color: '#0a0a0f',
                                    minWidth: 100,
                                    '&:hover': { background: 'linear-gradient(135deg, #66ffaa 0%, #22c55e 100%)' },
                                    '&.Mui-disabled': { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }
                                }}
                            >
                                {terminalRunning ? <CircularProgress size={20} sx={{ color: '#0a0a0f' }} /> : <SendIcon />}
                            </Button>
                            <Tooltip title="Clear output">
                                <IconButton 
                                    onClick={() => setTerminalOutput([])}
                                    sx={{ color: colors.text.muted }}
                                >
                                    <StopIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </CardContent>
                </Collapse>
            </Card>

            {/* Monitoring Tabs */}
            <Card sx={{ 
                background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                mb: 3,
            }}>
                <Tabs 
                    value={activeTab} 
                    onChange={(e, v) => setActiveTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        '& .MuiTab-root': {
                            color: colors.text.muted,
                            textTransform: 'none',
                            fontWeight: 500,
                            minHeight: 48,
                            minWidth: 'auto',
                            px: 2,
                            '&.Mui-selected': { color: colors.primary }
                        },
                        '& .MuiTabs-indicator': { background: colors.primary }
                    }}
                >
                    <Tab icon={<HistoryIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="History" />
                    <Tab icon={<ListIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Processes" />
                    <Tab icon={<BuildIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Services" />
                    <Tab icon={<SettingsEthernetIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Connections" />
                    <Tab icon={<StorageIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Disks" />
                    <Tab icon={<FolderIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Files" />
                    <Tab icon={<ArticleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Logs" />
                    <Tab icon={<TimelineIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Performance" />
                </Tabs>
                
                <CardContent sx={{ p: 0 }}>
                    {/* Tab 0: Recent Executions */}
                    {activeTab === 0 && (
                        recentExecutions.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <HistoryIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                <Typography sx={{ color: colors.text.muted }}>No recent executions on this machine</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ 
                                maxHeight: 350, 
                                overflowY: 'auto',
                                '&::-webkit-scrollbar': { width: '4px' },
                                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }
                            }}>
                                {recentExecutions.map((exec, idx) => (
                                    <Box 
                                        key={idx}
                                        sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 2,
                                            p: 2,
                                            borderBottom: idx < recentExecutions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                            '&:hover': { background: 'rgba(255,255,255,0.03)' }
                                        }}
                                    >
                                        <Box sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            background: exec.success ? colors.secondary : colors.error,
                                            boxShadow: `0 0 6px ${exec.success ? colors.secondary : colors.error}`,
                                            flexShrink: 0
                                        }} />
                                        <TerminalIcon sx={{ fontSize: 16, color: colors.text.disabled, flexShrink: 0 }} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ color: colors.text.primary, fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {exec.script_path?.split('/').pop() || 'Unknown script'}
                                            </Typography>
                                            <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem' }}>
                                                {exec.job_name || 'Manual execution'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                                {exec.started_at ? new Date(exec.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                                            </Typography>
                                            <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem' }}>
                                                {exec.started_at ? new Date(exec.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </Typography>
                                        </Box>
                                        <Chip 
                                            label={exec.success ? 'Success' : 'Failed'}
                                            size="small"
                                            sx={{
                                                background: exec.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 68, 102, 0.1)',
                                                color: exec.success ? colors.secondary : colors.error,
                                                fontSize: '0.65rem',
                                                height: 22,
                                                flexShrink: 0
                                            }}
                                        />
                                    </Box>
                                ))}
                            </Box>
                        )
                    )}

                    {/* Tab 1: Processes */}
                    {activeTab === 1 && (
                        <Box>
                            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem' }}>
                                    Top processes by CPU usage
                                </Typography>
                                <Button 
                                    size="small" 
                                    startIcon={<RefreshIcon />}
                                    onClick={fetchProcesses}
                                    disabled={loadingProcesses}
                                    sx={{ color: colors.primary }}
                                >
                                    Refresh
                                </Button>
                            </Box>
                            {loadingProcesses ? (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <CircularProgress size={32} sx={{ color: colors.primary }} />
                                </Box>
                            ) : processes.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <ListIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                    <Typography sx={{ color: colors.text.muted }}>Click Refresh to load processes</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ maxHeight: 350, overflowY: 'auto' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>PID</TableCell>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>USER</TableCell>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>CPU%</TableCell>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>MEM%</TableCell>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>COMMAND</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {processes.map((proc, idx) => (
                                                <TableRow key={idx} sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                                                    <TableCell sx={{ color: colors.text.primary, borderColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{proc.pid}</TableCell>
                                                    <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>{proc.user}</TableCell>
                                                    <TableCell sx={{ color: parseFloat(proc.cpu) > 50 ? colors.error : parseFloat(proc.cpu) > 20 ? colors.warning : colors.secondary, borderColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{proc.cpu}%</TableCell>
                                                    <TableCell sx={{ color: parseFloat(proc.mem) > 50 ? colors.error : parseFloat(proc.mem) > 20 ? colors.warning : colors.primary, borderColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{proc.mem}%</TableCell>
                                                    <TableCell sx={{ color: colors.text.primary, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proc.command}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Tab 2: Services */}
                    {activeTab === 2 && (
                        <Box>
                            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem' }}>
                                    Running and failed services
                                </Typography>
                                <Button 
                                    size="small" 
                                    startIcon={<RefreshIcon />}
                                    onClick={fetchServices}
                                    disabled={loadingServices}
                                    sx={{ color: colors.primary }}
                                >
                                    Refresh
                                </Button>
                            </Box>
                            {loadingServices ? (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <CircularProgress size={32} sx={{ color: colors.primary }} />
                                </Box>
                            ) : services.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <BuildIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                    <Typography sx={{ color: colors.text.muted }}>Click Refresh to load services</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ maxHeight: 350, overflowY: 'auto' }}>
                                    {services.map((svc, idx) => (
                                        <Box 
                                            key={idx}
                                            sx={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: 2,
                                                p: 2,
                                                borderBottom: idx < services.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                                '&:hover': { background: 'rgba(255,255,255,0.03)' }
                                            }}
                                        >
                                            <Box sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: svc.active === 'active' ? colors.secondary : colors.error,
                                                boxShadow: `0 0 6px ${svc.active === 'active' ? colors.secondary : colors.error}`,
                                                flexShrink: 0
                                            }} />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography sx={{ color: colors.text.primary, fontSize: '0.85rem', fontWeight: 500 }}>
                                                    {svc.name}
                                                </Typography>
                                                <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {svc.description}
                                                </Typography>
                                            </Box>
                                            <Chip 
                                                label={svc.sub || svc.active}
                                                size="small"
                                                sx={{
                                                    background: svc.active === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 68, 102, 0.1)',
                                                    color: svc.active === 'active' ? colors.secondary : colors.error,
                                                    fontSize: '0.65rem',
                                                    height: 22,
                                                    flexShrink: 0
                                                }}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Tab 3: Network Connections */}
                    {activeTab === 3 && (
                        <Box>
                            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem' }}>
                                    Listening ports and connections
                                </Typography>
                                <Button 
                                    size="small" 
                                    startIcon={<RefreshIcon />}
                                    onClick={fetchConnections}
                                    disabled={loadingConnections}
                                    sx={{ color: colors.primary }}
                                >
                                    Refresh
                                </Button>
                            </Box>
                            {loadingConnections ? (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <CircularProgress size={32} sx={{ color: colors.primary }} />
                                </Box>
                            ) : connections.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <SettingsEthernetIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                    <Typography sx={{ color: colors.text.muted }}>Click Refresh to load connections</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ maxHeight: 350, overflowY: 'auto' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>PROTO</TableCell>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>STATE</TableCell>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>LOCAL ADDRESS</TableCell>
                                                <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>PEER ADDRESS</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {connections.map((conn, idx) => (
                                                <TableRow key={idx} sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                                                    <TableCell sx={{ color: conn.protocol === 'tcp' ? colors.primary : colors.warning, borderColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.75rem', textTransform: 'uppercase' }}>{conn.protocol}</TableCell>
                                                    <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>{conn.state}</TableCell>
                                                    <TableCell sx={{ color: colors.text.primary, borderColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{conn.local}</TableCell>
                                                    <TableCell sx={{ color: colors.text.muted, borderColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{conn.peer || '*'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Tab 4: Disk Usage */}
                    {activeTab === 4 && (
                        <Box>
                            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem' }}>
                                    Disk partitions and usage
                                </Typography>
                                <Button 
                                    size="small" 
                                    startIcon={<RefreshIcon />}
                                    onClick={fetchDiskUsage}
                                    disabled={loadingDisk}
                                    sx={{ color: colors.primary }}
                                >
                                    Refresh
                                </Button>
                            </Box>
                            {loadingDisk ? (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <CircularProgress size={32} sx={{ color: colors.primary }} />
                                </Box>
                            ) : diskUsage.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <StorageIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                    <Typography sx={{ color: colors.text.muted }}>Click Refresh to load disk usage</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ p: 2 }}>
                                    {diskUsage.map((disk, idx) => (
                                        <Box key={idx} sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <StorageIcon sx={{ fontSize: 16, color: colors.primary }} />
                                                    <Typography sx={{ color: colors.text.primary, fontSize: '0.85rem', fontWeight: 500 }}>
                                                        {disk.mount}
                                                    </Typography>
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                                        ({disk.device})
                                                    </Typography>
                                                </Box>
                                                <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                    {disk.used} / {disk.size}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <LinearProgress 
                                                    variant="determinate" 
                                                    value={disk.percent}
                                                    sx={{
                                                        flex: 1,
                                                        height: 8,
                                                        borderRadius: 4,
                                                        background: 'rgba(255,255,255,0.08)',
                                                        '& .MuiLinearProgress-bar': {
                                                            background: disk.percent > 90 ? colors.error : disk.percent > 75 ? colors.warning : colors.secondary,
                                                            borderRadius: 4,
                                                        }
                                                    }}
                                                />
                                                <Typography sx={{ 
                                                    color: disk.percent > 90 ? colors.error : disk.percent > 75 ? colors.warning : colors.secondary, 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 600,
                                                    fontFamily: 'monospace',
                                                    minWidth: 45
                                                }}>
                                                    {disk.percent}%
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem', mt: 0.5 }}>
                                                {disk.avail} available
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Tab 5: File Browser */}
                    {activeTab === 5 && (
                        <Box>
                            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <IconButton 
                                            size="small" 
                                            onClick={() => browseDirectory('/home')}
                                            sx={{ color: colors.text.muted }}
                                        >
                                            <HomeIcon fontSize="small" />
                                        </IconButton>
                                    <Breadcrumbs 
                                        separator={<KeyboardArrowRightIcon sx={{ fontSize: 16, color: colors.text.disabled }} />}
                                        sx={{ '& .MuiBreadcrumbs-li': { display: 'flex' } }}
                                    >
                                        {fileBrowser.path.split('/').filter(Boolean).map((part, idx, arr) => {
                                            const path = '/' + arr.slice(0, idx + 1).join('/')
                                            return (
                                                <Link
                                                    key={path}
                                                    component="button"
                                                    onClick={() => browseDirectory(path)}
                                                    sx={{ 
                                                        color: idx === arr.length - 1 ? colors.primary : colors.text.muted,
                                                        fontSize: '0.8rem',
                                                        textDecoration: 'none',
                                                        '&:hover': { color: colors.primary }
                                                    }}
                                                >
                                                    {part}
                                                </Link>
                                            )
                                        })}
                                    </Breadcrumbs>
                                    </Box>
                                    <Button
                                        size="small"
                                        startIcon={<CloudUploadIcon />}
                                        onClick={() => setFileUploadDialog(prev => ({ ...prev, open: true }))}
                                        sx={{ 
                                            color: colors.secondary,
                                            borderColor: 'rgba(34, 197, 94, 0.3)',
                                            '&:hover': { borderColor: colors.secondary, background: 'rgba(34, 197, 94, 0.1)' }
                                        }}
                                        variant="outlined"
                                    >
                                        Upload
                                    </Button>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                        size="small"
                                        placeholder="Go to path..."
                                        value={fileBrowser.path}
                                        onChange={(e) => setFileBrowser(prev => ({ ...prev, path: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && browseDirectory(fileBrowser.path)}
                                        sx={{
                                            flex: 1,
                                            '& .MuiOutlinedInput-root': {
                                                background: 'rgba(0,0,0,0.2)',
                                                fontSize: '0.8rem',
                                                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                            },
                                            '& .MuiOutlinedInput-input': { color: colors.text.primary, fontFamily: 'monospace' }
                                        }}
                                    />
                                    <Button 
                                        size="small" 
                                        onClick={() => browseDirectory(fileBrowser.path)}
                                        disabled={fileBrowser.loading}
                                        sx={{ color: colors.primary }}
                                    >
                                        Go
                                    </Button>
                                </Box>
                            </Box>
                            {fileBrowser.loading ? (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <CircularProgress size={32} sx={{ color: colors.primary }} />
                                </Box>
                            ) : fileBrowser.files.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <FolderOpenIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                    <Typography sx={{ color: colors.text.muted }}>Directory is empty or inaccessible</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ 
                                    maxHeight: 'calc(100vh - 500px)',
                                    minHeight: 300,
                                    overflowY: 'auto',
                                    '&::-webkit-scrollbar': { width: '6px' },
                                    '&::-webkit-scrollbar-track': { background: 'rgba(0,0,0,0.2)' },
                                    '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: '3px' }
                                }}>
                                    {/* Table Header */}
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 2,
                                        p: 1,
                                        px: 2,
                                        background: 'rgba(0,0,0,0.2)',
                                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1
                                    }}>
                                        <Box sx={{ width: 20 }} />
                                        <Typography sx={{ flex: 1, color: colors.text.disabled, fontSize: '0.7rem', textTransform: 'uppercase' }}>Name</Typography>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem', textTransform: 'uppercase', minWidth: 70, textAlign: 'right' }}>Size</Typography>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem', textTransform: 'uppercase', minWidth: 110 }}>Modified</Typography>
                                        <Box sx={{ width: 32 }} />
                                    </Box>
                                    {fileBrowser.files.map((file, idx) => (
                                        <Box 
                                            key={idx}
                                            onClick={() => file.isDir ? browseDirectory(`${fileBrowser.path}/${file.name}`) : null}
                                            sx={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: 2,
                                                p: 1,
                                                px: 2,
                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                cursor: file.isDir ? 'pointer' : 'default',
                                                '&:hover': { background: 'rgba(255,255,255,0.05)' }
                                            }}
                                        >
                                            {file.isDir ? (
                                                <FolderIcon sx={{ fontSize: 18, color: colors.warning }} />
                                            ) : file.isLink ? (
                                                <InsertDriveFileIcon sx={{ fontSize: 18, color: colors.primary }} />
                                            ) : (
                                                <DescriptionIcon sx={{ fontSize: 18, color: colors.text.muted }} />
                                            )}
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography sx={{ 
                                                    color: file.isDir ? colors.warning : colors.text.primary, 
                                                    fontSize: '0.8rem',
                                                    fontWeight: file.isDir ? 500 : 400,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {file.name}
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem', fontFamily: 'monospace', minWidth: 70, textAlign: 'right' }}>
                                                {file.isDir ? '-' : file.size}
                                            </Typography>
                                            <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem', minWidth: 110 }}>
                                                {file.date}
                                            </Typography>
                                            {!file.isDir ? (
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    <Tooltip title="View file">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={(e) => { e.stopPropagation(); viewFile(file.name) }}
                                                            sx={{ color: colors.text.muted, p: 0.5 }}
                                                        >
                                                            <VisibilityIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Edit file">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={(e) => { e.stopPropagation(); editFile(file.name) }}
                                                            sx={{ color: colors.primary, p: 0.5 }}
                                                        >
                                                            <EditIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            ) : (
                                                <Box sx={{ width: 64 }} />
                                            )}
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Tab 6: System Logs */}
                    {activeTab === 6 && (
                        <Box>
                            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {['syslog', 'auth', 'kern', 'boot'].map(log => (
                                        <Chip
                                            key={log}
                                            label={log}
                                            size="small"
                                            onClick={() => { setLogFilter(log); fetchSystemLogs(log) }}
                                            sx={{
                                                background: logFilter === log ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255,255,255,0.05)',
                                                color: logFilter === log ? colors.primary : colors.text.muted,
                                                border: logFilter === log ? `1px solid ${colors.primary}` : '1px solid transparent',
                                                textTransform: 'uppercase',
                                                fontSize: '0.65rem',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    ))}
                                </Box>
                                <Button 
                                    size="small" 
                                    startIcon={<RefreshIcon />}
                                    onClick={() => fetchSystemLogs()}
                                    disabled={loadingLogs}
                                    sx={{ color: colors.primary }}
                                >
                                    Refresh
                                </Button>
                            </Box>
                            {loadingLogs ? (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <CircularProgress size={32} sx={{ color: colors.primary }} />
                                </Box>
                            ) : systemLogs.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <ArticleIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                    <Typography sx={{ color: colors.text.muted }}>Click Refresh to load logs</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ 
                                    maxHeight: 400, 
                                    overflowY: 'auto',
                                    background: '#0d1117',
                                    fontFamily: '"SF Mono", "Fira Code", monospace',
                                    fontSize: '0.75rem',
                                    p: 1
                                }}>
                                    {systemLogs.map((log) => (
                                        <Box 
                                            key={log.id}
                                            sx={{ 
                                                py: 0.25,
                                                px: 1,
                                                color: log.level === 'error' ? colors.error : log.level === 'warning' ? colors.warning : 'rgba(255,255,255,0.7)',
                                                '&:hover': { background: 'rgba(255,255,255,0.03)' },
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-all'
                                            }}
                                        >
                                            {log.text}
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Tab 7: Performance History */}
                    {activeTab === 7 && (
                        <Box sx={{ p: 2 }}>
                            {!agentConnected ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <TimelineIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                    <Typography sx={{ color: colors.text.muted, mb: 1 }}>Agent not connected</Typography>
                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem' }}>
                                        Performance history requires the monitoring agent to be installed and running
                                    </Typography>
                                </Box>
                            ) : performanceHistory.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <TimelineIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                    <Typography sx={{ color: colors.text.muted }}>Collecting performance data...</Typography>
                                </Box>
                            ) : (
                                <Box>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem', mb: 2 }}>
                                        Real-time CPU & Memory usage (last {performanceHistory.length} samples)
                                    </Typography>
                                    {/* Simple ASCII-style chart */}
                                    <Box sx={{ 
                                        background: '#0d1117', 
                                        borderRadius: '8px', 
                                        p: 2,
                                        fontFamily: '"SF Mono", monospace',
                                        fontSize: '0.7rem'
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 12, height: 12, background: colors.primary, borderRadius: 2 }} />
                                                <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>CPU</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 12, height: 12, background: colors.secondary, borderRadius: 2 }} />
                                                <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>Memory</Typography>
                                            </Box>
                                        </Box>
                                        {/* Bar chart visualization */}
                                        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 120, mt: 2 }}>
                                            {performanceHistory.map((point, idx) => (
                                                <Tooltip 
                                                    key={idx} 
                                                    title={`${point.time} - CPU: ${point.cpu.toFixed(1)}%, MEM: ${point.mem.toFixed(1)}%`}
                                                >
                                                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center' }}>
                                                        <Box sx={{ 
                                                            width: '100%', 
                                                            height: `${point.cpu}%`, 
                                                            background: colors.primary,
                                                            borderRadius: '2px 2px 0 0',
                                                            minHeight: 2,
                                                            opacity: 0.8
                                                        }} />
                                                        <Box sx={{ 
                                                            width: '100%', 
                                                            height: `${point.mem}%`, 
                                                            background: colors.secondary,
                                                            borderRadius: '0 0 2px 2px',
                                                            minHeight: 2,
                                                            opacity: 0.8
                                                        }} />
                                                    </Box>
                                                </Tooltip>
                                            ))}
                                        </Box>
                                        {/* Current values */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography sx={{ color: colors.primary, fontSize: '1.5rem', fontWeight: 700 }}>
                                                    {performanceHistory[performanceHistory.length - 1]?.cpu.toFixed(1)}%
                                                </Typography>
                                                <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem' }}>Current CPU</Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography sx={{ color: colors.secondary, fontSize: '1.5rem', fontWeight: 700 }}>
                                                    {performanceHistory[performanceHistory.length - 1]?.mem.toFixed(1)}%
                                                </Typography>
                                                <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem' }}>Current Memory</Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* File View Dialog */}
            <Dialog 
                open={fileViewDialog.open} 
                onClose={() => setFileViewDialog({ open: false, content: '', filename: '' })}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.98) 0%, rgba(17, 23, 35, 0.99) 100%)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                    }
                }}
            >
                <DialogTitle sx={{ 
                    color: colors.text.primary, 
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    <DescriptionIcon sx={{ color: colors.primary }} />
                    {fileViewDialog.filename}
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ 
                        background: '#0d1117',
                        p: 2,
                        maxHeight: 500,
                        overflowY: 'auto',
                        fontFamily: '"SF Mono", "Fira Code", monospace',
                        fontSize: '0.8rem',
                        color: 'rgba(255,255,255,0.8)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                    }}>
                        {fileViewDialog.content || 'No content'}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', p: 2 }}>
                    <Button 
                        onClick={() => {
                            navigator.clipboard.writeText(fileViewDialog.content)
                        }}
                        startIcon={<ContentCopyIcon />}
                        sx={{ color: colors.text.muted }}
                    >
                        Copy
                    </Button>
                    <Button 
                        onClick={() => setFileViewDialog({ open: false, content: '', filename: '' })}
                        variant="contained"
                        sx={{
                            background: 'linear-gradient(135deg, #f97316 0%, #00a0cc 100%)',
                            color: '#0a0a0f',
                        }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* File Edit Dialog */}
            <Dialog 
                open={fileEditDialog.open} 
                onClose={() => {
                    if (fileEditDialog.content !== fileEditDialog.originalContent) {
                        if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                            setFileEditDialog({ open: false, content: '', originalContent: '', filename: '', path: '', saving: false, error: '' })
                        }
                    } else {
                        setFileEditDialog({ open: false, content: '', originalContent: '', filename: '', path: '', saving: false, error: '' })
                    }
                }}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.98) 0%, rgba(17, 23, 35, 0.99) 100%)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        height: '80vh',
                        maxHeight: '80vh',
                    }
                }}
            >
                <DialogTitle sx={{ 
                    color: colors.text.primary, 
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1.5
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EditIcon sx={{ color: colors.primary }} />
                        <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                            {fileEditDialog.filename}
                        </Typography>
                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            {fileEditDialog.path}
                        </Typography>
                    </Box>
                    {fileEditDialog.content !== fileEditDialog.originalContent && (
                        <Chip 
                            label="Modified" 
                            size="small" 
                            sx={{ 
                                background: 'rgba(255, 170, 0, 0.2)', 
                                color: colors.warning,
                                fontSize: '0.7rem'
                            }} 
                        />
                    )}
                </DialogTitle>
                <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {fileEditDialog.loading ? (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CircularProgress sx={{ color: colors.primary }} />
                        </Box>
                    ) : fileEditDialog.error && !fileEditDialog.content ? (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                            <Typography sx={{ color: colors.error }}>{fileEditDialog.error}</Typography>
                        </Box>
                    ) : (
                        <textarea
                            value={fileEditDialog.content}
                            onChange={(e) => setFileEditDialog(prev => ({ ...prev, content: e.target.value }))}
                            style={{
                                flex: 1,
                                width: '100%',
                                background: '#0d1117',
                                color: 'rgba(255,255,255,0.9)',
                                border: 'none',
                                outline: 'none',
                                padding: '16px',
                                fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
                                fontSize: '0.85rem',
                                lineHeight: 1.6,
                                resize: 'none',
                                tabSize: 4,
                            }}
                            spellCheck={false}
                        />
                    )}
                </DialogContent>
                <DialogActions sx={{ 
                    borderTop: '1px solid rgba(255,255,255,0.06)', 
                    p: 2,
                    justifyContent: 'space-between'
                }}>
                    <Box>
                        {fileEditDialog.error && fileEditDialog.content && (
                            <Typography sx={{ color: colors.error, fontSize: '0.8rem' }}>
                                {fileEditDialog.error}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                            onClick={() => {
                                if (fileEditDialog.content !== fileEditDialog.originalContent) {
                                    if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                                        setFileEditDialog({ open: false, content: '', originalContent: '', filename: '', path: '', saving: false, error: '' })
                                    }
                                } else {
                                    setFileEditDialog({ open: false, content: '', originalContent: '', filename: '', path: '', saving: false, error: '' })
                                }
                            }}
                            sx={{ color: colors.text.muted }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={saveFile}
                            disabled={fileEditDialog.saving || fileEditDialog.content === fileEditDialog.originalContent}
                            variant="contained"
                            startIcon={fileEditDialog.saving ? <CircularProgress size={16} sx={{ color: '#0a0a0f' }} /> : <SaveIcon />}
                            sx={{
                                background: 'linear-gradient(135deg, #22c55e 0%, #00cc6a 100%)',
                                color: '#0a0a0f',
                                '&:hover': { background: 'linear-gradient(135deg, #66ffaa 0%, #22c55e 100%)' },
                                '&.Mui-disabled': { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }
                            }}
                        >
                            {fileEditDialog.saving ? 'Saving...' : 'Save'}
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>

            {/* File Upload Dialog */}
            <Dialog 
                open={fileUploadDialog.open} 
                onClose={() => !fileUploadDialog.uploading && setFileUploadDialog({ 
                    open: false, file: null, filename: '', permissions: '644', 
                    owner: '', makeExecutable: false, createDirs: true, 
                    uploading: false, error: '', progress: '' 
                })}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.98) 0%, rgba(17, 23, 35, 0.99) 100%)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                    }
                }}
            >
                <DialogTitle sx={{ 
                    color: colors.text.primary, 
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    <CloudUploadIcon sx={{ color: colors.secondary }} />
                    Upload File to {fileBrowser.path}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    {/* File Drop Zone */}
                    <Box 
                        sx={{ 
                            border: '2px dashed rgba(255,255,255,0.2)',
                            borderRadius: '12px',
                            p: 4,
                            textAlign: 'center',
                            mb: 3,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: fileUploadDialog.file ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                            borderColor: fileUploadDialog.file ? colors.secondary : 'rgba(255,255,255,0.2)',
                            '&:hover': { borderColor: colors.primary, background: 'rgba(249, 115, 22, 0.05)' }
                        }}
                        onClick={() => document.getElementById('file-upload-input').click()}
                    >
                        <input
                            id="file-upload-input"
                            type="file"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const file = e.target.files[0]
                                if (file) {
                                    // Extract just the filename, handling both Windows (\) and Unix (/) paths
                                    const filename = file.name.split('\\').pop().split('/').pop()
                                    setFileUploadDialog(prev => ({ 
                                        ...prev, 
                                        file, 
                                        filename: filename,
                                        error: '',
                                        progress: ''
                                    }))
                                }
                                // Reset input value so same file can be re-selected
                                e.target.value = ''
                            }}
                        />
                        {fileUploadDialog.file ? (
                            <Box>
                                <CheckCircleOutlineIcon sx={{ fontSize: 48, color: colors.secondary, mb: 1 }} />
                                <Typography sx={{ color: colors.text.primary, fontWeight: 500 }}>
                                    {fileUploadDialog.file.name}
                                </Typography>
                                <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem' }}>
                                    {(fileUploadDialog.file.size / 1024).toFixed(1)} KB
                                </Typography>
                            </Box>
                        ) : (
                            <Box>
                                <CloudUploadIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 1 }} />
                                <Typography sx={{ color: colors.text.muted }}>
                                    Click to select a file
                                </Typography>
                                <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem' }}>
                                    or drag and drop
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    {/* Filename Override */}
                    <TextField
                        fullWidth
                        size="small"
                        label="Filename (optional override)"
                        value={fileUploadDialog.filename}
                        onChange={(e) => setFileUploadDialog(prev => ({ ...prev, filename: e.target.value }))}
                        sx={{ 
                            mb: 2,
                            '& .MuiOutlinedInput-root': {
                                background: 'rgba(0,0,0,0.2)',
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                            },
                            '& .MuiInputLabel-root': { color: colors.text.muted },
                            '& .MuiOutlinedInput-input': { color: colors.text.primary }
                        }}
                    />

                    {/* Permissions & Options */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                            size="small"
                            label="Permissions"
                            value={fileUploadDialog.permissions}
                            onChange={(e) => setFileUploadDialog(prev => ({ ...prev, permissions: e.target.value }))}
                            placeholder="644"
                            sx={{ 
                                width: 120,
                                '& .MuiOutlinedInput-root': {
                                    background: 'rgba(0,0,0,0.2)',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                },
                                '& .MuiInputLabel-root': { color: colors.text.muted },
                                '& .MuiOutlinedInput-input': { color: colors.text.primary, fontFamily: 'monospace' }
                            }}
                        />
                        <TextField
                            size="small"
                            label="Owner (user:group)"
                            value={fileUploadDialog.owner}
                            onChange={(e) => setFileUploadDialog(prev => ({ ...prev, owner: e.target.value }))}
                            placeholder="root:root"
                            sx={{ 
                                flex: 1,
                                '& .MuiOutlinedInput-root': {
                                    background: 'rgba(0,0,0,0.2)',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                },
                                '& .MuiInputLabel-root': { color: colors.text.muted },
                                '& .MuiOutlinedInput-input': { color: colors.text.primary, fontFamily: 'monospace' }
                            }}
                        />
                    </Box>

                    {/* Checkboxes */}
                    <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                        <Box 
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                            onClick={() => setFileUploadDialog(prev => ({ ...prev, makeExecutable: !prev.makeExecutable }))}
                        >
                            <Box sx={{ 
                                width: 18, height: 18, borderRadius: '4px',
                                border: `2px solid ${fileUploadDialog.makeExecutable ? colors.secondary : 'rgba(255,255,255,0.3)'}`,
                                background: fileUploadDialog.makeExecutable ? colors.secondary : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {fileUploadDialog.makeExecutable && <Typography sx={{ color: '#0a0a0f', fontSize: '0.7rem', fontWeight: 700 }}>✓</Typography>}
                            </Box>
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>Make executable</Typography>
                        </Box>
                        <Box 
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                            onClick={() => setFileUploadDialog(prev => ({ ...prev, createDirs: !prev.createDirs }))}
                        >
                            <Box sx={{ 
                                width: 18, height: 18, borderRadius: '4px',
                                border: `2px solid ${fileUploadDialog.createDirs ? colors.secondary : 'rgba(255,255,255,0.3)'}`,
                                background: fileUploadDialog.createDirs ? colors.secondary : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {fileUploadDialog.createDirs && <Typography sx={{ color: '#0a0a0f', fontSize: '0.7rem', fontWeight: 700 }}>✓</Typography>}
                            </Box>
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>Create parent dirs</Typography>
                        </Box>
                    </Box>

                    {/* Progress/Error */}
                    {fileUploadDialog.progress && (
                        <Box sx={{ 
                            p: 2, 
                            background: fileUploadDialog.progress.includes('complete') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)', 
                            borderRadius: '8px',
                            border: fileUploadDialog.progress.includes('complete') ? '1px solid rgba(34, 197, 94, 0.5)' : 'none'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: fileUploadDialog.uploading ? 1.5 : 0 }}>
                                {fileUploadDialog.uploading ? (
                                    <CircularProgress size={20} sx={{ color: colors.secondary }} />
                                ) : fileUploadDialog.progress.includes('complete') ? (
                                    <CheckCircleOutlineIcon sx={{ color: colors.secondary }} />
                                ) : null}
                                <Typography sx={{ color: colors.secondary, fontSize: '0.85rem', fontWeight: fileUploadDialog.progress.includes('complete') ? 600 : 400 }}>
                                    {fileUploadDialog.progress}
                                </Typography>
                            </Box>
                            {/* Progress Bar */}
                            {fileUploadDialog.uploading && fileUploadDialog.uploadPercent > 0 && (
                                <Box sx={{ width: '100%', mt: 1 }}>
                                    <Box sx={{ 
                                        width: '100%', 
                                        height: 8, 
                                        background: 'rgba(0, 0, 0, 0.3)', 
                                        borderRadius: 4,
                                        overflow: 'hidden'
                                    }}>
                                        <Box sx={{ 
                                            width: `${fileUploadDialog.uploadPercent}%`, 
                                            height: '100%', 
                                            background: 'linear-gradient(90deg, #22c55e 0%, #00cc6a 100%)',
                                            borderRadius: 4,
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </Box>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.75rem', mt: 0.5, textAlign: 'right' }}>
                                        {fileUploadDialog.uploadPercent}%
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}
                    {fileUploadDialog.error && (
                        <Box sx={{ 
                            p: 2, 
                            background: 'rgba(255, 68, 102, 0.1)', 
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 68, 102, 0.3)'
                        }}>
                            <Typography sx={{ color: colors.error, fontSize: '0.85rem' }}>
                                {fileUploadDialog.error}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', p: 2 }}>
                    <Button 
                        onClick={() => setFileUploadDialog({ 
                            open: false, file: null, filename: '', permissions: '644', 
                            owner: '', makeExecutable: false, createDirs: true, 
                            uploading: false, error: '', progress: '' 
                        })}
                        disabled={fileUploadDialog.uploading}
                        sx={{ color: colors.text.muted }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={uploadFile}
                        disabled={!fileUploadDialog.file || fileUploadDialog.uploading}
                        variant="contained"
                        startIcon={fileUploadDialog.uploading ? <CircularProgress size={16} sx={{ color: '#0a0a0f' }} /> : <CloudUploadIcon />}
                        sx={{
                            background: 'linear-gradient(135deg, #22c55e 0%, #00cc6a 100%)',
                            color: '#0a0a0f',
                            '&:hover': { background: 'linear-gradient(135deg, #66ffaa 0%, #22c55e 100%)' },
                            '&.Mui-disabled': { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }
                        }}
                    >
                        {fileUploadDialog.uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    )
}

export default MachineMonitor
