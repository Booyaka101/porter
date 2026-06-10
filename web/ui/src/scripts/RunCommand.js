import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'

import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TerminalIcon from '@mui/icons-material/Terminal'
import ComputerIcon from '@mui/icons-material/Computer'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import HistoryIcon from '@mui/icons-material/History'
import ClearIcon from '@mui/icons-material/Clear'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import { colors, scrollableStyles } from './theme'

const RunCommand = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const outputRef = useRef(null)
    
    // Get pre-selected machines from URL
    const preSelectedMachineIds = searchParams.get('machines')?.split(',').filter(Boolean) || []
    
    const [machines, setMachines] = useState([])
    const [selectedMachines, setSelectedMachines] = useState([])
    const [command, setCommand] = useState('')
    const [executing, setExecuting] = useState(false)
    const [results, setResults] = useState({})
    const [commandHistory, setCommandHistory] = useState([])
    const [showHistory, setShowHistory] = useState(false)
    const [expandedResults, setExpandedResults] = useState({})

    useEffect(() => {
        fetchMachines()
        loadCommandHistory()
    }, [])

    const fetchMachines = async () => {
        try {
            const res = await fetch('/api/machines')
            const data = await res.json()
            setMachines(data || [])
            
            // Auto-select machines from URL params
            if (preSelectedMachineIds.length > 0 && data) {
                const validIds = preSelectedMachineIds.filter(id => 
                    data.some(m => m.id === id)
                )
                setSelectedMachines(validIds)
            }
        } catch (err) {
            console.error('Failed to fetch machines:', err)
        }
    }

    const loadCommandHistory = () => {
        try {
            const history = JSON.parse(localStorage.getItem('commandHistory') || '[]')
            setCommandHistory(history.slice(0, 20)) // Keep last 20 commands
        } catch (e) {
            setCommandHistory([])
        }
    }

    const saveToHistory = (cmd) => {
        const history = [cmd, ...commandHistory.filter(c => c !== cmd)].slice(0, 20)
        setCommandHistory(history)
        localStorage.setItem('commandHistory', JSON.stringify(history))
    }

    const handleMachineToggle = (machineId) => {
        setSelectedMachines(prev => 
            prev.includes(machineId) 
                ? prev.filter(id => id !== machineId)
                : [...prev, machineId]
        )
    }

    const handleSelectAll = () => {
        if (selectedMachines.length === machines.length) {
            setSelectedMachines([])
        } else {
            setSelectedMachines(machines.map(m => m.id))
        }
    }

    const handleExecute = async () => {
        if (!command.trim() || selectedMachines.length === 0) return
        
        setExecuting(true)
        setResults({})
        saveToHistory(command.trim())
        
        // Initialize results for all selected machines
        const initialResults = {}
        selectedMachines.forEach(id => {
            initialResults[id] = { status: 'running', output: '' }
        })
        setResults(initialResults)
        setExpandedResults(selectedMachines.reduce((acc, id) => ({ ...acc, [id]: true }), {}))

        // Execute command on each machine
        for (const machineId of selectedMachines) {
            try {
                const res = await fetch('/api/run-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        machine_id: machineId,
                        command: command.trim()
                    })
                })
                
                const data = await res.json()
                
                setResults(prev => ({
                    ...prev,
                    [machineId]: {
                        status: data.success ? 'success' : 'error',
                        output: data.output || data.error || 'No output',
                        exit_code: data.exit_code
                    }
                }))
            } catch (err) {
                setResults(prev => ({
                    ...prev,
                    [machineId]: {
                        status: 'error',
                        output: `Failed to execute: ${err.message}`
                    }
                }))
            }
        }
        
        setExecuting(false)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleExecute()
        }
    }

    const copyOutput = (output) => {
        navigator.clipboard.writeText(output)
    }

    const getMachine = (id) => machines.find(m => m.id === id)

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success': return <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />
            case 'error': return <ErrorIcon sx={{ color: '#ff4466', fontSize: 18 }} />
            case 'running': return <CircularProgress size={16} sx={{ color: '#f97316' }} />
            default: return <HourglassEmptyIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} />
        }
    }

    return (
        <Box sx={{ ...scrollableStyles }}>
            {/* Header */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                mb: 4,
            }}>
                <IconButton 
                    onClick={() => navigate(-1)}
                    sx={{ 
                        color: 'rgba(255,255,255,0.5)',
                        '&:hover': { color: '#f97316', background: 'rgba(249, 115, 22, 0.1)' }
                    }}
                >
                    <ArrowBackIcon />
                </IconButton>
                <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #22c55e 0%, #00cc6a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)',
                }}>
                    <TerminalIcon sx={{ color: '#0a0a0f', fontSize: 24 }} />
                </Box>
                <Box>
                    <Typography sx={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 700, 
                        color: '#fff',
                        letterSpacing: '-0.02em',
                    }}>
                        Run Command
                    </Typography>
                    <Typography sx={{ 
                        fontSize: '0.85rem', 
                        color: 'rgba(255,255,255,0.5)',
                    }}>
                        Execute commands on selected machines
                    </Typography>
                </Box>
            </Box>

            {/* Main Content */}
            <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                {/* Left Panel - Machine Selection */}
                <Card sx={{ 
                    flex: '0 0 300px',
                    background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    maxHeight: 500,
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <CardContent sx={{ p: 2, pb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.9rem' }}>
                                Select Machines
                            </Typography>
                            <Button 
                                size="small" 
                                onClick={handleSelectAll}
                                sx={{ color: '#f97316', fontSize: '0.75rem' }}
                            >
                                {selectedMachines.length === machines.length ? 'Deselect All' : 'Select All'}
                            </Button>
                        </Box>
                    </CardContent>
                    <Box sx={{ 
                        flex: 1, 
                        overflow: 'auto', 
                        px: 2, 
                        pb: 2,
                        ...scrollableStyles,
                    }}>
                        {machines.map(machine => {
                            const isSelected = selectedMachines.includes(machine.id)
                            const isOnline = machine.status === 'online'
                            return (
                                <Box
                                    key={machine.id}
                                    onClick={() => handleMachineToggle(machine.id)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        p: 1.5,
                                        mb: 1,
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        background: isSelected 
                                            ? 'rgba(249, 115, 22, 0.15)' 
                                            : 'rgba(255,255,255,0.02)',
                                        border: isSelected 
                                            ? '1px solid rgba(249, 115, 22, 0.4)' 
                                            : '1px solid transparent',
                                        opacity: isOnline ? 1 : 0.5,
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            background: isSelected 
                                                ? 'rgba(249, 115, 22, 0.2)' 
                                                : 'rgba(255,255,255,0.05)',
                                        }
                                    }}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        size="small"
                                        sx={{
                                            color: 'rgba(255,255,255,0.3)',
                                            '&.Mui-checked': { color: '#f97316' },
                                            p: 0,
                                        }}
                                    />
                                    <Box sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '8px',
                                        background: 'rgba(249, 115, 22, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <ComputerIcon sx={{ color: '#f97316', fontSize: 18 }} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ 
                                            color: '#fff', 
                                            fontSize: '0.85rem', 
                                            fontWeight: 500,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {machine.name}
                                        </Typography>
                                        <Typography sx={{ 
                                            color: 'rgba(255,255,255,0.4)', 
                                            fontSize: '0.7rem',
                                            fontFamily: 'monospace',
                                        }}>
                                            {machine.ip}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: isOnline ? '#22c55e' : '#ff4466',
                                        boxShadow: isOnline ? '0 0 8px #22c55e' : 'none',
                                    }} />
                                </Box>
                            )
                        })}
                    </Box>
                </Card>

                {/* Right Panel - Command & Results */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Command Input */}
                    <Card sx={{ 
                        background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '16px',
                    }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.9rem' }}>
                                    Command
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {commandHistory.length > 0 && (
                                        <Button
                                            size="small"
                                            startIcon={<HistoryIcon />}
                                            onClick={() => setShowHistory(!showHistory)}
                                            sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}
                                        >
                                            History
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                            
                            <Collapse in={showHistory}>
                                <Box sx={{ 
                                    mb: 2, 
                                    p: 1.5, 
                                    background: 'rgba(0,0,0,0.3)', 
                                    borderRadius: '8px',
                                    maxHeight: 150,
                                    overflow: 'auto',
                                    ...scrollableStyles,
                                }}>
                                    {commandHistory.map((cmd, i) => (
                                        <Box
                                            key={i}
                                            onClick={() => { setCommand(cmd); setShowHistory(false); }}
                                            sx={{
                                                p: 1,
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontFamily: 'monospace',
                                                fontSize: '0.8rem',
                                                color: 'rgba(255,255,255,0.7)',
                                                '&:hover': { background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' },
                                            }}
                                        >
                                            {cmd}
                                        </Box>
                                    ))}
                                </Box>
                            </Collapse>

                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter command to execute (e.g., ls -la, df -h, free -m)"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        fontFamily: 'monospace',
                                        fontSize: '0.9rem',
                                        background: 'rgba(0,0,0,0.3)',
                                        borderRadius: '10px',
                                    }
                                }}
                            />
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                                    Press Ctrl+Enter to execute
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={executing ? <CircularProgress size={16} sx={{ color: '#0a0a0f' }} /> : <PlayArrowIcon />}
                                    onClick={handleExecute}
                                    disabled={executing || !command.trim() || selectedMachines.length === 0}
                                    sx={{
                                        background: 'linear-gradient(135deg, #22c55e 0%, #00cc6a 100%)',
                                        color: '#0a0a0f',
                                        fontWeight: 600,
                                        '&:hover': { background: 'linear-gradient(135deg, #66ffaa 0%, #22c55e 100%)' },
                                        '&:disabled': { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }
                                    }}
                                >
                                    {executing ? 'Executing...' : `Execute on ${selectedMachines.length} machine${selectedMachines.length !== 1 ? 's' : ''}`}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Results */}
                    {Object.keys(results).length > 0 && (
                        <Card sx={{ 
                            background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(17, 23, 35, 0.98) 100%)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '16px',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                        }}>
                            <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
                                    Results
                                </Typography>
                                
                                <Box sx={{ flex: 1, overflow: 'auto', ...scrollableStyles }} ref={outputRef}>
                                    {Object.entries(results).map(([machineId, result]) => {
                                        const machine = getMachine(machineId)
                                        const isExpanded = expandedResults[machineId] !== false
                                        return (
                                            <Box 
                                                key={machineId} 
                                                sx={{ 
                                                    mb: 2,
                                                    background: 'rgba(0,0,0,0.2)',
                                                    borderRadius: '10px',
                                                    overflow: 'hidden',
                                                    border: result.status === 'error' 
                                                        ? '1px solid rgba(255, 68, 102, 0.3)'
                                                        : result.status === 'success'
                                                        ? '1px solid rgba(34, 197, 94, 0.2)'
                                                        : '1px solid rgba(249, 115, 22, 0.2)',
                                                }}
                                            >
                                                <Box 
                                                    sx={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: 1.5, 
                                                        p: 1.5,
                                                        cursor: 'pointer',
                                                        '&:hover': { background: 'rgba(255,255,255,0.02)' }
                                                    }}
                                                    onClick={() => setExpandedResults(prev => ({ ...prev, [machineId]: !isExpanded }))}
                                                >
                                                    {getStatusIcon(result.status)}
                                                    <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: '0.85rem', flex: 1 }}>
                                                        {machine?.name || machineId}
                                                    </Typography>
                                                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                                        {machine?.ip}
                                                    </Typography>
                                                    {result.exit_code !== undefined && (
                                                        <Chip 
                                                            label={`Exit: ${result.exit_code}`}
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '0.7rem',
                                                                background: result.exit_code === 0 
                                                                    ? 'rgba(34, 197, 94, 0.2)' 
                                                                    : 'rgba(255, 68, 102, 0.2)',
                                                                color: result.exit_code === 0 ? '#22c55e' : '#ff4466',
                                                            }}
                                                        />
                                                    )}
                                                    <Tooltip title="Copy output">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={(e) => { e.stopPropagation(); copyOutput(result.output); }}
                                                            sx={{ color: 'rgba(255,255,255,0.4)' }}
                                                        >
                                                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {isExpanded ? <ExpandLessIcon sx={{ color: 'rgba(255,255,255,0.4)' }} /> : <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />}
                                                </Box>
                                                
                                                <Collapse in={isExpanded}>
                                                    {result.status === 'running' && (
                                                        <LinearProgress sx={{ height: 2 }} />
                                                    )}
                                                    <Box sx={{ 
                                                        p: 2, 
                                                        pt: 1,
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.8rem',
                                                        color: 'rgba(255,255,255,0.8)',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-all',
                                                        maxHeight: 300,
                                                        overflow: 'auto',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        ...scrollableStyles,
                                                    }}>
                                                        {result.output || (result.status === 'running' ? 'Executing...' : 'No output')}
                                                    </Box>
                                                </Collapse>
                                            </Box>
                                        )
                                    })}
                                </Box>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty State */}
                    {Object.keys(results).length === 0 && (
                        <Box sx={{ 
                            flex: 1, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: 2,
                            py: 8,
                        }}>
                            <TerminalIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.1)' }} />
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                                Select machines and enter a command to execute
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    )
}

export default RunCommand
