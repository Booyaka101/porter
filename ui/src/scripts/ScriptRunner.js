import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Badge from '@mui/material/Badge'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import CircularProgress from '@mui/material/CircularProgress'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import CodeIcon from '@mui/icons-material/Code'
import ComputerIcon from '@mui/icons-material/Computer'
import TerminalIcon from '@mui/icons-material/Terminal'
import NotificationsIcon from '@mui/icons-material/Notifications'
import HistoryIcon from '@mui/icons-material/History'
import SettingsIcon from '@mui/icons-material/Settings'
import HomeIcon from '@mui/icons-material/Home'
import ArticleIcon from '@mui/icons-material/Article'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications'
import LayersIcon from '@mui/icons-material/Layers'
import FolderIcon from '@mui/icons-material/Folder'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import BuildIcon from '@mui/icons-material/Build'
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'
import BackupIcon from '@mui/icons-material/Backup'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import ErrorBoundary from './ErrorBoundary'
import CommandPalette from './CommandPalette'
import { colors } from './theme'
import { useAuth } from './AuthContext'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import MenuIcon from '@mui/icons-material/Menu'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useThemeContext } from './ThemeContext'

// Lazy load heavy components for better performance
const Dashboard = lazy(() => import('./Dashboard'))
const Machines = lazy(() => import('./Machines'))
const MachineView = lazy(() => import('./MachineView'))
const Scripts = lazy(() => import('./Scripts'))
const ScriptWizard = lazy(() => import('./ScriptWizard'))
const History = lazy(() => import('./History'))
const Settings = lazy(() => import('./Settings'))
const RunCommand = lazy(() => import('./RunCommand'))
const LiveLogs = lazy(() => import('./LiveLogs'))
const Services = lazy(() => import('./Services'))
const DockerManager = lazy(() => import('./DockerManager'))
const FileManager = lazy(() => import('./FileManager'))
const SystemTools = lazy(() => import('./SystemTools'))
const RemoteDesktop = lazy(() => import('./RemoteDesktop'))
const NetworkTools = lazy(() => import('./NetworkTools'))
const MultiTerminal = lazy(() => import('./MultiTerminal'))
const AuditLog = lazy(() => import('./AuditLog'))
const BackupManager = lazy(() => import('./BackupManager'))
const SSHKeyManager = lazy(() => import('./SSHKeyManager'))
const DiffViewer = lazy(() => import('./DiffViewer'))
const ImportExport = lazy(() => import('./ImportExport'))
const MachineComparison = lazy(() => import('./MachineComparison'))
const ApiDocs = lazy(() => import('./ApiDocs'))
const Webhooks = lazy(() => import('./Webhooks'))

// Loading fallback component
const LoadingFallback = () => (
    <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        minHeight: 400,
        flexDirection: 'column',
        gap: 2
    }}>
        <CircularProgress sx={{ color: colors.primary }} />
        <Typography sx={{ color: colors.text.muted }}>Loading...</Typography>
    </Box>
)

