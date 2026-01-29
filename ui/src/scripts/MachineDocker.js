import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
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
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import ArticleIcon from '@mui/icons-material/Article'
import TerminalIcon from '@mui/icons-material/Terminal'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import StorageIcon from '@mui/icons-material/Storage'
import LayersIcon from '@mui/icons-material/Layers'
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'
import InfoIcon from '@mui/icons-material/Info'
import AddIcon from '@mui/icons-material/Add'
import SpeedIcon from '@mui/icons-material/Speed'
import MemoryIcon from '@mui/icons-material/Memory'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import EditIcon from '@mui/icons-material/Edit'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'

const MachineDocker = ({ machine, machineId }) => {
    const [tabValue, setTabValue] = useState(0)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [actionLoading, setActionLoading] = useState({})
    const [containers, setContainers] = useState([])
    const [images, setImages] = useState([])
    const [volumes, setVolumes] = useState([])
    const [networks, setNetworks] = useState([])
    const [dockerInfo, setDockerInfo] = useState(null)
    const [execDialog, setExecDialog] = useState({ open: false, container: null, command: '', output: '' })
    const [pullDialog, setPullDialog] = useState({ open: false, image: '', pulling: false, progress: '' })
    const [runDialog, setRunDialog] = useState({ open: false, image: '', name: '', ports: '', volumes: '', env: '', network: '', detach: true, running: false, output: '' })
    const [inspectDialog, setInspectDialog] = useState({ open: false, container: null, data: null, loading: false })
    const [containerStats, setContainerStats] = useState({})
    const [createVolumeDialog, setCreateVolumeDialog] = useState({ open: false, name: '', driver: 'local', creating: false })
    const [createNetworkDialog, setCreateNetworkDialog] = useState({ open: false, name: '', driver: 'bridge', creating: false })
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [refreshInterval, setRefreshInterval] = useState(10)
    const [renameDialog, setRenameDialog] = useState({ open: false, containerId: null, currentName: '', newName: '', renaming: false })
    const [pruneDialog, setPruneDialog] = useState({ open: false, type: '', pruning: false, result: '' })
    const [selectedContainers, setSelectedContainers] = useState(new Set())
    const [bulkActionLoading, setBulkActionLoading] = useState(false)
    const abortControllerRef = useRef(null)
    const isMountedRef = useRef(true)

    const loadDockerData = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal
        
        setLoading(true)
        try {
            const [containersRes, imagesRes, volumesRes, networksRes, infoRes] = await Promise.all([
                fetch(`/api/machines/${machineId}/docker/containers`, { signal }),
                fetch(`/api/machines/${machineId}/docker/images`, { signal }),
                fetch(`/api/machines/${machineId}/docker/volumes`, { signal }),
                fetch(`/api/machines/${machineId}/docker/networks`, { signal }),
                fetch(`/api/machines/${machineId}/docker/info`, { signal })
            ])
            const [containersData, imagesData, volumesData, networksData, infoData] = await Promise.all([
                containersRes.json(), imagesRes.json(), volumesRes.json(), networksRes.json(), infoRes.json()
            ])
            if (isMountedRef.current) {
                setContainers(containersData.containers || [])
                setImages(imagesData.images || [])
                setVolumes(volumesData.volumes || [])
                setNetworks(networksData.networks || [])
                setDockerInfo(infoData)
                setLoading(false)
                // Load stats for running containers
                const runningContainers = (containersData.containers || []).filter(c => c.state === 'running' || c.status?.includes('Up'))
                for (const container of runningContainers) {
                    fetch(`/api/machines/${machineId}/docker/container/${container.id}/stats`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && isMountedRef.current) {
                                setContainerStats(prev => ({ ...prev, [container.id]: data.stats }))
                            }
                        })
                        .catch(() => {})
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError' && isMountedRef.current) {
                console.error('Failed to load Docker data:', err)
                setLoading(false)
            }
        }
    }, [machineId])

    useEffect(() => {
        isMountedRef.current = true
        loadDockerData()
        return () => {
            isMountedRef.current = false
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [loadDockerData])

    useEffect(() => {
        if (!autoRefresh) return
        const interval = setInterval(() => {
            if (isMountedRef.current) loadDockerData()
        }, refreshInterval * 1000)
        return () => clearInterval(interval)
    }, [autoRefresh, refreshInterval, loadDockerData])

    const handleContainerAction = async (containerId, action) => {
        setActionLoading(prev => ({ ...prev, [containerId]: action }))
        try {
            await fetch(`/api/machines/${machineId}/docker/container/${containerId}/${action}`, { method: 'POST' })
            setTimeout(loadDockerData, 1000)
        } catch (err) {
            console.error(`Failed to ${action} container:`, err)
        } finally {
            setActionLoading(prev => ({ ...prev, [containerId]: null }))
        }
    }

    // Bulk container actions
    const handleBulkAction = async (action) => {
        if (selectedContainers.size === 0) return
        setBulkActionLoading(true)
        try {
            for (const containerId of selectedContainers) {
                await fetch(`/api/machines/${machineId}/docker/container/${containerId}/${action}`, { method: 'POST' })
            }
            setSelectedContainers(new Set())
            setTimeout(loadDockerData, 1000)
        } catch (err) {
            console.error(`Failed bulk ${action}:`, err)
        } finally {
            setBulkActionLoading(false)
        }
    }

    const toggleContainerSelection = (containerId) => {
        setSelectedContainers(prev => {
            const newSet = new Set(prev)
            if (newSet.has(containerId)) newSet.delete(containerId)
            else newSet.add(containerId)
            return newSet
        })
    }

    const selectAllContainers = () => {
        if (selectedContainers.size === filteredContainers.length) {
            setSelectedContainers(new Set())
        } else {
            setSelectedContainers(new Set(filteredContainers.map(c => c.id)))
        }
    }

    const handleViewLogs = (containerId, containerName) => {
        // Open Dozzle directly with the container ID
        // Dozzle uses format: /container/<container-id> for viewing logs
        window.open(`http://${machine.ip}:9999/container/${containerId}`, '_blank')
    }

    const handleExec = async () => {
        if (!execDialog.command.trim()) return
        try {
            const res = await fetch(`/api/machines/${machineId}/docker/container/${execDialog.container}/exec`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: execDialog.command })
            })
            const data = await res.json()
            setExecDialog(prev => ({ ...prev, output: data.output || data.error || 'No output' }))
        } catch (err) {
            setExecDialog(prev => ({ ...prev, output: 'Error: ' + err.message }))
        }
    }

    const handlePullImage = async () => {
        if (!pullDialog.image.trim()) return
        setPullDialog(prev => ({ ...prev, pulling: true, progress: 'Pulling image...' }))
        try {
            const res = await fetch(`/api/machines/${machineId}/docker/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: pullDialog.image })
            })
            const data = await res.json()
            setPullDialog(prev => ({ ...prev, progress: data.success ? 'Image pulled successfully!' : 'Failed: ' + data.error }))
            if (data.success) setTimeout(loadDockerData, 1000)
        } catch (err) {
            setPullDialog(prev => ({ ...prev, progress: 'Error: ' + err.message }))
        } finally {
            setPullDialog(prev => ({ ...prev, pulling: false }))
        }
    }

    const handleDeleteImage = async (imageId) => {
        if (!window.confirm('Delete this image?')) return
        setActionLoading(prev => ({ ...prev, [imageId]: 'delete' }))
        try {
            await fetch(`/api/machines/${machineId}/docker/image/${imageId}`, { method: 'DELETE' })
            setTimeout(loadDockerData, 500)
        } catch (err) {
            console.error('Failed to delete image:', err)
        } finally {
            setActionLoading(prev => ({ ...prev, [imageId]: null }))
        }
    }

    const handleRunContainer = async () => {
        if (!runDialog.image.trim()) return
        setRunDialog(prev => ({ ...prev, running: true, output: 'Starting container...' }))
        try {
            const res = await fetch(`/api/machines/${machineId}/docker/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: runDialog.image,
                    name: runDialog.name || undefined,
                    ports: runDialog.ports || undefined,
                    volumes: runDialog.volumes || undefined,
                    env: runDialog.env || undefined,
                    network: runDialog.network || undefined,
                    detach: runDialog.detach
                })
            })
            const data = await res.json()
            setRunDialog(prev => ({ ...prev, output: data.success ? `Container started: ${data.containerId || 'OK'}` : `Error: ${data.error}` }))
            if (data.success) setTimeout(loadDockerData, 1000)
        } catch (err) {
            setRunDialog(prev => ({ ...prev, output: 'Error: ' + err.message }))
        } finally {
            setRunDialog(prev => ({ ...prev, running: false }))
        }
    }

    const openContainerShell = (containerId) => {
        window.open(`http://${machine.ip}:9999/container/${containerId}`, '_blank')
    }

    const handleInspectContainer = async (containerId) => {
        setInspectDialog({ open: true, container: containerId, data: null, loading: true })
        try {
            const res = await fetch(`/api/machines/${machineId}/docker/container/${containerId}/inspect`)
            const data = await res.json()
            setInspectDialog(prev => ({ ...prev, data: data.success ? data.data : { error: data.error }, loading: false }))
        } catch (err) {
            setInspectDialog(prev => ({ ...prev, data: { error: err.message }, loading: false }))
        }
    }

    const loadContainerStats = async () => {
        const runningContainers = containers.filter(c => c.state === 'running' || c.status?.includes('Up'))
        for (const container of runningContainers) {
            try {
                const res = await fetch(`/api/machines/${machineId}/docker/container/${container.id}/stats`)
                const data = await res.json()
                if (data.success) {
                    setContainerStats(prev => ({ ...prev, [container.id]: data.stats }))
                }
            } catch (err) {
                console.error('Failed to load stats for', container.id)
            }
        }
    }

    const handleCreateVolume = async () => {
        if (!createVolumeDialog.name.trim()) return
        setCreateVolumeDialog(prev => ({ ...prev, creating: true }))
        try {
            const res = await fetch(`/api/machines/${machineId}/docker/volume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: createVolumeDialog.name, driver: createVolumeDialog.driver })
            })
            const data = await res.json()
            if (data.success) {
                setCreateVolumeDialog({ open: false, name: '', driver: 'local', creating: false })
                loadDockerData()
            }
        } catch (err) {
            console.error('Failed to create volume:', err)
        } finally {
            setCreateVolumeDialog(prev => ({ ...prev, creating: false }))
        }
    }

    const handleDeleteVolume = async (volumeName) => {
        if (!window.confirm(`Delete volume "${volumeName}"?`)) return
        try {
            await fetch(`/api/machines/${machineId}/docker/volume/${volumeName}`, { method: 'DELETE' })
            loadDockerData()
        } catch (err) {
            console.error('Failed to delete volume:', err)
        }
    }

    const handleCreateNetwork = async () => {
        if (!createNetworkDialog.name.trim()) return
        setCreateNetworkDialog(prev => ({ ...prev, creating: true }))
        try {
            const res = await fetch(`/api/machines/${machineId}/docker/network`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: createNetworkDialog.name, driver: createNetworkDialog.driver })
            })
            const data = await res.json()
            if (data.success) {
                setCreateNetworkDialog({ open: false, name: '', driver: 'bridge', creating: false })
                loadDockerData()
            }
        } catch (err) {
            console.error('Failed to create network:', err)
        } finally {
            setCreateNetworkDialog(prev => ({ ...prev, creating: false }))
        }
    }

    const handleDeleteNetwork = async (networkId) => {
        if (!window.confirm('Delete this network?')) return
        try {
            await fetch(`/api/machines/${machineId}/docker/network/${networkId}`, { method: 'DELETE' })
            loadDockerData()
        } catch (err) {
            console.error('Failed to delete network:', err)
        }
    }

    const handleRenameContainer = async () => {
        if (!renameDialog.newName.trim()) return
        setRenameDialog(prev => ({ ...prev, renaming: true }))
        try {
            const res = await fetch(`/api/machines/${machineId}/docker/container/${renameDialog.containerId}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: renameDialog.newName })
            })
            const data = await res.json()
            if (data.success) {
                setRenameDialog({ open: false, containerId: null, currentName: '', newName: '', renaming: false })
                loadDockerData()
            }
        } catch (err) {
            console.error('Failed to rename container:', err)
        } finally {
            setRenameDialog(prev => ({ ...prev, renaming: false }))
        }
    }

    const handleBulkActionAll = async (action) => {
        if (!window.confirm(`Are you sure you want to ${action === 'stop' ? 'stop all running containers' : 'remove all stopped containers'}?`)) return
        setActionLoading(prev => ({ ...prev, bulk: action }))
        try {
            await fetch(`/api/machines/${machineId}/docker/bulk/${action}`, { method: 'POST' })
            setTimeout(loadDockerData, 2000)
        } catch (err) {
            console.error(`Failed to ${action}:`, err)
        } finally {
            setActionLoading(prev => ({ ...prev, bulk: null }))
        }
    }

    const handlePrune = async (type) => {
        setPruneDialog({ open: true, type, pruning: true, result: '' })
        try {
            const res = await fetch(`/api/machines/${machineId}/docker/prune/${type}`, { method: 'POST' })
            const data = await res.json()
            setPruneDialog(prev => ({ ...prev, pruning: false, result: data.success ? data.output || 'Prune completed' : `Error: ${data.error}` }))
            loadDockerData()
        } catch (err) {
            setPruneDialog(prev => ({ ...prev, pruning: false, result: 'Error: ' + err.message }))
        }
    }

    const handleQuickRunImage = (image) => {
        const imageName = image.repository && image.tag ? `${image.repository}:${image.tag}` : image.repository || image.id
        setRunDialog({ open: true, image: imageName, name: '', ports: '', volumes: '', env: '', network: '', detach: true, running: false, output: '' })
    }

    const getStatusColor = (status) => {
        if (status?.includes('Up') || status === 'running') return 'success'
        if (status?.includes('Exited') || status === 'exited') return 'error'
        return 'warning'
    }

    const filteredContainers = containers.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.image?.toLowerCase().includes(searchTerm.toLowerCase()))
    const filteredImages = images.filter(i => i.repository?.toLowerCase().includes(searchTerm.toLowerCase()) || i.tag?.toLowerCase().includes(searchTerm.toLowerCase()))

    return (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
            {dockerInfo && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(0,255,136,0.05) 100%)' }}>
                            <CardContent sx={{ py: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><LayersIcon sx={{ color: '#f97316', fontSize: 20 }} /><Typography variant="caption" color="text.secondary">Containers</Typography></Box>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{dockerInfo.containersRunning || 0}<Typography component="span" variant="body2" color="text.secondary"> / {dockerInfo.containers || 0}</Typography></Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, rgba(255,0,255,0.1) 0%, rgba(0,212,255,0.05) 100%)' }}>
                            <CardContent sx={{ py: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><StorageIcon sx={{ color: '#ff00ff', fontSize: 20 }} /><Typography variant="caption" color="text.secondary">Images</Typography></Box>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{dockerInfo.images || 0}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.1) 0%, rgba(0,212,255,0.05) 100%)' }}>
                            <CardContent sx={{ py: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><StorageIcon sx={{ color: '#22c55e', fontSize: 20 }} /><Typography variant="caption" color="text.secondary">Volumes</Typography></Box>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{volumes.length}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, rgba(255,170,0,0.1) 0%, rgba(255,0,255,0.05) 100%)' }}>
                            <CardContent sx={{ py: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><NetworkCheckIcon sx={{ color: '#ffaa00', fontSize: 20 }} /><Typography variant="caption" color="text.secondary">Networks</Typography></Box>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{networks.length}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField size="small" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} /></InputAdornment> }} sx={{ minWidth: 200 }} />
                    <FormControlLabel control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} size="small" />} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><AutorenewIcon sx={{ fontSize: 16 }} /><Typography variant="caption">Auto</Typography></Box>} sx={{ mr: 0 }} />
                    {autoRefresh && <Select size="small" value={refreshInterval} onChange={(e) => setRefreshInterval(e.target.value)} sx={{ minWidth: 70 }}><MenuItem value={5}>5s</MenuItem><MenuItem value={10}>10s</MenuItem><MenuItem value={30}>30s</MenuItem><MenuItem value={60}>60s</MenuItem></Select>}
                    <Box sx={{ flex: 1 }} />
                    {selectedContainers.size > 0 && (
                        <>
                            <Chip label={`${selectedContainers.size} selected`} size="small" onDelete={() => setSelectedContainers(new Set())} />
                            <Tooltip title="Start Selected"><IconButton size="small" onClick={() => handleBulkAction('start')} disabled={bulkActionLoading}><PlayArrowIcon sx={{ color: '#22c55e' }} /></IconButton></Tooltip>
                            <Tooltip title="Stop Selected"><IconButton size="small" onClick={() => handleBulkAction('stop')} disabled={bulkActionLoading}><StopIcon sx={{ color: '#ff6b6b' }} /></IconButton></Tooltip>
                            <Tooltip title="Restart Selected"><IconButton size="small" onClick={() => handleBulkAction('restart')} disabled={bulkActionLoading}><RestartAltIcon sx={{ color: '#ffaa00' }} /></IconButton></Tooltip>
                        </>
                    )}
                    <Tooltip title="Stop All Running"><IconButton size="small" onClick={() => handleBulkActionAll('stop')} disabled={actionLoading.bulk}><StopCircleIcon sx={{ color: '#ff6b6b' }} /></IconButton></Tooltip>
                    <Tooltip title="Remove Stopped"><IconButton size="small" onClick={() => handleBulkActionAll('prune')} disabled={actionLoading.bulk}><DeleteSweepIcon sx={{ color: '#ffaa00' }} /></IconButton></Tooltip>
                    <Tooltip title="System Prune"><IconButton size="small" onClick={() => handlePrune('system')}><CleaningServicesIcon sx={{ color: '#ff00ff' }} /></IconButton></Tooltip>
                    <Button variant="outlined" startIcon={<CloudDownloadIcon />} onClick={() => setPullDialog({ open: true, image: '', pulling: false, progress: '' })} size="small">Pull</Button>
                    <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => setRunDialog({ open: true, image: '', name: '', ports: '', volumes: '', env: '', network: '', detach: true, running: false, output: '' })} size="small">Run</Button>
                    <IconButton onClick={loadDockerData} disabled={loading} size="small">{loading ? <CircularProgress size={20} /> : <RefreshIcon sx={{ color: '#f97316' }} />}</IconButton>
                </Box>
            </Paper>

            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
                <Tab label={`Containers (${containers.length})`} icon={<LayersIcon />} iconPosition="start" />
                <Tab label={`Images (${images.length})`} icon={<StorageIcon />} iconPosition="start" />
                <Tab label={`Volumes (${volumes.length})`} icon={<StorageIcon />} iconPosition="start" />
                <Tab label={`Networks (${networks.length})`} icon={<NetworkCheckIcon />} iconPosition="start" />
            </Tabs>

            {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box> : (
                <>
                    {tabValue === 0 && (
                        <Paper sx={{ overflow: 'hidden' }}>
                            <Table size="small">
                                <TableHead><TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}><TableCell padding="checkbox"><Checkbox checked={selectedContainers.size === filteredContainers.length && filteredContainers.length > 0} indeterminate={selectedContainers.size > 0 && selectedContainers.size < filteredContainers.length} onChange={selectAllContainers} size="small" /></TableCell><TableCell sx={{ fontWeight: 600 }}>Status</TableCell><TableCell sx={{ fontWeight: 600 }}>Name</TableCell><TableCell sx={{ fontWeight: 600 }}>Image</TableCell><TableCell sx={{ fontWeight: 600 }}>CPU/Mem</TableCell><TableCell sx={{ fontWeight: 600 }}>Ports</TableCell><TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell></TableRow></TableHead>
                                <TableBody>
                                    {filteredContainers.map(container => (
                                        <TableRow key={container.id} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' }, bgcolor: selectedContainers.has(container.id) ? 'rgba(0,212,255,0.08)' : 'inherit' }}>
                                            <TableCell padding="checkbox"><Checkbox checked={selectedContainers.has(container.id)} onChange={() => toggleContainerSelection(container.id)} size="small" /></TableCell>
                                            <TableCell><Chip label={container.state || container.status?.split(' ')[0]} size="small" color={getStatusColor(container.status)} sx={{ fontSize: '0.7rem' }} /></TableCell>
                                            <TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{container.name}</Typography></TableCell>
                                            <TableCell><Typography variant="body2" color="text.secondary">{container.image}</Typography></TableCell>
                                            <TableCell>
                                                {containerStats[container.id] ? (
                                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                        <Tooltip title="CPU"><Chip icon={<SpeedIcon sx={{ fontSize: 14 }} />} label={containerStats[container.id].cpu || '0%'} size="small" sx={{ fontSize: '0.65rem', height: 20 }} /></Tooltip>
                                                        <Tooltip title="Memory"><Chip icon={<MemoryIcon sx={{ fontSize: 14 }} />} label={containerStats[container.id].memory || '0MB'} size="small" sx={{ fontSize: '0.65rem', height: 20 }} /></Tooltip>
                                                    </Box>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">-</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{container.ports || '-'}</Typography></TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                                    <Tooltip title="Start"><IconButton size="small" onClick={() => handleContainerAction(container.id, 'start')}><PlayArrowIcon sx={{ fontSize: 18, color: '#22c55e' }} /></IconButton></Tooltip>
                                                    <Tooltip title="Stop"><IconButton size="small" onClick={() => handleContainerAction(container.id, 'stop')}><StopIcon sx={{ fontSize: 18, color: '#ff6b6b' }} /></IconButton></Tooltip>
                                                    <Tooltip title="Restart"><IconButton size="small" onClick={() => handleContainerAction(container.id, 'restart')}><RestartAltIcon sx={{ fontSize: 18, color: '#ffaa00' }} /></IconButton></Tooltip>
                                                    <Tooltip title="Logs"><IconButton size="small" onClick={() => handleViewLogs(container.id, container.name)}><ArticleIcon sx={{ fontSize: 18, color: '#f97316' }} /></IconButton></Tooltip>
                                                    <Tooltip title="Exec"><IconButton size="small" onClick={() => setExecDialog({ open: true, container: container.id, command: '', output: '' })}><TerminalIcon sx={{ fontSize: 18, color: '#ff00ff' }} /></IconButton></Tooltip>
                                                    <Tooltip title="Inspect"><IconButton size="small" onClick={() => handleInspectContainer(container.id)}><InfoIcon sx={{ fontSize: 18, color: '#8be9fd' }} /></IconButton></Tooltip>
                                                    <Tooltip title="Rename"><IconButton size="small" onClick={() => setRenameDialog({ open: true, containerId: container.id, currentName: container.name, newName: container.name, renaming: false })}><EditIcon sx={{ fontSize: 18, color: '#bd93f9' }} /></IconButton></Tooltip>
                                                    <Tooltip title="Remove"><IconButton size="small" onClick={() => handleContainerAction(container.id, 'remove')}><DeleteIcon sx={{ fontSize: 18, color: '#ff3366' }} /></IconButton></Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Paper>
                    )}

                    {tabValue === 1 && (
                        <Paper sx={{ overflow: 'hidden' }}>
                            <Table size="small">
                                <TableHead><TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}><TableCell sx={{ fontWeight: 600 }}>Repository</TableCell><TableCell sx={{ fontWeight: 600 }}>Tag</TableCell><TableCell sx={{ fontWeight: 600 }}>ID</TableCell><TableCell sx={{ fontWeight: 600 }}>Size</TableCell><TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell></TableRow></TableHead>
                                <TableBody>
                                    {filteredImages.map(image => (
                                        <TableRow key={image.id} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                            <TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{image.repository || '<none>'}</Typography></TableCell>
                                            <TableCell><Chip label={image.tag || 'latest'} size="small" variant="outlined" /></TableCell>
                                            <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{image.id?.substring(0, 12)}</Typography></TableCell>
                                            <TableCell>{image.size}</TableCell>
                                            <TableCell><Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}><Tooltip title="Run"><IconButton size="small" onClick={() => handleQuickRunImage(image)}><RocketLaunchIcon sx={{ fontSize: 18, color: '#22c55e' }} /></IconButton></Tooltip><Tooltip title="Delete"><IconButton size="small" onClick={() => handleDeleteImage(image.id)} disabled={actionLoading[image.id] === 'delete'}>{actionLoading[image.id] === 'delete' ? <CircularProgress size={16} /> : <DeleteIcon sx={{ fontSize: 18, color: '#ff3366' }} />}</IconButton></Tooltip></Box></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Paper>
                    )}

                    {tabValue === 2 && (
                        <>
                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateVolumeDialog({ open: true, name: '', driver: 'local', creating: false })} size="small">Create Volume</Button>
                            </Box>
                            <Paper sx={{ overflow: 'hidden' }}>
                                <Table size="small">
                                    <TableHead><TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}><TableCell sx={{ fontWeight: 600 }}>Name</TableCell><TableCell sx={{ fontWeight: 600 }}>Driver</TableCell><TableCell sx={{ fontWeight: 600 }}>Mountpoint</TableCell><TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {volumes.map(vol => (
                                            <TableRow key={vol.name} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                                <TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{vol.name}</Typography></TableCell>
                                                <TableCell>{vol.driver}</TableCell>
                                                <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{vol.mountpoint}</Typography></TableCell>
                                                <TableCell><Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Tooltip title="Delete"><IconButton size="small" onClick={() => handleDeleteVolume(vol.name)}><DeleteIcon sx={{ fontSize: 18, color: '#ff3366' }} /></IconButton></Tooltip></Box></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Paper>
                        </>
                    )}

                    {tabValue === 3 && (
                        <>
                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateNetworkDialog({ open: true, name: '', driver: 'bridge', creating: false })} size="small">Create Network</Button>
                            </Box>
                            <Paper sx={{ overflow: 'hidden' }}>
                                <Table size="small">
                                    <TableHead><TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}><TableCell sx={{ fontWeight: 600 }}>Name</TableCell><TableCell sx={{ fontWeight: 600 }}>Driver</TableCell><TableCell sx={{ fontWeight: 600 }}>Scope</TableCell><TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {networks.map(net => (
                                            <TableRow key={net.id} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                                <TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{net.name}</Typography></TableCell>
                                                <TableCell>{net.driver}</TableCell>
                                                <TableCell>{net.scope}</TableCell>
                                                <TableCell><Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>{!['bridge', 'host', 'none'].includes(net.name) && <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDeleteNetwork(net.id)}><DeleteIcon sx={{ fontSize: 18, color: '#ff3366' }} /></IconButton></Tooltip>}</Box></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Paper>
                        </>
                    )}
                </>
            )}

            
            <Dialog open={execDialog.open} onClose={() => setExecDialog({ open: false, container: null, command: '', output: '' })} maxWidth="md" fullWidth>
                <DialogTitle>Execute Command</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Command" value={execDialog.command} onChange={(e) => setExecDialog(prev => ({ ...prev, command: e.target.value }))} placeholder="e.g., ls -la /app" sx={{ mt: 1, mb: 2 }} onKeyPress={(e) => e.key === 'Enter' && handleExec()} />
                    {execDialog.output && <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>{execDialog.output}</Box>}
                </DialogContent>
                <DialogActions><Button onClick={() => setExecDialog({ open: false, container: null, command: '', output: '' })}>Close</Button><Button variant="contained" onClick={handleExec}>Execute</Button></DialogActions>
            </Dialog>

            <Dialog open={pullDialog.open} onClose={() => !pullDialog.pulling && setPullDialog({ open: false, image: '', pulling: false, progress: '' })} maxWidth="sm" fullWidth>
                <DialogTitle>Pull Docker Image</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Image" value={pullDialog.image} onChange={(e) => setPullDialog(prev => ({ ...prev, image: e.target.value }))} placeholder="e.g., nginx:latest" sx={{ mt: 1 }} disabled={pullDialog.pulling} />
                    {pullDialog.progress && <Box sx={{ mt: 2 }}>{pullDialog.pulling && <LinearProgress sx={{ mb: 1 }} />}<Typography variant="body2" color={pullDialog.progress.includes('success') ? 'success.main' : 'text.secondary'}>{pullDialog.progress}</Typography></Box>}
                </DialogContent>
                <DialogActions><Button onClick={() => setPullDialog({ open: false, image: '', pulling: false, progress: '' })} disabled={pullDialog.pulling}>Cancel</Button><Button variant="contained" onClick={handlePullImage} disabled={pullDialog.pulling || !pullDialog.image.trim()}>{pullDialog.pulling ? <CircularProgress size={20} /> : 'Pull'}</Button></DialogActions>
            </Dialog>

            <Dialog open={runDialog.open} onClose={() => !runDialog.running && setRunDialog({ open: false, image: '', name: '', ports: '', volumes: '', env: '', network: '', detach: true, running: false, output: '' })} maxWidth="md" fullWidth>
                <DialogTitle>Run Docker Container</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Image *" value={runDialog.image} onChange={(e) => setRunDialog(prev => ({ ...prev, image: e.target.value }))} placeholder="e.g., nginx:latest" disabled={runDialog.running} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Container Name" value={runDialog.name} onChange={(e) => setRunDialog(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., my-nginx" disabled={runDialog.running} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Ports" value={runDialog.ports} onChange={(e) => setRunDialog(prev => ({ ...prev, ports: e.target.value }))} placeholder="e.g., 8080:80, 443:443" disabled={runDialog.running} helperText="host:container, comma separated" />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Network" value={runDialog.network} onChange={(e) => setRunDialog(prev => ({ ...prev, network: e.target.value }))} placeholder="e.g., bridge, host" disabled={runDialog.running} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Volumes" value={runDialog.volumes} onChange={(e) => setRunDialog(prev => ({ ...prev, volumes: e.target.value }))} placeholder="e.g., /host/path:/container/path" disabled={runDialog.running} helperText="host:container, comma separated" />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Environment Variables" value={runDialog.env} onChange={(e) => setRunDialog(prev => ({ ...prev, env: e.target.value }))} placeholder="e.g., KEY=value, DEBUG=true" disabled={runDialog.running} helperText="KEY=value, comma separated" />
                        </Grid>
                    </Grid>
                    {runDialog.output && <Box sx={{ mt: 2, bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}><Typography color={runDialog.output.includes('Error') ? 'error' : 'success.main'}>{runDialog.output}</Typography></Box>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRunDialog({ open: false, image: '', name: '', ports: '', volumes: '', env: '', network: '', detach: true, running: false, output: '' })} disabled={runDialog.running}>Cancel</Button>
                    <Button variant="contained" onClick={handleRunContainer} disabled={runDialog.running || !runDialog.image.trim()}>{runDialog.running ? <CircularProgress size={20} /> : 'Run'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={inspectDialog.open} onClose={() => setInspectDialog({ open: false, container: null, data: null, loading: false })} maxWidth="md" fullWidth>
                <DialogTitle>Container Details</DialogTitle>
                <DialogContent>
                    {inspectDialog.loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : inspectDialog.data?.error ? (
                        <Typography color="error">{inspectDialog.data.error}</Typography>
                    ) : inspectDialog.data && (
                        <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem', maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>
                            {JSON.stringify(inspectDialog.data, null, 2)}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions><Button onClick={() => setInspectDialog({ open: false, container: null, data: null, loading: false })}>Close</Button></DialogActions>
            </Dialog>

            <Dialog open={createVolumeDialog.open} onClose={() => !createVolumeDialog.creating && setCreateVolumeDialog({ open: false, name: '', driver: 'local', creating: false })} maxWidth="sm" fullWidth>
                <DialogTitle>Create Docker Volume</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Volume Name" value={createVolumeDialog.name} onChange={(e) => setCreateVolumeDialog(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., my-data" sx={{ mt: 1, mb: 2 }} disabled={createVolumeDialog.creating} />
                    <TextField fullWidth label="Driver" value={createVolumeDialog.driver} onChange={(e) => setCreateVolumeDialog(prev => ({ ...prev, driver: e.target.value }))} placeholder="local" disabled={createVolumeDialog.creating} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateVolumeDialog({ open: false, name: '', driver: 'local', creating: false })} disabled={createVolumeDialog.creating}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateVolume} disabled={createVolumeDialog.creating || !createVolumeDialog.name.trim()}>{createVolumeDialog.creating ? <CircularProgress size={20} /> : 'Create'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={createNetworkDialog.open} onClose={() => !createNetworkDialog.creating && setCreateNetworkDialog({ open: false, name: '', driver: 'bridge', creating: false })} maxWidth="sm" fullWidth>
                <DialogTitle>Create Docker Network</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Network Name" value={createNetworkDialog.name} onChange={(e) => setCreateNetworkDialog(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., my-network" sx={{ mt: 1, mb: 2 }} disabled={createNetworkDialog.creating} />
                    <TextField fullWidth label="Driver" value={createNetworkDialog.driver} onChange={(e) => setCreateNetworkDialog(prev => ({ ...prev, driver: e.target.value }))} placeholder="bridge" disabled={createNetworkDialog.creating} helperText="bridge, overlay, macvlan, etc." />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateNetworkDialog({ open: false, name: '', driver: 'bridge', creating: false })} disabled={createNetworkDialog.creating}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateNetwork} disabled={createNetworkDialog.creating || !createNetworkDialog.name.trim()}>{createNetworkDialog.creating ? <CircularProgress size={20} /> : 'Create'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={renameDialog.open} onClose={() => !renameDialog.renaming && setRenameDialog({ open: false, containerId: null, currentName: '', newName: '', renaming: false })} maxWidth="sm" fullWidth>
                <DialogTitle>Rename Container</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Current name: <strong>{renameDialog.currentName}</strong></Typography>
                    <TextField fullWidth label="New Name" value={renameDialog.newName} onChange={(e) => setRenameDialog(prev => ({ ...prev, newName: e.target.value }))} placeholder="e.g., my-container" sx={{ mt: 1 }} disabled={renameDialog.renaming} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenameDialog({ open: false, containerId: null, currentName: '', newName: '', renaming: false })} disabled={renameDialog.renaming}>Cancel</Button>
                    <Button variant="contained" onClick={handleRenameContainer} disabled={renameDialog.renaming || !renameDialog.newName.trim() || renameDialog.newName === renameDialog.currentName}>{renameDialog.renaming ? <CircularProgress size={20} /> : 'Rename'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={pruneDialog.open} onClose={() => !pruneDialog.pruning && setPruneDialog({ open: false, type: '', pruning: false, result: '' })} maxWidth="sm" fullWidth>
                <DialogTitle>Docker System Prune</DialogTitle>
                <DialogContent>
                    {pruneDialog.pruning ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}><CircularProgress size={24} /><Typography>Cleaning up unused Docker resources...</Typography></Box>
                    ) : pruneDialog.result && (
                        <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>{pruneDialog.result}</Box>
                    )}
                </DialogContent>
                <DialogActions><Button onClick={() => setPruneDialog({ open: false, type: '', pruning: false, result: '' })} disabled={pruneDialog.pruning}>Close</Button></DialogActions>
            </Dialog>
        </Box>
    )
}

export default MachineDocker
