import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ComputerIcon from '@mui/icons-material/Computer'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import MemoryIcon from '@mui/icons-material/Memory'
import StorageIcon from '@mui/icons-material/Storage'
import SpeedIcon from '@mui/icons-material/Speed'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { colors } from './theme'

// Memoized Machine Selector component to prevent re-renders
const MachineSelector = memo(({ value, onChange, label, otherValue, machines }) => (
    <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label={label}
            MenuProps={{
                PaperProps: {
                    sx: {
                        bgcolor: 'rgba(20, 20, 20, 0.98)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        maxHeight: 300
                    }
                }
            }}
            sx={{
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(249, 115, 22, 0.4)' },
            }}
        >
            <MenuItem value="">Select a machine</MenuItem>
            {machines.map(m => (
                <MenuItem 
                    key={m.id} 
                    value={m.id}
                    disabled={m.id === otherValue}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                    <ComputerIcon sx={{ fontSize: 16, color: m.status === 'online' ? '#22c55e' : '#ff3333' }} />
                    {m.name} ({m.ip})
                </MenuItem>
            ))}
        </Select>
    </FormControl>
))

const MachineComparison = () => {
    const navigate = useNavigate()
    const [machines, setMachines] = useState([])
    const [machine1Id, setMachine1Id] = useState('')
    const [machine2Id, setMachine2Id] = useState('')
    const [machine1Data, setMachine1Data] = useState(null)
    const [machine2Data, setMachine2Data] = useState(null)
    const [loading1, setLoading1] = useState(false)
    const [loading2, setLoading2] = useState(false)
    
    // Track last loaded IDs to prevent duplicate fetches
    const lastLoaded1 = useRef('')
    const lastLoaded2 = useRef('')

    // Load machines list - only once
    useEffect(() => {
        let mounted = true
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => {
                if (mounted) setMachines(data || [])
            })
            .catch(() => {})
        return () => { mounted = false }
    }, [])

    // Load machine 1 data
    useEffect(() => {
        if (machine1Id === lastLoaded1.current) return
        lastLoaded1.current = machine1Id
        
        if (!machine1Id) {
            setMachine1Data(null)
            return
        }
        
        let mounted = true
        setLoading1(true)
        
        const loadData = async () => {
            try {
                const machineRes = await fetch(`/api/machines/${machine1Id}`)
                const machine = await machineRes.json()

                const healthRes = await fetch(`/api/machines/${machine1Id}/health`)
                const health = await healthRes.json()

                let servicesCount = { running: 0, total: 0 }
                try {
                    const servicesRes = await fetch(`/api/machines/${machine1Id}/services`)
                    const services = await servicesRes.json()
                    servicesCount.total = services.services?.length || 0
                    servicesCount.running = services.services?.filter(s => s.status === 'active' || s.subState === 'running').length || 0
                } catch {}

                let dockerInfo = null
                try {
                    const dockerRes = await fetch(`/api/machines/${machine1Id}/docker/info`)
                    dockerInfo = await dockerRes.json()
                } catch {}

                if (mounted) {
                    setMachine1Data({ machine, health, servicesCount, dockerInfo })
                }
            } catch (err) {
                console.error('Failed to load machine 1 data:', err)
                if (mounted) setMachine1Data({ error: err.message })
            } finally {
                if (mounted) setLoading1(false)
            }
        }
        
        loadData()
        return () => { mounted = false }
    }, [machine1Id])

    // Load machine 2 data
    useEffect(() => {
        if (machine2Id === lastLoaded2.current) return
        lastLoaded2.current = machine2Id
        
        if (!machine2Id) {
            setMachine2Data(null)
            return
        }
        
        let mounted = true
        setLoading2(true)
        
        const loadData = async () => {
            try {
                const machineRes = await fetch(`/api/machines/${machine2Id}`)
                const machine = await machineRes.json()

                const healthRes = await fetch(`/api/machines/${machine2Id}/health`)
                const health = await healthRes.json()

                let servicesCount = { running: 0, total: 0 }
                try {
                    const servicesRes = await fetch(`/api/machines/${machine2Id}/services`)
                    const services = await servicesRes.json()
                    servicesCount.total = services.services?.length || 0
                    servicesCount.running = services.services?.filter(s => s.status === 'active' || s.subState === 'running').length || 0
                } catch {}

                let dockerInfo = null
                try {
                    const dockerRes = await fetch(`/api/machines/${machine2Id}/docker/info`)
                    dockerInfo = await dockerRes.json()
                } catch {}

                if (mounted) {
                    setMachine2Data({ machine, health, servicesCount, dockerInfo })
                }
            } catch (err) {
                console.error('Failed to load machine 2 data:', err)
                if (mounted) setMachine2Data({ error: err.message })
            } finally {
                if (mounted) setLoading2(false)
            }
        }
        
        loadData()
        return () => { mounted = false }
    }, [machine2Id])

    const swapMachines = () => {
        // Reset refs to allow reload after swap
        lastLoaded1.current = ''
        lastLoaded2.current = ''
        const temp = machine1Id
        setMachine1Id(machine2Id)
        setMachine2Id(temp)
    }

    const refreshBoth = useCallback(() => {
        // Reset refs to force reload
        lastLoaded1.current = ''
        lastLoaded2.current = ''
        // Force re-render by temporarily clearing and restoring
        const id1 = machine1Id
        const id2 = machine2Id
        setMachine1Id('')
        setMachine2Id('')
        setTimeout(() => {
            setMachine1Id(id1)
            setMachine2Id(id2)
        }, 0)
    }, [machine1Id, machine2Id])

    const ComparisonRow = ({ label, value1, value2, icon: Icon, highlight }) => {
        const isDifferent = value1 !== value2 && value1 && value2
        return (
            <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 200px 1fr', 
                gap: 2, 
                py: 1.5,
                px: 2,
                borderRadius: 1,
                bgcolor: highlight ? 'rgba(249, 115, 22, 0.05)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }
            }}>
                <Box sx={{ 
                    textAlign: 'right', 
                    color: isDifferent ? '#f97316' : colors.text.primary,
                    fontWeight: isDifferent ? 600 : 400,
                    fontFamily: 'monospace',
                    fontSize: '0.9rem'
                }}>
                    {value1 || '-'}
                </Box>
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 1,
                    color: colors.text.muted
                }}>
                    {Icon && <Icon sx={{ fontSize: 16 }} />}
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>{label}</Typography>
                </Box>
                <Box sx={{ 
                    textAlign: 'left', 
                    color: isDifferent ? '#22c55e' : colors.text.primary,
                    fontWeight: isDifferent ? 600 : 400,
                    fontFamily: 'monospace',
                    fontSize: '0.9rem'
                }}>
                    {value2 || '-'}
                </Box>
            </Box>
        )
    }


    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                <CompareArrowsIcon sx={{ fontSize: 32, color: '#f97316' }} />
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: colors.text.primary }}>
                        Machine Comparison
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.text.muted }}>
                        Compare configurations and status of two machines side-by-side
                    </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Refresh Both">
                    <IconButton onClick={refreshBoth} disabled={!machine1Id && !machine2Id}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Machine Selectors */}
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 2, alignItems: 'center' }}>
                    <MachineSelector 
                        value={machine1Id} 
                        onChange={setMachine1Id} 
                        label="Machine 1"
                        otherValue={machine2Id}
                        machines={machines}
                    />
                    <Tooltip title="Swap Machines">
                        <IconButton onClick={swapMachines} disabled={!machine1Id || !machine2Id}>
                            <SwapHorizIcon sx={{ color: '#f97316' }} />
                        </IconButton>
                    </Tooltip>
                    <MachineSelector 
                        value={machine2Id} 
                        onChange={setMachine2Id} 
                        label="Machine 2"
                        otherValue={machine1Id}
                        machines={machines}
                    />
                </Box>
            </Paper>

            {/* Comparison Results */}
            {(machine1Id || machine2Id) && (
                <Paper sx={{ bgcolor: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                    {/* Headers */}
                    <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 200px 1fr', 
                        gap: 2, 
                        p: 2,
                        bgcolor: 'rgba(249, 115, 22, 0.1)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Box sx={{ textAlign: 'right' }}>
                            {loading1 ? (
                                <CircularProgress size={20} />
                            ) : machine1Data?.machine ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                    <Typography sx={{ fontWeight: 600, color: '#f97316' }}>
                                        {machine1Data.machine.name}
                                    </Typography>
                                    {machine1Data.machine.status === 'online' ? (
                                        <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                                    ) : (
                                        <ErrorIcon sx={{ fontSize: 16, color: '#ff3333' }} />
                                    )}
                                </Box>
                            ) : (
                                <Typography sx={{ color: colors.text.muted }}>Select Machine 1</Typography>
                            )}
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                            <CompareArrowsIcon sx={{ color: colors.text.muted }} />
                        </Box>
                        <Box sx={{ textAlign: 'left' }}>
                            {loading2 ? (
                                <CircularProgress size={20} />
                            ) : machine2Data?.machine ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {machine2Data.machine.status === 'online' ? (
                                        <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                                    ) : (
                                        <ErrorIcon sx={{ fontSize: 16, color: '#ff3333' }} />
                                    )}
                                    <Typography sx={{ fontWeight: 600, color: '#22c55e' }}>
                                        {machine2Data.machine.name}
                                    </Typography>
                                </Box>
                            ) : (
                                <Typography sx={{ color: colors.text.muted }}>Select Machine 2</Typography>
                            )}
                        </Box>
                    </Box>

                    {/* Comparison Data */}
                    <Box sx={{ p: 1 }}>
                        {/* Basic Info */}
                        <Typography variant="overline" sx={{ color: colors.text.muted, px: 2, display: 'block', mt: 1 }}>
                            Basic Information
                        </Typography>
                        <ComparisonRow 
                            label="IP Address" 
                            value1={machine1Data?.machine?.ip} 
                            value2={machine2Data?.machine?.ip}
                            icon={ComputerIcon}
                        />
                        <ComparisonRow 
                            label="Username" 
                            value1={machine1Data?.machine?.username} 
                            value2={machine2Data?.machine?.username}
                        />
                        <ComparisonRow 
                            label="Status" 
                            value1={machine1Data?.machine?.status} 
                            value2={machine2Data?.machine?.status}
                        />

                        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.05)' }} />

                        {/* System Health */}
                        <Typography variant="overline" sx={{ color: colors.text.muted, px: 2, display: 'block' }}>
                            System Health
                        </Typography>
                        <ComparisonRow 
                            label="Uptime" 
                            value1={machine1Data?.health?.uptime} 
                            value2={machine2Data?.health?.uptime}
                            icon={AccessTimeIcon}
                            highlight
                        />
                        <ComparisonRow 
                            label="Load Average" 
                            value1={machine1Data?.health?.load_avg} 
                            value2={machine2Data?.health?.load_avg}
                            icon={SpeedIcon}
                        />
                        <ComparisonRow 
                            label="Memory Usage" 
                            value1={machine1Data?.health?.memory_usage} 
                            value2={machine2Data?.health?.memory_usage}
                            icon={MemoryIcon}
                        />
                        <ComparisonRow 
                            label="Disk Usage" 
                            value1={machine1Data?.health?.disk_usage} 
                            value2={machine2Data?.health?.disk_usage}
                            icon={StorageIcon}
                        />

                        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.05)' }} />

                        {/* Services */}
                        <Typography variant="overline" sx={{ color: colors.text.muted, px: 2, display: 'block' }}>
                            Services
                        </Typography>
                        <ComparisonRow 
                            label="Running Services" 
                            value1={machine1Data?.servicesCount?.running?.toString()} 
                            value2={machine2Data?.servicesCount?.running?.toString()}
                        />
                        <ComparisonRow 
                            label="Total Services" 
                            value1={machine1Data?.servicesCount?.total?.toString()} 
                            value2={machine2Data?.servicesCount?.total?.toString()}
                        />

                        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.05)' }} />

                        {/* Docker */}
                        <Typography variant="overline" sx={{ color: colors.text.muted, px: 2, display: 'block' }}>
                            Docker
                        </Typography>
                        <ComparisonRow 
                            label="Docker Version" 
                            value1={machine1Data?.dockerInfo?.ServerVersion} 
                            value2={machine2Data?.dockerInfo?.ServerVersion}
                        />
                        <ComparisonRow 
                            label="Containers Running" 
                            value1={machine1Data?.dockerInfo?.ContainersRunning?.toString()} 
                            value2={machine2Data?.dockerInfo?.ContainersRunning?.toString()}
                        />
                        <ComparisonRow 
                            label="Images" 
                            value1={machine1Data?.dockerInfo?.Images?.toString()} 
                            value2={machine2Data?.dockerInfo?.Images?.toString()}
                        />
                    </Box>

                    {/* Actions */}
                    <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: 2, 
                        p: 2,
                        borderTop: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Button
                            variant="outlined"
                            disabled={!machine1Id}
                            onClick={() => navigate(`/machines/${machine1Id}`)}
                            sx={{ borderColor: '#f97316', color: '#f97316' }}
                        >
                            View {machine1Data?.machine?.name || 'Machine 1'}
                        </Button>
                        <Button
                            variant="outlined"
                            disabled={!machine2Id}
                            onClick={() => navigate(`/machines/${machine2Id}`)}
                            sx={{ borderColor: '#22c55e', color: '#22c55e' }}
                        >
                            View {machine2Data?.machine?.name || 'Machine 2'}
                        </Button>
                    </Box>
                </Paper>
            )}

            {/* Empty State */}
            {!machine1Id && !machine2Id && (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <CompareArrowsIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                    <Typography sx={{ color: colors.text.muted, mb: 1 }}>
                        Select two machines to compare
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.text.disabled }}>
                        Compare system configurations, health metrics, and service status
                    </Typography>
                </Paper>
            )}
        </Box>
    )
}

export default MachineComparison
