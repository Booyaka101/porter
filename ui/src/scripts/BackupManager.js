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
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'

import BackupIcon from '@mui/icons-material/Backup'
import AddIcon from '@mui/icons-material/Add'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import StorageIcon from '@mui/icons-material/Storage'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ScheduleIcon from '@mui/icons-material/Schedule'
import FolderIcon from '@mui/icons-material/Folder'
import RestoreIcon from '@mui/icons-material/Restore'
import VerifiedIcon from '@mui/icons-material/Verified'

import { colors } from './theme'

// Stats Card Component
const StatsCard = ({ icon: Icon, title, value, subtitle, color }) => (
    <Card sx={{ 
        background: `linear-gradient(135deg, ${color}08 0%, rgba(255,255,255,0.01) 100%)`,
        border: `1px solid ${color}20`,
        borderRadius: '12px',
        height: '100%',
    }}>
        <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    background: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Icon sx={{ color, fontSize: 22 }} />
                </Box>
                <Box>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.75rem' }}>{title}</Typography>
                    <Typography sx={{ color: colors.text.primary, fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
                        {value}
                    </Typography>
                    {subtitle && (
                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem' }}>{subtitle}</Typography>
                    )}
                </Box>
            </Box>
        </CardContent>
    </Card>
)

const BackupManager = () => {
    const [jobs, setJobs] = useState([])
    const [machines, setMachines] = useState([])
    const [history, setHistory] = useState([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [newJob, setNewJob] = useState({
        name: '',
        machine_id: '',
        source_path: '',
        dest_path: '/backups',
        compress: true,
        schedule: 'manual'
    })

    const loadData = async () => {
        setLoading(true)
        try {
            const [jobsRes, machinesRes, historyRes] = await Promise.all([
                fetch('/api/backups'),
                fetch('/api/machines'),
                fetch('/api/backups/history')
            ])
            setJobs(await jobsRes.json() || [])
            setMachines(await machinesRes.json() || [])
            setHistory(await historyRes.json() || [])
        } catch (err) {
            console.error('Failed to load data:', err)
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [])

    const createJob = async () => {
        try {
            await fetch('/api/backups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJob)
            })
            setDialogOpen(false)
            setNewJob({ name: '', machine_id: '', source_path: '', dest_path: '/backups', compress: true, schedule: 'manual' })
            loadData()
        } catch (err) {
            console.error('Failed to create backup job:', err)
        }
    }

    const runJob = async (id) => {
        try {
            await fetch(`/api/backups/${id}/run`, { method: 'POST' })
            loadData()
        } catch (err) {
            console.error('Failed to run backup:', err)
        }
    }

    const deleteJob = async (id) => {
        if (!window.confirm('Delete this backup job?')) return
        try {
            await fetch(`/api/backups/${id}`, { method: 'DELETE' })
            loadData()
        } catch (err) {
            console.error('Failed to delete backup job:', err)
        }
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

    // Calculate stats
    const totalBackups = history.length
    const successfulBackups = history.filter(h => h.status === 'success').length
    const totalSize = history.reduce((sum, h) => sum + (h.size || 0), 0)
    const successRate = totalBackups > 0 ? Math.round((successfulBackups / totalBackups) * 100) : 0

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 3,
                p: 3,
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderRadius: '16px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
            }}>
                <Box>
                    <Typography variant="h5" sx={{ color: colors.text.primary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BackupIcon sx={{ color: '#3b82f6' }} />
                        Backup Manager
                    </Typography>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mt: 0.5 }}>
                        Create and manage backup jobs for your machines
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={loadData} sx={{ color: colors.text.muted, '&:hover': { color: '#3b82f6' } }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setDialogOpen(true)}
                        sx={{ 
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            '&:hover': { background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' }
                        }}
                    >
                        New Backup Job
                    </Button>
                </Box>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                    <StatsCard 
                        icon={FolderIcon}
                        title="Total Jobs"
                        value={jobs.length}
                        color="#3b82f6"
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatsCard 
                        icon={CheckCircleIcon}
                        title="Successful"
                        value={successfulBackups}
                        subtitle={`${successRate}% success rate`}
                        color={colors.secondary}
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatsCard 
                        icon={StorageIcon}
                        title="Total Size"
                        value={formatSize(totalSize)}
                        color="#8b5cf6"
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatsCard 
                        icon={ScheduleIcon}
                        title="Total Backups"
                        value={totalBackups}
                        color={colors.warning}
                    />
                </Grid>
            </Grid>

            {/* Backup Jobs */}
            <Paper sx={{ background: colors.background.card, border: `1px solid ${colors.border.light}`, mb: 3 }}>
                <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border.light}` }}>
                    <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>Backup Jobs</Typography>
                </Box>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ color: colors.text.muted }}>Name</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Machine</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Source</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Last Run</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Status</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {jobs.map(job => (
                            <TableRow key={job.id}>
                                <TableCell sx={{ color: colors.text.primary }}>{job.name}</TableCell>
                                <TableCell sx={{ color: colors.text.secondary }}>{job.machine_name}</TableCell>
                                <TableCell sx={{ color: colors.text.muted, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {job.source_path}
                                </TableCell>
                                <TableCell sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                    {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
                                </TableCell>
                                <TableCell>
                                    {job.last_status && (
                                        <Chip 
                                            label={job.last_status} 
                                            size="small"
                                            color={job.last_status === 'success' ? 'success' : 'error'}
                                        />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="Run Now">
                                        <IconButton size="small" onClick={() => runJob(job.id)} sx={{ color: colors.secondary }}>
                                            <PlayArrowIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton size="small" onClick={() => deleteJob(job.id)} sx={{ color: colors.error }}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                        {jobs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ textAlign: 'center', color: colors.text.muted, py: 4 }}>
                                    No backup jobs configured
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>

            {/* Backup History */}
            <Paper sx={{ background: colors.background.card, border: `1px solid ${colors.border.light}` }}>
                <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border.light}` }}>
                    <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>Recent Backups</Typography>
                </Box>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ color: colors.text.muted }}>Job</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Started</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Duration</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Size</TableCell>
                            <TableCell sx={{ color: colors.text.muted }}>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {history.slice(0, 10).map(h => (
                            <TableRow key={h.id}>
                                <TableCell sx={{ color: colors.text.primary }}>{h.job_name}</TableCell>
                                <TableCell sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                    {new Date(h.started_at).toLocaleString()}
                                </TableCell>
                                <TableCell sx={{ color: colors.text.muted }}>
                                    {h.ended_at ? `${Math.round((new Date(h.ended_at) - new Date(h.started_at)) / 1000)}s` : '-'}
                                </TableCell>
                                <TableCell sx={{ color: colors.text.muted }}>{formatSize(h.size)}</TableCell>
                                <TableCell>
                                    <Chip 
                                        label={h.status} 
                                        size="small"
                                        color={h.status === 'success' ? 'success' : h.status === 'running' ? 'primary' : 'error'}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                        {history.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} sx={{ textAlign: 'center', color: colors.text.muted, py: 4 }}>
                                    No backup history
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>

            {/* Create Job Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Backup Job</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Job Name"
                            value={newJob.name}
                            onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            select
                            label="Machine"
                            value={newJob.machine_id}
                            onChange={(e) => setNewJob({ ...newJob, machine_id: e.target.value })}
                            fullWidth
                        >
                            {machines.map(m => (
                                <MenuItem key={m.id} value={m.id}>{m.name} ({m.ip})</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Source Path"
                            value={newJob.source_path}
                            onChange={(e) => setNewJob({ ...newJob, source_path: e.target.value })}
                            fullWidth
                            placeholder="/home/user/data"
                        />
                        <TextField
                            label="Destination Path"
                            value={newJob.dest_path}
                            onChange={(e) => setNewJob({ ...newJob, dest_path: e.target.value })}
                            fullWidth
                            placeholder="/backups"
                        />
                        <FormControlLabel
                            control={
                                <Switch 
                                    checked={newJob.compress}
                                    onChange={(e) => setNewJob({ ...newJob, compress: e.target.checked })}
                                />
                            }
                            label="Compress backup (tar.gz)"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button 
                        variant="contained" 
                        onClick={createJob}
                        disabled={!newJob.name || !newJob.machine_id || !newJob.source_path}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default BackupManager
