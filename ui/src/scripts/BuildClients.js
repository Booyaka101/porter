import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import BuildIcon from '@mui/icons-material/Build'
import { colors } from './theme'

const BuildClients = () => {
    const navigate = useNavigate()
    const [clients, setClients] = useState([])
    const [machines, setMachines] = useState([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingClient, setEditingClient] = useState(null)
    const [buildDialogOpen, setBuildDialogOpen] = useState(false)
    const [selectedClient, setSelectedClient] = useState(null)
    const [selectedMachine, setSelectedMachine] = useState('')
    const [buildVersion, setBuildVersion] = useState('')
    const [building, setBuilding] = useState({})
    const [error, setError] = useState('')

    const [formData, setFormData] = useState({
        name: '',
        customer: '',
        pack: '',
        branch: ''
    })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [clientsRes, machinesRes] = await Promise.all([
                fetch('/api/build-clients'),
                fetch('/api/machines')
            ])
            const clientsData = await clientsRes.json()
            const machinesData = await machinesRes.json()
            setClients(clientsData || [])
            // Filter machines with build or deploy tags
            const buildMachines = (machinesData || []).filter(m => 
                m.tags?.includes('build') || m.tags?.includes('deploy')
            )
            setMachines(buildMachines)
            if (buildMachines.length > 0) {
                setSelectedMachine(buildMachines[0].id)
            }
        } catch (err) {
            setError('Failed to load data: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleOpenDialog = (client = null) => {
        if (client) {
            setEditingClient(client)
            setFormData({
                name: client.name,
                customer: client.customer,
                pack: client.pack,
                branch: client.branch
            })
        } else {
            setEditingClient(null)
            setFormData({ name: '', customer: '', pack: '', branch: '' })
        }
        setDialogOpen(true)
    }

    const handleCloseDialog = () => {
        setDialogOpen(false)
        setEditingClient(null)
        setFormData({ name: '', customer: '', pack: '', branch: '' })
    }

    const handleSave = async () => {
        try {
            const url = editingClient 
                ? `/api/build-clients/${editingClient.id}`
                : '/api/build-clients'
            const method = editingClient ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (!res.ok) throw new Error('Failed to save')

            handleCloseDialog()
            loadData()
        } catch (err) {
            setError('Failed to save: ' + err.message)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this build client?')) return

        try {
            await fetch(`/api/build-clients/${id}`, { method: 'DELETE' })
            loadData()
        } catch (err) {
            setError('Failed to delete: ' + err.message)
        }
    }

    const handleOpenBuildDialog = (client) => {
        setSelectedClient(client)
        setBuildVersion(client.version || '')
        setBuildDialogOpen(true)
    }

    const handleBuild = async () => {
        if (!selectedMachine || !selectedClient) return

        setBuilding(prev => ({ ...prev, [selectedClient.id]: true }))
        setBuildDialogOpen(false)

        try {
            // Build the args string for buildBundle.sh
            const args = `--customer=${selectedClient.customer} --pack=${selectedClient.pack} --branch=${selectedClient.branch}${buildVersion ? ` --version=${buildVersion}` : ''} --auto-install`

            // Trigger the script execution using Porter's API
            const execRes = await fetch('/api/execute-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script_path: 'build-deploy/buildBundle.sh',
                    machine_ids: [selectedMachine],
                    args: args
                })
            })

            if (!execRes.ok) throw new Error('Failed to trigger build')

            const result = await execRes.json()
            
            // Navigate to the execution view to see stages and output
            if (result.id) {
                navigate(`/history?execution=${result.id}`)
            }
        } catch (err) {
            setError('Failed to trigger build: ' + err.message)
        } finally {
            setBuilding(prev => ({ ...prev, [selectedClient.id]: false }))
        }
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BuildIcon /> Build Clients
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{ bgcolor: colors.primary }}
                >
                    Add Client
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {machines.length === 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    No build machines found. Add machines with "build" or "deploy" tags to enable 1-click builds.
                </Alert>
            )}

            <Grid container spacing={2}>
                {clients.map(client => (
                    <Grid item xs={12} sm={6} md={4} key={client.id}>
                        <Card sx={{ 
                            bgcolor: colors.surface, 
                            border: `1px solid ${colors.border}`,
                            '&:hover': { borderColor: colors.primary }
                        }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ color: colors.text.primary, mb: 1 }}>
                                    {client.name}
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Chip label={`Customer: ${client.customer}`} size="small" />
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Chip label={`Pack: ${client.pack}`} size="small" variant="outlined" />
                                    </Box>
                                    <Typography variant="body2" sx={{ color: colors.text.muted, mt: 1 }}>
                                        Branch: {client.branch}
                                    </Typography>
                                </Box>
                            </CardContent>
                            <CardActions sx={{ justifyContent: 'space-between' }}>
                                <Box>
                                    <IconButton size="small" onClick={() => handleOpenDialog(client)}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(client.id)} color="error">
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={building[client.id] ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                                    onClick={() => handleOpenBuildDialog(client)}
                                    disabled={building[client.id] || machines.length === 0}
                                    sx={{ bgcolor: colors.success }}
                                >
                                    Build
                                </Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}

                {clients.length === 0 && (
                    <Grid item xs={12}>
                        <Box sx={{ 
                            textAlign: 'center', 
                            py: 6, 
                            color: colors.text.muted,
                            border: `2px dashed ${colors.border}`,
                            borderRadius: 2
                        }}>
                            <BuildIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                            <Typography>No build clients configured</Typography>
                            <Typography variant="body2">Click "Add Client" to create your first build configuration</Typography>
                        </Box>
                    </Grid>
                )}
            </Grid>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingClient ? 'Edit Build Client' : 'Add Build Client'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            fullWidth
                            placeholder="e.g., Inspire Production"
                        />
                        <TextField
                            label="Customer"
                            value={formData.customer}
                            onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                            fullWidth
                            placeholder="e.g., inspire"
                        />
                        <TextField
                            label="Pack"
                            value={formData.pack}
                            onChange={(e) => setFormData({ ...formData, pack: e.target.value })}
                            fullWidth
                            placeholder="e.g., inspire"
                        />
                        <TextField
                            label="Branch"
                            value={formData.branch}
                            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                            fullWidth
                            placeholder="e.g., customer/inspire-xtrend"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        variant="contained"
                        disabled={!formData.name || !formData.customer || !formData.branch}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Build Dialog */}
            <Dialog open={buildDialogOpen} onClose={() => setBuildDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Trigger Build: {selectedClient?.name}</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Build Machine</InputLabel>
                            <Select
                                value={selectedMachine}
                                onChange={(e) => setSelectedMachine(e.target.value)}
                                label="Build Machine"
                            >
                                {machines.map(m => (
                                    <MenuItem key={m.id} value={m.id}>
                                        {m.name} ({m.host})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Version"
                            value={buildVersion}
                            onChange={(e) => setBuildVersion(e.target.value)}
                            fullWidth
                            placeholder="e.g., 1.2.3"
                            sx={{ mt: 2 }}
                            required
                            error={!buildVersion}
                            helperText={!buildVersion ? "Version is required for the build" : ""}
                        />
                        <Box sx={{ mt: 2, p: 2, bgcolor: colors.background, borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ color: colors.text.muted, mb: 1 }}>
                                Build will run with:
                            </Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>--customer={selectedClient?.customer}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>--pack={selectedClient?.pack}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>--branch={selectedClient?.branch}</Typography>
                            {buildVersion && <Typography variant="body2" sx={{ fontFamily: 'monospace', color: colors.primary }}>--version={buildVersion}</Typography>}
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: colors.success }}>--auto-install</Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBuildDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={handleBuild} 
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        disabled={!selectedMachine || !buildVersion}
                        sx={{ bgcolor: colors.success }}
                    >
                        Start Build
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default BuildClients
