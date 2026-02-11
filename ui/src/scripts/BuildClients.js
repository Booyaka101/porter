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
import { colors, gradients, shadows, cardStyles, headerStyles, buttonStyles, inputStyles } from './theme'

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
        <Box sx={{ p: 3, minHeight: '100vh' }}>
            {/* Header */}
            <Box sx={{ 
                ...headerStyles.container,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton 
                        onClick={() => navigate('/machines')} 
                        sx={{ 
                            color: colors.text.muted,
                            background: 'rgba(255,255,255,0.05)',
                            '&:hover': { background: 'rgba(249, 115, 22, 0.1)', color: colors.primary }
                        }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Box>
                        <Typography sx={headerStyles.title}>
                            Build Clients
                        </Typography>
                        {preselectedMachineId && (
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ComputerIcon sx={{ fontSize: 16, color: colors.primary }} />
                                Building on: <strong style={{ color: colors.primary }}>{getSelectedMachineName()}</strong>
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={buttonStyles.primary}
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
            <Grid container spacing={3}>
                {clients.length === 0 ? (
                    <Grid item xs={12}>
                        <Box sx={{ 
                            textAlign: 'center', 
                            py: 8, 
                            color: colors.text.muted,
                            background: colors.background.card,
                            borderRadius: '20px',
                            border: `1px dashed ${colors.border.medium}`,
                        }}>
                            <BuildIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3, color: colors.primary }} />
                            <Typography variant="h5" sx={{ color: colors.text.primary, mb: 1 }}>No clients configured</Typography>
                            <Typography sx={{ mb: 3, color: colors.text.muted }}>Add a client to start building</Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => handleOpenDialog()}
                                sx={buttonStyles.primary}
                            >
                                Add First Client
                            </Button>
                        </Box>
                    </Grid>
                ) : (
                    clients.map(client => (
                        <Grid item xs={12} sm={6} md={4} key={client.id}>
                            <Card sx={{ 
                                ...cardStyles.base,
                                '&:hover': cardStyles.hover
                            }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                        <Box sx={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: '12px',
                                            background: gradients.primarySubtle,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <BuildIcon sx={{ color: colors.primary, fontSize: 22 }} />
                                        </Box>
                                        <Typography variant="h6" sx={{ 
                                            color: colors.text.primary, 
                                            fontWeight: 700,
                                            fontSize: '1.1rem'
                                        }}>
                                            {client.name}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                                        <Chip 
                                            size="small" 
                                            label={`Customer: ${client.customer}`}
                                            sx={{ 
                                                bgcolor: 'rgba(249, 115, 22, 0.1)', 
                                                color: colors.primary,
                                                border: `1px solid ${colors.border.accent}`,
                                                fontWeight: 500
                                            }}
                                        />
                                        <Chip 
                                            size="small" 
                                            label={`Pack: ${client.pack}`}
                                            sx={{ 
                                                bgcolor: 'rgba(34, 197, 94, 0.1)', 
                                                color: colors.secondary,
                                                border: `1px solid ${colors.border.success}`,
                                                fontWeight: 500
                                            }}
                                        />
                                    </Box>
                                    {client.branch && (
                                        <Typography sx={{ 
                                            color: colors.text.muted, 
                                            fontSize: '0.85rem',
                                            fontFamily: 'monospace',
                                            background: 'rgba(0,0,0,0.2)',
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: '6px',
                                            display: 'inline-block'
                                        }}>
                                            🌿 {client.branch}
                                        </Typography>
                                    )}
                                </CardContent>
                                <CardActions sx={{ 
                                    justifyContent: 'space-between', 
                                    px: 3, 
                                    pb: 3,
                                    pt: 0,
                                    borderTop: `1px solid ${colors.border.light}`,
                                    mt: 0
                                }}>
                                    <Box sx={{ display: 'flex', gap: 0.5, pt: 2 }}>
                                        <Tooltip title="Edit">
                                            <IconButton 
                                                size="small" 
                                                onClick={() => handleOpenDialog(client)}
                                                sx={{ 
                                                    color: colors.text.muted,
                                                    '&:hover': { color: colors.primary, background: 'rgba(249, 115, 22, 0.1)' }
                                                }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton 
                                                size="small" 
                                                onClick={() => handleDelete(client.id)}
                                                sx={{ 
                                                    color: colors.text.muted,
                                                    '&:hover': { color: colors.error, background: 'rgba(239, 68, 68, 0.1)' }
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        size="medium"
                                        startIcon={<PlayArrowIcon />}
                                        onClick={() => handleOpenBuildDialog(client)}
                                        disabled={machines.length === 0}
                                        sx={{ 
                                            mt: 2,
                                            background: gradients.secondary,
                                            fontWeight: 600,
                                            px: 2.5,
                                            borderRadius: '10px',
                                            boxShadow: shadows.glowSuccess,
                                            '&:hover': { 
                                                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                                boxShadow: '0 8px 30px rgba(34, 197, 94, 0.5)'
                                            },
                                            '&:disabled': { 
                                                background: 'rgba(255,255,255,0.05)',
                                                boxShadow: 'none'
                                            }
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
                        background: colors.background.elevated,
                        border: `1px solid ${colors.border.medium}`,
                        borderRadius: '20px',
                        boxShadow: shadows.cardElevated
                    }
                }}
            >
                <DialogTitle sx={{ 
                    color: colors.text.primary, 
                    fontWeight: 700,
                    fontSize: '1.3rem',
                    borderBottom: `1px solid ${colors.border.light}`,
                    pb: 2
                }}>
                    {editingClient ? 'Edit Client' : 'Add Client'}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <TextField
                        fullWidth
                        label="Client Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        sx={{ mt: 1, mb: 2.5, ...inputStyles.search }}
                        placeholder="e.g., solaire, inspire, idx"
                    />
                    <TextField
                        fullWidth
                        label="Customer"
                        value={formData.customer}
                        onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                        sx={{ mb: 2.5, ...inputStyles.search }}
                        placeholder="Customer name for build output"
                    />
                    <TextField
                        fullWidth
                        label="Pack"
                        value={formData.pack}
                        onChange={(e) => setFormData({ ...formData, pack: e.target.value })}
                        sx={{ mb: 2.5, ...inputStyles.search }}
                        placeholder="Pack name (usually same as customer)"
                    />
                    <TextField
                        fullWidth
                        label="Branch"
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                        sx={inputStyles.search}
                        placeholder="Git branch (default: master)"
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 2, borderTop: `1px solid ${colors.border.light}` }}>
                    <Button 
                        onClick={() => setDialogOpen(false)} 
                        sx={{ ...buttonStyles.secondary, px: 3 }}
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave}
                        variant="contained"
                        disabled={!formData.name || !formData.customer || !formData.pack}
                        sx={buttonStyles.primary}
                    >
                        Save Client
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
                        background: colors.background.elevated,
                        border: `1px solid ${colors.border.medium}`,
                        borderRadius: '20px',
                        boxShadow: shadows.cardElevated
                    }
                }}
            >
                <DialogTitle sx={{ 
                    color: colors.text.primary, 
                    fontWeight: 700,
                    fontSize: '1.3rem',
                    borderBottom: `1px solid ${colors.border.light}`,
                    pb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                }}>
                    <Box sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        background: gradients.secondary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <PlayArrowIcon sx={{ color: '#fff', fontSize: 22 }} />
                    </Box>
                    Build {selectedClient?.name}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Alert 
                        severity="info" 
                        sx={{ 
                            mb: 3, 
                            borderRadius: '12px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            '& .MuiAlert-icon': { color: colors.info }
                        }}
                    >
                        This will run <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>buildBundle.sh</code> with <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>--auto-install</code> enabled.
                    </Alert>
                    
                    <Typography sx={{ color: colors.text.secondary, mb: 1, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Build Machine
                    </Typography>
                    <Box sx={{ 
                        p: 2, 
                        mb: 3, 
                        background: colors.background.card, 
                        borderRadius: '12px',
                        border: `1px solid ${colors.border.light}`
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '8px',
                                background: gradients.primarySubtle,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <ComputerIcon sx={{ color: colors.primary, fontSize: 20 }} />
                            </Box>
                            <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>
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
                        sx={{ mb: 3, ...inputStyles.search }}
                    />

                    <Typography sx={{ color: colors.text.secondary, mb: 1, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Build Configuration
                    </Typography>
                    <Box sx={{ 
                        p: 2, 
                        background: 'rgba(0,0,0,0.3)', 
                        borderRadius: '12px',
                        border: `1px solid ${colors.border.light}`
                    }}>
                        <Typography sx={{ 
                            color: colors.secondary, 
                            fontFamily: 'monospace', 
                            fontSize: '0.9rem',
                            lineHeight: 1.8
                        }}>
                            <span style={{ color: colors.text.muted }}>$</span> --client=<span style={{ color: colors.primary }}>{selectedClient?.name.toLowerCase()}</span><br/>
                            <span style={{ color: colors.text.muted }}>$</span> --version=<span style={{ color: colors.primary }}>{buildVersion || '<version>'}</span><br/>
                            <span style={{ color: colors.text.muted }}>$</span> --auto-install
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 2, borderTop: `1px solid ${colors.border.light}` }}>
                    <Button 
                        onClick={() => setBuildDialogOpen(false)} 
                        sx={{ ...buttonStyles.secondary, px: 3 }}
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleBuild}
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        disabled={!buildVersion || !selectedMachine}
                        sx={{ 
                            background: gradients.secondary,
                            fontWeight: 700,
                            px: 3,
                            borderRadius: '12px',
                            boxShadow: shadows.glowSuccess,
                            '&:hover': { 
                                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                boxShadow: '0 8px 30px rgba(34, 197, 94, 0.5)'
                            },
                            '&:disabled': { 
                                background: 'rgba(255,255,255,0.05)',
                                boxShadow: 'none'
                            }
                        }}
                    >
                        Start Build
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default BuildClients
