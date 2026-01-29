import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import List from '@mui/material/List'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Switch from '@mui/material/Switch'
import Collapse from '@mui/material/Collapse'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'

import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import ComputerIcon from '@mui/icons-material/Computer'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import WarningIcon from '@mui/icons-material/Warning'
import SettingsIcon from '@mui/icons-material/Settings'
import StarIcon from '@mui/icons-material/Star'
import PreviewIcon from '@mui/icons-material/Preview'
import CodeIcon from '@mui/icons-material/Code'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

import { getPresetsForScript, presetToFlagValues } from './presets'
import ExecutionStream from './ExecutionStream'

const ScriptWizard = () => {
    const { scriptPath } = useParams()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const decodedPath = decodeURIComponent(scriptPath || '')
    
    // Get pre-selected machines from URL query params
    const preSelectedMachineIds = searchParams.get('machines')?.split(',').filter(Boolean) || []
    // Get execId for reconnection to running script
    const reconnectExecId = searchParams.get('execId')
    
    const [script, setScript] = useState(null)
    const [machines, setMachines] = useState([])
    const [selectedMachines, setSelectedMachines] = useState([])
    const [flagValues, setFlagValues] = useState({})
    const [activeStep, setActiveStep] = useState(0)
    const [executing, setExecuting] = useState(false)
    const [executionResults, setExecutionResults] = useState(null)
    const [execId, setExecId] = useState(null)
    const [streamingExecutions, setStreamingExecutions] = useState([])
    const [loading, setLoading] = useState(true)
    
    // Preset mode state
    const [scriptPresets, setScriptPresets] = useState(null)
    const [selectedPreset, setSelectedPreset] = useState(null)
    const [advancedMode, setAdvancedMode] = useState(false)
    const [presetInputs, setPresetInputs] = useState({})
    const [showDryRun, setShowDryRun] = useState(false)
    const [copiedCommand, setCopiedCommand] = useState(false)

    useEffect(() => {
        fetchScript()
        fetchMachines()
    }, [decodedPath])

    // Handle reconnection to running execution
    useEffect(() => {
        if (reconnectExecId && machines.length > 0) {
            reconnectToExecution(reconnectExecId)
        }
    }, [reconnectExecId, machines])

    const reconnectToExecution = async (execIdToReconnect) => {
        try {
            const res = await fetch(`/api/script-executions/${execIdToReconnect}`)
            if (!res.ok) return
            const data = await res.json()
            
            if (data.status === 'running') {
                setExecuting(true)
                setExecId(execIdToReconnect)
                setExecutionResults(data)
                setActiveStep(2) // Go to execution step
                
                // Set selected machines from the execution
                if (data.machine_ids) {
                    setSelectedMachines(data.machine_ids)
                }
                
                // Create streaming execution entries for each machine
                const executions = (data.machine_ids || []).map(machineId => {
                    const machine = machines.find(m => m.id === machineId)
                    return {
                        execId: execIdToReconnect,
                        machineId: machineId,
                        machineName: machine?.name || machineId
                    }
                })
                setStreamingExecutions(executions)
                
                // Poll for final status
                const pollExecution = async () => {
                    const statusRes = await fetch(`/api/script-executions/${execIdToReconnect}`)
                    const statusData = await statusRes.json()
                    setExecutionResults(statusData)
                    
                    if (statusData.status === 'running') {
                        setTimeout(pollExecution, 2000)
                    } else {
                        setExecuting(false)
                    }
                }
                setTimeout(pollExecution, 2000)
            }
        } catch (err) {
            console.error('Failed to reconnect to execution:', err)
        }
    }

    const fetchScript = async () => {
        try {
            const res = await fetch('/api/scripts')
            const scripts = await res.json()
            const found = scripts.find(s => s.path === decodedPath)
            if (found) {
                setScript(found)
                // Initialize flag values
                const initialFlags = {}
                found.flags?.forEach(flag => {
                    initialFlags[flag.long] = {
                        enabled: false,
                        value: ''
                    }
                })
                setFlagValues(initialFlags)
                
                // Load presets for this script
                const presets = getPresetsForScript(found.path)
                setScriptPresets(presets)
                
                // Auto-select recommended preset if available
                const recommended = presets.presets?.find(p => p.recommended)
                if (recommended) {
                    setSelectedPreset(recommended)
                    setFlagValues(presetToFlagValues(recommended, found.flags))
                }
            }
        } catch (err) {
            console.error('Failed to fetch script:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchMachines = async () => {
        try {
            const res = await fetch('/api/machines')
            const data = await res.json()
            setMachines(data || [])
            
            // Auto-select machines from URL params if provided
            if (preSelectedMachineIds.length > 0 && data) {
                const validIds = preSelectedMachineIds.filter(id => 
                    data.some(m => m.id === id)
                )
                if (validIds.length > 0) {
                    setSelectedMachines(validIds)
                    // Skip to step 1 (Configure Options) if machines are pre-selected
                    setActiveStep(1)
                }
            }
        } catch (err) {
            console.error('Failed to fetch machines:', err)
        }
    }

    const handleMachineToggle = (machineId) => {
        setSelectedMachines(prev => 
            prev.includes(machineId) 
                ? prev.filter(id => id !== machineId)
                : [...prev, machineId]
        )
    }

    const handleFlagToggle = (flagLong) => {
        setSelectedPreset(null) // Clear preset when manually changing flags
        setFlagValues(prev => ({
            ...prev,
            [flagLong]: {
                ...prev[flagLong],
                enabled: !prev[flagLong]?.enabled
            }
        }))
    }
    
    const handlePresetSelect = (preset) => {
        setSelectedPreset(preset)
        // No inputs needed for standalone agent
        setPresetInputs({})
        // For scripts using args (positional arguments), don't update flagValues
        if (!scriptPresets?.useArgs) {
            setFlagValues(presetToFlagValues(preset, script?.flags))
        }
    }

    const handlePresetInputChange = (flag, value) => {
        setPresetInputs(prev => ({
            ...prev,
            [flag]: value
        }))
    }

    const handleFlagValueChange = (flagLong, value) => {
        setFlagValues(prev => ({
            ...prev,
            [flagLong]: {
                ...prev[flagLong],
                value: value
            }
        }))
    }

    const buildCommandArgs = () => {
        // If using args-based preset, return the preset's args directly
        if (scriptPresets?.useArgs && selectedPreset?.args) {
            return selectedPreset.args
        }
        // Otherwise build from flags
        const args = []
        Object.entries(flagValues).forEach(([flagLong, config]) => {
            if (config.enabled) {
                if (config.value) {
                    args.push(`${flagLong}=${config.value}`)
                } else {
                    args.push(flagLong)
                }
            }
        })
        return args.join(' ')
    }

    // Generate dry-run preview command
    const getDryRunCommand = () => {
        const args = buildCommandArgs()
        const scriptName = script?.path || 'script.sh'
        return `${scriptName}${args ? ' ' + args : ''}`
    }

    const copyCommand = () => {
        navigator.clipboard.writeText(getDryRunCommand())
        setCopiedCommand(true)
        setTimeout(() => setCopiedCommand(false), 2000)
    }

    const handleExecute = async () => {
        setExecuting(true)
        setExecutionResults(null)
        setExecId(null)
        setStreamingExecutions([])
        
        try {
            const args = buildCommandArgs()
            const res = await fetch('/api/execute-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script_path: script.path,
                    machine_ids: selectedMachines,
                    args: args
                })
            })
            const data = await res.json()
            setExecutionResults(data)
            
            // Set up streaming for real-time output
            if (data.id) {
                setExecId(data.id)
                // Create streaming execution entries for each machine
                const executions = selectedMachines.map(machineId => {
                    const machine = machines.find(m => m.id === machineId)
                    return {
                        execId: data.id,
                        machineId: machineId,
                        machineName: machine?.name || machineId
                    }
                })
                setStreamingExecutions(executions)
                
                // Also poll for final status
                const pollExecution = async () => {
                    const statusRes = await fetch(`/api/script-executions/${data.id}`)
                    const statusData = await statusRes.json()
                    setExecutionResults(statusData)
                    
                    if (statusData.status === 'running') {
                        setTimeout(pollExecution, 2000)
                    } else {
                        setExecuting(false)
                    }
                }
                setTimeout(pollExecution, 2000)
            } else {
                setExecuting(false)
            }
        } catch (err) {
            console.error('Execution failed:', err)
            setExecutionResults({ error: err.message })
            setExecuting(false)
        }
    }
    
    const handleStreamComplete = () => {
        // Stream completed for a machine
    }

    const handleCancelExecution = async () => {
        if (!execId) return
        try {
            const res = await fetch(`/api/script-executions/${execId}/cancel`, {
                method: 'POST'
            })
            const data = await res.json()
            if (data.success) {
                setExecutionResults(prev => ({ ...prev, status: 'cancelled' }))
                setExecuting(false)
            }
        } catch (err) {
            console.error('Failed to cancel execution:', err)
        }
    }

    // Fixed 3-step wizard
    const steps = ['Select Machines', 'Configure Options', 'Review & Execute']

    const handleNext = () => setActiveStep(prev => prev + 1)
    const handleBack = () => setActiveStep(prev => prev - 1)

    const canProceed = () => {
        switch (activeStep) {
            case 0:
                return selectedMachines.length > 0
            default:
                return true
        }
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <CircularProgress />
            </Box>
        )
    }

    if (!script) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">Script not found: {decodedPath}</Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/scripts')} sx={{ mt: 2 }}>
                    Back to Scripts
                </Button>
            </Box>
        )
    }

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Alert severity="info" icon={<LightbulbIcon />} sx={{ mb: 3 }}>
                            <Typography variant="subtitle2">Step 1 of 3: Pick Your Computers</Typography>
                            <Typography variant="body2">
                                Click on the computers below where you want to run this script. 
                                You can select multiple computers to run the same script on all of them at once.
                            </Typography>
                        </Alert>

                        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ComputerIcon color="primary" />
                            Which computers do you want to use?
                        </Typography>
                        
                        {machines.length === 0 ? (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                <Typography variant="subtitle2">No computers set up yet!</Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    You need to add at least one computer before you can run scripts.
                                </Typography>
                                <Button variant="contained" size="small" onClick={() => navigate('/machines')}>
                                    Add a Computer Now
                                </Button>
                            </Alert>
                        ) : (
                            <>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {selectedMachines.length === 0 
                                        ? '👆 Click on a computer to select it' 
                                        : `✅ ${selectedMachines.length} computer${selectedMachines.length > 1 ? 's' : ''} selected`}
                                </Typography>
                                
                                {/* Offline machine warning */}
                                {selectedMachines.some(id => machines.find(m => m.id === id)?.status !== 'online') && (
                                    <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2">⚠️ Some selected machines are offline</Typography>
                                        <Typography variant="body2">
                                            Scripts may fail on offline machines. Consider testing connections first.
                                        </Typography>
                                    </Alert>
                                )}
                                
                                <List>
                                    {machines.map((machine) => (
                                        <Card 
                                            key={machine.id}
                                            sx={{ 
                                                mb: 1.5,
                                                border: 2, 
                                                borderColor: selectedMachines.includes(machine.id) ? 'primary.main' : 'transparent', 
                                                bgcolor: selectedMachines.includes(machine.id) ? 'primary.dark' : 'background.paper',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    borderColor: 'primary.light',
                                                    transform: 'scale(1.01)'
                                                }
                                            }}
                                            onClick={() => handleMachineToggle(machine.id)}
                                        >
                                            <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                                                <Checkbox 
                                                    checked={selectedMachines.includes(machine.id)} 
                                                    sx={{ mr: 1 }}
                                                />
                                                <ComputerIcon 
                                                    sx={{ mr: 2, fontSize: 40 }} 
                                                    color={machine.status === 'online' ? 'success' : 'disabled'} 
                                                />
                                                <Box sx={{ flexGrow: 1 }}>
                                                    <Typography variant="h6">
                                                        {machine.name || machine.ip}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        IP: {machine.ip} • User: {machine.username}
                                                    </Typography>
                                                </Box>
                                                <Chip 
                                                    label={machine.status === 'online' ? '🟢 Online' : '🔴 Offline'} 
                                                    size="medium"
                                                    color={machine.status === 'online' ? 'success' : 'error'}
                                                    variant="outlined"
                                                />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </List>
                            </>
                        )}
                    </Box>
                )

            case 1:
                const enabledCount = Object.values(flagValues).filter(f => f.enabled).length
                const hasPresets = scriptPresets?.presets?.length > 0
                
                return (
                    <Box>
                        <Alert severity="info" icon={<LightbulbIcon />} sx={{ mb: 3 }}>
                            <Typography variant="subtitle2">Step 2 of 3: What do you want to set up?</Typography>
                            <Typography variant="body2">
                                {hasPresets 
                                    ? "Pick a setup type below. Each one is pre-configured for a specific use case."
                                    : "Configure the options for this script."}
                            </Typography>
                        </Alert>

                        {/* PRESET MODE */}
                        {hasPresets && !advancedMode && (
                            <>
                                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    🎯 What type of machine is this?
                                </Typography>
                                
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Click on the option that best describes what this computer will be used for.
                                </Typography>

                                <RadioGroup value={selectedPreset?.id || ''}>
                                    {scriptPresets.presets.map((preset) => (
                                        <Card 
                                            key={preset.id}
                                            onClick={() => handlePresetSelect(preset)}
                                            sx={{ 
                                                mb: 2,
                                                cursor: 'pointer',
                                                border: 3,
                                                borderColor: selectedPreset?.id === preset.id ? 'primary.main' : 'transparent',
                                                bgcolor: selectedPreset?.id === preset.id ? 'primary.dark' : 'background.paper',
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    borderColor: 'primary.light',
                                                    transform: 'scale(1.01)'
                                                }
                                            }}
                                        >
                                            <CardContent sx={{ py: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Radio 
                                                        checked={selectedPreset?.id === preset.id}
                                                        sx={{ mr: 2 }}
                                                    />
                                                    <Box sx={{ flexGrow: 1 }}>
                                                        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {preset.name}
                                                            {preset.recommended && (
                                                                <Chip 
                                                                    icon={<StarIcon />}
                                                                    label="Recommended" 
                                                                    size="small" 
                                                                    color="warning"
                                                                />
                                                            )}
                                                        </Typography>
                                                        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                                                            {preset.description}
                                                        </Typography>
                                                        {preset.warning && (
                                                            <Chip 
                                                                icon={<WarningIcon />}
                                                                label={preset.warning}
                                                                size="small"
                                                                color="warning"
                                                                variant="outlined"
                                                                sx={{ mt: 1 }}
                                                            />
                                                        )}
                                                        {/* Show what flags this preset enables */}
                                                        {selectedPreset?.id === preset.id && preset.flags && preset.flags.length > 0 && (
                                                            <Collapse in={true}>
                                                                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1 }}>
                                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                                        This preset will enable:
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                        {preset.flags.map((flag) => {
                                                                            // Convert flag to readable name
                                                                            const readableName = flag
                                                                                .replace(/^--/, '')
                                                                                .replace(/=/g, ': ')
                                                                                .replace(/-/g, ' ')
                                                                                .replace(/\b\w/g, l => l.toUpperCase())
                                                                            return (
                                                                                <Chip 
                                                                                    key={flag}
                                                                                    label={readableName}
                                                                                    size="small"
                                                                                    sx={{ 
                                                                                        bgcolor: 'rgba(249, 115, 22, 0.2)',
                                                                                        color: '#f97316',
                                                                                        fontSize: '0.75rem'
                                                                                    }}
                                                                                />
                                                                            )
                                                                        })}
                                                                    </Box>
                                                                </Box>
                                                            </Collapse>
                                                        )}
                                                    </Box>
                                                    {selectedPreset?.id === preset.id && (
                                                        <CheckCircleIcon color="primary" sx={{ fontSize: 40 }} />
                                                    )}
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </RadioGroup>

                                
                                <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                    <Button
                                        startIcon={<SettingsIcon />}
                                        onClick={() => setAdvancedMode(true)}
                                        color="inherit"
                                        size="small"
                                    >
                                        Advanced: Customize individual options
                                    </Button>
                                </Box>
                            </>
                        )}

                        {/* ADVANCED MODE */}
                        {(advancedMode || !hasPresets) && (
                            <>
                                {hasPresets && (
                                    <Box sx={{ mb: 3 }}>
                                        <Button
                                            startIcon={<ArrowBackIcon />}
                                            onClick={() => setAdvancedMode(false)}
                                            variant="outlined"
                                            size="small"
                                        >
                                            Back to Simple Mode
                                        </Button>
                                    </Box>
                                )}

                                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SettingsIcon color="primary" />
                                    Advanced Options
                                </Typography>

                                {(!script.flags || script.flags.length === 0) ? (
                                    <Alert severity="success" sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2">No options needed! 🎉</Typography>
                                        <Typography variant="body2">
                                            This script doesn't have any options to configure. 
                                            Just click "Next" to continue.
                                        </Typography>
                                    </Alert>
                                ) : (
                                    <>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            {enabledCount === 0 
                                                ? '💡 All options are OFF. Turn on what you need.' 
                                                : `✅ ${enabledCount} option${enabledCount > 1 ? 's' : ''} turned ON`}
                                        </Typography>
                                        <List>
                                            {script.flags.map((flag) => {
                                                const isEnabled = flagValues[flag.long]?.enabled || false
                                                const friendlyName = flag.long.replace('--', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                                
                                                return (
                                                    <Card 
                                                        key={flag.long} 
                                                        sx={{ 
                                                            mb: 1.5,
                                                            border: 2,
                                                            borderColor: isEnabled ? 'success.main' : 'transparent',
                                                            bgcolor: isEnabled ? 'success.dark' : 'background.paper',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <CardContent sx={{ py: 2 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <Switch
                                                                    checked={isEnabled}
                                                                    onChange={() => handleFlagToggle(flag.long)}
                                                                    color="success"
                                                                    sx={{ mr: 2 }}
                                                                />
                                                                <Box sx={{ flexGrow: 1 }}>
                                                                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        {friendlyName}
                                                                        {flag.has_value && (
                                                                            <Chip 
                                                                                label="needs a value" 
                                                                                size="small" 
                                                                                color="warning" 
                                                                                variant="outlined" 
                                                                            />
                                                                        )}
                                                                    </Typography>
                                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                        {flag.description || 'No description available'}
                                                                    </Typography>
                                                                    
                                                                    {flag.has_value && isEnabled && (
                                                                        <TextField
                                                                            fullWidth
                                                                            size="medium"
                                                                            label={`Enter ${flag.value_hint || 'value'}`}
                                                                            value={flagValues[flag.long]?.value || ''}
                                                                            onChange={(e) => handleFlagValueChange(flag.long, e.target.value)}
                                                                            sx={{ mt: 2 }}
                                                                            placeholder={`Example: ${flag.value_hint || 'your-value'}`}
                                                                            helperText={`Type the ${flag.value_hint || 'value'} you want to use`}
                                                                            variant="outlined"
                                                                        />
                                                                    )}
                                                                </Box>
                                                                <Typography 
                                                                    variant="body2" 
                                                                    sx={{ 
                                                                        ml: 2, 
                                                                        color: isEnabled ? 'success.light' : 'text.disabled',
                                                                        fontWeight: 'bold'
                                                                    }}
                                                                >
                                                            {isEnabled ? 'ON' : 'OFF'}
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </List>
                            </>
                        )}
                            </>
                        )}
                    </Box>
                )

            case 2:
                const selectedOptions = Object.entries(flagValues).filter(([_, v]) => v.enabled)
                return (
                    <Box>
                        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
                            <Typography variant="subtitle2">Step 3 of 3: Ready to Run!</Typography>
                            <Typography variant="body2">
                                Double-check everything below. When you click the big green button, 
                                the script will run on your selected computers. This cannot be undone!
                            </Typography>
                        </Alert>

                        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon color="primary" />
                            Here's what will happen:
                        </Typography>
                        
                        {/* Summary Cards */}
                        <Card sx={{ mb: 2, bgcolor: 'primary.dark' }}>
                            <CardContent>
                                <Typography variant="overline" color="text.secondary">SCRIPT</Typography>
                                <Typography variant="h6">{script.name}</Typography>
                                <Typography variant="body2" color="text.secondary">{script.description}</Typography>
                            </CardContent>
                        </Card>

                        <Card sx={{ mb: 2, bgcolor: 'info.dark' }}>
                            <CardContent>
                                <Typography variant="overline" color="text.secondary">
                                    RUNNING ON {selectedMachines.length} COMPUTER{selectedMachines.length > 1 ? 'S' : ''}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                    {selectedMachines.map(id => {
                                        const machine = machines.find(m => m.id === id)
                                        return (
                                            <Chip 
                                                key={id} 
                                                icon={<ComputerIcon />}
                                                label={machine?.name || machine?.ip || id}
                                                color="info"
                                                sx={{ fontSize: '1rem', py: 2 }}
                                            />
                                        )
                                    })}
                                </Box>
                            </CardContent>
                        </Card>

                        <Card sx={{ mb: 2, bgcolor: selectedOptions.length > 0 ? 'success.dark' : 'grey.800' }}>
                            <CardContent>
                                <Typography variant="overline" color="text.secondary">
                                    {selectedOptions.length > 0 
                                        ? `WITH ${selectedOptions.length} OPTION${selectedOptions.length > 1 ? 'S' : ''} ENABLED`
                                        : 'USING DEFAULT SETTINGS (NO OPTIONS)'}
                                </Typography>
                                {selectedOptions.length > 0 ? (
                                    <Box sx={{ mt: 1 }}>
                                        {selectedOptions.map(([key, val]) => (
                                            <Chip 
                                                key={key}
                                                label={val.value ? `${key}=${val.value}` : key}
                                                sx={{ mr: 1, mb: 1 }}
                                                color="success"
                                            />
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                        The script will run with its default behavior.
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>

                        {/* Dry-Run Preview Panel */}
                        <Card sx={{ 
                            mb: 2, 
                            bgcolor: 'rgba(139, 92, 246, 0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                        }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <PreviewIcon sx={{ color: '#8b5cf6' }} />
                                        <Typography variant="overline" sx={{ color: '#8b5cf6' }}>
                                            DRY-RUN PREVIEW
                                        </Typography>
                                    </Box>
                                    <Tooltip title={copiedCommand ? "Copied!" : "Copy command"}>
                                        <IconButton size="small" onClick={copyCommand} sx={{ color: '#8b5cf6' }}>
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    This is the command that will be executed on each machine:
                                </Typography>
                                <Box sx={{ 
                                    p: 2, 
                                    bgcolor: 'rgba(0,0,0,0.4)', 
                                    borderRadius: 1,
                                    fontFamily: '"JetBrains Mono", monospace',
                                    fontSize: '0.9rem',
                                    color: '#a5f3fc',
                                    overflow: 'auto',
                                }}>
                                    <CodeIcon sx={{ fontSize: 14, mr: 1, verticalAlign: 'middle', color: '#8b5cf6' }} />
                                    {getDryRunCommand()}
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled' }}>
                                    💡 Tip: Copy this command to test manually before running on all machines
                                </Typography>
                            </CardContent>
                        </Card>

                        {/* Execution Results - Redesigned */}
                        {executionResults && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {/* Status Header - Compact */}
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 2,
                                    p: 2,
                                    borderRadius: 2,
                                    background: executionResults.status === 'completed' 
                                        ? 'linear-gradient(135deg, rgba(0,200,100,0.2) 0%, rgba(0,150,80,0.1) 100%)'
                                        : executionResults.status === 'failed'
                                        ? 'linear-gradient(135deg, rgba(255,80,80,0.2) 0%, rgba(200,50,50,0.1) 100%)'
                                        : executionResults.status === 'cancelled'
                                        ? 'linear-gradient(135deg, rgba(255,152,0,0.2) 0%, rgba(200,120,0,0.1) 100%)'
                                        : 'linear-gradient(135deg, rgba(0,180,255,0.2) 0%, rgba(0,120,200,0.1) 100%)',
                                    border: '1px solid',
                                    borderColor: executionResults.status === 'completed' 
                                        ? 'rgba(0,200,100,0.3)'
                                        : executionResults.status === 'failed'
                                        ? 'rgba(255,80,80,0.3)'
                                        : executionResults.status === 'cancelled'
                                        ? 'rgba(255,152,0,0.3)'
                                        : 'rgba(0,180,255,0.3)',
                                }}>
                                    {executionResults.status === 'running' && (
                                        <CircularProgress size={32} sx={{ color: '#00b4ff' }} />
                                    )}
                                    {executionResults.status === 'completed' && (
                                        <CheckCircleIcon sx={{ fontSize: 32, color: '#00c864' }} />
                                    )}
                                    {executionResults.status === 'failed' && (
                                        <ErrorIcon sx={{ fontSize: 32, color: '#ff5050' }} />
                                    )}
                                    {executionResults.status === 'cancelled' && (
                                        <StopIcon sx={{ fontSize: 32, color: '#ff9800' }} />
                                    )}
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            {executionResults.status === 'running' && 'Executing...'}
                                            {executionResults.status === 'completed' && 'Completed Successfully'}
                                            {executionResults.status === 'failed' && 'Execution Failed'}
                                            {executionResults.status === 'cancelled' && 'Execution Cancelled'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                            {executionResults.status === 'running' && `Running on ${selectedMachines.length} machine(s)`}
                                            {executionResults.status === 'completed' && 'All tasks completed'}
                                            {executionResults.status === 'failed' && 'Check output below for details'}
                                            {executionResults.status === 'cancelled' && 'Execution was cancelled'}
                                        </Typography>
                                    </Box>
                                    {executionResults.status === 'running' && (
                                        <>
                                            <Chip 
                                                label={`${executionResults.results?.length || 0}/${selectedMachines.length}`}
                                                sx={{ 
                                                    background: 'rgba(0,180,255,0.2)',
                                                    color: '#00b4ff',
                                                    fontWeight: 600,
                                                }}
                                            />
                                            <Button
                                                variant="contained"
                                                color="error"
                                                startIcon={<StopIcon />}
                                                onClick={handleCancelExecution}
                                                sx={{ 
                                                    ml: 1,
                                                    background: 'linear-gradient(135deg, #ff5050 0%, #cc3030 100%)',
                                                    '&:hover': {
                                                        background: 'linear-gradient(135deg, #ff6060 0%, #dd4040 100%)',
                                                    }
                                                }}
                                            >
                                                Stop
                                            </Button>
                                        </>
                                    )}
                                </Box>

                                {/* Live Streaming Output - Full Width */}
                                {execId && (
                                    <Box sx={{ flex: 1 }}>
                                        {streamingExecutions.map((exec) => (
                                            <ExecutionStream
                                                key={exec.machineId}
                                                execId={exec.execId}
                                                machineName={exec.machineName}
                                                machineId={exec.machineId}
                                                onComplete={handleStreamComplete}
                                            />
                                        ))}
                                    </Box>
                                )}

                                {/* Final Results - Show after completion */}
                                {executionResults.status !== 'running' && executionResults.results?.length > 0 && !execId && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {executionResults.results.map((result, i) => (
                                            <Box 
                                                key={i} 
                                                sx={{ 
                                                    p: 2,
                                                    borderRadius: 2,
                                                    background: 'rgba(0,0,0,0.3)',
                                                    border: '1px solid',
                                                    borderColor: result.success ? 'rgba(0,200,100,0.3)' : 'rgba(255,80,80,0.3)',
                                                    borderLeft: '3px solid',
                                                    borderLeftColor: result.success ? '#00c864' : '#ff5050',
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    {result.success ? (
                                                        <CheckCircleIcon sx={{ color: '#00c864', fontSize: 20 }} />
                                                    ) : (
                                                        <ErrorIcon sx={{ color: '#ff5050', fontSize: 20 }} />
                                                    )}
                                                    <Typography sx={{ fontWeight: 600 }}>
                                                        {result.machine_name || 'Machine'}
                                                    </Typography>
                                                    <Chip 
                                                        label={result.success ? 'Success' : 'Failed'}
                                                        size="small"
                                                        sx={{
                                                            ml: 'auto',
                                                            background: result.success ? 'rgba(0,200,100,0.2)' : 'rgba(255,80,80,0.2)',
                                                            color: result.success ? '#00c864' : '#ff5050',
                                                        }}
                                                    />
                                                </Box>
                                                {result.output && (
                                                    <Box sx={{ 
                                                        mt: 1, 
                                                        p: 2, 
                                                        bgcolor: 'rgba(0,0,0,0.4)', 
                                                        borderRadius: 1,
                                                        fontFamily: '"JetBrains Mono", monospace',
                                                        fontSize: '0.8rem',
                                                        lineHeight: 1.5,
                                                        maxHeight: '40vh',
                                                        overflow: 'auto',
                                                        whiteSpace: 'pre-wrap',
                                                    }}>
                                                        {result.output}
                                                    </Box>
                                                )}
                                                {result.error && (
                                                    <Alert severity="error" sx={{ mt: 1 }}>{result.error}</Alert>
                                                )}
                                            </Box>
                                        ))}
                                    </Box>
                                )}

                                {/* Waiting state */}
                                {executionResults.status === 'running' && !execId && (
                                    <Box sx={{ 
                                        textAlign: 'center', 
                                        py: 4,
                                        background: 'rgba(0,0,0,0.2)',
                                        borderRadius: 2,
                                    }}>
                                        <CircularProgress size={32} sx={{ mb: 2, color: '#00b4ff' }} />
                                        <Typography sx={{ opacity: 0.7 }}>
                                            Connecting to machines...
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {executing && !executionResults && (
                            <Box sx={{ mb: 2 }}>
                                <LinearProgress sx={{ height: 8, borderRadius: 4 }} />
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                                    Starting execution...
                                </Typography>
                            </Box>
                        )}

                        {executionResults && executionResults.status !== 'running' && (
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                    variant="outlined"
                                    size="large"
                                    onClick={() => navigate('/scripts')}
                                    fullWidth
                                >
                                    Back to Scripts
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="large"
                                    startIcon={<PlayArrowIcon />}
                                    onClick={() => {
                                        setExecutionResults(null)
                                        handleExecute()
                                    }}
                                    fullWidth
                                >
                                    Run Again
                                </Button>
                            </Box>
                        )}
                    </Box>
                )

            default:
                return null
        }
    }

    return (
        <Box sx={{ 
            p: 2, 
            maxWidth: 1200, 
            mx: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            height: 'calc(100vh - 64px)',
            gap: 1.5,
            overflow: 'hidden',
        }}>
            {/* Compact Header */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                flexShrink: 0,
            }}>
                <Button 
                    startIcon={<ArrowBackIcon />} 
                    onClick={() => navigate('/scripts')}
                    variant="text"
                    sx={{ 
                        color: 'rgba(255,255,255,0.7)',
                        '&:hover': { color: '#f97316', background: 'rgba(0,212,255,0.1)' }
                    }}
                >
                    Back
                </Button>
                <Box sx={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2,
                    background: 'linear-gradient(90deg, rgba(0,212,255,0.1) 0%, transparent 100%)',
                    borderRadius: 2,
                    p: 1.5,
                    pl: 2,
                }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
                            {script.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            {script.description}
                        </Typography>
                    </Box>
                </Box>
            </Box>
            
            {/* Modern Progress Stepper */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                flexShrink: 0,
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 2,
                p: 1,
            }}>
                {steps.map((label, index) => (
                    <Box 
                        key={label}
                        sx={{ 
                            flex: 1, 
                            display: 'flex', 
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            flex: 1,
                            p: 1.5,
                            borderRadius: 1.5,
                            background: index === activeStep 
                                ? 'linear-gradient(135deg, rgba(0,212,255,0.3) 0%, rgba(0,255,136,0.2) 100%)'
                                : index < activeStep 
                                ? 'rgba(0,200,100,0.15)'
                                : 'transparent',
                            border: '1px solid',
                            borderColor: index === activeStep 
                                ? 'rgba(0,212,255,0.5)'
                                : index < activeStep 
                                ? 'rgba(0,200,100,0.3)'
                                : 'rgba(255,255,255,0.1)',
                            transition: 'all 0.3s ease',
                        }}>
                            <Box sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: index < activeStep 
                                    ? '#00c864'
                                    : index === activeStep 
                                    ? 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)'
                                    : 'rgba(255,255,255,0.1)',
                                color: index <= activeStep ? '#0a0a0f' : 'rgba(255,255,255,0.5)',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                            }}>
                                {index < activeStep ? '✓' : index + 1}
                            </Box>
                            <Typography sx={{ 
                                fontWeight: index === activeStep ? 600 : 400,
                                color: index === activeStep 
                                    ? '#fff' 
                                    : index < activeStep 
                                    ? '#00c864'
                                    : 'rgba(255,255,255,0.5)',
                                fontSize: '0.9rem',
                            }}>
                                {label}
                            </Typography>
                        </Box>
                        {index < steps.length - 1 && (
                            <Box sx={{ 
                                width: 24, 
                                height: 2, 
                                background: index < activeStep 
                                    ? '#00c864'
                                    : 'rgba(255,255,255,0.2)',
                                borderRadius: 1,
                            }} />
                        )}
                    </Box>
                ))}
            </Box>

            {/* Main Content */}
            <Paper sx={{ 
                p: 2, 
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                mb: 1,
                '&::-webkit-scrollbar': {
                    width: '12px',
                },
                '&::-webkit-scrollbar-track': {
                    background: '#1e1e1e',
                    borderRadius: '6px',
                },
                '&::-webkit-scrollbar-thumb': {
                    background: '#666',
                    borderRadius: '6px',
                    border: '2px solid #1e1e1e',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                    background: '#888',
                },
            }}>
                {renderStepContent(activeStep)}
            </Paper>

            {/* Navigation Buttons - Always visible at bottom */}
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                p: 2,
                bgcolor: 'rgba(0, 20, 40, 0.95)',
                borderRadius: 2,
                border: '1px solid rgba(249, 115, 22, 0.3)',
                flexShrink: 0,
                position: 'sticky',
                bottom: 0,
                backdropFilter: 'blur(10px)',
            }}>
                <Button
                    variant="outlined"
                    size="large"
                    startIcon={<ArrowBackIcon />}
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    sx={{ px: 4 }}
                >
                    ← Previous Step
                </Button>
                {activeStep < steps.length - 1 ? (
                    <Button
                        variant="contained"
                        size="large"
                        endIcon={<ArrowForwardIcon />}
                        onClick={handleNext}
                        disabled={!canProceed()}
                        sx={{ 
                            px: 4,
                            background: 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)',
                            color: '#0a0a0f',
                            fontWeight: 700,
                            '&:hover': {
                                background: 'linear-gradient(135deg, #fb923c 0%, #4ade80 100%)',
                            },
                            '&:disabled': {
                                background: 'rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.3)',
                            }
                        }}
                    >
                        Next Step →
                    </Button>
                ) : (
                    !executing && !executionResults && (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleExecute}
                            sx={{ 
                                px: 4,
                                background: 'linear-gradient(135deg, #22c55e 0%, #f97316 100%)',
                                color: '#0a0a0f',
                                fontWeight: 700,
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #4ade80 0%, #fb923c 100%)',
                                    boxShadow: '0 0 30px rgba(34, 197, 94, 0.4)',
                                }
                            }}
                        >
                            🚀 Execute Script
                        </Button>
                    )
                )}
            </Box>
        </Box>
    )
}

export default ScriptWizard
