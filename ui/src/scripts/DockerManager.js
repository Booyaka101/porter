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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import DownloadIcon from '@mui/icons-material/Download'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import StorageIcon from '@mui/icons-material/Storage'
import LayersIcon from '@mui/icons-material/Layers'
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'
import MemoryIcon from '@mui/icons-material/Memory'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

const DockerManager = () => {
    const [machines, setMachines] = useState([])
    const [selectedMachine, setSelectedMachine] = useState('')
    const [tabValue, setTabValue] = useState(0)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [actionLoading, setActionLoading] = useState({})
    
    // Data states
    const [containers, setContainers] = useState([])
    const [images, setImages] = useState([])
    const [volumes, setVolumes] = useState([])
    const [networks, setNetworks] = useState([])
    const [dockerInfo, setDockerInfo] = useState(null)
    
    // Dialog states
    const [logsDialog, setLogsDialog] = useState({ open: false, container: null, logs: '' })
    const [execDialog, setExecDialog] = useState({ open: false, container: null, command: '', output: '' })
    const [pullDialog, setPullDialog] = useState({ open: false, image: '', pulling: false, progress: '' })

    useEffect(() => {
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => setMachines(data || []))
            .catch(console.error)
    }, [])

    const loadDockerData = useCallback(async () => {
        if (!selectedMachine) return
        setLoading(true)
        try {
            const [containersRes, imagesRes, volumesRes, networksRes, infoRes] = await Promise.all([
                fetch(`/api/machines/${selectedMachine}/docker/containers`),
                fetch(`/api/machines/${selectedMachine}/docker/images`),
                fetch(`/api/machines/${selectedMachine}/docker/volumes`),
                fetch(`/api/machines/${selectedMachine}/docker/networks`),
                fetch(`/api/machines/${selectedMachine}/docker/info`)
            ])
            
            const [containersData, imagesData, volumesData, networksData, infoData] = await Promise.all([
                containersRes.json(),
                imagesRes.json(),
                volumesRes.json(),
                networksRes.json(),
                infoRes.json()
            ])
            
            setContainers(containersData.containers || [])
            setImages(imagesData.images || [])
            setVolumes(volumesData.volumes || [])
            setNetworks(networksData.networks || [])
            setDockerInfo(infoData)
        } catch (err) {
            console.error('Failed to load Docker data:', err)
        } finally {
            setLoading(false)
        }
    }, [selectedMachine])

    useEffect(() => {
        if (selectedMachine) loadDockerData()
    }, [selectedMachine, loadDockerData])

    const handleContainerAction = async (containerId, action) => {
        setActionLoading(prev => ({ ...prev, [containerId]: action }))
        try {
            await fetch(`/api/machines/${selectedMachine}/docker/container/${containerId}/${action}`, {
                method: 'POST'
            })
            setTimeout(loadDockerData, 1000)
        } catch (err) {
            console.error(`Failed to ${action} container:`, err)
        } finally {
            setActionLoading(prev => ({ ...prev, [containerId]: null }))
        }
    }

    const handleViewLogs = async (containerId, containerName) => {
        setLogsDialog({ open: true, container: containerName, logs: '' })
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/docker/container/${containerId}/logs?lines=200`)
            const data = await res.json()
            setLogsDialog(prev => ({ ...prev, logs: data.logs || 'No logs available' }))
        } catch (err) {
            setLogsDialog(prev => ({ ...prev, logs: 'Failed to load logs: ' + err.message }))
        }
    }

    const handleExec = async () => {
        if (!execDialog.command.trim()) return
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/docker/container/${execDialog.container}/exec`, {
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
            const res = await fetch(`/api/machines/${selectedMachine}/docker/pull`, {
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
        if (!window.confirm('Are you sure you want to delete this image?')) return
        setActionLoading(prev => ({ ...prev, [imageId]: 'delete' }))
        try {
            await fetch(`/api/machines/${selectedMachine}/docker/image/${imageId}`, { method: 'DELETE' })
            setTimeout(loadDockerData, 500)
        } catch (err) {
            console.error('Failed to delete image:', err)
        } finally {
            setActionLoading(prev => ({ ...prev, [imageId]: null }))
        }
    }

    const getStatusColor = (status) => {
        if (status?.includes('Up') || status === 'running') return 'success'
        if (status?.includes('Exited') || status === 'exited') return 'error'
        return 'warning'
    }

    const formatSize = (bytes) => {
        if (!bytes) return '-'
        const units = ['B', 'KB', 'MB', 'GB']
        let i = 0
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024
            i++
        }
        return `${bytes.toFixed(1)} ${units[i]}`
    }

    const filteredContainers = containers.filter(c => 
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.image?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredImages = images.filter(i =>
        i.repository?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.tag?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    Docker Manager
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
                    <IconButton onClick={loadDockerData} disabled={!selectedMachine || loading}>
                        <RefreshIcon sx={{ color: loading ? 'grey' : '#f97316' }} />
                    </IconButton>
                </Box>
            </Box>

            {selectedMachine && dockerInfo && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(0,255,136,0.05) 100%)' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <LayersIcon sx={{ color: '#f97316' }} />
                                    <Typography variant="subtitle2" color="text.secondary">Containers</Typography>
                                </Box>
                                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                    {dockerInfo.containersRunning || 0}
                                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                        / {dockerInfo.containers || 0}
                                    </Typography>
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, rgba(255,0,255,0.1) 0%, rgba(0,212,255,0.05) 100%)' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <StorageIcon sx={{ color: '#ff00ff' }} />
                                    <Typography variant="subtitle2" color="text.secondary">Images</Typography>
                                </Box>
                                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                    {dockerInfo.images || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.1) 0%, rgba(0,212,255,0.05) 100%)' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <MemoryIcon sx={{ color: '#22c55e' }} />
                                    <Typography variant="subtitle2" color="text.secondary">Memory</Typography>
                                </Box>
                                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                    {formatSize(dockerInfo.memoryUsed)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, rgba(255,170,0,0.1) 0%, rgba(255,0,255,0.05) 100%)' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <NetworkCheckIcon sx={{ color: '#ffaa00' }} />
                                    <Typography variant="subtitle2" color="text.secondary">Networks</Typography>
                                </Box>
                                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                    {networks.length}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {selectedMachine && (
                <>
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                                size="small"
                                placeholder="Search..."
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
                            <Box sx={{ flex: 1 }} />
                            <Button
                                variant="outlined"
                                startIcon={<CloudDownloadIcon />}
                                onClick={() => setPullDialog({ open: true, image: '', pulling: false, progress: '' })}
                            >
                                Pull Image
                            </Button>
                        </Box>
                    </Paper>

                    <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
                        <Tab label={`Containers (${containers.length})`} icon={<LayersIcon />} iconPosition="start" />
                        <Tab label={`Images (${images.length})`} icon={<StorageIcon />} iconPosition="start" />
                        <Tab label={`Volumes (${volumes.length})`} icon={<StorageIcon />} iconPosition="start" />
                        <Tab label={`Networks (${networks.length})`} icon={<NetworkCheckIcon />} iconPosition="start" />
                    </Tabs>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            {tabValue === 0 && (
                                <Paper sx={{ overflow: 'hidden' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}>
                                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Image</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Ports</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                                                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredContainers.map(container => (
                                                <TableRow key={container.id} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                                    <TableCell>
                                                        <Chip 
                                                            label={container.state || container.status?.split(' ')[0]} 
                                                            size="small" 
                                                            color={getStatusColor(container.status)}
                                                            sx={{ fontSize: '0.7rem' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                            {container.name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {container.image}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {container.ports || '-'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {container.created}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                                            <Tooltip title="Start">
                                                                <IconButton size="small" onClick={() => handleContainerAction(container.id, 'start')}>
                                                                    <PlayArrowIcon sx={{ fontSize: 18, color: '#22c55e' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Stop">
                                                                <IconButton size="small" onClick={() => handleContainerAction(container.id, 'stop')}>
                                                                    <StopIcon sx={{ fontSize: 18, color: '#ff6b6b' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Restart">
                                                                <IconButton size="small" onClick={() => handleContainerAction(container.id, 'restart')}>
                                                                    <RestartAltIcon sx={{ fontSize: 18, color: '#ffaa00' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Logs">
                                                                <IconButton size="small" onClick={() => handleViewLogs(container.id, container.name)}>
                                                                    <ArticleIcon sx={{ fontSize: 18, color: '#f97316' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Exec">
                                                                <IconButton size="small" onClick={() => setExecDialog({ open: true, container: container.id, command: '', output: '' })}>
                                                                    <TerminalIcon sx={{ fontSize: 18, color: '#ff00ff' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Remove">
                                                                <IconButton size="small" onClick={() => handleContainerAction(container.id, 'remove')}>
                                                                    <DeleteIcon sx={{ fontSize: 18, color: '#ff3366' }} />
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

                            {tabValue === 1 && (
                                <Paper sx={{ overflow: 'hidden' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}>
                                                <TableCell sx={{ fontWeight: 600 }}>Repository</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Tag</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                                                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredImages.map(image => (
                                                <TableRow key={image.id} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                                    <TableCell>
                                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                            {image.repository || '<none>'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip label={image.tag || 'latest'} size="small" variant="outlined" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {image.id?.substring(0, 12)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{image.size}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {image.created}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                                            <Tooltip title="Delete">
                                                                <IconButton 
                                                                    size="small" 
                                                                    onClick={() => handleDeleteImage(image.id)}
                                                                    disabled={actionLoading[image.id] === 'delete'}
                                                                >
                                                                    {actionLoading[image.id] === 'delete' ? 
                                                                        <CircularProgress size={16} /> :
                                                                        <DeleteIcon sx={{ fontSize: 18, color: '#ff3366' }} />
                                                                    }
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

                            {tabValue === 2 && (
                                <Paper sx={{ overflow: 'hidden' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}>
                                                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Mountpoint</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {volumes.map(vol => (
                                                <TableRow key={vol.name} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                                    <TableCell>
                                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                            {vol.name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{vol.driver}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {vol.mountpoint}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Paper>
                            )}

                            {tabValue === 3 && (
                                <Paper sx={{ overflow: 'hidden' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}>
                                                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Scope</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Subnet</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {networks.map(net => (
                                                <TableRow key={net.id} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                                    <TableCell>
                                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                            {net.name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{net.driver}</TableCell>
                                                    <TableCell>{net.scope}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {net.subnet || '-'}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Paper>
                            )}
                        </>
                    )}
                </>
            )}

            {!selectedMachine && (
                <Paper sx={{ p: 6, textAlign: 'center' }}>
                    <LayersIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                    <Typography color="text.secondary">
                        Select a machine to manage Docker containers
                    </Typography>
                </Paper>
            )}

            {/* Logs Dialog */}
            <Dialog open={logsDialog.open} onClose={() => setLogsDialog({ open: false, container: null, logs: '' })} maxWidth="lg" fullWidth>
                <DialogTitle>Container Logs: {logsDialog.container}</DialogTitle>
                <DialogContent>
                    <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>
                        {logsDialog.logs || 'Loading...'}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogsDialog({ open: false, container: null, logs: '' })}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Exec Dialog */}
            <Dialog open={execDialog.open} onClose={() => setExecDialog({ open: false, container: null, command: '', output: '' })} maxWidth="md" fullWidth>
                <DialogTitle>Execute Command in Container</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Command"
                        value={execDialog.command}
                        onChange={(e) => setExecDialog(prev => ({ ...prev, command: e.target.value }))}
                        placeholder="e.g., ls -la /app"
                        sx={{ mt: 1, mb: 2 }}
                        onKeyPress={(e) => e.key === 'Enter' && handleExec()}
                    />
                    {execDialog.output && (
                        <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>
                            {execDialog.output}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExecDialog({ open: false, container: null, command: '', output: '' })}>Close</Button>
                    <Button variant="contained" onClick={handleExec}>Execute</Button>
                </DialogActions>
            </Dialog>

            {/* Pull Image Dialog */}
            <Dialog open={pullDialog.open} onClose={() => !pullDialog.pulling && setPullDialog({ open: false, image: '', pulling: false, progress: '' })} maxWidth="sm" fullWidth>
                <DialogTitle>Pull Docker Image</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Image"
                        value={pullDialog.image}
                        onChange={(e) => setPullDialog(prev => ({ ...prev, image: e.target.value }))}
                        placeholder="e.g., nginx:latest, ubuntu:22.04"
                        sx={{ mt: 1 }}
                        disabled={pullDialog.pulling}
                    />
                    {pullDialog.progress && (
                        <Box sx={{ mt: 2 }}>
                            {pullDialog.pulling && <LinearProgress sx={{ mb: 1 }} />}
                            <Typography variant="body2" color={pullDialog.progress.includes('success') ? 'success.main' : 'text.secondary'}>
                                {pullDialog.progress}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPullDialog({ open: false, image: '', pulling: false, progress: '' })} disabled={pullDialog.pulling}>Cancel</Button>
                    <Button variant="contained" onClick={handlePullImage} disabled={pullDialog.pulling || !pullDialog.image.trim()}>
                        {pullDialog.pulling ? <CircularProgress size={20} /> : 'Pull'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default DockerManager
