import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import InputAdornment from '@mui/material/InputAdornment'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import ArticleIcon from '@mui/icons-material/Article'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import InfoIcon from '@mui/icons-material/Info'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AccountTreeIcon from '@mui/icons-material/AccountTree'

const MachineServices = ({ machine, machineId }) => {
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState('running')
    const [actionLoading, setActionLoading] = useState({})
    const [logsDialog, setLogsDialog] = useState({ open: false, service: null, logs: '', streaming: false, lines: 100 })
    const [logsLoading, setLogsLoading] = useState(false)
    const [tabValue, setTabValue] = useState(0)
    const [detailsDialog, setDetailsDialog] = useState({ open: false, service: null, data: null, loading: false })
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [depsDialog, setDepsDialog] = useState({ open: false, loading: false, nodes: [], edges: [] })
    const abortControllerRef = useRef(null)
    const isMountedRef = useRef(true)
    const logsIntervalRef = useRef(null)

    const loadServices = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        
        setLoading(true)
        try {
            const res = await fetch(`/api/machines/${machineId}/services`, {
                signal: abortControllerRef.current.signal
            })
            const data = await res.json()
            if (isMountedRef.current) {
                setServices(data.services || [])
                setLoading(false)
            }
        } catch (err) {
            if (err.name !== 'AbortError' && isMountedRef.current) {
                console.error('Failed to load services:', err)
                setLoading(false)
            }
        }
    }, [machineId])

    useEffect(() => {
        isMountedRef.current = true
        loadServices()
        return () => {
            isMountedRef.current = false
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [loadServices])

    const handleServiceAction = async (serviceName, action, isUser = false) => {
        setActionLoading(prev => ({ ...prev, [serviceName]: action }))
        try {
            const userParam = isUser ? '?user=true' : ''
            await fetch(`/api/machines/${machineId}/service/${serviceName}/${action}${userParam}`, { method: 'POST' })
            setTimeout(loadServices, 1000)
        } catch (err) {
            console.error(`Failed to ${action} service:`, err)
        } finally {
            setActionLoading(prev => ({ ...prev, [serviceName]: null }))
        }
    }

    const loadDependencies = async () => {
        setDepsDialog({ open: true, loading: true, nodes: [], edges: [] })
        try {
            const res = await fetch(`/api/machines/${machineId}/services/dependencies`)
            const data = await res.json()
            setDepsDialog({ open: true, loading: false, nodes: data.nodes || [], edges: data.edges || [] })
        } catch (err) {
            console.error('Failed to load dependencies:', err)
            setDepsDialog(prev => ({ ...prev, loading: false }))
        }
    }

    const handleViewLogs = async (serviceName, lines = 100, isUser = false) => {
        setLogsDialog(prev => ({ ...prev, open: true, service: serviceName, lines, isUser }))
        setLogsLoading(true)
        try {
            const userParam = isUser ? '&user=true' : ''
            const res = await fetch(`/api/machines/${machineId}/service/${serviceName}/logs?lines=${lines}${userParam}`)
            const data = await res.json()
            setLogsDialog(prev => ({ ...prev, logs: data.logs || 'No logs available' }))
        } catch (err) {
            setLogsDialog(prev => ({ ...prev, logs: 'Failed to load logs: ' + err.message }))
        } finally {
            setLogsLoading(false)
        }
    }

    const toggleLogStreaming = (enabled) => {
        setLogsDialog(prev => ({ ...prev, streaming: enabled }))
        if (enabled && logsDialog.service) {
            logsIntervalRef.current = setInterval(() => {
                handleViewLogs(logsDialog.service, logsDialog.lines, logsDialog.isUser)
            }, 2000)
        } else {
            if (logsIntervalRef.current) clearInterval(logsIntervalRef.current)
        }
    }

    const handleViewDetails = async (serviceName, isUser = false) => {
        setDetailsDialog({ open: true, service: serviceName, data: null, loading: true, isUser })
        try {
            const userParam = isUser ? '?user=true' : ''
            const res = await fetch(`/api/machines/${machineId}/service/${serviceName}/status${userParam}`)
            const data = await res.json()
            setDetailsDialog(prev => ({ ...prev, data, loading: false }))
        } catch (err) {
            setDetailsDialog(prev => ({ ...prev, data: { error: err.message }, loading: false }))
        }
    }

    const copyLogs = () => {
        navigator.clipboard.writeText(logsDialog.logs)
    }

    const downloadLogs = () => {
        const blob = new Blob([logsDialog.logs], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${logsDialog.service}-logs.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    useEffect(() => {
        return () => {
            if (logsIntervalRef.current) clearInterval(logsIntervalRef.current)
        }
    }, [])

    useEffect(() => {
        if (!autoRefresh) return
        const interval = setInterval(loadServices, 10000)
        return () => clearInterval(interval)
    }, [autoRefresh, loadServices])

    const getStatusIcon = (status) => {
        if (status === 'running' || status === 'active') return <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 20 }} />
        if (status === 'failed') return <ErrorIcon sx={{ color: '#ff3366', fontSize: 20 }} />
        if (status === 'stopped' || status === 'inactive' || status === 'dead') return <ErrorIcon sx={{ color: '#ff6b6b', fontSize: 20 }} />
        return <PauseCircleIcon sx={{ color: '#ffaa00', fontSize: 20 }} />
    }

    const getStatusColor = (status) => {
        if (status === 'running' || status === 'active') return 'success'
        if (status === 'failed') return 'error'
        if (status === 'stopped' || status === 'inactive' || status === 'dead') return 'error'
        return 'warning'
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

    const systemServices = filteredServices.filter(s => s.type === 'service' && !s.isUser)
    const userServices = filteredServices.filter(s => s.type === 'service' && s.isUser)
    const timerServices = filteredServices.filter(s => s.type === 'timer')

    const currentServices = tabValue === 0 ? systemServices : tabValue === 1 ? userServices : timerServices

    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Paper sx={{ p: 2, mb: 3, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                        size="small"
                        placeholder="Search services..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} /></InputAdornment> }}
                        sx={{ minWidth: 250 }}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {['all', 'running', 'stopped', 'failed', 'enabled'].map(f => (
                            <Chip key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} onClick={() => setFilter(f)} color={filter === f ? 'primary' : 'default'} variant={filter === f ? 'filled' : 'outlined'} size="small" />
                        ))}
                    </Box>
                    <Box sx={{ flex: 1 }} />
                    <FormControlLabel
                        control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} size="small" />}
                        label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><AutorenewIcon sx={{ fontSize: 14 }} /><Typography variant="caption">Auto</Typography></Box>}
                        sx={{ mr: 1 }}
                    />
                    <Tooltip title="Service Dependencies Graph">
                        <IconButton onClick={loadDependencies} size="small">
                            <AccountTreeIcon sx={{ color: '#8b5cf6' }} />
                        </IconButton>
                    </Tooltip>
                    <IconButton onClick={loadServices} disabled={loading} size="small">
                        {loading ? <CircularProgress size={20} /> : <RefreshIcon sx={{ color: '#f97316' }} />}
                    </IconButton>
                    <Typography variant="body2" color="text.secondary">{filteredServices.length} services</Typography>
                </Box>
            </Paper>

            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2, flexShrink: 0 }}>
                <Tab label={`System (${systemServices.length})`} />
                <Tab label={`User (${userServices.length})`} />
                <Tab label={`Timers (${timerServices.length})`} />
            </Tabs>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : currentServices.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <Typography color="text.secondary">No services found</Typography>
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ flex: 1, minHeight: 200 }}>
                    <Table size="small" stickyHeader sx={{ minWidth: 800 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#1a1a2e' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#1a1a2e' }}>Service</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#1a1a2e' }}>Description</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#1a1a2e' }}>Enabled</TableCell>
                                <TableCell sx={{ fontWeight: 600, textAlign: 'right', bgcolor: '#1a1a2e' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {currentServices.map(svc => (
                                <TableRow key={svc.name} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.05)' } }}>
                                    <TableCell sx={{ py: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {getStatusIcon(svc.status)}
                                            <Chip label={svc.status} size="small" color={getStatusColor(svc.status)} sx={{ fontSize: '0.7rem', height: 22 }} />
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ py: 1 }}>
                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fff' }}>{svc.name}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ py: 1 }}>
                                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {svc.description || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ py: 1 }}>
                                        <Chip label={svc.enabled ? 'Yes' : 'No'} size="small" color={svc.enabled ? 'success' : 'default'} variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                                    </TableCell>
                                    <TableCell sx={{ py: 1 }}>
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                            <Tooltip title="Start"><IconButton size="small" onClick={() => handleServiceAction(svc.name, 'start', svc.isUser)} disabled={actionLoading[svc.name] === 'start'}>{actionLoading[svc.name] === 'start' ? <CircularProgress size={16} /> : <PlayArrowIcon sx={{ fontSize: 18, color: '#22c55e' }} />}</IconButton></Tooltip>
                                            <Tooltip title="Stop"><IconButton size="small" onClick={() => handleServiceAction(svc.name, 'stop', svc.isUser)} disabled={actionLoading[svc.name] === 'stop'}>{actionLoading[svc.name] === 'stop' ? <CircularProgress size={16} /> : <StopIcon sx={{ fontSize: 18, color: '#ff6b6b' }} />}</IconButton></Tooltip>
                                            <Tooltip title="Restart"><IconButton size="small" onClick={() => handleServiceAction(svc.name, 'restart', svc.isUser)} disabled={actionLoading[svc.name] === 'restart'}>{actionLoading[svc.name] === 'restart' ? <CircularProgress size={16} /> : <RestartAltIcon sx={{ fontSize: 18, color: '#ffaa00' }} />}</IconButton></Tooltip>
                                            <Tooltip title={svc.enabled ? 'Disable' : 'Enable'}><IconButton size="small" onClick={() => handleServiceAction(svc.name, svc.enabled ? 'disable' : 'enable', svc.isUser)}><PowerSettingsNewIcon sx={{ fontSize: 18, color: svc.enabled ? '#f97316' : 'rgba(255,255,255,0.3)' }} /></IconButton></Tooltip>
                                            <Tooltip title="Details"><IconButton size="small" onClick={() => handleViewDetails(svc.name, svc.isUser)}><InfoIcon sx={{ fontSize: 18, color: '#8be9fd' }} /></IconButton></Tooltip>
                                            <Tooltip title="View Logs"><IconButton size="small" onClick={() => handleViewLogs(svc.name, 100, svc.isUser)}><ArticleIcon sx={{ fontSize: 18, color: '#f97316' }} /></IconButton></Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={logsDialog.open} onClose={() => { setLogsDialog({ open: false, service: null, logs: '', streaming: false, lines: 100 }); if (logsIntervalRef.current) clearInterval(logsIntervalRef.current) }} maxWidth="lg" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                    <ArticleIcon sx={{ color: '#f97316' }} />
                    <Typography variant="h6">Logs: {logsDialog.service}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Select size="small" value={logsDialog.lines} onChange={(e) => { setLogsDialog(prev => ({ ...prev, lines: e.target.value })); handleViewLogs(logsDialog.service, e.target.value, logsDialog.isUser) }} sx={{ minWidth: 80 }}>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                        <MenuItem value={200}>200</MenuItem>
                        <MenuItem value={500}>500</MenuItem>
                    </Select>
                    <FormControlLabel
                        control={<Switch checked={logsDialog.streaming} onChange={(e) => toggleLogStreaming(e.target.checked)} size="small" />}
                        label={<Typography variant="caption" sx={{ color: logsDialog.streaming ? '#22c55e' : 'inherit' }}>{logsDialog.streaming ? 'Live' : 'Stream'}</Typography>}
                        sx={{ ml: 1 }}
                    />
                    <Tooltip title="Copy"><IconButton size="small" onClick={copyLogs}><ContentCopyIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                    <Tooltip title="Download"><IconButton size="small" onClick={downloadLogs}><DownloadIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                    <Tooltip title="Refresh"><IconButton size="small" onClick={() => handleViewLogs(logsDialog.service, logsDialog.lines)}><RefreshIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                </DialogTitle>
                <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
                    {logsLoading && !logsDialog.streaming ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : (
                        <Box sx={{ flex: 1, bgcolor: '#0d1117', p: 2, fontFamily: 'monospace', fontSize: '0.75rem', overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>{logsDialog.logs}</Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary', ml: 2 }}>
                        {logsDialog.logs?.split('\n').length || 0} lines
                    </Typography>
                    <Button onClick={() => { setLogsDialog({ open: false, service: null, logs: '', streaming: false, lines: 100 }); if (logsIntervalRef.current) clearInterval(logsIntervalRef.current) }}>Close</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={detailsDialog.open} onClose={() => setDetailsDialog({ open: false, service: null, data: null, loading: false })} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon sx={{ color: '#8be9fd' }} />
                    Service Details: {detailsDialog.service}
                </DialogTitle>
                <DialogContent>
                    {detailsDialog.loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : detailsDialog.data?.error ? (
                        <Typography color="error">{detailsDialog.data.error}</Typography>
                    ) : detailsDialog.data && (
                        <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem', maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>
                            {detailsDialog.data.status || JSON.stringify(detailsDialog.data, null, 2)}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsDialog({ open: false, service: null, data: null, loading: false })}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Service Dependencies Graph Dialog */}
            <Dialog open={depsDialog.open} onClose={() => setDepsDialog({ open: false, loading: false, nodes: [], edges: [] })} maxWidth="lg" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountTreeIcon sx={{ color: '#8b5cf6' }} />
                    Service Dependencies Graph
                    <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                        {depsDialog.nodes.length} services • {depsDialog.edges.length} dependencies
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {depsDialog.loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    ) : depsDialog.nodes.length === 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'text.secondary' }}>
                            <AccountTreeIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                            <Typography>No custom service dependencies found</Typography>
                            <Typography variant="body2">Only running custom services are shown</Typography>
                        </Box>
                    ) : (
                        <ServiceDependencyGraph nodes={depsDialog.nodes} edges={depsDialog.edges} />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDepsDialog({ open: false, loading: false, nodes: [], edges: [] })}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

// Simple Service Dependency Graph Component using CSS positioning
const ServiceDependencyGraph = ({ nodes, edges }) => {
    const containerRef = useRef(null)
    const [positions, setPositions] = useState({})
    const [hoveredNode, setHoveredNode] = useState(null)

    useEffect(() => {
        if (!nodes.length) return
        
        // Simple force-directed layout simulation
        const width = 800
        const height = 500
        const nodePositions = {}
        
        // Initialize positions in a circle
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length
            const radius = Math.min(width, height) * 0.35
            nodePositions[node.id] = {
                x: width / 2 + radius * Math.cos(angle),
                y: height / 2 + radius * Math.sin(angle)
            }
        })

        // Simple force simulation (a few iterations)
        for (let iter = 0; iter < 50; iter++) {
            // Repulsion between all nodes
            nodes.forEach((n1, i) => {
                nodes.forEach((n2, j) => {
                    if (i >= j) return
                    const dx = nodePositions[n2.id].x - nodePositions[n1.id].x
                    const dy = nodePositions[n2.id].y - nodePositions[n1.id].y
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1
                    const force = 5000 / (dist * dist)
                    nodePositions[n1.id].x -= (dx / dist) * force * 0.1
                    nodePositions[n1.id].y -= (dy / dist) * force * 0.1
                    nodePositions[n2.id].x += (dx / dist) * force * 0.1
                    nodePositions[n2.id].y += (dy / dist) * force * 0.1
                })
            })

            // Attraction along edges
            edges.forEach(edge => {
                const source = nodePositions[edge.source]
                const target = nodePositions[edge.target]
                if (!source || !target) return
                const dx = target.x - source.x
                const dy = target.y - source.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 1
                const force = (dist - 150) * 0.01
                source.x += (dx / dist) * force
                source.y += (dy / dist) * force
                target.x -= (dx / dist) * force
                target.y -= (dy / dist) * force
            })

            // Keep nodes in bounds
            nodes.forEach(node => {
                nodePositions[node.id].x = Math.max(60, Math.min(width - 60, nodePositions[node.id].x))
                nodePositions[node.id].y = Math.max(30, Math.min(height - 30, nodePositions[node.id].y))
            })
        }

        setPositions(nodePositions)
    }, [nodes, edges])

    const getNodeColor = (status) => {
        if (status === 'active') return '#22c55e'
        if (status === 'inactive') return '#6b7280'
        if (status === 'failed') return '#ef4444'
        return '#f97316'
    }

    const getEdgeColor = (type) => {
        if (type === 'Requires') return '#ef4444'
        if (type === 'Wants') return '#f97316'
        return '#6b7280'
    }

    return (
        <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: '#0d1117', overflow: 'hidden' }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                    </marker>
                </defs>
                {edges.map((edge, i) => {
                    const source = positions[edge.source]
                    const target = positions[edge.target]
                    if (!source || !target) return null
                    return (
                        <line
                            key={i}
                            x1={source.x}
                            y1={source.y}
                            x2={target.x}
                            y2={target.y}
                            stroke={getEdgeColor(edge.type)}
                            strokeWidth={hoveredNode === edge.source || hoveredNode === edge.target ? 2 : 1}
                            strokeOpacity={hoveredNode && hoveredNode !== edge.source && hoveredNode !== edge.target ? 0.2 : 0.6}
                            markerEnd="url(#arrowhead)"
                        />
                    )
                })}
            </svg>
            {nodes.map(node => {
                const pos = positions[node.id]
                if (!pos) return null
                return (
                    <Tooltip key={node.id} title={`${node.label} (${node.status})`} placement="top">
                        <Box
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                            sx={{
                                position: 'absolute',
                                left: pos.x - 50,
                                top: pos.y - 15,
                                width: 100,
                                px: 1,
                                py: 0.5,
                                bgcolor: hoveredNode === node.id ? 'rgba(249, 115, 22, 0.2)' : 'rgba(30, 30, 40, 0.9)',
                                border: `2px solid ${getNodeColor(node.status)}`,
                                borderRadius: 1,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                zIndex: hoveredNode === node.id ? 10 : 1,
                                '&:hover': { transform: 'scale(1.1)' }
                            }}
                        >
                            <Typography variant="caption" sx={{ 
                                display: 'block', 
                                textAlign: 'center', 
                                color: '#fff',
                                fontSize: '0.65rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {node.label}
                            </Typography>
                        </Box>
                    </Tooltip>
                )
            })}
            {/* Legend */}
            <Box sx={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: 2, bgcolor: 'rgba(0,0,0,0.7)', p: 1, borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#22c55e' }} />
                    <Typography variant="caption">Active</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#6b7280' }} />
                    <Typography variant="caption">Inactive</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 20, height: 2, bgcolor: '#ef4444' }} />
                    <Typography variant="caption">Requires</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 20, height: 2, bgcolor: '#f97316' }} />
                    <Typography variant="caption">Wants</Typography>
                </Box>
            </Box>
        </Box>
    )
}

export default MachineServices
