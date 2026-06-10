import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderIcon from '@mui/icons-material/Folder'
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications'
import LayersIcon from '@mui/icons-material/Layers'
import ArticleIcon from '@mui/icons-material/Article'
import BuildIcon from '@mui/icons-material/Build'
import TerminalIcon from '@mui/icons-material/Terminal'
import ComputerIcon from '@mui/icons-material/Computer'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'

// Import feature components
import MachineOverview from './MachineOverview'
import MachineFiles from './MachineFiles'
import MachineServices from './MachineServices'
import MachineDocker from './MachineDocker'
import MachineLogs from './MachineLogs'
import MachineSystem from './MachineSystem'
import MachineTerminalTabs from './MachineTerminalTabs'
import { useAuth } from './AuthContext'

const MachineView = () => {
    const { machineId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { canAccessTerminal, canAccessFiles, canAccessTools, isViewer, isAdmin } = useAuth()
    const [machine, setMachine] = useState(null)
    const [loading, setLoading] = useState(true)
    const [tabValue, setTabValue] = useState(0)
    const [vncCapability, setVncCapability] = useState(null)
    const [checkingVnc, setCheckingVnc] = useState(false)

    // Get permission values once
    const hasFilesAccess = canAccessFiles()
    const hasToolsAccess = canAccessTools()
    const hasTerminalAccess = canAccessTerminal()

    // Memoize tabs to prevent re-creation on every render
    const tabs = useMemo(() => {
        const allTabs = [
            { label: 'Overview', icon: <DashboardIcon />, key: 'overview', allowed: true },
            { label: 'Files', icon: <FolderIcon />, key: 'files', allowed: hasFilesAccess },
            { label: 'Services', icon: <SettingsApplicationsIcon />, key: 'services', allowed: hasToolsAccess },
            { label: 'Docker', icon: <LayersIcon />, key: 'docker', allowed: hasToolsAccess },
            { label: 'Logs', icon: <ArticleIcon />, key: 'logs', allowed: true },
            { label: 'System', icon: <BuildIcon />, key: 'system', allowed: isAdmin() },
            { label: 'Terminal', icon: <TerminalIcon />, key: 'terminal', allowed: hasTerminalAccess },
        ]
        return allTabs.filter(tab => tab.allowed)
    }, [hasFilesAccess, hasToolsAccess, hasTerminalAccess, isAdmin])

    // Determine active tab from URL based on filtered tabs
    useEffect(() => {
        const path = location.pathname
        let targetKey = 'overview'
        if (path.includes('/files')) targetKey = 'files'
        else if (path.includes('/services')) targetKey = 'services'
        else if (path.includes('/docker')) targetKey = 'docker'
        else if (path.includes('/logs')) targetKey = 'logs'
        else if (path.includes('/system')) targetKey = 'system'
        else if (path.includes('/terminal')) targetKey = 'terminal'
        
        // Find the index in the filtered tabs array
        const tabIndex = tabs.findIndex(tab => tab.key === targetKey)
        setTabValue(tabIndex >= 0 ? tabIndex : 0)
    }, [location.pathname, tabs])

    useEffect(() => {
        let isMounted = true
        const abortController = new AbortController()
        
        const loadMachine = async () => {
            try {
                const res = await fetch(`/api/machines/${machineId}`, {
                    signal: abortController.signal
                })
                const data = await res.json()
                if (isMounted) {
                    setMachine(data)
                    setLoading(false)
                }
            } catch (err) {
                if (err.name !== 'AbortError' && isMounted) {
                    console.error('Failed to load machine:', err)
                    setLoading(false)
                }
            }
        }
        
        setLoading(true)
        loadMachine()
        
        return () => {
            isMounted = false
            abortController.abort()
        }
    }, [machineId])

    // Check VNC capability when machine loads
    useEffect(() => {
        if (!machine || !machineId) return
        
        const checkVncCapability = async () => {
            setCheckingVnc(true)
            try {
                const res = await fetch(`/api/vnc/${machineId}/capability`)
                if (res.ok) {
                    const data = await res.json()
                    setVncCapability(data)
                }
            } catch (err) {
                console.error('Failed to check VNC capability:', err)
            }
            setCheckingVnc(false)
        }
        
        checkVncCapability()
    }, [machine, machineId])

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
        // Get the path based on the selected tab's key
        const selectedTab = tabs[newValue]
        const pathMap = {
            'overview': '',
            'files': '/files',
            'services': '/services',
            'docker': '/docker',
            'logs': '/logs',
            'system': '/system',
            'terminal': '/terminal'
        }
        navigate(`/machines/${machineId}${pathMap[selectedTab?.key] || ''}`)
    }

    if (loading) {
        return (
            <Box>
                <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 2 }} />
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
            </Box>
        )
    }

    if (!machine) {
        return (
            <Box sx={{ textAlign: 'center', py: 8 }}>
                <ComputerIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                <Typography color="text.secondary">Machine not found</Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                mb: 2,
                pb: 2,
                flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <IconButton onClick={() => navigate('/machines')} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    <ArrowBackIcon />
                </IconButton>
                <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <ComputerIcon sx={{ color: '#0a0a0f', fontSize: 24 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
                        {machine.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                        {machine.username}@{machine.ip}
                    </Typography>
                </Box>
                <Chip 
                    label={machine.status === 'online' ? 'Online' : 'Offline'}
                    color={machine.status === 'online' ? 'success' : 'error'}
                    size="small"
                    sx={{ 
                        fontWeight: 600,
                        '& .MuiChip-label': { px: 2 }
                    }}
                />
{vncCapability?.available && canAccessTools() && (
                    <Tooltip title={vncCapability.service_active ? "Remote Desktop (VNC running)" : "Remote Desktop (will start VNC)"}>
                        <Button
                            onClick={() => navigate(`/remote-desktop/${machineId}`)}
                            startIcon={<DesktopWindowsIcon />}
                            size="small"
                            sx={{ 
                                color: vncCapability.service_active ? '#22c55e' : 'rgba(255,255,255,0.7)',
                                borderColor: vncCapability.service_active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.2)',
                                '&:hover': { 
                                    borderColor: '#f97316',
                                    background: 'rgba(249, 115, 22, 0.1)'
                                }
                            }}
                            variant="outlined"
                        >
                            Remote Desktop
                        </Button>
                    </Tooltip>
                )}
            </Box>

            {/* Tabs */}
            <Box sx={{ 
                mb: 2,
                flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
                <Tabs 
                    value={tabValue} 
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': {
                            minHeight: 56,
                            textTransform: 'none',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: 'rgba(255,255,255,0.5)',
                            '&.Mui-selected': {
                                color: '#f97316',
                            },
                        },
                        '& .MuiTabs-indicator': {
                            background: 'linear-gradient(90deg, #f97316 0%, #22c55e 100%)',
                            height: 3,
                            borderRadius: '3px 3px 0 0',
                        },
                    }}
                >
                    {tabs.map((tab, index) => (
                        <Tab 
                            key={index}
                            label={tab.label} 
                            icon={tab.icon} 
                            iconPosition="start"
                        />
                    ))}
                </Tabs>
            </Box>

            {/* Tab Content - use flex to fill remaining space */}
            <Box sx={{ flex: 1, overflow: tabs[tabValue]?.key === 'terminal' ? 'hidden' : 'auto', pb: tabs[tabValue]?.key === 'terminal' ? 0 : 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {tabs[tabValue]?.key === 'overview' && <MachineOverview machine={machine} machineId={machineId} />}
                {tabs[tabValue]?.key === 'files' && <MachineFiles machine={machine} machineId={machineId} />}
                {tabs[tabValue]?.key === 'services' && <MachineServices machine={machine} machineId={machineId} />}
                {tabs[tabValue]?.key === 'docker' && <MachineDocker machine={machine} machineId={machineId} />}
                {tabs[tabValue]?.key === 'logs' && <MachineLogs machine={machine} machineId={machineId} />}
                {tabs[tabValue]?.key === 'system' && <MachineSystem machine={machine} machineId={machineId} />}
                {tabs[tabValue]?.key === 'terminal' && <MachineTerminalTabs machine={machine} machineId={machineId} />}
            </Box>
        </Box>
    )
}

export default MachineView
