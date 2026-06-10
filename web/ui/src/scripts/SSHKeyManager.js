import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'

import VpnKeyIcon from '@mui/icons-material/VpnKey'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import RefreshIcon from '@mui/icons-material/Refresh'

import { colors } from './theme'

const SSHKeyManager = () => {
    const [keys, setKeys] = useState([])
    const [machines, setMachines] = useState([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deployDialogOpen, setDeployDialogOpen] = useState(false)
    const [selectedKey, setSelectedKey] = useState(null)
    const [message, setMessage] = useState(null)
    const [newKey, setNewKey] = useState({ name: '', public_key: '' })
    const [deployTarget, setDeployTarget] = useState({ machine_id: '', user: '' })

    const loadData = async () => {
        try {
            const [keysRes, machinesRes] = await Promise.all([
                fetch('/api/ssh-keys'),
                fetch('/api/machines')
            ])
            setKeys(await keysRes.json() || [])
            setMachines(await machinesRes.json() || [])
        } catch (err) {
            console.error('Failed to load data:', err)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const addKey = async () => {
        try {
            await fetch('/api/ssh-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newKey)
            })
            setDialogOpen(false)
            setNewKey({ name: '', public_key: '' })
            loadData()
            setMessage({ type: 'success', text: 'SSH key added successfully' })
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to add SSH key' })
        }
    }

    const deleteKey = async (id) => {
        if (!window.confirm('Delete this SSH key?')) return
        try {
            await fetch(`/api/ssh-keys/${id}`, { method: 'DELETE' })
            loadData()
            setMessage({ type: 'success', text: 'SSH key deleted' })
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to delete SSH key' })
        }
    }

    const deployKey = async () => {
        try {
            const res = await fetch(`/api/machines/${deployTarget.machine_id}/ssh-keys/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key_id: selectedKey.id,
                    user: deployTarget.user
                })
            })
            const data = await res.json()
            setDeployDialogOpen(false)
            setDeployTarget({ machine_id: '', user: '' })
            if (data.success) {
                setMessage({ type: 'success', text: data.message })
            } else {
                setMessage({ type: 'error', text: data.error })
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to deploy SSH key' })
        }
    }

    const openDeployDialog = (key) => {
        setSelectedKey(key)
        setDeployDialogOpen(true)
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ color: colors.text.primary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VpnKeyIcon sx={{ color: colors.primary }} />
                    SSH Key Manager
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={loadData} sx={{ color: colors.text.muted }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setDialogOpen(true)}
                        sx={{ background: colors.primary }}
                    >
                        Add SSH Key
                    </Button>
                </Box>
            </Box>

            {message && (
                <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
                    {message.text}
                </Alert>
            )}

            <Paper sx={{ background: colors.background.card, border: `1px solid ${colors.border.light}` }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ color: colors.text.muted }}>Name</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Fingerprint</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Created</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {keys.map(key => (
                            <TableRow key={key.id}>
                                <TableCell sx={{ color: colors.text.primary, fontWeight: 500 }}>{key.name}</TableCell>
                                <TableCell sx={{ color: colors.text.muted, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {key.fingerprint}
                                </TableCell>
                                <TableCell sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                    {new Date(key.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="Deploy to Machine">
                                        <IconButton size="small" onClick={() => openDeployDialog(key)} sx={{ color: colors.secondary }}>
                                            <CloudUploadIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton size="small" onClick={() => deleteKey(key.id)} sx={{ color: colors.error }}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                        {keys.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} sx={{ textAlign: 'center', color: colors.text.muted, py: 4 }}>
                                    No SSH keys configured. Add a key to get started.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>

            {/* Add Key Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Add SSH Key</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Key Name"
                            value={newKey.name}
                            onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                            fullWidth
                            placeholder="My SSH Key"
                        />
                        <TextField
                            label="Public Key"
                            value={newKey.public_key}
                            onChange={(e) => setNewKey({ ...newKey, public_key: e.target.value })}
                            fullWidth
                            multiline
                            rows={4}
                            placeholder="ssh-rsa AAAA... user@host"
                            helperText="Paste your public key (usually from ~/.ssh/id_rsa.pub)"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button 
                        variant="contained" 
                        onClick={addKey}
                        disabled={!newKey.name || !newKey.public_key}
                    >
                        Add Key
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Deploy Key Dialog */}
            <Dialog open={deployDialogOpen} onClose={() => setDeployDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Deploy SSH Key</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: colors.text.secondary, mb: 2 }}>
                        Deploy "{selectedKey?.name}" to a machine's authorized_keys file.
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            select
                            label="Target Machine"
                            value={deployTarget.machine_id}
                            onChange={(e) => setDeployTarget({ ...deployTarget, machine_id: e.target.value })}
                            fullWidth
                        >
                            {machines.map(m => (
                                <MenuItem key={m.id} value={m.id}>{m.name} ({m.ip})</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="User (optional)"
                            value={deployTarget.user}
                            onChange={(e) => setDeployTarget({ ...deployTarget, user: e.target.value })}
                            fullWidth
                            placeholder="Leave empty to use machine's default user"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeployDialogOpen(false)}>Cancel</Button>
                    <Button 
                        variant="contained" 
                        onClick={deployKey}
                        disabled={!deployTarget.machine_id}
                        startIcon={<CloudUploadIcon />}
                    >
                        Deploy
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default SSHKeyManager
