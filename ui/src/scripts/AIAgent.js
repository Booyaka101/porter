import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import SendIcon from '@mui/icons-material/Send'
import PersonIcon from '@mui/icons-material/Person'
import ComputerIcon from '@mui/icons-material/Computer'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CodeIcon from '@mui/icons-material/Code'
import TerminalIcon from '@mui/icons-material/Terminal'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import WarningIcon from '@mui/icons-material/Warning'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SettingsIcon from '@mui/icons-material/Settings'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import BugReportIcon from '@mui/icons-material/BugReport'
import SearchIcon from '@mui/icons-material/Search'
import LinearProgress from '@mui/material/LinearProgress'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import StepContent from '@mui/material/StepContent'
import { colors, gradients, shadows, scrollableStyles } from './theme'
import { useAuth } from './AuthContext'

const AIAgent = () => {
    const { canExecute } = useAuth()
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [sessionId, setSessionId] = useState(null)
    const [config, setConfig] = useState(null)
    const [configLoading, setConfigLoading] = useState(true)
    const [machines, setMachines] = useState([])
    const [selectedMachines, setSelectedMachines] = useState([])
    const [machineSelectOpen, setMachineSelectOpen] = useState(false)
    const [pendingAction, setPendingAction] = useState(null)
    const [actionDialogOpen, setActionDialogOpen] = useState(false)
    const [executionResult, setExecutionResult] = useState(null)
    const [scripts, setScripts] = useState([])
    const [debugMode, setDebugMode] = useState(false)
    const [debugging, setDebugging] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Load AI agent config
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await fetch('/api/ai-agent/config')
                const data = await res.json()
                setConfig(data)
            } catch (err) {
                console.error('Failed to load AI config:', err)
            } finally {
                setConfigLoading(false)
            }
        }
        loadConfig()
    }, [])

    // Load machines
    useEffect(() => {
        const loadMachines = async () => {
            try {
                const res = await fetch('/api/machines')
                const data = await res.json()
                setMachines(data || [])
            } catch (err) {
                console.error('Failed to load machines:', err)
            }
        }
        loadMachines()
    }, [])

    // Load available scripts
    useEffect(() => {
        const loadScripts = async () => {
            try {
                const res = await fetch('/api/ai-agent/scripts')
                const data = await res.json()
                setScripts(data || [])
            } catch (err) {
                console.error('Failed to load scripts:', err)
            }
        }
        loadScripts()
    }, [])

    const startDebug = useCallback(async () => {
        if (!input.trim() || debugging) return

        const userMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setDebugging(true)
        setLoading(true)

        setMessages(prev => [...prev, {
            role: 'debug-progress',
            content: 'Investigating... Running diagnostic commands on target machines.',
            timestamp: new Date().toISOString()
        }])

        try {
            const res = await fetch('/api/ai-agent/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    session_id: sessionId,
                    machine_ids: selectedMachines
                })
            })

            const data = await res.json()

            setMessages(prev => prev.filter(m => m.role !== 'debug-progress'))

            if (data.error) {
                setMessages(prev => [...prev, {
                    role: 'error',
                    content: data.error,
                    timestamp: new Date().toISOString()
                }])
            } else {
                if (data.session_id) setSessionId(data.session_id)
                setMessages(prev => [...prev, {
                    role: 'debug-result',
                    content: data.summary,
                    steps: data.steps,
                    timestamp: data.timestamp || new Date().toISOString()
                }])
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.role !== 'debug-progress'))
            setMessages(prev => [...prev, {
                role: 'error',
                content: `Debug failed: ${err.message}`,
                timestamp: new Date().toISOString()
            }])
        } finally {
            setDebugging(false)
            setLoading(false)
        }
    }, [input, debugging, sessionId, selectedMachines])

    const sendMessage = useCallback(async () => {
        if (!input.trim() || loading) return

        // Auto-detect debug intent and route to debug endpoint
        const debugKeywords = /\b(debug|diagnose|investigate|troubleshoot|what'?s wrong)\b/i
        if (debugKeywords.test(input.trim())) {
            return startDebug()
        }

        const userMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setLoading(true)

        try {
            const res = await fetch('/api/ai-agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    session_id: sessionId,
                    machine_ids: selectedMachines
                })
            })

            const data = await res.json()

            if (data.error) {
                setMessages(prev => [...prev, {
                    role: 'error',
                    content: data.error,
                    timestamp: new Date().toISOString()
                }])
            } else {
                setSessionId(data.session_id)
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message,
                    actions: data.actions,
                    tokens: data.tokens_used,
                    timestamp: data.timestamp
                }])

                // If there are actions, show confirmation dialog
                if (data.actions && data.actions.length > 0) {
                    setPendingAction(data.actions[0])
                    setActionDialogOpen(true)
                }
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'error',
                content: `Failed to send message: ${err.message}`,
                timestamp: new Date().toISOString()
            }])
        } finally {
            setLoading(false)
        }
    }, [input, loading, sessionId, selectedMachines, startDebug])

    const executeAction = async (action) => {
        setActionDialogOpen(false)
        setLoading(true)

        try {
            const res = await fetch('/api/ai-agent/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    confirmed: true,
                    action: {
                        ...action,
                        machine_ids: action.machine_ids?.length > 0 ? action.machine_ids : selectedMachines
                    }
                })
            })

            const data = await res.json()
            setExecutionResult(data)

            // Add execution result to messages
            if (data.success) {
                setMessages(prev => [...prev, {
                    role: 'system',
                    content: action.type === 'execute_script' 
                        ? `Script execution started. Execution ID: ${data.execution_id}`
                        : `Command executed successfully on ${data.results?.length || 0} machine(s)`,
                    timestamp: new Date().toISOString(),
                    execution: data
                }])
            } else {
                setMessages(prev => [...prev, {
                    role: 'error',
                    content: data.error || 'Execution failed',
                    timestamp: new Date().toISOString()
                }])
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'error',
                content: `Execution failed: ${err.message}`,
                timestamp: new Date().toISOString()
            }])
        } finally {
            setLoading(false)
            setPendingAction(null)
        }
    }

    const clearSession = async () => {
        if (sessionId) {
            try {
                await fetch(`/api/ai-agent/session/${sessionId}`, { method: 'DELETE' })
            } catch (err) {
                console.error('Failed to clear session:', err)
            }
        }
        setMessages([])
        setSessionId(null)
        setExecutionResult(null)
    }

    const toggleMachine = (machineId) => {
        setSelectedMachines(prev => 
            prev.includes(machineId) 
                ? prev.filter(id => id !== machineId)
                : [...prev, machineId]
        )
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
    }

    // Render message content with code blocks
    const renderMessageContent = (content) => {
        const parts = content.split(/(```[\s\S]*?```)/g)
        return parts.map((part, index) => {
            if (part.startsWith('```')) {
                const match = part.match(/```(\w+)?\n?([\s\S]*?)```/)
                if (match) {
                    const lang = match[1] || ''
                    const code = match[2]
                    return (
                        <Box key={index} sx={{ my: 1, position: 'relative' }}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(0,0,0,0.3)',
                                px: 2,
                                py: 0.5,
                                borderTopLeftRadius: 8,
                                borderTopRightRadius: 8,
                            }}>
                                <Typography sx={{ fontSize: '0.75rem', color: colors.text.muted }}>
                                    {lang || 'code'}
                                </Typography>
                                <IconButton size="small" onClick={() => copyToClipboard(code)}>
                                    <ContentCopyIcon sx={{ fontSize: 14, color: colors.text.muted }} />
                                </IconButton>
                            </Box>
                            <Box sx={{
                                background: 'rgba(0,0,0,0.4)',
                                p: 2,
                                borderBottomLeftRadius: 8,
                                borderBottomRightRadius: 8,
                                overflow: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.85rem',
                                color: colors.text.primary,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}>
                                {code}
                            </Box>
                        </Box>
                    )
                }
            }
            return (
                <Typography key={index} sx={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    '& strong': { fontWeight: 700 },
                    '& code': { 
                        background: 'rgba(249, 115, 22, 0.1)', 
                        px: 0.5, 
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.9em'
                    }
                }}>
                    {part}
                </Typography>
            )
        })
    }

    if (configLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress sx={{ color: colors.primary }} />
            </Box>
        )
    }

    if (!config?.configured && !config?.has_api_key) {
        return (
            <Box sx={{ p: 4 }}>
                <Card sx={{
                    background: colors.background.card,
                    border: `1px solid ${colors.border.light}`,
                    borderRadius: '16px',
                    maxWidth: 600,
                    mx: 'auto',
                }}>
                    <CardContent sx={{ p: 4, textAlign: 'center' }}>
                        <SmartToyIcon sx={{ fontSize: 64, color: colors.text.muted, mb: 2 }} />
                        <Typography variant="h5" sx={{ color: colors.text.primary, mb: 2 }}>
                            AI Agent Not Configured
                        </Typography>
                        <Typography sx={{ color: colors.text.muted, mb: 3 }}>
                            To use the AI Agent, you need to configure an LLM provider.
                        </Typography>
                        <Alert severity="info" sx={{ textAlign: 'left', mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                Option 1: Environment Variable
                            </Typography>
                            <code>PORTER_AI_API_KEY=your-api-key</code>
                        </Alert>
                        <Alert severity="info" sx={{ textAlign: 'left' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                Option 2: Wrapper Configuration
                            </Typography>
                            <Typography variant="body2">
                                Configure AIAgentConfig in your Porter wrapper with script descriptions.
                            </Typography>
                        </Alert>
                    </CardContent>
                </Card>
            </Box>
        )
    }

    return (
        <Box sx={{ 
            height: 'calc(100vh - 80px)', 
            display: 'flex', 
            flexDirection: 'column',
            p: 2,
        }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                px: 1,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '14px',
                        background: gradients.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: shadows.glow,
                    }}>
                        <SmartToyIcon sx={{ color: '#fff', fontSize: 28 }} />
                    </Box>
                    <Box>
                        <Typography sx={{ 
                            fontSize: '1.5rem', 
                            fontWeight: 700, 
                            color: colors.text.primary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        }}>
                            Porter AI
                            <AutoAwesomeIcon sx={{ fontSize: 20, color: colors.primary }} />
                        </Typography>
                        <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                            {config?.provider || 'OpenAI'} • {config?.model || 'gpt-4'}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* Machine selector */}
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ComputerIcon />}
                        onClick={() => setMachineSelectOpen(!machineSelectOpen)}
                        sx={{
                            borderColor: selectedMachines.length > 0 ? colors.primary : colors.border.light,
                            color: selectedMachines.length > 0 ? colors.primary : colors.text.secondary,
                            '&:hover': {
                                borderColor: colors.primary,
                                background: 'rgba(249, 115, 22, 0.1)',
                            }
                        }}
                    >
                        {selectedMachines.length > 0 ? `${selectedMachines.length} Selected` : 'Select Machines'}
                    </Button>

                    <Tooltip title="Clear conversation">
                        <IconButton onClick={clearSession} sx={{ color: colors.text.muted }}>
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Machine selector collapse */}
            <Collapse in={machineSelectOpen}>
                <Card sx={{
                    background: colors.background.card,
                    border: `1px solid ${colors.border.light}`,
                    borderRadius: '12px',
                    mb: 2,
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mb: 1 }}>
                            Select machines for script execution:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {machines.map(machine => (
                                <Chip
                                    key={machine.id}
                                    label={machine.name}
                                    icon={<ComputerIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => toggleMachine(machine.id)}
                                    sx={{
                                        background: selectedMachines.includes(machine.id) 
                                            ? 'rgba(249, 115, 22, 0.2)' 
                                            : 'rgba(255,255,255,0.05)',
                                        border: selectedMachines.includes(machine.id)
                                            ? `1px solid ${colors.primary}`
                                            : '1px solid transparent',
                                        color: selectedMachines.includes(machine.id) 
                                            ? colors.primary 
                                            : colors.text.secondary,
                                        '&:hover': {
                                            background: 'rgba(249, 115, 22, 0.15)',
                                        }
                                    }}
                                />
                            ))}
                            {machines.length === 0 && (
                                <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                                    No machines available
                                </Typography>
                            )}
                        </Box>
                    </CardContent>
                </Card>
            </Collapse>

            {/* Messages area */}
            <Box sx={{
                flex: 1,
                overflow: 'auto',
                ...scrollableStyles.customScrollbar,
                mb: 2,
            }}>
                {messages.length === 0 ? (
                    <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        height: '100%',
                        opacity: 0.7,
                    }}>
                        <SmartToyIcon sx={{ fontSize: 80, color: colors.text.muted, mb: 2 }} />
                        <Typography sx={{ color: colors.text.muted, fontSize: '1.1rem', mb: 1 }}>
                            How can I help you today?
                        </Typography>
                        <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', textAlign: 'center', maxWidth: 400 }}>
                            I can help you run scripts, execute commands, and manage your machines.
                            {selectedMachines.length === 0 && ' Select some machines to get started.'}
                        </Typography>
                        
                        {/* Quick suggestions */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3, justifyContent: 'center' }}>
                            {[
                                'What scripts are available?',
                                'Show me the status of all machines',
                                'Check disk and memory usage',
                                'Investigate network connectivity',
                            ].map((suggestion, i) => (
                                <Chip
                                    key={i}
                                    label={suggestion}
                                    onClick={() => setInput(suggestion)}
                                    sx={{
                                        background: 'rgba(255,255,255,0.05)',
                                        color: colors.text.secondary,
                                        '&:hover': {
                                            background: 'rgba(249, 115, 22, 0.1)',
                                            color: colors.primary,
                                        }
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
                        {messages.map((msg, index) => (
                            <Box
                                key={index}
                                sx={{
                                    display: 'flex',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                }}
                            >
                                <Box sx={{
                                    maxWidth: '80%',
                                    display: 'flex',
                                    gap: 1.5,
                                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                }}>
                                    {/* Avatar */}
                                    <Box sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '10px',
                                        background: msg.role === 'user' 
                                            ? 'rgba(139, 92, 246, 0.2)'
                                            : msg.role === 'error'
                                            ? 'rgba(239, 68, 68, 0.2)'
                                            : msg.role === 'system'
                                            ? 'rgba(34, 197, 94, 0.2)'
                                            : (msg.role === 'debug-result' || msg.role === 'debug-progress')
                                            ? 'rgba(59, 130, 246, 0.2)'
                                            : gradients.primary,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {msg.role === 'user' ? (
                                            <PersonIcon sx={{ fontSize: 20, color: colors.tertiary }} />
                                        ) : msg.role === 'error' ? (
                                            <ErrorIcon sx={{ fontSize: 20, color: colors.error }} />
                                        ) : msg.role === 'system' ? (
                                            <CheckCircleIcon sx={{ fontSize: 20, color: colors.secondary }} />
                                        ) : (msg.role === 'debug-result' || msg.role === 'debug-progress') ? (
                                            <BugReportIcon sx={{ fontSize: 20, color: '#3b82f6' }} />
                                        ) : (
                                            <SmartToyIcon sx={{ fontSize: 20, color: '#fff' }} />
                                        )}
                                    </Box>

                                    {/* Message content */}
                                    <Card sx={{
                                        background: msg.role === 'user'
                                            ? 'rgba(139, 92, 246, 0.1)'
                                            : msg.role === 'error'
                                            ? 'rgba(239, 68, 68, 0.1)'
                                            : msg.role === 'system'
                                            ? 'rgba(34, 197, 94, 0.1)'
                                            : (msg.role === 'debug-result' || msg.role === 'debug-progress')
                                            ? 'rgba(59, 130, 246, 0.05)'
                                            : colors.background.card,
                                        border: `1px solid ${
                                            msg.role === 'user'
                                                ? 'rgba(139, 92, 246, 0.2)'
                                                : msg.role === 'error'
                                                ? 'rgba(239, 68, 68, 0.2)'
                                                : msg.role === 'system'
                                                ? 'rgba(34, 197, 94, 0.2)'
                                                : (msg.role === 'debug-result' || msg.role === 'debug-progress')
                                                ? 'rgba(59, 130, 246, 0.2)'
                                                : colors.border.light
                                        }`,
                                        borderRadius: '12px',
                                        ...(msg.role === 'debug-result' ? { maxWidth: '100%', width: '100%' } : {}),
                                    }}>
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                            {msg.role === 'debug-progress' ? (
                                                <Box>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                        <SearchIcon sx={{ fontSize: 18, color: '#3b82f6' }} />
                                                        <Typography sx={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.9rem' }}>
                                                            Investigating...
                                                        </Typography>
                                                    </Box>
                                                    <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mb: 1 }}>
                                                        Running diagnostic commands on target machines. This may take a minute.
                                                    </Typography>
                                                    <LinearProgress sx={{ 
                                                        borderRadius: 4,
                                                        '& .MuiLinearProgress-bar': { background: '#3b82f6' },
                                                        background: 'rgba(59, 130, 246, 0.1)',
                                                    }} />
                                                </Box>
                                            ) : msg.role === 'debug-result' ? (
                                                <Box>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                        <BugReportIcon sx={{ fontSize: 20, color: '#3b82f6' }} />
                                                        <Typography sx={{ color: '#3b82f6', fontWeight: 700, fontSize: '1rem' }}>
                                                            Debug Investigation Complete
                                                        </Typography>
                                                        <Chip label={`${msg.steps?.length || 0} steps`} size="small" sx={{
                                                            background: 'rgba(59, 130, 246, 0.1)',
                                                            color: '#3b82f6',
                                                            fontSize: '0.75rem',
                                                        }} />
                                                    </Box>

                                                    {/* Investigation Steps */}
                                                    {msg.steps && msg.steps.length > 0 && (
                                                        <Box sx={{ mb: 2 }}>
                                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem', mb: 1, fontWeight: 600 }}>
                                                                Investigation Steps:
                                                            </Typography>
                                                            {msg.steps.map((step, si) => (
                                                                <Box key={si} sx={{
                                                                    mb: 1,
                                                                    background: 'rgba(0,0,0,0.2)',
                                                                    borderRadius: '8px',
                                                                    p: 1.5,
                                                                    borderLeft: `3px solid ${step.error && !step.output ? '#ef4444' : '#22c55e'}`,
                                                                }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                                        <Chip label={`Step ${step.step}`} size="small" sx={{
                                                                            background: 'rgba(255,255,255,0.05)',
                                                                            color: colors.text.muted,
                                                                            fontSize: '0.7rem',
                                                                            height: 20,
                                                                        }} />
                                                                        <Typography sx={{ color: colors.text.secondary, fontSize: '0.8rem', fontWeight: 600 }}>
                                                                            {step.action}
                                                                        </Typography>
                                                                        {step.machine && (
                                                                            <Chip label={step.machine} size="small" sx={{
                                                                                background: 'rgba(249, 115, 22, 0.1)',
                                                                                color: colors.primary,
                                                                                fontSize: '0.7rem',
                                                                                height: 20,
                                                                            }} />
                                                                        )}
                                                                    </Box>
                                                                    <Typography sx={{ 
                                                                        color: colors.text.muted, 
                                                                        fontSize: '0.75rem',
                                                                        fontFamily: 'monospace',
                                                                        mb: 0.5,
                                                                    }}>
                                                                        $ {step.command}
                                                                    </Typography>
                                                                    {step.output && (
                                                                        <Box sx={{
                                                                            background: 'rgba(0,0,0,0.3)',
                                                                            borderRadius: '4px',
                                                                            p: 1,
                                                                            maxHeight: 150,
                                                                            overflow: 'auto',
                                                                            ...scrollableStyles.customScrollbar,
                                                                        }}>
                                                                            <Typography sx={{ 
                                                                                fontFamily: 'monospace',
                                                                                fontSize: '0.75rem',
                                                                                color: colors.text.secondary,
                                                                                whiteSpace: 'pre-wrap',
                                                                                wordBreak: 'break-word',
                                                                            }}>
                                                                                {step.output}
                                                                            </Typography>
                                                                        </Box>
                                                                    )}
                                                                    {step.error && (
                                                                        <Typography sx={{ color: '#ef4444', fontSize: '0.75rem', mt: 0.5 }}>
                                                                            {step.error}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            ))}
                                                        </Box>
                                                    )}

                                                    <Divider sx={{ borderColor: 'rgba(59, 130, 246, 0.2)', my: 2 }} />

                                                    {/* Analysis Summary */}
                                                    <Box sx={{
                                                        background: 'rgba(59, 130, 246, 0.05)',
                                                        borderRadius: '8px',
                                                        p: 2,
                                                        border: '1px solid rgba(59, 130, 246, 0.15)',
                                                    }}>
                                                        <Typography sx={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
                                                            Analysis & Recommendations
                                                        </Typography>
                                                        {renderMessageContent(msg.content)}
                                                    </Box>
                                                </Box>
                                            ) : (
                                                <>{renderMessageContent(msg.content)}</>
                                            )}
                                            
                                            {/* Actions */}
                                            {msg.actions && msg.actions.length > 0 && (
                                                <Box sx={{ mt: 2 }}>
                                                    <Divider sx={{ borderColor: colors.border.light, mb: 2 }} />
                                                    <Typography sx={{ 
                                                        color: colors.text.muted, 
                                                        fontSize: '0.8rem', 
                                                        mb: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                    }}>
                                                        <PlayArrowIcon sx={{ fontSize: 16 }} />
                                                        Suggested Actions:
                                                    </Typography>
                                                    {msg.actions.map((action, i) => (
                                                        <Box key={i} sx={{
                                                            background: 'rgba(249, 115, 22, 0.1)',
                                                            border: `1px solid ${colors.border.accent}`,
                                                            borderRadius: '8px',
                                                            p: 1.5,
                                                            mb: 1,
                                                        }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                                {action.type === 'execute_script' ? (
                                                                    <CodeIcon sx={{ fontSize: 18, color: colors.primary }} />
                                                                ) : (
                                                                    <TerminalIcon sx={{ fontSize: 18, color: colors.primary }} />
                                                                )}
                                                                <Typography sx={{ 
                                                                    color: colors.primary, 
                                                                    fontWeight: 600,
                                                                    fontSize: '0.9rem',
                                                                }}>
                                                                    {action.type === 'execute_script' ? 'Execute Script' : 'Run Command'}
                                                                </Typography>
                                                            </Box>
                                                            <Typography sx={{ 
                                                                color: colors.text.secondary, 
                                                                fontSize: '0.85rem',
                                                                fontFamily: 'monospace',
                                                            }}>
                                                                {action.script_path || action.command}
                                                            </Typography>
                                                            {canExecute() && (
                                                                <Button
                                                                    size="small"
                                                                    variant="contained"
                                                                    startIcon={<PlayArrowIcon />}
                                                                    onClick={() => {
                                                                        setPendingAction(action)
                                                                        setActionDialogOpen(true)
                                                                    }}
                                                                    sx={{
                                                                        mt: 1,
                                                                        background: gradients.primary,
                                                                        color: colors.background.dark,
                                                                        fontWeight: 600,
                                                                        '&:hover': {
                                                                            background: gradients.primaryHover,
                                                                        }
                                                                    }}
                                                                >
                                                                    Execute
                                                                </Button>
                                                            )}
                                                        </Box>
                                                    ))}
                                                </Box>
                                            )}

                                            {/* Execution result */}
                                            {msg.execution && (
                                                <Box sx={{ mt: 1 }}>
                                                    {msg.execution.results?.map((result, i) => (
                                                        <Box key={i} sx={{
                                                            background: 'rgba(0,0,0,0.2)',
                                                            borderRadius: '8px',
                                                            p: 1.5,
                                                            mt: 1,
                                                        }}>
                                                            <Typography sx={{ 
                                                                color: colors.text.muted, 
                                                                fontSize: '0.8rem',
                                                                mb: 0.5,
                                                            }}>
                                                                Output from {result.machine_name}:
                                                            </Typography>
                                                            <Typography sx={{ 
                                                                fontFamily: 'monospace',
                                                                fontSize: '0.85rem',
                                                                color: colors.text.secondary,
                                                                whiteSpace: 'pre-wrap',
                                                                maxHeight: 200,
                                                                overflow: 'auto',
                                                            }}>
                                                                {result.output}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            )}

                                            {/* Timestamp */}
                                            <Typography sx={{ 
                                                color: colors.text.disabled, 
                                                fontSize: '0.7rem',
                                                mt: 1,
                                                textAlign: msg.role === 'user' ? 'right' : 'left',
                                            }}>
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                                {msg.tokens && ` • ${msg.tokens} tokens`}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Box>
                            </Box>
                        ))}
                        <div ref={messagesEndRef} />
                    </Box>
                )}
            </Box>

            {/* Input area */}
            <Box sx={{
                display: 'flex',
                gap: 1,
                p: 2,
                background: colors.background.card,
                borderRadius: '16px',
                border: `1px solid ${colors.border.light}`,
            }}>
                <TextField
                    ref={inputRef}
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder={selectedMachines.length > 0 
                        ? "Ask me to run scripts or commands..." 
                        : "Select machines first, then ask me anything..."
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '12px',
                            '& fieldset': { borderColor: 'transparent' },
                            '&:hover fieldset': { borderColor: colors.border.light },
                            '&.Mui-focused fieldset': { borderColor: colors.primary },
                        },
                        '& .MuiInputBase-input': {
                            color: colors.text.primary,
                        }
                    }}
                />
                <Tooltip title="Debug / Investigate">
                    <span>
                        <Button
                            variant="contained"
                            onClick={startDebug}
                            disabled={!input.trim() || loading}
                            sx={{
                                minWidth: 56,
                                height: 56,
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                                },
                                '&.Mui-disabled': {
                                    background: 'rgba(255,255,255,0.1)',
                                }
                            }}
                        >
                            {debugging ? (
                                <CircularProgress size={24} sx={{ color: '#fff' }} />
                            ) : (
                                <BugReportIcon />
                            )}
                        </Button>
                    </span>
                </Tooltip>
                <Button
                    variant="contained"
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    sx={{
                        minWidth: 56,
                        height: 56,
                        borderRadius: '12px',
                        background: gradients.primary,
                        '&:hover': {
                            background: gradients.primaryHover,
                        },
                        '&.Mui-disabled': {
                            background: 'rgba(255,255,255,0.1)',
                        }
                    }}
                >
                    {loading && !debugging ? (
                        <CircularProgress size={24} sx={{ color: colors.background.dark }} />
                    ) : (
                        <SendIcon />
                    )}
                </Button>
            </Box>

            {/* Action confirmation dialog */}
            <Dialog
                open={actionDialogOpen}
                onClose={() => setActionDialogOpen(false)}
                PaperProps={{
                    sx: {
                        background: colors.background.elevated,
                        border: `1px solid ${colors.border.light}`,
                        borderRadius: '16px',
                        minWidth: 400,
                    }
                }}
            >
                <DialogTitle sx={{ 
                    color: colors.text.primary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}>
                    <WarningIcon sx={{ color: colors.warning }} />
                    Confirm Action
                </DialogTitle>
                <DialogContent>
                    {pendingAction && (
                        <Box>
                            <Typography sx={{ color: colors.text.secondary, mb: 2 }}>
                                The AI wants to execute the following:
                            </Typography>
                            <Box sx={{
                                background: 'rgba(0,0,0,0.3)',
                                borderRadius: '8px',
                                p: 2,
                                mb: 2,
                            }}>
                                <Typography sx={{ 
                                    color: colors.primary, 
                                    fontWeight: 600,
                                    mb: 1,
                                }}>
                                    {pendingAction.type === 'execute_script' ? 'Script' : 'Command'}:
                                </Typography>
                                <Typography sx={{ 
                                    color: colors.text.primary,
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                }}>
                                    {pendingAction.script_path || pendingAction.command}
                                </Typography>
                            </Box>
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                                Target machines: {
                                    (pendingAction.machine_ids?.length > 0 
                                        ? pendingAction.machine_ids 
                                        : selectedMachines
                                    ).map(id => machines.find(m => m.id === id)?.name || id).join(', ') || 'None selected'
                                }
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button 
                        onClick={() => setActionDialogOpen(false)}
                        sx={{ color: colors.text.muted }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => executeAction(pendingAction)}
                        disabled={selectedMachines.length === 0 && !pendingAction?.machine_ids?.length}
                        sx={{
                            background: gradients.primary,
                            color: colors.background.dark,
                            fontWeight: 600,
                            '&:hover': {
                                background: gradients.primaryHover,
                            }
                        }}
                    >
                        Execute
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default AIAgent
