import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import BuildIcon from '@mui/icons-material/Build'
import ComputerIcon from '@mui/icons-material/Computer'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { colors } from './theme'

const BuildClients = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const preselectedMachineId = searchParams.get('machine')
    
    const [clients, setClients] = useState([])
    const [machines, setMachines] = useState([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingClient, setEditingClient] = useState(null)
    const [buildDialogOpen, setBuildDialogOpen] = useState(false)
    const [selectedClient, setSelectedClient] = useState(null)
    const [selectedMachine, setSelectedMachine] = useState('')
    const [buildVersion, setBuildVersion] = useState('')
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

    // Set preselected machine when machines are loaded
    useEffect(() => {
        if (preselectedMachineId && machines.length > 0) {
            const machine = machines.find(m => m.id === preselectedMachineId)
            if (machine) {
                setSelectedMachine(preselectedMachineId)
            }
        }
    }, [preselectedMachineId, machines])

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
            // Use preselected machine from URL if available, otherwise use first build machine
            if (preselectedMachineId && buildMachines.find(m => m.id === preselectedMachineId)) {
                setSelectedMachine(preselectedMachineId)
            } else if (buildMachines.length > 0 && !selectedMachine) {
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
            
            if (!res.ok) throw new Error('Failed to save client')
            
            setDialogOpen(false)
            loadData()
        } catch (err) {
            setError('Failed to save client: ' + err.message)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this client?')) return
        try {
            const res = await fetch(`/api/build-clients/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete client')
            loadData()
        } catch (err) {
            setError('Failed to delete client: ' + err.message)
        }
    }

    const handleOpenBuildDialog = (client) => {
        setSelectedClient(client)
        setBuildVersion('')
        setBuildDialogOpen(true)
    }

    const handleBuild = () => {
        if (!selectedClient || !selectedMachine || !buildVersion) return
        
        // Build the URL with all flags pre-populated
        // Flags: --client, --version, --auto-install
        const flags = [
            `--client=${selectedClient.name.toLowerCase()}`,
            `--version=${buildVersion}`,
            '--auto-install'
        ]
        
        // Encode flags as URL parameter
        const flagsParam = encodeURIComponent(flags.join(' '))
        
        // Navigate to ScriptWizard step 3 with machine and flags pre-populated
        navigate(`/scripts/build-deploy%2FbuildBundle.sh?machines=${selectedMachine}&step=3&flags=${flagsParam}`)
        
        setBuildDialogOpen(false)
    }

    const getSelectedMachineName = () => {
        const machine = machines.find(m => m.id === selectedMachine)
        return machine?.name || 'Unknown'
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
                <CircularProgress sx={{ color: colors.primary }} />
            </Box>
        )
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => navigate('/machines')} sx={{ color: colors.text.muted }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Box>
                        <Typography variant="h4" sx={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BuildIcon sx={{ color: colors.primary }} />
                            Build Clients
                        </Typography>
                        {preselectedMachineId && (
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ComputerIcon sx={{ fontSize: 16 }} />
                                Building on: <strong>{getSelectedMachineName()}</strong>
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{ bgcolor: colors.primary, '&:hover': { bgcolor: colors.primaryDark } }}
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
                    No machines with 'build' or 'deploy' tags found. Add these tags to machines that can run builds.
                </Alert>
            )}

            {/* Client Cards */}
            <Grid container spacing={2}>
                {clients.length === 0 ? (
                    <Grid item xs={12}>
                        <Box sx={{ 
                            textAlign: 'center', 
                            py: 6, 
                            color: colors.text.muted,
                            bgcolor: 'rgba(255,255,255,0.02)',
                            borderRadius: 2,
                            border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <BuildIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                            <Typography variant="h6">No clients configured</Typography>
                            <Typography sx={{ mb: 2 }}>Add a client to start building</Typography>
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={() => handleOpenDialog()}
                                sx={{ color: colors.primary, borderColor: colors.primary }}
                            >
                                Add First Client
                            </Button>
                        </Box>
                    </Grid>
                ) : (
                    clients.map(client => (
                        <Grid item xs={12} sm={6} md={4} key={client.id}>
                            <Card sx={{ 
                                bgcolor: 'rgba(255,255,255,0.03)', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 2,
                                transition: 'all 0.2s',
                                '&:hover': { 
                                    borderColor: colors.primary,
                                    transform: 'translateY(-2px)'
                                }
                            }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: colors.text.primary, mb: 1 }}>
                                        {client.name}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                        <Chip 
                                            size="small" 
                                            label={`Customer: ${client.customer}`}
                                            sx={{ bgcolor: 'rgba(249, 115, 22, 0.1)', color: colors.primary }}
                                        />
                                        <Chip 
                                            size="small" 
                                            label={`Pack: ${client.pack}`}
                                            sx={{ bgcolor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}
                                        />
                                    </Box>
                                    {client.branch && (
                                        <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                                            Branch: {client.branch}
                                        </Typography>
                                    )}
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                                    <Box>
                                        <Tooltip title="Edit">
                                            <IconButton 
                                                size="small" 
                                                onClick={() => handleOpenDialog(client)}
                                                sx={{ color: colors.text.muted }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton 
                                                size="small" 
                                                onClick={() => handleDelete(client.id)}
                                                sx={{ color: '#ff4466' }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<PlayArrowIcon />}
                                        onClick={() => handleOpenBuildDialog(client)}
                                        disabled={machines.length === 0}
                                        sx={{ 
                                            bgcolor: '#22c55e', 
                                            '&:hover': { bgcolor: '#16a34a' },
                                            '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)' }
                                        }}
                                    >
                                        Build
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))
                )}
            </Grid>

            {/* Add/Edit Client Dialog */}
            <Dialog 
                open={dialogOpen} 
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 2
                    }
                }}
            >
                <DialogTitle sx={{ color: colors.text.primary }}>
                    {editingClient ? 'Edit Client' : 'Add Client'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Client Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        sx={{ mt: 2, mb: 2 }}
                        placeholder="e.g., solaire, inspire, idx"
                    />
                    <TextField
                        fullWidth
                        label="Customer"
                        value={formData.customer}
                        onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                        sx={{ mb: 2 }}
                        placeholder="Customer name for build output"
                    />
                    <TextField
                        fullWidth
                        label="Pack"
                        value={formData.pack}
                        onChange={(e) => setFormData({ ...formData, pack: e.target.value })}
                        sx={{ mb: 2 }}
                        placeholder="Pack name (usually same as customer)"
                    />
                    <TextField
                        fullWidth
                        label="Branch"
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                        placeholder="Git branch (default: master)"
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialogOpen(false)} sx={{ color: colors.text.muted }}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave}
                        variant="contained"
                        disabled={!formData.name || !formData.customer || !formData.pack}
                        sx={{ bgcolor: colors.primary }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Build Dialog */}
            <Dialog 
                open={buildDialogOpen} 
                onClose={() => setBuildDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 2
                    }
                }}
            >
                <DialogTitle sx={{ color: colors.text.primary }}>
                    Build {selectedClient?.name}
                </DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        This will run <code>buildBundle.sh</code> with <code>--auto-install</code> enabled.
                    </Alert>
                    
                    <Typography sx={{ color: colors.text.muted, mb: 1, fontSize: '0.85rem' }}>
                        Build Machine
                    </Typography>
                    <Box sx={{ 
                        p: 2, 
                        mb: 2, 
                        bgcolor: 'rgba(0,0,0,0.2)', 
                        borderRadius: 1,
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ComputerIcon sx={{ color: colors.primary }} />
                            <Typography sx={{ color: colors.text.primary }}>
                                {getSelectedMachineName()}
                            </Typography>
                        </Box>
                    </Box>

                    <TextField
                        fullWidth
                        label="Version"
                        value={buildVersion}
                        onChange={(e) => setBuildVersion(e.target.value)}
                        placeholder="e.g., 1.2.3"
                        required
                        helperText="Version tag for this build (required)"
                        sx={{ mb: 2 }}
                    />

                    <Typography sx={{ color: colors.text.muted, mb: 1, fontSize: '0.85rem' }}>
                        Build Configuration
                    </Typography>
                    <Box sx={{ 
                        p: 2, 
                        bgcolor: 'rgba(0,0,0,0.2)', 
                        borderRadius: 1,
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Typography sx={{ color: colors.text.primary, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            --client={selectedClient?.name.toLowerCase()}<br/>
                            --version={buildVersion || '<version>'}<br/>
                            --auto-install
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setBuildDialogOpen(false)} sx={{ color: colors.text.muted }}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleBuild}
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        disabled={!buildVersion || !selectedMachine}
                        sx={{ bgcolor: '#22c55e', '&:hover': { bgcolor: '#16a34a' } }}
                    >
                        Start Build
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default BuildClients