// Theme Toggle Button Component
const ThemeToggleButton = () => {
    const { isDark, toggleTheme } = useThemeContext()
    return (
        <Tooltip title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            <IconButton 
                size="small" 
                onClick={toggleTheme}
                sx={{ 
                    color: isDark ? '#fbbf24' : '#6366f1',
                    '&:hover': { 
                        color: isDark ? '#fcd34d' : '#818cf8', 
                        background: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(99, 102, 241, 0.1)' 
                    },
                }}
            >
                {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
        </Tooltip>
    )
}

const ScriptRunner = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout, isAdmin, canAccessTools, canAccessTerminal } = useAuth()
    const [machineCount, setMachineCount] = useState(0)
    const [time, setTime] = useState(new Date())
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
    const [runningScripts, setRunningScripts] = useState([])
    const [runningMenuAnchor, setRunningMenuAnchor] = useState(null)
    const [shortcutsOpen, setShortcutsOpen] = useState(false)
    const [toolsMenuAnchor, setToolsMenuAnchor] = useState(null)
    const [userMenuAnchor, setUserMenuAnchor] = useState(null)
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
    const muiTheme = useTheme()
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Load machine count - only on pathname change, not every location update
    useEffect(() => {
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => setMachineCount(data?.length || 0))
            .catch(() => {})
    }, [location.pathname])

    // Poll for running scripts
    useEffect(() => {
        const fetchRunning = () => {
            fetch('/api/script-executions?running=true')
                .then(res => res.json())
                .then(data => setRunningScripts(data || []))
                .catch(() => {})
        }
        fetchRunning()
        const interval = setInterval(fetchRunning, 3000)
        return () => clearInterval(interval)
    }, [])

    // Global keyboard shortcuts for power users
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only trigger if not in an input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
            
            // Ctrl/Cmd + key shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'k':
                        e.preventDefault()
                        setCommandPaletteOpen(true)
                        break
                    case '1':
                        e.preventDefault()
                        navigate('/')
                        break
                    case '2':
                        e.preventDefault()
                        navigate('/machines')
                        break
                    case '3':
                        e.preventDefault()
                        navigate('/scripts')
                        break
                    case '4':
                        e.preventDefault()
                        navigate('/history')
                        break
                    case '5':
                        e.preventDefault()
                        navigate('/settings')
                        break
                    case 'r':
                        e.preventDefault()
                        navigate('/run-command')
                        break
                    default:
                        break
                }
            }
            
            // Single key shortcuts (when not in input)
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                switch (e.key) {
                    case '?':
                        setShortcutsOpen(true)
                        break
                    default:
                        break
                }
            }
        }
        
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [navigate])

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon />, path: '/' },
        { id: 'machines', label: 'Machines', icon: <ComputerIcon />, path: '/machines' },
        { id: 'scripts', label: 'Scripts', icon: <CodeIcon />, path: '/scripts' },
        { id: 'history', label: 'History', icon: <HistoryIcon />, path: '/history' },
        // Only show Tools menu for users with tools access
        ...(canAccessTools() ? [{ id: 'tools', label: 'Tools', icon: <BuildIcon />, path: null, hasMenu: true }] : []),
        { id: 'settings', label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ]

    const toolsMenuItems = [
        { label: 'Multi-Terminal', icon: <TerminalIcon />, path: '/multi-terminal' },
        { label: 'Network Tools', icon: <NetworkCheckIcon />, path: '/network-tools' },
        { label: 'Backup Manager', icon: <BackupIcon />, path: '/backups' },
        { label: 'SSH Keys', icon: <VpnKeyIcon />, path: '/ssh-keys' },
        { label: 'File Diff', icon: <CompareArrowsIcon />, path: '/diff' },
        { label: 'Machine Compare', icon: <CompareArrowsIcon />, path: '/compare' },
        { label: 'Audit Log', icon: <AssessmentIcon />, path: '/audit-log' },
        { label: 'API Docs', icon: <CodeIcon />, path: '/api-docs' },
        { label: 'Webhooks', icon: <NotificationsIcon />, path: '/webhooks' },
        { label: 'Import/Export', icon: <ImportExportIcon />, path: '/import-export' },
    ]

    const currentTab = location.pathname.startsWith('/script-wizard') ? 'scripts' 
        : location.pathname === '/' ? 'dashboard'
        : tabs.find(t => location.pathname === t.path)?.id || 'dashboard'

    // Generate breadcrumbs based on current path
    const getBreadcrumbs = () => {
        const path = location.pathname
        const crumbs = [{ label: 'Home', path: '/', icon: <HomeIcon sx={{ fontSize: 16 }} /> }]
        
        if (path.startsWith('/machines')) {
            crumbs.push({ label: 'Machines', path: '/machines', icon: <ComputerIcon sx={{ fontSize: 16 }} /> })
        } else if (path.startsWith('/script-wizard')) {
            crumbs.push({ label: 'Scripts', path: '/scripts', icon: <CodeIcon sx={{ fontSize: 16 }} /> })
            const scriptPath = decodeURIComponent(path.split('/script-wizard/')[1] || '')
            const scriptName = scriptPath.split('/').pop() || 'Script'
            crumbs.push({ label: scriptName, path: path, icon: <PlayArrowIcon sx={{ fontSize: 16 }} /> })
        } else if (path.startsWith('/scripts') || path === '/') {
            crumbs.push({ label: 'Scripts', path: '/scripts', icon: <CodeIcon sx={{ fontSize: 16 }} /> })
        }
        
        return crumbs
    }

    const breadcrumbs = getBreadcrumbs()

    return (
        <Box sx={{ 
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#0f0f0f',
            overflow: 'hidden',
            position: 'relative',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '300px',
                background: 'radial-gradient(ellipse at 50% 0%, rgba(249, 115, 22, 0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
            }
        }}>
            {/* Top Navigation Bar */}
            <Box sx={{
                flexShrink: 0,
                zIndex: 1000,
                backdropFilter: 'blur(20px)',
                background: 'rgba(15, 15, 15, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: '0 2px 20px rgba(0, 0, 0, 0.4)',
            }}>
                <Box sx={{
                    px: { xs: 2, md: 4 },
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 1, md: 3 },
                }}>
                    {/* Mobile Menu Button */}
                    {isMobile && (
                        <IconButton 
                            onClick={() => setMobileDrawerOpen(true)}
                            sx={{ color: '#f97316', mr: 1 }}
                        >
                            <MenuIcon />
                        </IconButton>
                    )}

                    {/* Logo */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: { xs: 1, md: 2 },
                        cursor: 'pointer',
                        pr: { xs: 1, md: 3 },
                        borderRight: { xs: 'none', md: '1px solid rgba(255, 255, 255, 0.06)' },
                    }} onClick={() => navigate('/')}>
                        <Box sx={{
                            width: 42,
                            height: 42,
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 20px rgba(249, 115, 22, 0.4)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                transform: 'scale(1.05)',
                                boxShadow: '0 6px 25px rgba(249, 115, 22, 0.5)',
                            },
                        }}>
                            <TerminalIcon sx={{ color: '#fff', fontSize: 22 }} />
                        </Box>
                        <Box>
                            <Typography sx={{ 
                                fontWeight: 700, 
                                fontSize: '1.15rem',
                                color: '#fafafa',
                                letterSpacing: '-0.02em',
                                lineHeight: 1.2,
                            }}>
                                Porter
                            </Typography>
                            <Typography sx={{ 
                                fontSize: '0.7rem', 
                                color: '#f97316',
                                letterSpacing: '0.1em',
                                fontWeight: 500,
                            }}>
                                Script Runner
                            </Typography>
                        </Box>
                    </Box>

                    {/* Tab Navigation - Hidden on mobile */}
                    <Box sx={{ 
                        display: { xs: 'none', md: 'flex' }, 
                        gap: 1,
                        ml: 2,
                    }}>
                        {tabs.map(tab => (
                            <Box
                                key={tab.id}
                                onClick={(e) => tab.hasMenu ? setToolsMenuAnchor(e.currentTarget) : navigate(tab.path)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 2,
                                    py: 1,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: currentTab === tab.id 
                                        ? 'rgba(249, 115, 22, 0.15)'
                                        : 'transparent',
                                    borderBottom: currentTab === tab.id 
                                        ? '2px solid #f97316'
                                        : '2px solid transparent',
                                    '&:hover': {
                                        background: currentTab === tab.id 
                                            ? 'rgba(249, 115, 22, 0.2)'
                                            : 'rgba(255, 255, 255, 0.05)',
                                    },
                                }}
                            >
                                <Box sx={{ 
                                    color: currentTab === tab.id ? '#f97316' : 'rgba(255, 255, 255, 0.5)',
                                    display: 'flex',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {tab.icon}
                                </Box>
                                <Typography sx={{ 
                                    fontSize: '0.9rem',
                                    fontWeight: currentTab === tab.id ? 600 : 400,
                                    color: currentTab === tab.id ? '#fafafa' : 'rgba(255, 255, 255, 0.6)',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {tab.label}
                                </Typography>
                                {tab.hasMenu && <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />}
                                {tab.id === 'machines' && machineCount > 0 && (
                                    <Box sx={{
                                        background: '#f97316',
                                        color: '#fff',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        px: 0.8,
                                        py: 0.2,
                                        borderRadius: '4px',
                                        minWidth: 20,
                                        textAlign: 'center',
                                    }}>
                                        {machineCount}
                                    </Box>
                                )}
                            </Box>
                        ))}
                    </Box>

                    {/* Tools Dropdown Menu */}
                    <Menu
                        anchorEl={toolsMenuAnchor}
                        open={Boolean(toolsMenuAnchor)}
                        onClose={() => setToolsMenuAnchor(null)}
                        PaperProps={{
                            sx: {
                                background: 'rgba(20, 20, 20, 0.98)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                minWidth: 200,
                                mt: 1
                            }
                        }}
                    >
                        {toolsMenuItems.map(item => (
                            <MenuItem 
                                key={item.path}
                                onClick={() => { navigate(item.path); setToolsMenuAnchor(null); }}
                                sx={{ 
                                    py: 1.5,
                                    '&:hover': { background: 'rgba(249, 115, 22, 0.1)' }
                                }}
                            >
                                <ListItemIcon sx={{ color: '#f97316' }}>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.label} />
                            </MenuItem>
                        ))}
                    </Menu>

                    {/* Spacer */}
                    <Box sx={{ flex: 1 }} />

                    {/* Status & Time */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2,
                    }}>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 0.75,
                            borderRadius: '6px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                        }}>
                            <Box sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#22c55e',
                                boxShadow: '0 0 8px #22c55e',
                            }} />
                            <Typography sx={{ 
                                fontSize: '0.8rem', 
                                color: '#22c55e',
                                fontWeight: 600,
                            }}>
                                Online
                            </Typography>
                        </Box>

                        <Typography sx={{ 
                            fontSize: '0.85rem', 
                            color: 'rgba(255, 255, 255, 0.4)',
                            fontFamily: 'monospace',
                        }}>
                            {time.toLocaleTimeString()}
                        </Typography>

                        {/* Help Button */}
                        <Tooltip title="Keyboard Shortcuts (?)">
                            <IconButton 
                                size="small" 
                                onClick={() => setShortcutsOpen(true)}
                                sx={{ 
                                    color: 'rgba(255, 255, 255, 0.4)',
                                    '&:hover': { color: '#f97316', background: 'rgba(249, 115, 22, 0.1)' },
                                }}
                            >
                                <HelpOutlineIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        {/* Theme Toggle */}
                        <ThemeToggleButton />

                        {/* Running Scripts Indicator */}
                        {runningScripts.length > 0 && (
                            <>
                                <Tooltip title="Running Scripts - Click to reconnect">
                                    <IconButton 
                                        size="small" 
                                        onClick={(e) => setRunningMenuAnchor(e.currentTarget)}
                                        sx={{ 
                                            color: '#ffaa00',
                                            animation: 'pulse 1.5s infinite',
                                            '@keyframes pulse': {
                                                '0%, 100%': { opacity: 1 },
                                                '50%': { opacity: 0.6 },
                                            },
                                        }}
                                    >
                                        <Badge badgeContent={runningScripts.length} color="warning">
                                            <PlayCircleOutlineIcon fontSize="small" />
                                        </Badge>
                                    </IconButton>
                                </Tooltip>
                                <Menu
                                    anchorEl={runningMenuAnchor}
                                    open={Boolean(runningMenuAnchor)}
                                    onClose={() => setRunningMenuAnchor(null)}
                                    PaperProps={{
                                        sx: {
                                            backgroundColor: 'rgba(20, 20, 20, 0.98)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            backdropFilter: 'blur(10px)',
                                            minWidth: 280,
                                        }
                                    }}
                                >
                                    <Typography sx={{ px: 2, py: 1, fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                                        RUNNING SCRIPTS
                                    </Typography>
                                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                    {runningScripts.map((exec) => (
                                        <MenuItem 
                                            key={exec.id}
                                            onClick={() => {
                                                setRunningMenuAnchor(null)
                                                navigate(`/script-wizard/${encodeURIComponent(exec.script_path)}?execId=${exec.id}`)
                                            }}
                                            sx={{
                                                '&:hover': { backgroundColor: 'rgba(249, 115, 22, 0.1)' },
                                            }}
                                        >
                                            <ListItemIcon>
                                                <PlayArrowIcon sx={{ color: '#ffaa00', fontSize: 18 }} />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary={exec.script_name || 'Script'}
                                                secondary={`${exec.machine_ids?.length || 0} machine(s) • ${new Date(exec.started_at).toLocaleTimeString()}`}
                                                primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                                                secondaryTypographyProps={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}
                                            />
                                        </MenuItem>
                                    ))}
                                </Menu>
                            </>
                        )}

                        <Tooltip title="Notifications">
                            <IconButton size="small" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                <Badge badgeContent={0} color="error">
                                    <NotificationsIcon fontSize="small" />
                                </Badge>
                            </IconButton>
                        </Tooltip>

                        {/* User Menu */}
                        {user && (
                            <>
                                <Tooltip title={user.display_name || user.username}>
                                    <IconButton 
                                        size="small" 
                                        onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                                        sx={{ 
                                            color: 'rgba(255, 255, 255, 0.7)',
                                            ml: 1,
                                            '&:hover': { color: colors.primary }
                                        }}
                                    >
                                        <AccountCircleIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Menu
                                    anchorEl={userMenuAnchor}
                                    open={Boolean(userMenuAnchor)}
                                    onClose={() => setUserMenuAnchor(null)}
                                    PaperProps={{
                                        sx: {
                                            background: 'rgba(26, 26, 26, 0.98)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            minWidth: 200,
                                        }
                                    }}
                                >
                                    <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <Typography sx={{ color: '#fafafa', fontWeight: 600 }}>
                                            {user.display_name || user.username}
                                        </Typography>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                                            {user.role} • {user.email || user.username}
                                        </Typography>
                                    </Box>
                                    <MenuItem 
                                        onClick={() => { setUserMenuAnchor(null); navigate('/settings'); }}
                                        sx={{ color: 'rgba(255,255,255,0.8)', py: 1.5 }}
                                    >
                                        <ListItemIcon><PersonIcon sx={{ color: 'rgba(255,255,255,0.5)' }} /></ListItemIcon>
                                        <ListItemText primary="Profile" />
                                    </MenuItem>
                                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                    <MenuItem 
                                        onClick={() => { setUserMenuAnchor(null); logout(); }}
                                        sx={{ color: '#ef4444', py: 1.5 }}
                                    >
                                        <ListItemIcon><LogoutIcon sx={{ color: '#ef4444' }} /></ListItemIcon>
                                        <ListItemText primary="Logout" />
                                    </MenuItem>
                                </Menu>
                            </>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Breadcrumb Navigation */}
            {breadcrumbs.length > 1 && (
                <Box sx={{
                    px: 4,
                    pt: 2,
                    flexShrink: 0,
                }}>
                    <Breadcrumbs 
                        separator={<NavigateNextIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />}
                        sx={{ 
                            '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' }
                        }}
                    >
                        {breadcrumbs.map((crumb, index) => {
                            const isLast = index === breadcrumbs.length - 1
                            return isLast ? (
                                <Box 
                                    key={crumb.path}
                                    sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 0.5,
                                        color: '#f97316',
                                    }}
                                >
                                    {crumb.icon}
                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                        {crumb.label}
                                    </Typography>
                                </Box>
                            ) : (
                                <Link
                                    key={crumb.path}
                                    onClick={() => navigate(crumb.path)}
                                    sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 0.5,
                                        color: 'rgba(255,255,255,0.5)',
                                        textDecoration: 'none',
                                        cursor: 'pointer',
                                        '&:hover': { color: '#f97316' },
                                        transition: 'color 0.2s',
                                    }}
                                >
                                    {crumb.icon}
                                    <Typography sx={{ fontSize: '0.85rem' }}>
                                        {crumb.label}
                                    </Typography>
                                </Link>
                            )
                        })}
                    </Breadcrumbs>
                </Box>
            )}

            {/* Main Content */}
            <Box sx={{
                px: 4,
                py: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <ErrorBoundary fallbackMessage="Failed to load this page. Please try refreshing.">
                    <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/machines" element={<Machines />} />
                            <Route path="/machines/:machineId/*" element={<MachineView />} />
                            <Route path="/scripts" element={<Scripts />} />
                            <Route path="/history" element={<History />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/script-wizard/:scriptPath" element={<ScriptWizard />} />
                            <Route path="/run-command" element={<RunCommand />} />
                            <Route path="/remote-desktop/:id" element={<RemoteDesktop />} />
                            <Route path="/network-tools/:id?" element={<NetworkTools />} />
                            <Route path="/multi-terminal" element={<MultiTerminal />} />
                            <Route path="/audit-log" element={<AuditLog />} />
                            <Route path="/backups" element={<BackupManager />} />
                            <Route path="/ssh-keys" element={<SSHKeyManager />} />
                            <Route path="/diff" element={<DiffViewer />} />
                            <Route path="/import-export" element={<ImportExport />} />
                            <Route path="/compare" element={<MachineComparison />} />
                            <Route path="/api-docs" element={<ApiDocs />} />
                            <Route path="/webhooks" element={<Webhooks />} />
                            <Route path="*" element={<Dashboard />} />
                        </Routes>
                    </Suspense>
                </ErrorBoundary>
            </Box>

            {/* Mobile Navigation Drawer */}
            <Drawer
                anchor="left"
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        width: 280,
                        bgcolor: 'rgba(15, 15, 15, 0.98)',
                        borderRight: '1px solid rgba(249, 115, 22, 0.2)',
                    }
                }}
            >
                <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <TerminalIcon sx={{ color: '#fff', fontSize: 20 }} />
                        </Box>
                        <Box>
                            <Typography sx={{ fontWeight: 700, color: '#fafafa' }}>Porter</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: '#f97316' }}>Script Runner</Typography>
                        </Box>
                    </Box>
                </Box>
                <List sx={{ py: 1 }}>
                    {tabs.map(tab => (
                        <ListItem key={tab.id} disablePadding>
                            <ListItemButton
                                onClick={() => {
                                    if (tab.path) {
                                        navigate(tab.path)
                                        setMobileDrawerOpen(false)
                                    }
                                }}
                                sx={{
                                    py: 1.5,
                                    px: 2,
                                    bgcolor: currentTab === tab.id ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                                    borderLeft: currentTab === tab.id ? '3px solid #f97316' : '3px solid transparent',
                                    '&:hover': { bgcolor: 'rgba(249, 115, 22, 0.1)' },
                                }}
                            >
                                <Box sx={{ color: currentTab === tab.id ? '#f97316' : 'rgba(255,255,255,0.6)', mr: 2 }}>
                                    {tab.icon}
                                </Box>
                                <Typography sx={{ color: currentTab === tab.id ? '#fafafa' : 'rgba(255,255,255,0.7)', fontWeight: currentTab === tab.id ? 600 : 400 }}>
                                    {tab.label}
                                </Typography>
                                {tab.id === 'machines' && machineCount > 0 && (
                                    <Box sx={{ ml: 'auto', bgcolor: '#f97316', color: '#fff', fontSize: '0.7rem', px: 0.8, py: 0.2, borderRadius: '4px' }}>
                                        {machineCount}
                                    </Box>
                                )}
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
                {canAccessTools() && (
                    <>
                        <Box sx={{ px: 2, py: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                Tools
                            </Typography>
                        </Box>
                        <List sx={{ py: 0 }}>
                            {toolsMenuItems.map(item => (
                                <ListItem key={item.path} disablePadding>
                                    <ListItemButton
                                        onClick={() => {
                                            navigate(item.path)
                                            setMobileDrawerOpen(false)
                                        }}
                                        sx={{ py: 1, px: 2, '&:hover': { bgcolor: 'rgba(249, 115, 22, 0.1)' } }}
                                    >
                                        <Box sx={{ color: 'rgba(255,255,255,0.5)', mr: 2, '& svg': { fontSize: 20 } }}>
                                            {item.icon}
                                        </Box>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                                            {item.label}
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}
            </Drawer>

            {/* Command Palette */}
            <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

            {/* Keyboard Shortcuts Dialog */}
            <Dialog 
                open={shortcutsOpen} 
                onClose={() => setShortcutsOpen(false)}
                PaperProps={{
                    sx: {
                        background: 'rgba(20, 20, 20, 0.98)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        minWidth: 400,
                    }
                }}
            >
                <DialogTitle sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    pb: 2,
                }}>
                    <KeyboardIcon sx={{ color: '#f97316' }} />
                    <Typography sx={{ color: '#fafafa', fontWeight: 600 }}>Keyboard Shortcuts</Typography>
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Navigation
                        </Typography>
                        {[
                            { keys: 'Ctrl + 1', action: 'Go to Dashboard' },
                            { keys: 'Ctrl + 2', action: 'Go to Machines' },
                            { keys: 'Ctrl + 3', action: 'Go to Scripts' },
                            { keys: 'Ctrl + 4', action: 'Go to History' },
                            { keys: 'Ctrl + 5', action: 'Go to Settings' },
                        ].map(({ keys, action }) => (
                            <Box key={keys} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{action}</Typography>
                                <Box sx={{ 
                                    background: 'rgba(255,255,255,0.05)', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    px: 1.5,
                                    py: 0.5,
                                }}>
                                    <Typography sx={{ color: '#f97316', fontSize: '0.8rem', fontFamily: 'monospace' }}>{keys}</Typography>
                                </Box>
                            </Box>
                        ))}
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1 }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Actions
                        </Typography>
                        {[
                            { keys: 'Ctrl + K', action: 'Open Command Palette' },
                            { keys: 'Ctrl + R', action: 'Run Command' },
                            { keys: '?', action: 'Show this help' },
                        ].map(({ keys, action }) => (
                            <Box key={keys} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{action}</Typography>
                                <Box sx={{ 
                                    background: 'rgba(255,255,255,0.05)', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    px: 1.5,
                                    py: 0.5,
                                }}>
                                    <Typography sx={{ color: '#f97316', fontSize: '0.8rem', fontFamily: 'monospace' }}>{keys}</Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Footer */}
            <Box sx={{
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                py: 1.5,
                px: 3,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2,
                background: 'rgba(0, 0, 0, 0.3)',
            }}>
                <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: 'rgba(255, 255, 255, 0.3)',
                }}>
                    Porter
                </Typography>
                <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: 'rgba(255, 255, 255, 0.2)',
                }}>
                    •
                </Typography>
                <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: 'rgba(255, 255, 255, 0.3)',
                }}>
                    Script Runner
                </Typography>
                <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: 'rgba(255, 255, 255, 0.2)',
                }}>
                    •
                </Typography>
                <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: 'rgba(255, 255, 255, 0.3)',
                }}>
                    {new Date().getFullYear()}
                </Typography>
            </Box>
        </Box>
    )
}

export default ScriptRunner
