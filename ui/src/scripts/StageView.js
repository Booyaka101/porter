import { useState, useEffect, useRef, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { colors } from './theme'

// Parse output lines into stages and tasks
const parseStages = (events) => {
    const stages = []
    let currentStage = null
    let currentTask = null
    
    events.forEach(event => {
        const line = event.data || ''
        
        // Detect PLAY (stage) markers: === PLAY [Stage Name] ===
        const playMatch = line.match(/^=== PLAY \[(.+)\] ===$/)
        if (playMatch) {
            // Mark previous stage as success if it was still running (new stage means previous completed)
            if (currentStage && currentStage.status === 'running') {
                currentStage.status = 'success'
                stages.push(currentStage)
            } else if (currentStage) {
                stages.push(currentStage)
            }
            currentStage = {
                name: playMatch[1],
                status: 'running',
                tasks: [],
                startTime: event.timestamp,
                logs: []
            }
            currentTask = null
            return
        }
        
        // Detect TASK markers: TASK [N] Task Name
        const taskMatch = line.match(/^TASK \[(\d+)\] (.+)$/)
        if (taskMatch && currentStage) {
            currentTask = {
                number: parseInt(taskMatch[1]),
                name: taskMatch[2],
                status: 'running',
                logs: []
            }
            currentStage.tasks.push(currentTask)
            return
        }
        
        // Detect task completion: ...ok or ...FAILED or ...skipped
        if (line.includes('...ok') && currentTask) {
            currentTask.status = 'success'
            currentTask = null
            return
        }
        if (line.includes('...FAILED') && currentTask) {
            currentTask.status = 'failed'
            if (currentStage) currentStage.status = 'failed'
            currentTask = null
            return
        }
        if (line.includes('...skipped') && currentTask) {
            currentTask.status = 'skipped'
            currentTask = null
            return
        }
        
        // Detect EXIT_CODE
        const exitMatch = line.match(/EXIT_CODE:(\d+)/)
        if (exitMatch) {
            const exitCode = parseInt(exitMatch[1])
            if (currentStage) {
                currentStage.status = exitCode === 0 ? 'success' : 'failed'
                stages.push(currentStage)
                currentStage = null
            }
            return
        }
        
        // Add log lines
        if (currentTask) {
            currentTask.logs.push(line)
        } else if (currentStage) {
            currentStage.logs.push(line)
        }
    })
    
    // Add any remaining stage
    if (currentStage) {
        stages.push(currentStage)
    }
    
    return stages
}

// Stage component
const Stage = ({ stage, isLast }) => {
    const [expanded, setExpanded] = useState(stage.status === 'running' || stage.status === 'failed')
    
    const getStatusIcon = () => {
        switch (stage.status) {
            case 'success':
                return <CheckCircleIcon sx={{ color: colors.secondary, fontSize: 20 }} />
            case 'failed':
                return <ErrorIcon sx={{ color: colors.error, fontSize: 20 }} />
            case 'running':
                return <HourglassEmptyIcon sx={{ 
                    color: colors.warning, 
                    fontSize: 20,
                    animation: 'spin 1s linear infinite',
                    '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } }
                }} />
            default:
                return <PlayArrowIcon sx={{ color: colors.text.disabled, fontSize: 20 }} />
        }
    }
    
    const getStatusColor = () => {
        switch (stage.status) {
            case 'success': return colors.secondary
            case 'failed': return colors.error
            case 'running': return colors.warning
            default: return colors.text.disabled
        }
    }
    
    const completedTasks = stage.tasks.filter(t => t.status === 'success').length
    const failedTasks = stage.tasks.filter(t => t.status === 'failed').length
    const totalTasks = stage.tasks.length
    
    return (
        <Box sx={{ mb: 1 }}>
            {/* Stage Header */}
            <Box 
                onClick={() => setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    cursor: 'pointer',
                    background: `linear-gradient(90deg, ${getStatusColor()}15 0%, transparent 100%)`,
                    borderLeft: `3px solid ${getStatusColor()}`,
                    borderRadius: '0 8px 8px 0',
                    transition: 'all 0.2s',
                    '&:hover': {
                        background: `linear-gradient(90deg, ${getStatusColor()}25 0%, transparent 100%)`,
                    }
                }}
            >
                {getStatusIcon()}
                <Typography sx={{ 
                    flex: 1, 
                    fontWeight: 600, 
                    color: colors.text.primary,
                    fontSize: '0.95rem'
                }}>
                    {stage.name}
                </Typography>
                
                {/* Task count badges */}
                {totalTasks > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {completedTasks > 0 && (
                            <Chip 
                                size="small" 
                                label={`${completedTasks} ✓`}
                                sx={{ 
                                    height: 22,
                                    fontSize: '0.75rem',
                                    background: `${colors.secondary}30`,
                                    color: colors.secondary,
                                }}
                            />
                        )}
                        {failedTasks > 0 && (
                            <Chip 
                                size="small" 
                                label={`${failedTasks} ✗`}
                                sx={{ 
                                    height: 22,
                                    fontSize: '0.75rem',
                                    background: `${colors.error}30`,
                                    color: colors.error,
                                }}
                            />
                        )}
                        {stage.status === 'running' && (
                            <Chip 
                                size="small" 
                                label={`${completedTasks}/${totalTasks}`}
                                sx={{ 
                                    height: 22,
                                    fontSize: '0.75rem',
                                    background: `${colors.warning}30`,
                                    color: colors.warning,
                                }}
                            />
                        )}
                    </Box>
                )}
                
                <IconButton size="small" sx={{ color: colors.text.disabled }}>
                    {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
            </Box>
            
            {/* Progress bar for running stage */}
            {stage.status === 'running' && (
                <LinearProgress 
                    variant={totalTasks > 0 ? "determinate" : "indeterminate"}
                    value={totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}
                    sx={{
                        height: 2,
                        background: 'rgba(0,0,0,0.2)',
                        '& .MuiLinearProgress-bar': {
                            background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                        }
                    }}
                />
            )}
            
            {/* Tasks */}
            <Collapse in={expanded}>
                <Box sx={{ pl: 4, pr: 2, py: 1 }}>
                    {stage.tasks.map((task, idx) => (
                        <Task key={idx} task={task} />
                    ))}
                    
                    {/* Stage logs */}
                    {stage.logs.filter(l => l.trim()).length > 0 && (
                        <Box sx={{
                            mt: 1,
                            p: 1.5,
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: 1,
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            color: colors.text.muted,
                            maxHeight: 150,
                            overflow: 'auto',
                        }}>
                            {stage.logs.filter(l => l.trim()).map((log, i) => (
                                <Box key={i} sx={{ whiteSpace: 'pre-wrap' }}>{log}</Box>
                            ))}
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Box>
    )
}

// Task component
const Task = ({ task }) => {
    const getStatusIcon = () => {
        switch (task.status) {
            case 'success':
                return <CheckCircleIcon sx={{ color: colors.secondary, fontSize: 16 }} />
            case 'failed':
                return <ErrorIcon sx={{ color: colors.error, fontSize: 16 }} />
            case 'skipped':
                return <PlayArrowIcon sx={{ color: colors.text.disabled, fontSize: 16 }} />
            case 'running':
                return <HourglassEmptyIcon sx={{ 
                    color: colors.warning, 
                    fontSize: 16,
                    animation: 'spin 1s linear infinite',
                    '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } }
                }} />
            default:
                return null
        }
    }
    
    const getStatusColor = () => {
        switch (task.status) {
            case 'success': return colors.secondary
            case 'failed': return colors.error
            case 'running': return colors.warning
            default: return colors.text.disabled
        }
    }
    
    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.5,
            borderLeft: `2px solid ${getStatusColor()}40`,
            pl: 1.5,
            mb: 0.5,
        }}>
            {getStatusIcon()}
            <Typography sx={{ 
                fontSize: '0.85rem', 
                color: task.status === 'failed' ? colors.error : colors.text.secondary 
            }}>
                {task.name}
            </Typography>
            {task.status === 'failed' && task.logs.length > 0 && (
                <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: colors.error,
                    opacity: 0.8,
                    ml: 'auto',
                }}>
                    {task.logs[task.logs.length - 1]?.substring(0, 50)}...
                </Typography>
            )}
        </Box>
    )
}

