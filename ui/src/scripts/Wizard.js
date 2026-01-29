import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'

import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ComputerIcon from '@mui/icons-material/Computer'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'

const steps = ['Select Machines', 'Build Manifest', 'Configure Variables', 'Review & Execute']

const Wizard = () => {
    const [activeStep, setActiveStep] = useState(0)
    const [machines, setMachines] = useState([])
    const [selectedMachines, setSelectedMachines] = useState([])
    const [taskTypes, setTaskTypes] = useState([])
    const [manifest, setManifest] = useState({
        name: '',
        description: '',
        variables: {},
        tasks: []
    })
    const [execution, setExecution] = useState(null)
    const [executing, setExecuting] = useState(false)
    const [addTaskOpen, setAddTaskOpen] = useState(false)
    const [newTask, setNewTask] = useState({ type: '', params: {}, options: {} })

    useEffect(() => {
        fetchMachines()
        fetchTaskTypes()
    }, [])

    const fetchMachines = async () => {
        try {
            const res = await fetch('/api/machines')
            const data = await res.json()
            setMachines(data || [])
        } catch (err) {
            console.error('Failed to fetch machines:', err)
        }
    }

    const fetchTaskTypes = async () => {
        try {
            const res = await fetch('/api/task-types')
            const data = await res.json()
            setTaskTypes(data || [])
        } catch (err) {
            console.error('Failed to fetch task types:', err)
        }
    }

    const handleNext = () => {
        setActiveStep((prev) => prev + 1)
    }

    const handleBack = () => {
        setActiveStep((prev) => prev - 1)
    }

    const handleMachineToggle = (machineId) => {
        setSelectedMachines(prev => 
            prev.includes(machineId) 
                ? prev.filter(id => id !== machineId)
                : [...prev, machineId]
        )
    }

    const handleAddTask = () => {
        if (!newTask.type) return
        
        const taskType = taskTypes.find(t => t.type === newTask.type)
        const task = {
            id: `task-${Date.now()}`,
            type: newTask.type,
            name: taskType?.name || newTask.type,
            params: { ...newTask.params },
            options: { ...newTask.options }
        }
        
        setManifest(prev => ({
            ...prev,
            tasks: [...prev.tasks, task]
        }))
        
        setNewTask({ type: '', params: {}, options: {} })
        setAddTaskOpen(false)
    }

    const handleRemoveTask = (taskId) => {
        setManifest(prev => ({
            ...prev,
            tasks: prev.tasks.filter(t => t.id !== taskId)
        }))
    }

    const handleExecute = async () => {
        setExecuting(true)
        try {
            // First save the manifest
            const manifestRes = await fetch('/api/manifests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(manifest)
            })
            const savedManifest = await manifestRes.json()

            // Then execute it
            const execRes = await fetch(`/api/manifests/${savedManifest.id}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_ids: selectedMachines,
                    variables: manifest.variables
                })
            })
            const execData = await execRes.json()
            setExecution(execData)

            // Poll for updates
            const pollExecution = async () => {
                const res = await fetch(`/api/executions/${execData.id}`)
                const data = await res.json()
                setExecution(data)
                
                if (data.status === 'running') {
                    setTimeout(pollExecution, 1000)
                } else {
                    setExecuting(false)
                }
            }
            pollExecution()
        } catch (err) {
            console.error('Execution failed:', err)
            setExecuting(false)
        }
    }

    const getTaskTypesByCategory = () => {
        const categories = {}
        taskTypes.forEach(tt => {
            if (!categories[tt.category]) {
                categories[tt.category] = []
            }
            categories[tt.category].push(tt)
        })
        return categories
    }

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>
                            Select Target Machines
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Choose the machines where you want to execute the deployment tasks.
                        </Typography>
                        
                        {machines.length === 0 ? (
                            <Alert severity="warning">
                                No machines configured. Please add machines first.
                            </Alert>
                        ) : (
                            <List>
                                {machines.map((machine) => (
                                    <ListItem 
                                        key={machine.id}
                                        sx={{ 
                                            border: 1, 
                                            borderColor: 'divider', 
                                            borderRadius: 1, 
                                            mb: 1,
                                            bgcolor: selectedMachines.includes(machine.id) ? 'action.selected' : 'transparent'
                                        }}
                                    >
                                        <ListItemIcon>
                                            <Checkbox
                                                checked={selectedMachines.includes(machine.id)}
                                                onChange={() => handleMachineToggle(machine.id)}
                                            />
                                        </ListItemIcon>
                                        <ListItemIcon>
                                            <ComputerIcon color={machine.status === 'online' ? 'success' : 'disabled'} />
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary={machine.name || machine.ip}
                                            secondary={`${machine.ip} - ${machine.username}`}
                                        />
                                        <Chip 
                                            label={machine.status} 
                                            size="small"
                                            color={machine.status === 'online' ? 'success' : 'default'}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>
                )

            case 1:
                return (
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box>
                                <Typography variant="h6">Build Deployment Manifest</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Add tasks to define your deployment workflow.
                                </Typography>
                            </Box>
                            <Button 
                                variant="contained" 
                                startIcon={<AddIcon />}
                                onClick={() => setAddTaskOpen(true)}
                            >
                                Add Task
                            </Button>
                        </Box>

                        <TextField
                            fullWidth
                            label="Manifest Name"
                            value={manifest.name}
                            onChange={(e) => setManifest(prev => ({ ...prev, name: e.target.value }))}
                            sx={{ mb: 2 }}
                        />

                        {manifest.tasks.length === 0 ? (
                            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover' }}>
                                <Typography color="text.secondary">
                                    No tasks added yet. Click "Add Task" to start building your manifest.
                                </Typography>
                            </Paper>
                        ) : (
                            <List>
                                {manifest.tasks.map((task, index) => (
                                    <Card key={task.id} sx={{ mb: 1 }}>
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
                                            <DragIndicatorIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                            <Chip label={index + 1} size="small" sx={{ mr: 1 }} />
                                            <Box sx={{ flexGrow: 1 }}>
                                                <Typography variant="subtitle2">{task.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {Object.entries(task.params).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                                </Typography>
                                            </Box>
                                            <IconButton size="small" onClick={() => handleRemoveTask(task.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </CardContent>
                                    </Card>
                                ))}
                            </List>
                        )}

                        <Dialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} maxWidth="md" fullWidth>
                            <DialogTitle>Add Task</DialogTitle>
                            <DialogContent>
                                <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
                                    <InputLabel>Task Type</InputLabel>
                                    <Select
                                        value={newTask.type}
                                        label="Task Type"
                                        onChange={(e) => setNewTask({ type: e.target.value, params: {}, options: {} })}
                                    >
                                        {Object.entries(getTaskTypesByCategory()).map(([category, types]) => [
                                            <MenuItem key={`cat-${category}`} disabled sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                {category}
                                            </MenuItem>,
                                            ...types.map(tt => (
                                                <MenuItem key={tt.type} value={tt.type} sx={{ pl: 4 }}>
                                                    {tt.name}
                                                </MenuItem>
                                            ))
                                        ])}
                                    </Select>
                                </FormControl>

                                {newTask.type && taskTypes.find(t => t.type === newTask.type)?.params.map(param => (
                                    <TextField
                                        key={param}
                                        fullWidth
                                        label={param}
                                        value={newTask.params[param] || ''}
                                        onChange={(e) => setNewTask(prev => ({
                                            ...prev,
                                            params: { ...prev.params, [param]: e.target.value }
                                        }))}
                                        sx={{ mb: 2 }}
                                        multiline={param === 'content'}
                                        rows={param === 'content' ? 4 : 1}
                                    />
                                ))}

                                {newTask.type && (
                                    <Accordion>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Typography>Advanced Options</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={newTask.options.sudo || false}
                                                        onChange={(e) => setNewTask(prev => ({
                                                            ...prev,
                                                            options: { ...prev.options, sudo: e.target.checked }
                                                        }))}
                                                    />
                                                }
                                                label="Run with sudo"
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={newTask.options.user || false}
                                                        onChange={(e) => setNewTask(prev => ({
                                                            ...prev,
                                                            options: { ...prev.options, user: e.target.checked }
                                                        }))}
                                                    />
                                                }
                                                label="User service (systemd --user)"
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={newTask.options.ignore || false}
                                                        onChange={(e) => setNewTask(prev => ({
                                                            ...prev,
                                                            options: { ...prev.options, ignore: e.target.checked }
                                                        }))}
                                                    />
                                                }
                                                label="Ignore errors"
                                            />
                                            <TextField
                                                fullWidth
                                                label="Retry count"
                                                type="number"
                                                value={newTask.options.retry || ''}
                                                onChange={(e) => setNewTask(prev => ({
                                                    ...prev,
                                                    options: { ...prev.options, retry: parseInt(e.target.value) || 0 }
                                                }))}
                                                sx={{ mt: 1 }}
                                            />
                                        </AccordionDetails>
                                    </Accordion>
                                )}
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setAddTaskOpen(false)}>Cancel</Button>
                                <Button variant="contained" onClick={handleAddTask} disabled={!newTask.type}>
                                    Add Task
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Box>
                )

            case 2:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>Configure Variables</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Define variables that can be used in your tasks with {'{{variable_name}}'} syntax.
                        </Typography>

                        <Box sx={{ mb: 2 }}>
                            {Object.entries(manifest.variables).map(([key, value]) => (
                                <Box key={key} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <TextField
                                        label="Variable Name"
                                        value={key}
                                        disabled
                                        sx={{ flex: 1 }}
                                    />
                                    <TextField
                                        label="Value"
                                        value={value}
                                        onChange={(e) => setManifest(prev => ({
                                            ...prev,
                                            variables: { ...prev.variables, [key]: e.target.value }
                                        }))}
                                        sx={{ flex: 2 }}
                                    />
                                    <IconButton onClick={() => {
                                        const newVars = { ...manifest.variables }
                                        delete newVars[key]
                                        setManifest(prev => ({ ...prev, variables: newVars }))
                                    }}>
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>

                        <Button
                            startIcon={<AddIcon />}
                            onClick={() => {
                                const name = prompt('Variable name:')
                                if (name) {
                                    setManifest(prev => ({
                                        ...prev,
                                        variables: { ...prev.variables, [name]: '' }
                                    }))
                                }
                            }}
                        >
                            Add Variable
                        </Button>
                    </Box>
                )

            case 3:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>Review & Execute</Typography>
                        
                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">Manifest</Typography>
                            <Typography variant="h6">{manifest.name || 'Unnamed Manifest'}</Typography>
                            <Typography variant="body2">{manifest.tasks.length} tasks</Typography>
                        </Paper>

                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">Target Machines</Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                {selectedMachines.map(id => {
                                    const machine = machines.find(m => m.id === id)
                                    return (
                                        <Chip 
                                            key={id} 
                                            icon={<ComputerIcon />}
                                            label={machine?.name || machine?.ip || id}
                                        />
                                    )
                                })}
                            </Box>
                        </Paper>

                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">Tasks</Typography>
                            <List dense>
                                {manifest.tasks.map((task, i) => (
                                    <ListItem key={task.id}>
                                        <ListItemText 
                                            primary={`${i + 1}. ${task.name}`}
                                            secondary={Object.entries(task.params).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Paper>

                        {execution && (
                            <Paper sx={{ p: 2, mb: 2 }}>
                                <Typography variant="subtitle2" color="text.secondary">Execution Status</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                    {execution.status === 'running' && <HourglassEmptyIcon color="primary" />}
                                    {execution.status === 'completed' && <CheckCircleIcon color="success" />}
                                    {execution.status === 'failed' && <ErrorIcon color="error" />}
                                    <Typography>{execution.status}</Typography>
                                </Box>
                                
                                {execution.results?.map((result, i) => (
                                    <Box key={i} sx={{ mt: 2 }}>
                                        <Typography variant="body2">
                                            {result.machine_name || result.machine_ip}: {result.status}
                                        </Typography>
                                        {result.error && (
                                            <Alert severity="error" sx={{ mt: 1 }}>{result.error}</Alert>
                                        )}
                                    </Box>
                                ))}
                            </Paper>
                        )}

                        {executing && <LinearProgress sx={{ mb: 2 }} />}

                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleExecute}
                            disabled={executing || selectedMachines.length === 0 || manifest.tasks.length === 0}
                            fullWidth
                        >
                            {executing ? 'Executing...' : 'Execute Manifest'}
                        </Button>
                    </Box>
                )

            default:
                return null
        }
    }

    const canProceed = () => {
        switch (activeStep) {
            case 0:
                return selectedMachines.length > 0
            case 1:
                return manifest.tasks.length > 0 && manifest.name
            case 2:
                return true
            default:
                return true
        }
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Deployment Wizard
            </Typography>
            
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            <Paper sx={{ p: 3, minHeight: 400 }}>
                {renderStepContent(activeStep)}
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                >
                    Back
                </Button>
                {activeStep < steps.length - 1 && (
                    <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={!canProceed()}
                    >
                        Next
                    </Button>
                )}
            </Box>
        </Box>
    )
}

export default Wizard
