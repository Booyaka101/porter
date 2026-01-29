import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'

const AgentMonitor = () => {
    const [agents, setAgents] = useState([])
    const [agentData, setAgentData] = useState({})
    const [addDialog, setAddDialog] = useState(false)
    const [newAgentUrl, setNewAgentUrl] = useState('')
    const [newAgentName, setNewAgentName] = useState('')
    const [loading, setLoading] = useState(false)

    // Load saved agents from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('agent-monitors')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setAgents(parsed)
                parsed.forEach(agent => connectToAgent(agent))
            } catch (e) {
                console.error('Failed to load agents:', e)
            }
        }
    }, [])

    // Save agents to localStorage
    const saveAgents = useCallback((agentList) => {
        localStorage.setItem('agent-monitors', JSON.stringify(agentList))
    }, [])

    // Connect to an agent WebSocket
    const connectToAgent = useCallback((agent) => {
        const ws = new WebSocket(`${agent.url}/ws`)
        
        ws.onopen = () => {
            console.log(`Connected to agent: ${agent.name}`)
            setAgentData(prev => ({
                ...prev,
                [agent.id]: { ...prev[agent.id], connected: true, ws }
            }))
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                setAgentData(prev => ({
                    ...prev,
                    [agent.id]: { ...prev[agent.id], ...data, connected: true, ws }
                }))
            } catch (e) {
                console.error('Failed to parse agent data:', e)
            }
        }

        ws.onclose = () => {
            console.log(`Disconnected from agent: ${agent.name}`)
            setAgentData(prev => ({
                ...prev,
                [agent.id]: { ...prev[agent.id], connected: false, ws: null }
            }))
            // Try to reconnect after 5 seconds
            setTimeout(() => connectToAgent(agent), 5000)
        }

        ws.onerror = (error) => {
            console.error(`Agent ${agent.name} error:`, error)
        }
    }, [])

    // Add new agent
    const handleAddAgent = () => {
        if (!newAgentUrl || !newAgentName) return

        const agent = {
            id: Date.now().toString(),
            name: newAgentName,
            url: newAgentUrl.replace(/\/$/, '') // Remove trailing slash
        }

        const updated = [...agents, agent]
        setAgents(updated)
        saveAgents(updated)
        connectToAgent(agent)

        setNewAgentUrl('')
        setNewAgentName('')
        setAddDialog(false)
    }

    // Remove agent
    const handleRemoveAgent = (agentId) => {
        const data = agentData[agentId]
        if (data?.ws) {
            data.ws.close()
        }

        const updated = agents.filter(a => a.id !== agentId)
        setAgents(updated)
        saveAgents(updated)
        
        setAgentData(prev => {
            const newData = { ...prev }
            delete newData[agentId]
            return newData
        })
    }

    // Refresh agent connection
    const handleRefreshAgent = (agent) => {
        const data = agentData[agent.id]
        if (data?.ws) {
            data.ws.close()
        }
        connectToAgent(agent)
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    📡 Agent Monitor
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddDialog(true)}
                >
                    Add Agent
                </Button>
            </Box>

            {agents.length === 0 ? (
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>No agents configured</Typography>
                    <Typography>
                        Add agents running on machines to monitor their real-time metrics.
                        Each agent runs on port 8083 by default.
                    </Typography>
                </Alert>
            ) : (
                <Grid container spacing={3}>
                    {agents.map((agent) => {
                        const data = agentData[agent.id] || {}
                        const connected = data.connected
                        
                        return (
                            <Grid item xs={12} md={6} lg={4} key={agent.id}>
                                <Card sx={{ 
                                    height: '100%',
                                    border: connected ? '2px solid #4caf50' : '2px solid #f44336',
                                    position: 'relative'
                                }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {agent.name}
                                            </Typography>
                                            <Box>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleRefreshAgent(agent)}
                                                    sx={{ mr: 1 }}
                                                >
                                                    <RefreshIcon />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleRemoveAgent(agent.id)}
                                                    color="error"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Box>
                                        </Box>

                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            {connected ? (
                                                <WifiIcon color="success" sx={{ mr: 1 }} />
                                            ) : (
                                                <WifiOffIcon color="error" sx={{ mr: 1 }} />
                                            )}
                                            <Typography variant="body2" color="text.secondary">
                                                {connected ? 'Connected' : 'Disconnected'}
                                            </Typography>
                                        </Box>

                                        {connected && data ? (
                                            <Box>
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    <strong>Hostname:</strong> {data.hostname || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    <strong>Uptime:</strong> {data.uptime || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    <strong>CPU:</strong> {data.cpuUsage?.toFixed(1) || 0}% ({data.cpuCores || 0} cores)
                                                </Typography>
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    <strong>Memory:</strong> {data.memoryUsage?.toFixed(1) || 0}% ({data.memoryUsed || '0'} / {data.memoryTotal || '0'})
                                                </Typography>
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    <strong>Disk:</strong> {data.diskUsage || 0}% ({data.diskUsed || '0'} / {data.diskTotal || '0'})
                                                </Typography>
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    <strong>Processes:</strong> {data.processCount || 0}
                                                </Typography>
                                                {data.loggedInUsers && data.loggedInUsers.length > 0 && (
                                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                                        <strong>Users:</strong> {data.loggedInUsers.join(', ')}
                                                    </Typography>
                                                )}
                                                <Typography variant="caption" color="text.secondary">
                                                    Last update: {new Date((data.timestamp || 0) * 1000).toLocaleTimeString()}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Box sx={{ py: 2 }}>
                                                {loading ? (
                                                    <LinearProgress />
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">
                                                        Waiting for connection...
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}

                                        <Chip
                                            label={agent.url}
                                            size="small"
                                            variant="outlined"
                                            sx={{ mt: 2, fontSize: '0.7rem' }}
                                        />
                                    </CardContent>
                                </Card>
                            </Grid>
                        )
                    })}
                </Grid>
            )}

            <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Agent Monitor</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Agent Name"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        sx={{ mb: 2 }}
                        placeholder="e.g., Production Server"
                    />
                    <TextField
                        fullWidth
                        label="Agent URL"
                        value={newAgentUrl}
                        onChange={(e) => setNewAgentUrl(e.target.value)}
                        placeholder="ws://192.168.1.100:8083"
                        helperText="WebSocket URL of the agent (usually port 8083)"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={handleAddAgent}
                        variant="contained"
                        disabled={!newAgentUrl || !newAgentName}
                    >
                        Add Agent
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default AgentMonitor