// Main StageView component
const StageView = ({ events, status, machineName }) => {
    const stages = useMemo(() => parseStages(events), [events])
    const outputRef = useRef(null)
    const [showRawOutput, setShowRawOutput] = useState(false)
    const [copied, setCopied] = useState(false)
    
    // Auto-scroll
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [stages])
    
    const copyOutput = () => {
        const output = events.map(e => e.data).join('\n')
        navigator.clipboard.writeText(output)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    
    const getOverallStatus = () => {
        if (status === 'complete') return 'success'
        if (status === 'error') return 'failed'
        return 'running'
    }
    
    const getStatusColor = () => {
        switch (getOverallStatus()) {
            case 'success': return colors.secondary
            case 'failed': return colors.error
            default: return colors.warning
        }
    }
    
    const completedStages = stages.filter(s => s.status === 'success').length
    const failedStages = stages.filter(s => s.status === 'failed').length
    
    return (
        <Box sx={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            border: `1px solid ${getStatusColor()}33`,
            overflow: 'hidden',
        }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                background: `${getStatusColor()}10`,
                borderBottom: `1px solid ${colors.border.light}`,
            }}>
                {getOverallStatus() === 'success' && <CheckCircleIcon sx={{ color: colors.secondary, fontSize: 28 }} />}
                {getOverallStatus() === 'failed' && <ErrorIcon sx={{ color: colors.error, fontSize: 28 }} />}
                {getOverallStatus() === 'running' && (
                    <HourglassEmptyIcon sx={{ 
                        color: colors.warning, 
                        fontSize: 28,
                        animation: 'spin 1s linear infinite',
                        '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } }
                    }} />
                )}
                
                <Box sx={{ flex: 1 }}>
                    <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '1.1rem' }}>
                        {machineName}
                    </Typography>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                        {stages.length} stages • {completedStages} completed
                        {failedStages > 0 && ` • ${failedStages} failed`}
                    </Typography>
                </Box>
                
                <Tooltip title={showRawOutput ? "Show stages" : "Show raw output"}>
                    <Chip 
                        label={showRawOutput ? "Stages" : "Raw"}
                        size="small"
                        onClick={() => setShowRawOutput(!showRawOutput)}
                        sx={{
                            cursor: 'pointer',
                            background: 'rgba(255,255,255,0.1)',
                            color: colors.text.secondary,
                        }}
                    />
                </Tooltip>
                
                <Tooltip title="Copy output">
                    <IconButton 
                        size="small" 
                        onClick={copyOutput}
                        sx={{ color: copied ? colors.secondary : colors.text.disabled }}
                    >
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            
            {/* Progress bar */}
            {getOverallStatus() === 'running' && (
                <LinearProgress 
                    sx={{
                        height: 3,
                        background: 'rgba(0,0,0,0.2)',
                        '& .MuiLinearProgress-bar': {
                            background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                        }
                    }}
                />
            )}
            
            {/* Content */}
            <Box 
                ref={outputRef}
                sx={{
                    maxHeight: '60vh',
                    minHeight: 200,
                    overflow: 'auto',
                    p: 2,
                }}
            >
                {showRawOutput ? (
                    // Raw output view
                    <Box sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                    }}>
                        {events.map((event, idx) => (
                            <Box 
                                key={idx}
                                sx={{
                                    color: event.type === 'error' ? colors.error : colors.text.secondary,
                                    whiteSpace: 'pre-wrap',
                                    mb: 0.25,
                                }}
                            >
                                {event.data}
                            </Box>
                        ))}
                    </Box>
                ) : (
                    // Stage view
                    stages.length > 0 ? (
                        stages.map((stage, idx) => (
                            <Stage key={idx} stage={stage} isLast={idx === stages.length - 1} />
                        ))
                    ) : (
                        <Typography sx={{ color: colors.text.disabled, fontStyle: 'italic' }}>
                            Waiting for output...
                        </Typography>
                    )
                )}
            </Box>
        </Box>
    )
}

export default StageView
