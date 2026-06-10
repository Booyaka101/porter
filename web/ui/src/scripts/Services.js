import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Tooltip from '@mui/material/Tooltip'
import InputAdornment from '@mui/material/InputAdornment'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import ArticleIcon from '@mui/icons-material/Article'
import SettingsIcon from '@mui/icons-material/Settings'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

const Services = () => {
    const [machines, setMachines] = useState([])
    const [selectedMachine, setSelectedMachine] = useState('')
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState('all')
    const [actionLoading, setActionLoading] = useState({})
    const [logsDialog, setLogsDialog] = useState({ open: false, service: null, logs: '' })
    const [logsLoading, setLogsLoading] = useState(false)
    const [tabValue, setTabValue] = useState(0)

    useEffect(() => {
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => setMachines(data || []))
            .catch(console.error)
    }, [])

    const loadServices = useCallback(async () => {
        if (!selectedMachine) return
        setLoading(true)
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/services`)
            const data = await res.json()
            setServices(data.services || [])
        } catch (err) {
            console.error('Failed to load services:', err)
        } finally {
            setLoading(false)
        }
    }, [selectedMachine])

    useEffect(() => {
        if (selectedMachine) loadServices()
    }, [selectedMachine, loadServices])

    const handleServiceAction = async (serviceName, action) => {
        setActionLoading(prev => ({ ...prev, [serviceName]: action }))
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/service/${serviceName}/${action}`, {
                method: 'POST'
            })
            const data = await res.json()
            if (data.success) {
                setTimeout(loadServices, 1000)
            }
        } catch (err) {
            console.error(`Failed to ${action} service:`, err)
        } finally {
            setActionLoading(prev => ({ ...prev, [serviceName]: null }))
        }
    }

    const handleViewLogs = async (serviceName) => {
        setLogsDialog({ open: true, service: serviceName, logs: '' })
        setLogsLoading(true)
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/service/${serviceName}/logs?lines=100`)
            const data = await res.json()
            setLogsDialog(prev => ({ ...prev, logs: data.logs || 'No logs available' }))
        } catch (err) {
            setLogsDialog(prev => ({ ...prev, logs: 'Failed to load logs: ' + err.message }))
        } finally {
            setLogsLoading(false)
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'running':
            case 'active':
                return <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 20 }} />
            case 'stopped':
            case 'inactive':
            case 'dead':
                return <ErrorIcon sx={{ color: '#ff6b6b', fontSize: 20 }} />
            case 'failed':
                return <ErrorIcon sx={{ color: '#ff3366', fontSize: 20 }} />
            default:
                return <PauseCircleIcon sx={{ color: '#ffaa00', fontSize: 20 }} />
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'running':
            case 'active':
                return 'success'
            case 'stopped':
            case 'inactive':
            case 'dead':
                return 'error'
            case 'failed':
                return 'error'
            default:
                return 'warning'
        }
    }

    const filteredServices = services.filter(svc => {
        const matchesSearch = svc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (svc.description && svc.description.toLowerCase().includes(searchTerm.toLowerCase()))
        
        if (filter === 'all') return matchesSearch
        if (filter === 'running') return matchesSearch && (svc.status === 'running' || svc.status === 'active')
        if (filter === 'stopped') return matchesSearch && (svc.status === 'stopped' || svc.status === 'inactive' || svc.status === 'dead')
        if (filter === 'failed') return matchesSearch && svc.status === 'failed'
        if (filter === 'enabled') return matchesSearch && svc.enabled
        return matchesSearch
    })

    const systemServices = filteredServices.filter(s => !s.name.includes('@') && !s.isUser)
    const userServices = filteredServices.filter(s => s.isUser)
    const timerServices = filteredServices.filter(s => s.name.endsWith('.timer'))

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    Services Manager
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Machine</InputLabel>
                        <Select
                            value={selectedMachine}
                            onChange={(e) => setSelectedMachine(e.target.value)}
                            label="Machine"
                        >
                            {machines.map(m => (
                                <MenuItem key={m.id} value={m.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            bgcolor: m.status === 'online' ? '#22c55e' : '#ff3366'
                                        }} />
                                        {m.name}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <IconButton onClick={loadServices} disabled={!selectedMachine || loading}>
                        <RefreshIcon sx={{ color: loading ? 'grey' : '#f97316' }} />
                    </IconButton>
                </Box>
            </Box>

            {selectedMachine && (
                <>
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                            <TextField
                                size="small"
                                placeholder="Search services..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                                        </InputAdornment>
                                    )
                                }}
                                sx={{ minWidth: 250 }}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {['all', 'running', 'stopped', 'failed', 'enabled'].map(f => (
                                    <Chip
                                        key={f}
                                        label={f.charAt(0).toUpperCase() + f.slice(1)}
                                        onClick={() => setFilter(f)}
                                        color={filter === f ? 'primary' : 'default'}
                                        variant={filter === f ? 'filled' : 'outlined'}
                                        size="small"
                                    />
                                ))}
                            </Box>
                            <Box sx={{ flex: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                                {filteredServices.length} services
                            </Typography>
                        </Box>
                    </Paper>

                    <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
                        <Tab label={`System (${systemServices.length})`} />
                        <Tab label={`User (${userServices.length})`} />
                        <Tab label={`Timers (${timerServices.length})`} />
                    </Tabs>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Paper sx={{ overflow: 'hidden' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Service</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Enabled</TableCell>
                                        <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(tabValue === 0 ? systemServices : tabValue === 1 ? userServices : timerServices).map(svc => (
                                        <TableRow 
                                            key={svc.name}
                                            sx={{ 
                                                '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' },
                                                transition: 'background-color 0.2s'
                                            }}
                                        >
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {getStatusIcon(svc.status)}
                                                    <Chip 
                                                        label={svc.status} 
                                                        size="small" 
                                                        color={getStatusColor(svc.status)}
                                                        sx={{ fontSize: '0.7rem', height: 22 }}
                                                    />
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                    {svc.name}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary" sx={{ 
                                                    maxWidth: 300, 
                                                    overflow: 'hidden', 
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {svc.description || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={svc.enabled ? 'Yes' : 'No'} 
                                                    size="small"
                                                    color={svc.enabled ? 'success' : 'default'}
                                                    variant="outlined"
                                                    sx={{ fontSize: '0.7rem', height: 22 }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                                    <Tooltip title="Start">
                                                        <IconButton 
                                                            size="small"
                                                            onClick={() => handleServiceAction(svc.name, 'start')}
                                                            disabled={actionLoading[svc.name] === 'start'}
                                                        >
                                                            {actionLoading[svc.name] === 'start' ? 
                                                                <CircularProgress size={16} /> : 
                                                                <PlayArrowIcon sx={{ fontSize: 18, color: '#22c55e' }} />
                                                            }
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Stop">
                                                        <IconButton 
                                                            size="small"
                                                            onClick={() => handleServiceAction(svc.name, 'stop')}
                                                            disabled={actionLoading[svc.name] === 'stop'}
                                                        >
                                                            {actionLoading[svc.name] === 'stop' ? 
                                                                <CircularProgress size={16} /> : 
                                                                <StopIcon sx={{ fontSize: 18, color: '#ff6b6b' }} />
                                                            }
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Restart">
                                                        <IconButton 
                                                            size="small"
                                                            onClick={() => handleServiceAction(svc.name, 'restart')}
                                                            disabled={actionLoading[svc.name] === 'restart'}
                                                        >
                                                            {actionLoading[svc.name] === 'restart' ? 
                                                                <CircularProgress size={16} /> : 
                                                                <RestartAltIcon sx={{ fontSize: 18, color: '#ffaa00' }} />
                                                            }
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={svc.enabled ? 'Disable' : 'Enable'}>
                                                        <IconButton 
                                                            size="small"
                                                            onClick={() => handleServiceAction(svc.name, svc.enabled ? 'disable' : 'enable')}
                                                            disabled={actionLoading[svc.name]}
                                                        >
                                                            <PowerSettingsNewIcon sx={{ 
                                                                fontSize: 18, 
                                                                color: svc.enabled ? '#f97316' : 'rgba(255,255,255,0.3)' 
                                                            }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="View Logs">
                                                        <IconButton 
                                                            size="small"
                                                            onClick={() => handleViewLogs(svc.name)}
                                                        >
                                                            <ArticleIcon sx={{ fontSize: 18, color: '#f97316' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Paper>
                    )}
                </>
            )}

            {!selectedMachine && (
                <Paper sx={{ p: 6, textAlign: 'center' }}>
                    <SettingsIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                    <Typography color="text.secondary">
                        Select a machine to manage systemd services
                    </Typography>
                </Paper>
            )}

            <Dialog 
                open={logsDialog.open} 
                onClose={() => setLogsDialog({ open: false, service: null, logs: '' })}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ArticleIcon />
                    Logs: {logsDialog.service}
                </DialogTitle>
                <DialogContent>
                    {logsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box sx={{
                            bgcolor: '#0d1117',
                            p: 2,
                            borderRadius: 1,
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            maxHeight: 500,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            color: '#e0f7ff'
                        }}>
                            {logsDialog.logs}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogsDialog({ open: false, service: null, logs: '' })}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Services
