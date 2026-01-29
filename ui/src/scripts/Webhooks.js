import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'

import WebhookIcon from '@mui/icons-material/Webhook'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'

import { colors } from './theme'

const WEBHOOK_EVENTS = [
    { id: 'script.started', label: 'Script Started', description: 'When a script execution begins' },
    { id: 'script.completed', label: 'Script Completed', description: 'When a script execution finishes successfully' },
    { id: 'script.failed', label: 'Script Failed', description: 'When a script execution fails' },
    { id: 'machine.online', label: 'Machine Online', description: 'When a machine comes online' },
    { id: 'machine.offline', label: 'Machine Offline', description: 'When a machine goes offline' },
    { id: 'machine.added', label: 'Machine Added', description: 'When a new machine is added' },
    { id: 'machine.removed', label: 'Machine Removed', description: 'When a machine is deleted' },
    { id: 'docker.container.started', label: 'Container Started', description: 'When a Docker container starts' },
    { id: 'docker.container.stopped', label: 'Container Stopped', description: 'When a Docker container stops' },
    { id: 'backup.completed', label: 'Backup Completed', description: 'When a backup completes' },
    { id: 'backup.failed', label: 'Backup Failed', description: 'When a backup fails' },
]

const Webhooks = () => {
    const [webhooks, setWebhooks] = useState([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingWebhook, setEditingWebhook] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [testResult, setTestResult] = useState(null)
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
    
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        secret: '',
        events: [],
        enabled: true
    })

    const loadWebhooks = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/webhooks')
            if (res.ok) {
                const data = await res.json()
                setWebhooks(data || [])
            } else {
                // API might not exist yet, use empty array
                setWebhooks([])
            }
        } catch (err) {
            console.error('Failed to load webhooks:', err)
            setWebhooks([])
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadWebhooks()
    }, [loadWebhooks])

    const openAddDialog = () => {
        setEditingWebhook(null)
        setFormData({ name: '', url: '', secret: '', events: [], enabled: true })
        setDialogOpen(true)
    }

    const openEditDialog = (webhook) => {
        setEditingWebhook(webhook)
        setFormData({
            name: webhook.name,
            url: webhook.url,
            secret: webhook.secret || '',
            events: webhook.events || [],
            enabled: webhook.enabled
        })
        setDialogOpen(true)
    }

    const handleSave = async () => {
        if (!formData.name || !formData.url || formData.events.length === 0) {
            setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'error' })
            return
        }

        try {
            const url = editingWebhook ? `/api/webhooks/${editingWebhook.id}` : '/api/webhooks'
            const method = editingWebhook ? 'PUT' : 'POST'
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                setSnackbar({ open: true, message: editingWebhook ? 'Webhook updated' : 'Webhook created', severity: 'success' })
                setDialogOpen(false)
                loadWebhooks()
            } else {
                throw new Error('Failed to save webhook')
            }
        } catch (err) {
            setSnackbar({ open: true, message: err.message, severity: 'error' })
        }
    }

    const handleDelete = async () => {
        if (!deleteConfirm) return
        try {
            const res = await fetch(`/api/webhooks/${deleteConfirm.id}`, { method: 'DELETE' })
            if (res.ok) {
                setSnackbar({ open: true, message: 'Webhook deleted', severity: 'success' })
                loadWebhooks()
            }
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to delete webhook', severity: 'error' })
        }
        setDeleteConfirm(null)
    }

    const handleToggle = async (webhook) => {
        try {
            const res = await fetch(`/api/webhooks/${webhook.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...webhook, enabled: !webhook.enabled })
            })
            if (res.ok) {
                loadWebhooks()
            }
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to toggle webhook', severity: 'error' })
        }
    }

    const testWebhook = async (webhook) => {
        setTestResult({ id: webhook.id, loading: true })
        try {
            const res = await fetch(`/api/webhooks/${webhook.id}/test`, { method: 'POST' })
            const data = await res.json()
            setTestResult({ id: webhook.id, success: data.success, message: data.message })
        } catch (err) {
            setTestResult({ id: webhook.id, success: false, message: err.message })
        }
        setTimeout(() => setTestResult(null), 5000)
    }

    const toggleEvent = (eventId) => {
        setFormData(prev => ({
            ...prev,
            events: prev.events.includes(eventId)
                ? prev.events.filter(e => e !== eventId)
                : [...prev.events, eventId]
        }))
    }

    const copySecret = (secret) => {
        navigator.clipboard.writeText(secret)
        setSnackbar({ open: true, message: 'Secret copied to clipboard', severity: 'success' })
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <WebhookIcon sx={{ color: '#8b5cf6', fontSize: 28 }} />
                    </Box>
                    <Box>
                        <Typography variant="h4" sx={{ color: '#fafafa', fontWeight: 700 }}>
                            Webhooks
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            Trigger external services on events
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={loadWebhooks} sx={{ color: '#f97316' }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={openAddDialog}
                        sx={{
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            '&:hover': { background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)' }
                        }}
                    >
                        Add Webhook
                    </Button>
                </Box>
            </Box>

            {/* Info Box */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                    Webhooks allow you to receive HTTP POST notifications when events occur in Porter. 
                    Configure a URL endpoint and select which events should trigger notifications.
                </Typography>
            </Paper>

            {/* Webhooks List */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress sx={{ color: '#8b5cf6' }} />
                </Box>
            ) : webhooks.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <WebhookIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>No webhooks configured</Typography>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddDialog} sx={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>
                        Create Your First Webhook
                    </Button>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {webhooks.map(webhook => (
                        <Paper 
                            key={webhook.id} 
                            sx={{ 
                                p: 3, 
                                bgcolor: 'rgba(255,255,255,0.02)', 
                                border: '1px solid rgba(255,255,255,0.05)',
                                opacity: webhook.enabled ? 1 : 0.6,
                                transition: 'all 0.2s ease',
                                '&:hover': { borderColor: 'rgba(139, 92, 246, 0.3)' }
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                        <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '1.1rem' }}>
                                            {webhook.name}
                                        </Typography>
                                        <Switch
                                            checked={webhook.enabled}
                                            onChange={() => handleToggle(webhook)}
                                            size="small"
                                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#8b5cf6' } }}
                                        />
                                        {!webhook.enabled && (
                                            <Chip label="Disabled" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }} />
                                        )}
                                    </Box>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: '0.85rem', mb: 2 }}>
                                        {webhook.url}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {webhook.events?.map(event => (
                                            <Chip 
                                                key={event} 
                                                label={WEBHOOK_EVENTS.find(e => e.id === event)?.label || event}
                                                size="small"
                                                sx={{ bgcolor: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', fontSize: '0.75rem' }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    {testResult?.id === webhook.id && (
                                        testResult.loading ? (
                                            <CircularProgress size={20} sx={{ color: '#8b5cf6' }} />
                                        ) : testResult.success ? (
                                            <CheckCircleIcon sx={{ color: '#22c55e' }} />
                                        ) : (
                                            <Tooltip title={testResult.message}>
                                                <ErrorIcon sx={{ color: '#ef4444' }} />
                                            </Tooltip>
                                        )
                                    )}
                                    <Tooltip title="Test Webhook">
                                        <IconButton onClick={() => testWebhook(webhook)} sx={{ color: '#22c55e' }}>
                                            <PlayArrowIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit">
                                        <IconButton onClick={() => openEditDialog(webhook)} sx={{ color: '#f97316' }}>
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton onClick={() => setDeleteConfirm(webhook)} sx={{ color: '#ef4444' }}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>
                        </Paper>
                    ))}
                </Box>
            )}

            {/* Add/Edit Dialog */}
            <Dialog 
                open={dialogOpen} 
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { bgcolor: 'rgba(20, 20, 20, 0.98)', border: '1px solid rgba(255,255,255,0.1)' } }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WebhookIcon sx={{ color: '#8b5cf6' }} />
                        {editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <TextField
                            label="Name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            fullWidth
                            required
                            placeholder="My Webhook"
                        />
                        <TextField
                            label="URL"
                            value={formData.url}
                            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                            fullWidth
                            required
                            placeholder="https://example.com/webhook"
                            helperText="The URL that will receive POST requests"
                        />
                        <TextField
                            label="Secret (optional)"
                            value={formData.secret}
                            onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                            fullWidth
                            placeholder="webhook-secret-key"
                            helperText="Used to sign webhook payloads for verification"
                            InputProps={{
                                endAdornment: formData.secret && (
                                    <IconButton size="small" onClick={() => copySecret(formData.secret)}>
                                        <ContentCopyIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                )
                            }}
                        />
                        <Box>
                            <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1.5, fontWeight: 500 }}>
                                Events *
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                                {WEBHOOK_EVENTS.map(event => (
                                    <FormControlLabel
                                        key={event.id}
                                        control={
                                            <Checkbox
                                                checked={formData.events.includes(event.id)}
                                                onChange={() => toggleEvent(event.id)}
                                                sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: '#8b5cf6' } }}
                                            />
                                        }
                                        label={
                                            <Tooltip title={event.description}>
                                                <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                                                    {event.label}
                                                </Typography>
                                            </Tooltip>
                                        }
                                    />
                                ))}
                            </Box>
                        </Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.enabled}
                                    onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#8b5cf6' } }}
                                />
                            }
                            label="Enabled"
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave}
                        variant="contained"
                        sx={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}
                    >
                        {editingWebhook ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog 
                open={!!deleteConfirm} 
                onClose={() => setDeleteConfirm(null)}
                PaperProps={{ sx: { bgcolor: 'rgba(20, 20, 20, 0.98)', border: '1px solid rgba(255,255,255,0.1)' } }}
            >
                <DialogTitle>Delete Webhook</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Are you sure you want to delete "{deleteConfirm?.name}"?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default Webhooks
