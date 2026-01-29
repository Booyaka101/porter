import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import FormControlLabel from '@mui/material/FormControlLabel'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Collapse from '@mui/material/Collapse'
import SettingsIcon from '@mui/icons-material/Settings'
import NotificationsIcon from '@mui/icons-material/Notifications'
import ScheduleIcon from '@mui/icons-material/Schedule'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'
import ComputerIcon from '@mui/icons-material/Computer'
import CodeIcon from '@mui/icons-material/Code'
import StarIcon from '@mui/icons-material/Star'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { colors, gradients, scrollableStyles } from './theme'
import { getPresetsForScript, presetToFlagValues } from './presets'
import UserManagement from './UserManagement'
import PeopleIcon from '@mui/icons-material/People'
import { useAuth } from './AuthContext'

const Settings = () => {
    const { isAdmin, canWrite, canExecute } = useAuth()
    const canEditScheduler = canWrite('scheduler') || canExecute()
    const [activeTab, setActiveTab] = useState('scheduler')
    const [jobs, setJobs] = useState([])
    const [machines, setMachines] = useState([])
    const [scripts, setScripts] = useState([])
    const [notifConfig, setNotifConfig] = useState({
        enabled: true,
        slack_webhook: '',
        on_success: false,
        on_failure: true,
    })
    const [jobDialog, setJobDialog] = useState(false)
    const [editingJob, setEditingJob] = useState(null)
    const [jobForm, setJobForm] = useState({
        name: '',
        description: '',
        script_path: '',
        args: '',
        machine_ids: [],
        cron_expr: '0 0 * * * *',
        enabled: true,
    })
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
    
    // Wizard state for job creation
    const [wizardStep, setWizardStep] = useState(0)
    const [selectedScript, setSelectedScript] = useState(null)
    const [scriptPresets, setScriptPresets] = useState(null)
    const [selectedPreset, setSelectedPreset] = useState(null)
    const [flagValues, setFlagValues] = useState({})
    const [advancedMode, setAdvancedMode] = useState(false)

    const loadJobs = useCallback(async () => {
        try {
            const res = await fetch('/api/scheduler/jobs')
            const data = await res.json()
            setJobs(data || [])
        } catch (err) {
            console.error('Failed to load jobs:', err)
        }
    }, [])

    const loadMachines = useCallback(async () => {
        try {
            const res = await fetch('/api/machines')
            const data = await res.json()
            setMachines(data || [])
        } catch (err) {
            console.error('Failed to load machines:', err)
        }
    }, [])

    const loadScripts = useCallback(async () => {
        try {
            const res = await fetch('/api/scripts')
            const data = await res.json()
            setScripts(data || [])
        } catch (err) {
            console.error('Failed to load scripts:', err)
        }
    }, [])

    const loadNotifConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications/config')
            const data = await res.json()
            setNotifConfig(data || {})
        } catch (err) {
            console.error('Failed to load notification config:', err)
        }
    }, [])

    useEffect(() => {
        loadJobs()
        loadMachines()
        loadScripts()
        loadNotifConfig()
    }, [loadJobs, loadMachines, loadScripts, loadNotifConfig])

    const showToast = (message, severity = 'success') => {
        setToast({ open: true, message, severity })
    }

    const handleSaveJob = async () => {
        try {
            const method = editingJob ? 'PUT' : 'POST'
            const url = editingJob ? `/api/scheduler/jobs/${editingJob.id}` : '/api/scheduler/jobs'
            
            // Build args from preset/flags
            const args = buildCommandArgs()
            const presetName = selectedPreset?.name || ''
            
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...jobForm,
                    args,
                    description: presetName ? `${presetName} - ${jobForm.description || ''}`.trim() : jobForm.description,
                }),
            })
            
            setJobDialog(false)
            setEditingJob(null)
            setWizardStep(0)
            setSelectedScript(null)
            setScriptPresets(null)
            setSelectedPreset(null)
            setFlagValues({})
            setJobForm({
                name: '',
                description: '',
                script_path: '',
                args: '',
                machine_ids: [],
                cron_expr: '0 0 * * * *',
                enabled: true,
            })
            loadJobs()
            showToast(editingJob ? 'Job updated' : 'Job created')
        } catch (err) {
            showToast('Failed to save job', 'error')
        }
    }

    const handleDeleteJob = async (id) => {
        if (!window.confirm('Delete this scheduled job?')) return
        try {
            await fetch(`/api/scheduler/jobs/${id}`, { method: 'DELETE' })
            loadJobs()
            showToast('Job deleted')
        } catch (err) {
            showToast('Failed to delete job', 'error')
        }
    }

    const handleToggleJob = async (id) => {
        try {
            await fetch(`/api/scheduler/jobs/${id}/toggle`, { method: 'POST' })
            loadJobs()
        } catch (err) {
            showToast('Failed to toggle job', 'error')
        }
    }

    const handleRunJob = async (id) => {
        try {
            await fetch(`/api/scheduler/jobs/${id}/run`, { method: 'POST' })
            showToast('Job execution started')
        } catch (err) {
            showToast('Failed to run job', 'error')
        }
    }

    const handleEditJob = (job) => {
        setEditingJob(job)
        setJobForm({
            name: job.name || '',
            description: job.description || '',
            script_path: job.script_path || '',
            args: job.args || '',
            machine_ids: job.machine_ids || [],
            cron_expr: job.cron_expr || '0 0 * * * *',
            enabled: job.enabled,
        })
        // Find the script and load presets
        const script = scripts.find(s => s.path === job.script_path)
        if (script) {
            setSelectedScript(script)
            const presets = getPresetsForScript(script.path)
            setScriptPresets(presets)
        }
        setWizardStep(3) // Go directly to schedule step for editing
        setJobDialog(true)
    }

    const handleScriptSelect = (script) => {
        setSelectedScript(script)
        setJobForm(prev => ({ ...prev, script_path: script.path, name: script.name }))
        
        // Load presets for this script
        const presets = getPresetsForScript(script.path)
        setScriptPresets(presets)
        
        // Initialize flag values
        const initialFlags = {}
        script.flags?.forEach(flag => {
            initialFlags[flag.long] = { enabled: false, value: '' }
        })
        setFlagValues(initialFlags)
        
        // Auto-select recommended preset
        const recommended = presets?.presets?.find(p => p.recommended)
        if (recommended) {
            setSelectedPreset(recommended)
            setFlagValues(presetToFlagValues(recommended, script.flags))
        } else {
            setSelectedPreset(null)
        }
    }

    const handlePresetSelect = (preset) => {
        setSelectedPreset(preset)
        if (!scriptPresets?.useArgs && selectedScript) {
            setFlagValues(presetToFlagValues(preset, selectedScript.flags))
        }
    }

    const handleFlagToggle = (flagLong) => {
        setSelectedPreset(null)
        setFlagValues(prev => ({
            ...prev,
            [flagLong]: { ...prev[flagLong], enabled: !prev[flagLong]?.enabled }
        }))
    }

    const handleFlagValueChange = (flagLong, value) => {
        setFlagValues(prev => ({
            ...prev,
            [flagLong]: { ...prev[flagLong], value }
        }))
    }

    const buildCommandArgs = () => {
        // If preset has direct args string, use it
        if (scriptPresets?.useArgs && selectedPreset?.args) {
            return selectedPreset.args
        }
        
        // If a preset is selected, build args directly from preset flags
        // This ensures preset flags are always included even if flagValues state is stale
        if (selectedPreset?.flags?.length > 0) {
            return selectedPreset.flags.join(' ')
        }
        
        // Build from flagValues state (for advanced/manual mode)
        const args = []
        Object.entries(flagValues).forEach(([flagLong, config]) => {
            if (config.enabled) {
                args.push(config.value ? `${flagLong}=${config.value}` : flagLong)
            }
        })
        
        // If no args built from flags, use existing jobForm.args (for editing existing jobs)
        if (args.length === 0 && jobForm.args) {
            return jobForm.args
        }
        
        return args.join(' ')
    }

    const openNewJobDialog = () => {
        setEditingJob(null)
        setWizardStep(0)
        setSelectedScript(null)
        setScriptPresets(null)
        setSelectedPreset(null)
        setFlagValues({})
        setAdvancedMode(false)
        setJobForm({
            name: '',
            description: '',
            script_path: '',
            args: '',
            machine_ids: [],
            cron_expr: '0 0 * * * *',
            enabled: true,
        })
        setJobDialog(true)
    }

    const wizardSteps = ['Select Script', 'Configure Options', 'Select Machines', 'Schedule']

    const canProceedWizard = () => {
        switch (wizardStep) {
            case 0: return selectedScript !== null
            case 1: return true
            case 2: return jobForm.machine_ids.length > 0
            case 3: return jobForm.name && jobForm.cron_expr
            default: return true
        }
    }

    const handleSaveNotifConfig = async () => {
        try {
            await fetch('/api/notifications/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notifConfig),
            })
            showToast('Notification settings saved')
        } catch (err) {
            showToast('Failed to save settings', 'error')
        }
    }

    const cronPresets = [
        { label: 'Every minute', value: '0 * * * * *', description: 'Runs at the start of every minute' },
        { label: 'Every 5 minutes', value: '0 */5 * * * *', description: 'Runs every 5 minutes (0, 5, 10, 15...)' },
        { label: 'Every 15 minutes', value: '0 */15 * * * *', description: 'Runs every 15 minutes (0, 15, 30, 45)' },
        { label: 'Every 30 minutes', value: '0 */30 * * * *', description: 'Runs every 30 minutes (0, 30)' },
        { label: 'Every hour', value: '0 0 * * * *', description: 'Runs at the start of every hour' },
        { label: 'Every 6 hours', value: '0 0 */6 * * *', description: 'Runs at 12am, 6am, 12pm, 6pm' },
        { label: 'Every day at midnight', value: '0 0 0 * * *', description: 'Runs once daily at 12:00 AM' },
        { label: 'Every day at 9am', value: '0 0 9 * * *', description: 'Runs once daily at 9:00 AM' },
        { label: 'Every day at 6pm', value: '0 0 18 * * *', description: 'Runs once daily at 6:00 PM' },
        { label: 'Every Monday at 9am', value: '0 0 9 * * 1', description: 'Runs weekly on Monday at 9:00 AM' },
        { label: 'Every weekday at 9am', value: '0 0 9 * * 1-5', description: 'Runs Mon-Fri at 9:00 AM' },
        { label: 'First of month at midnight', value: '0 0 0 1 * *', description: 'Runs on the 1st of each month' },
    ]

    return (
        <Box sx={scrollableStyles.pageContainer}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography sx={{ 
                        fontSize: '1.8rem', 
                        fontWeight: 800,
                        background: gradients.text,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Settings
                    </Typography>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem' }}>
                        Configure scheduled jobs and notifications
                    </Typography>
                </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <Button
                    startIcon={<ScheduleIcon />}
                    onClick={() => setActiveTab('scheduler')}
                    sx={{
                        px: 3,
                        py: 1,
                        borderRadius: '12px',
                        background: activeTab === 'scheduler' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.03)',
                        color: activeTab === 'scheduler' ? colors.primary : colors.text.secondary,
                        border: activeTab === 'scheduler' ? `1px solid ${colors.primary}` : '1px solid transparent',
                        textTransform: 'none',
                        fontWeight: 600,
                    }}
                >
                    Scheduled Jobs
                </Button>
                <Button
                    startIcon={<NotificationsIcon />}
                    onClick={() => setActiveTab('notifications')}
                    sx={{
                        px: 3,
                        py: 1,
                        borderRadius: '12px',
                        background: activeTab === 'notifications' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.03)',
                        color: activeTab === 'notifications' ? colors.primary : colors.text.secondary,
                        border: activeTab === 'notifications' ? `1px solid ${colors.primary}` : '1px solid transparent',
                        textTransform: 'none',
                        fontWeight: 600,
                    }}
                >
                    Notifications
                </Button>
                {isAdmin() && (
                    <Button
                        startIcon={<PeopleIcon />}
                        onClick={() => setActiveTab('users')}
                        sx={{
                            px: 3,
                            py: 1,
                            borderRadius: '12px',
                            background: activeTab === 'users' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.03)',
                            color: activeTab === 'users' ? colors.primary : colors.text.secondary,
                            border: activeTab === 'users' ? `1px solid ${colors.primary}` : '1px solid transparent',
                            textTransform: 'none',
                            fontWeight: 600,
                        }}
                    >
                        Users
                    </Button>
                )}
            </Box>

            {/* Scheduler Tab */}
            {activeTab === 'scheduler' && (
                <Box>
                    {/* Cron Explanation - Always Visible */}
                    <Card sx={{ background: 'rgba(255, 170, 0, 0.05)', border: `1px solid rgba(255, 170, 0, 0.2)`, borderRadius: '12px', mb: 3 }}>
                        <CardContent sx={{ py: 2 }}>
                            <Typography sx={{ color: colors.warning, fontWeight: 600, fontSize: '1rem', mb: 2 }}>
                                📅 Understanding Cron Expressions
                            </Typography>
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mb: 2 }}>
                                A cron expression has 6 fields that define when a job runs. Read left to right:
                            </Typography>
                            
                            {/* Visual Field Breakdown */}
                            <Box sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(6, 1fr)', 
                                gap: 1.5, 
                                mb: 2
                            }}>
                                <Box sx={{ background: 'rgba(249, 115, 22, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                    <Typography sx={{ color: colors.primary, fontSize: '0.8rem', fontWeight: 700 }}>1. SECOND</Typography>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>0-59</Typography>
                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                        Which second
                                    </Typography>
                                </Box>
                                <Box sx={{ background: 'rgba(34, 197, 94, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                    <Typography sx={{ color: colors.secondary, fontSize: '0.8rem', fontWeight: 700 }}>2. MINUTE</Typography>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>0-59</Typography>
                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                        Which minute
                                    </Typography>
                                </Box>
                                <Box sx={{ background: 'rgba(255, 170, 0, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                    <Typography sx={{ color: colors.warning, fontSize: '0.8rem', fontWeight: 700 }}>3. HOUR</Typography>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>0-23</Typography>
                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                        24h format
                                    </Typography>
                                </Box>
                                <Box sx={{ background: 'rgba(255, 68, 102, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                    <Typography sx={{ color: colors.error, fontSize: '0.8rem', fontWeight: 700 }}>4. DAY</Typography>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>1-31</Typography>
                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                        Day of month
                                    </Typography>
                                </Box>
                                <Box sx={{ background: 'rgba(136, 68, 255, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                    <Typography sx={{ color: '#8844ff', fontSize: '0.8rem', fontWeight: 700 }}>5. MONTH</Typography>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>1-12</Typography>
                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                        Which month
                                    </Typography>
                                </Box>
                                <Box sx={{ background: 'rgba(0, 170, 255, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                    <Typography sx={{ color: '#00aaff', fontSize: '0.8rem', fontWeight: 700 }}>6. WEEKDAY</Typography>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>0-6</Typography>
                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                        Sun=0, Sat=6
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Special Characters & Examples */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <Box>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem', fontWeight: 600, mb: 1 }}>
                                        Special Characters:
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                            <strong style={{ color: colors.primary }}>*</strong> = any value (every)
                                        </Typography>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                            <strong style={{ color: colors.primary }}>*/5</strong> = every 5 units
                                        </Typography>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                            <strong style={{ color: colors.primary }}>1-5</strong> = range (1 through 5)
                                        </Typography>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                            <strong style={{ color: colors.primary }}>1,15</strong> = specific values
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem', fontWeight: 600, mb: 1 }}>
                                        Examples:
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                            <code style={{ color: colors.primary }}>0 0 9 * * *</code> = Daily at 9am
                                        </Typography>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                            <code style={{ color: colors.primary }}>0 */30 * * * *</code> = Every 30 min
                                        </Typography>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                            <code style={{ color: colors.primary }}>0 0 9 * * 1-5</code> = Weekdays 9am
                                        </Typography>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                            <code style={{ color: colors.primary }}>0 0 0 1 * *</code> = 1st of month
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>
                            Scheduled Jobs ({jobs.length})
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton onClick={loadJobs} sx={{ color: colors.text.secondary }}>
                                <RefreshIcon />
                            </IconButton>
                            {canEditScheduler && (
                                <Button
                                    startIcon={<AddIcon />}
                                    onClick={openNewJobDialog}
                                    sx={{
                                        background: gradients.primary,
                                        color: '#0a0a0f',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        borderRadius: '10px',
                                    }}
                                >
                                    New Job
                                </Button>
                            )}
                        </Box>
                    </Box>

                    {jobs.length === 0 ? (
                        <Card sx={{ 
                            background: colors.background.glass, 
                            border: `1px solid ${colors.border.light}`,
                            borderRadius: '16px',
                            textAlign: 'center',
                            py: 6,
                        }}>
                            <ScheduleIcon sx={{ fontSize: 48, color: colors.text.disabled, mb: 2 }} />
                            <Typography sx={{ color: colors.text.muted }}>No scheduled jobs yet</Typography>
                            <Typography sx={{ color: colors.text.disabled, fontSize: '0.85rem' }}>
                                Create a job to run scripts automatically
                            </Typography>
                        </Card>
                    ) : (
                        jobs.map(job => (
                            <Card key={job.id} sx={{ 
                                background: colors.background.glass, 
                                border: `1px solid ${colors.border.light}`,
                                borderRadius: '12px',
                                mb: 2,
                                opacity: job.enabled ? 1 : 0.6,
                            }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>
                                                    {job.name}
                                                </Typography>
                                                <Chip 
                                                    label={job.enabled ? 'Active' : 'Paused'} 
                                                    size="small"
                                                    sx={{
                                                        background: job.enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)',
                                                        color: job.enabled ? colors.secondary : colors.text.disabled,
                                                        height: 20,
                                                        fontSize: '0.7rem',
                                                    }}
                                                />
                                            </Box>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mb: 1 }}>
                                                {job.description || job.script_path}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem' }}>
                                                    <strong>Cron:</strong> {job.cron_expr}
                                                </Typography>
                                                <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem' }}>
                                                    <strong>Machines:</strong> {job.machine_ids?.length || 0}
                                                </Typography>
                                                {job.last_run && (
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem' }}>
                                                        <strong>Last run:</strong> {new Date(job.last_run).toLocaleString()}
                                                    </Typography>
                                                )}
                                                {job.next_run && (
                                                    <Typography sx={{ color: colors.primary, fontSize: '0.8rem' }}>
                                                        <strong>Next:</strong> {new Date(job.next_run).toLocaleString()}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            {canEditScheduler && (
                                                <Tooltip title="Run now">
                                                    <IconButton size="small" onClick={() => handleRunJob(job.id)} sx={{ color: colors.secondary }}>
                                                        <PlayArrowIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {canEditScheduler && (
                                                <Tooltip title={job.enabled ? 'Pause' : 'Resume'}>
                                                    <IconButton size="small" onClick={() => handleToggleJob(job.id)} sx={{ color: colors.warning }}>
                                                        {job.enabled ? <PauseIcon /> : <PlayArrowIcon />}
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {canEditScheduler && (
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => handleEditJob(job)} sx={{ color: colors.text.secondary }}>
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {canEditScheduler && (
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" onClick={() => handleDeleteJob(job.id)} sx={{ color: colors.error }}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </Box>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <Card sx={{ 
                    background: colors.background.glass, 
                    border: `1px solid ${colors.border.light}`,
                    borderRadius: '16px',
                }}>
                    <CardContent>
                        <Typography sx={{ color: colors.text.primary, fontWeight: 600, mb: 3 }}>
                            Notification Settings
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <FormControlLabel
                                control={
                                    <Switch 
                                        checked={notifConfig.enabled} 
                                        onChange={(e) => setNotifConfig({ ...notifConfig, enabled: e.target.checked })}
                                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary } }}
                                    />
                                }
                                label="Enable notifications"
                                sx={{ color: colors.text.primary }}
                            />

                            <TextField
                                label="Slack Webhook URL"
                                value={notifConfig.slack_webhook || ''}
                                onChange={(e) => setNotifConfig({ ...notifConfig, slack_webhook: e.target.value })}
                                placeholder="https://hooks.slack.com/services/..."
                                fullWidth
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        background: 'rgba(0,0,0,0.2)',
                                        borderRadius: '12px',
                                    }
                                }}
                            />

                            <Box>
                                <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mb: 1 }}>
                                    Send notifications on:
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <FormControlLabel
                                        control={
                                            <Switch 
                                                checked={notifConfig.on_success} 
                                                onChange={(e) => setNotifConfig({ ...notifConfig, on_success: e.target.checked })}
                                                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: colors.secondary } }}
                                            />
                                        }
                                        label="Success"
                                        sx={{ color: colors.text.secondary }}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch 
                                                checked={notifConfig.on_failure} 
                                                onChange={(e) => setNotifConfig({ ...notifConfig, on_failure: e.target.checked })}
                                                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: colors.error } }}
                                            />
                                        }
                                        label="Failure"
                                        sx={{ color: colors.text.secondary }}
                                    />
                                </Box>
                            </Box>

                            <Button
                                startIcon={<SaveIcon />}
                                onClick={handleSaveNotifConfig}
                                sx={{
                                    background: gradients.primary,
                                    color: '#0a0a0f',
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    borderRadius: '10px',
                                    alignSelf: 'flex-start',
                                    px: 3,
                                }}
                            >
                                Save Settings
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && isAdmin() && (
                <UserManagement />
            )}

            {/* Job Dialog - Wizard Style */}
            <Dialog 
                open={jobDialog} 
                onClose={() => setJobDialog(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        background: colors.background.card,
                        borderRadius: '16px',
                        border: `1px solid ${colors.border.light}`,
                        minHeight: '70vh',
                    }
                }}
            >
                <DialogTitle sx={{ color: colors.text.primary, borderBottom: `1px solid ${colors.border.light}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.3rem' }}>
                            {editingJob ? 'Edit Scheduled Job' : 'Create Scheduled Job'}
                        </Typography>
                        {!editingJob && (
                            <Stepper activeStep={wizardStep} sx={{ flex: 1, ml: 4 }}>
                                {wizardSteps.map((label) => (
                                    <Step key={label}>
                                        <StepLabel sx={{ '& .MuiStepLabel-label': { color: colors.text.secondary } }}>
                                            {label}
                                        </StepLabel>
                                    </Step>
                                ))}
                            </Stepper>
                        )}
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 3 }}>
                    {/* Step 0: Select Script */}
                    {wizardStep === 0 && (
                        <Box>
                            <Typography sx={{ color: colors.text.primary, fontWeight: 600, mb: 1 }}>
                                Which script do you want to schedule?
                            </Typography>
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mb: 3 }}>
                                Click on a script to select it
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                {scripts.map(script => (
                                    <Card 
                                        key={script.path}
                                        onClick={() => handleScriptSelect(script)}
                                        sx={{ 
                                            background: selectedScript?.path === script.path ? 'rgba(249, 115, 22, 0.15)' : colors.background.glass,
                                            border: selectedScript?.path === script.path ? `2px solid ${colors.primary}` : `1px solid ${colors.border.light}`,
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            '&:hover': { borderColor: colors.primary, transform: 'translateY(-2px)' }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Radio checked={selectedScript?.path === script.path} sx={{ p: 0 }} />
                                                <CodeIcon sx={{ color: colors.primary }} />
                                                <Box>
                                                    <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>
                                                        {script.name}
                                                    </Typography>
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>
                                                        {script.description?.substring(0, 60) || script.path}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Box>
                        </Box>
                    )}

                    {/* Step 1: Configure Options (Presets) */}
                    {wizardStep === 1 && selectedScript && (
                        <Box>
                            <Typography sx={{ color: colors.text.primary, fontWeight: 600, mb: 1 }}>
                                Configure {selectedScript.name}
                            </Typography>
                            
                            {scriptPresets?.presets?.length > 0 && !advancedMode ? (
                                <>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mb: 3 }}>
                                        Select a preset configuration or use advanced mode for custom flags
                                    </Typography>
                                    <RadioGroup value={selectedPreset?.id || ''}>
                                        {scriptPresets.presets.map(preset => (
                                            <Card 
                                                key={preset.id}
                                                onClick={() => handlePresetSelect(preset)}
                                                sx={{ 
                                                    mb: 2,
                                                    background: selectedPreset?.id === preset.id ? 'rgba(249, 115, 22, 0.15)' : colors.background.glass,
                                                    border: selectedPreset?.id === preset.id ? `2px solid ${colors.primary}` : `1px solid ${colors.border.light}`,
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    '&:hover': { borderColor: colors.primary }
                                                }}
                                            >
                                                <CardContent sx={{ py: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <Radio checked={selectedPreset?.id === preset.id} sx={{ mr: 2 }} />
                                                        <Box sx={{ flex: 1 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '1.1rem' }}>
                                                                    {preset.name}
                                                                </Typography>
                                                                {preset.recommended && (
                                                                    <Chip label="Recommended" size="small" icon={<StarIcon />} 
                                                                        sx={{ background: 'rgba(255, 170, 0, 0.2)', color: colors.warning, height: 22 }} />
                                                                )}
                                                            </Box>
                                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mt: 0.5 }}>
                                                                {preset.description}
                                                            </Typography>
                                                            {preset.flags && (
                                                                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                                                                    {preset.flags.map((flag, i) => (
                                                                        <Chip key={i} label={flag} size="small" 
                                                                            sx={{ height: 20, fontSize: '0.7rem', background: 'rgba(0,0,0,0.3)' }} />
                                                                    ))}
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </RadioGroup>
                                    <Button 
                                        startIcon={<SettingsIcon />}
                                        onClick={() => setAdvancedMode(true)}
                                        sx={{ color: colors.text.secondary, textTransform: 'none', mt: 1 }}
                                    >
                                        Advanced: Configure flags manually
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {scriptPresets?.presets?.length > 0 && (
                                        <Button 
                                            startIcon={<ArrowBackIcon />}
                                            onClick={() => setAdvancedMode(false)}
                                            sx={{ color: colors.text.secondary, textTransform: 'none', mb: 2 }}
                                        >
                                            Back to presets
                                        </Button>
                                    )}
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mb: 2 }}>
                                        Configure individual flags for this script
                                    </Typography>
                                    {selectedScript.flags?.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {selectedScript.flags.map(flag => (
                                                <Card key={flag.long} sx={{ 
                                                    background: flagValues[flag.long]?.enabled ? 'rgba(249, 115, 22, 0.1)' : colors.background.glass,
                                                    border: `1px solid ${flagValues[flag.long]?.enabled ? colors.primary : colors.border.light}`,
                                                    borderRadius: '10px',
                                                }}>
                                                    <CardContent sx={{ py: 1.5, px: 2 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <Checkbox 
                                                                checked={flagValues[flag.long]?.enabled || false}
                                                                onChange={() => handleFlagToggle(flag.long)}
                                                            />
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography sx={{ color: colors.text.primary, fontWeight: 500, fontFamily: 'monospace' }}>
                                                                    {flag.long}
                                                                </Typography>
                                                                <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem' }}>
                                                                    {flag.description}
                                                                </Typography>
                                                            </Box>
                                                            {flag.takes_value && flagValues[flag.long]?.enabled && (
                                                                <TextField
                                                                    size="small"
                                                                    placeholder="Value"
                                                                    value={flagValues[flag.long]?.value || ''}
                                                                    onChange={(e) => handleFlagValueChange(flag.long, e.target.value)}
                                                                    sx={{ width: 150, '& .MuiOutlinedInput-root': { background: 'rgba(0,0,0,0.2)' } }}
                                                                />
                                                            )}
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Alert severity="info">This script has no configurable flags</Alert>
                                    )}
                                </>
                            )}
                        </Box>
                    )}

                    {/* Step 2: Select Machines */}
                    {wizardStep === 2 && (
                        <Box>
                            <Typography sx={{ color: colors.text.primary, fontWeight: 600, mb: 1 }}>
                                Which machines should run this job?
                            </Typography>
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mb: 3 }}>
                                Select one or more machines. Selected: {jobForm.machine_ids.length}
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 2 }}>
                                {machines.map(machine => {
                                    const isSelected = jobForm.machine_ids.includes(machine.id)
                                    return (
                                        <Card 
                                            key={machine.id}
                                            onClick={() => {
                                                setJobForm(prev => ({
                                                    ...prev,
                                                    machine_ids: isSelected 
                                                        ? prev.machine_ids.filter(id => id !== machine.id)
                                                        : [...prev.machine_ids, machine.id]
                                                }))
                                            }}
                                            sx={{ 
                                                background: isSelected ? 'rgba(249, 115, 22, 0.15)' : colors.background.glass,
                                                border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.border.light}`,
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                '&:hover': { borderColor: colors.primary }
                                            }}
                                        >
                                            <CardContent sx={{ p: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Checkbox checked={isSelected} sx={{ p: 0 }} />
                                                    <ComputerIcon sx={{ color: machine.status === 'online' ? colors.secondary : colors.text.disabled }} />
                                                    <Box>
                                                        <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>
                                                            {machine.name}
                                                        </Typography>
                                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                                            {machine.ip}
                                                        </Typography>
                                                    </Box>
                                                    <Chip 
                                                        label={machine.status === 'online' ? 'Online' : 'Offline'} 
                                                        size="small"
                                                        sx={{ 
                                                            ml: 'auto',
                                                            height: 20,
                                                            background: machine.status === 'online' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)',
                                                            color: machine.status === 'online' ? colors.secondary : colors.text.disabled,
                                                        }}
                                                    />
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </Box>
                        </Box>
                    )}

                    {/* Step 3: Schedule */}
                    {wizardStep === 3 && (
                        <Box>
                            <Typography sx={{ color: colors.text.primary, fontWeight: 600, mb: 1 }}>
                                Set the schedule
                            </Typography>
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mb: 3 }}>
                                Configure when this job should run automatically
                            </Typography>
                            
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <TextField
                                    label="Job Name"
                                    value={jobForm.name}
                                    onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })}
                                    fullWidth
                                    sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(0,0,0,0.2)', borderRadius: '12px' } }}
                                />
                                
                                <Box>
                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mb: 2 }}>
                                        Choose how often this job should run:
                                    </Typography>
                                    
                                    {/* Visual Schedule Presets */}
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5, mb: 3 }}>
                                        {cronPresets.map(preset => (
                                            <Card
                                                key={preset.value}
                                                onClick={() => setJobForm({ ...jobForm, cron_expr: preset.value })}
                                                sx={{
                                                    background: jobForm.cron_expr === preset.value ? 'rgba(249, 115, 22, 0.15)' : colors.background.glass,
                                                    border: jobForm.cron_expr === preset.value ? `2px solid ${colors.primary}` : `1px solid ${colors.border.light}`,
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    '&:hover': { borderColor: colors.primary, transform: 'translateY(-1px)' }
                                                }}
                                            >
                                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Radio checked={jobForm.cron_expr === preset.value} size="small" sx={{ p: 0 }} />
                                                        <Box>
                                                            <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.9rem' }}>
                                                                {preset.label}
                                                            </Typography>
                                                            <Typography sx={{ color: colors.text.disabled, fontSize: '0.7rem' }}>
                                                                {preset.description}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Box>

                                    {/* Cron Expression Explanation */}
                                    <Card sx={{ background: 'rgba(255, 170, 0, 0.05)', border: `1px solid rgba(255, 170, 0, 0.2)`, borderRadius: '12px', mb: 2 }}>
                                        <CardContent sx={{ py: 2 }}>
                                            <Typography sx={{ color: colors.warning, fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
                                                📅 Understanding Cron Expressions
                                            </Typography>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem', mb: 2 }}>
                                                A cron expression has 6 fields that define when the job runs. Read left to right:
                                            </Typography>
                                            
                                            {/* Visual Field Breakdown */}
                                            <Box sx={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: 'repeat(6, 1fr)', 
                                                gap: 1.5, 
                                                mb: 2
                                            }}>
                                                <Box sx={{ background: 'rgba(249, 115, 22, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                                    <Typography sx={{ color: colors.primary, fontSize: '0.8rem', fontWeight: 700 }}>1. SECOND</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>0-59</Typography>
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                                        Which second of the minute
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ background: 'rgba(34, 197, 94, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                                    <Typography sx={{ color: colors.secondary, fontSize: '0.8rem', fontWeight: 700 }}>2. MINUTE</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>0-59</Typography>
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                                        Which minute of the hour
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ background: 'rgba(255, 170, 0, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                                    <Typography sx={{ color: colors.warning, fontSize: '0.8rem', fontWeight: 700 }}>3. HOUR</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>0-23</Typography>
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                                        Which hour (24h format)
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ background: 'rgba(255, 68, 102, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                                    <Typography sx={{ color: colors.error, fontSize: '0.8rem', fontWeight: 700 }}>4. DAY</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>1-31</Typography>
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                                        Day of the month
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ background: 'rgba(136, 68, 255, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                                    <Typography sx={{ color: '#8844ff', fontSize: '0.8rem', fontWeight: 700 }}>5. MONTH</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>1-12</Typography>
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                                        Which month
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ background: 'rgba(0, 170, 255, 0.1)', p: 1.5, borderRadius: '8px', textAlign: 'center' }}>
                                                    <Typography sx={{ color: '#00aaff', fontSize: '0.8rem', fontWeight: 700 }}>6. WEEKDAY</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem', mt: 0.5 }}>0-6</Typography>
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.65rem', mt: 0.5 }}>
                                                        0=Sun, 1=Mon...6=Sat
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            {/* Special Characters */}
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem', fontWeight: 600, mb: 1 }}>
                                                Special Characters:
                                            </Typography>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Chip label="*" size="small" sx={{ fontFamily: 'monospace', fontWeight: 700, background: 'rgba(0,0,0,0.3)' }} />
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>Any value (every)</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Chip label="*/5" size="small" sx={{ fontFamily: 'monospace', fontWeight: 700, background: 'rgba(0,0,0,0.3)' }} />
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>Every 5 units</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Chip label="1-5" size="small" sx={{ fontFamily: 'monospace', fontWeight: 700, background: 'rgba(0,0,0,0.3)' }} />
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>Range (1 through 5)</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Chip label="1,15" size="small" sx={{ fontFamily: 'monospace', fontWeight: 700, background: 'rgba(0,0,0,0.3)' }} />
                                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.75rem' }}>Specific values (1 and 15)</Typography>
                                                </Box>
                                            </Box>

                                            {/* Examples */}
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem', fontWeight: 600, mt: 2, mb: 1 }}>
                                                Examples:
                                            </Typography>
                                            <Box sx={{ background: 'rgba(0,0,0,0.2)', p: 1.5, borderRadius: '8px' }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                    <Typography sx={{ color: colors.primary, fontSize: '0.75rem', fontFamily: 'monospace' }}>0 0 9 * * *</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.75rem' }}>Every day at 9:00 AM</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                    <Typography sx={{ color: colors.primary, fontSize: '0.75rem', fontFamily: 'monospace' }}>0 */30 * * * *</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.75rem' }}>Every 30 minutes</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography sx={{ color: colors.primary, fontSize: '0.75rem', fontFamily: 'monospace' }}>0 0 9 * * 1-5</Typography>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.75rem' }}>Weekdays at 9:00 AM</Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>

                                    <TextField
                                        label="Custom Cron Expression"
                                        value={jobForm.cron_expr}
                                        onChange={(e) => setJobForm({ ...jobForm, cron_expr: e.target.value })}
                                        fullWidth
                                        placeholder="0 0 9 * * *"
                                        helperText={`Current: ${jobForm.cron_expr}`}
                                        sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(0,0,0,0.2)', borderRadius: '12px' } }}
                                    />
                                </Box>

                                <FormControlLabel
                                    control={
                                        <Switch 
                                            checked={jobForm.enabled} 
                                            onChange={(e) => setJobForm({ ...jobForm, enabled: e.target.checked })}
                                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: colors.secondary } }}
                                        />
                                    }
                                    label="Enable job immediately"
                                    sx={{ color: colors.text.primary }}
                                />

                                {/* Summary */}
                                <Card sx={{ background: 'rgba(249, 115, 22, 0.05)', border: `1px solid ${colors.border.light}`, borderRadius: '12px' }}>
                                    <CardContent>
                                        <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mb: 1 }}>Summary</Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            <Typography sx={{ color: colors.text.primary, fontSize: '0.9rem' }}>
                                                <strong>Script:</strong> {selectedScript?.name || jobForm.script_path}
                                            </Typography>
                                            {selectedPreset && (
                                                <Typography sx={{ color: colors.text.primary, fontSize: '0.9rem' }}>
                                                    <strong>Preset:</strong> {selectedPreset.name}
                                                </Typography>
                                            )}
                                            <Typography sx={{ color: colors.text.primary, fontSize: '0.9rem' }}>
                                                <strong>Machines:</strong> {jobForm.machine_ids.length} selected
                                            </Typography>
                                            <Typography sx={{ color: colors.text.primary, fontSize: '0.9rem' }}>
                                                <strong>Args:</strong> {buildCommandArgs() || jobForm.args || '(none)'}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: `1px solid ${colors.border.light}`, justifyContent: 'space-between' }}>
                    <Box>
                        {wizardStep > 0 && !editingJob && (
                            <Button 
                                startIcon={<ArrowBackIcon />}
                                onClick={() => setWizardStep(prev => prev - 1)} 
                                sx={{ color: colors.text.secondary }}
                            >
                                Back
                            </Button>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button onClick={() => setJobDialog(false)} sx={{ color: colors.text.secondary }}>
                            Cancel
                        </Button>
                        {wizardStep < 3 && !editingJob ? (
                            <Button 
                                endIcon={<ArrowForwardIcon />}
                                onClick={() => setWizardStep(prev => prev + 1)}
                                disabled={!canProceedWizard()}
                                sx={{
                                    background: canProceedWizard() ? gradients.primary : 'rgba(255,255,255,0.1)',
                                    color: canProceedWizard() ? '#0a0a0f' : colors.text.disabled,
                                    fontWeight: 600,
                                    borderRadius: '10px',
                                }}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button 
                                startIcon={<CheckCircleIcon />}
                                onClick={handleSaveJob}
                                disabled={!canProceedWizard()}
                                sx={{
                                    background: canProceedWizard() ? gradients.primary : 'rgba(255,255,255,0.1)',
                                    color: canProceedWizard() ? '#0a0a0f' : colors.text.disabled,
                                    fontWeight: 600,
                                    borderRadius: '10px',
                                }}
                            >
                                {editingJob ? 'Update Job' : 'Create Job'}
                            </Button>
                        )}
                    </Box>
                </DialogActions>
            </Dialog>

            {/* Toast */}
            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default Settings
