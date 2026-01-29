import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import InputAdornment from '@mui/material/InputAdornment'
import Fade from '@mui/material/Fade'
import Chip from '@mui/material/Chip'
import Checkbox from '@mui/material/Checkbox'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import WifiIcon from '@mui/icons-material/Wifi'
import ComputerIcon from '@mui/icons-material/Computer'
import PersonIcon from '@mui/icons-material/Person'
import LockIcon from '@mui/icons-material/Lock'
import DnsIcon from '@mui/icons-material/Dns'
import LabelIcon from '@mui/icons-material/Label'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import EditIcon from '@mui/icons-material/Edit'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import CategoryIcon from '@mui/icons-material/Category'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import SearchIcon from '@mui/icons-material/Search'
import StorageIcon from '@mui/icons-material/Storage'
import WarningIcon from '@mui/icons-material/Warning'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TerminalIcon from '@mui/icons-material/Terminal'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import FolderIcon from '@mui/icons-material/Folder'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import HelpIcon from '@mui/icons-material/Help'
import DownloadIcon from '@mui/icons-material/Download'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { useNavigate } from 'react-router-dom'
import { colors, gradients, buttonStyles, inputStyles, skeletonStyles, getStatusStyles, scrollableStyles } from './theme'
import { useAuth } from './AuthContext'

// Memoized machine card skeleton for loading state
const MachineSkeleton = memo(() => (
    <Box sx={{
        background: colors.background.glass,
        borderRadius: '20px',
        border: `1px solid ${colors.border.light}`,
        p: 3,
    }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Skeleton variant="circular" width={56} height={56} sx={skeletonStyles.base} />
            <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" sx={skeletonStyles.base} />
                <Skeleton variant="text" width="40%" sx={skeletonStyles.light} />
            </Box>
            <Skeleton variant="rounded" width={80} height={28} sx={skeletonStyles.base} />
        </Box>
        <Skeleton variant="rounded" width="100%" height={40} sx={skeletonStyles.light} />
    </Box>
))

const defaultCategories = ['Production', 'Development', 'Staging', 'Testing', 'Uncategorized']

// IP validation regex
const isValidIP = (ip) => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return ipRegex.test(ip) || hostnameRegex.test(ip)
}

const Machines = () => {
    const navigate = useNavigate()
    const { canWrite, canExecute, canAccessTerminal, canAccessFiles, canRunCommands } = useAuth()
    const canEditMachines = canWrite('machines')
    const canUseTerminal = canAccessTerminal()
    const canUseFiles = canAccessFiles()
    const canRun = canRunCommands()
    const [machines, setMachines] = useState([])
    const [open, setOpen] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [form, setForm] = useState({ id: '', name: '', ip: '', username: '', password: '', category: '', notes: '', tags: [] })
    const [testing, setTesting] = useState({})
    const [filterCategory, setFilterCategory] = useState('all')
    const [selectedMachines, setSelectedMachines] = useState(new Set())
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
    const [ipError, setIpError] = useState('')
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [healthData, setHealthData] = useState({})
    const [importDialog, setImportDialog] = useState({ open: false, data: '' })
    const [helpDialog, setHelpDialog] = useState(false)
    const [exportMenuAnchor, setExportMenuAnchor] = useState(null)
    const [favorites, setFavorites] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('favoriteMachines') || '[]')
        } catch { return [] }
    })
    const importFileRef = useRef(null)

    const loadMachines = async (showLoading = false) => {
        if (showLoading) setLoading(true)
        try {
            const res = await fetch('/api/machines')
            const data = await res.json() || []
            
            // Also load health to get accurate online status
            let healthInfo = {}
            try {
                const healthRes = await fetch('/api/health/cached')
                healthInfo = await healthRes.json() || {}
            } catch (healthErr) {
                console.warn('Failed to load health data:', healthErr)
            }
            
            // Update machine status based on health data
            // If no health data exists for a machine, preserve previous status or mark as unknown
            const updated = data.map(m => {
                const health = healthInfo[m.id]
                // If health data exists, use it
                if (health) {
                    return { ...m, status: health.online ? 'online' : 'offline' }
                }
                // If no health data, preserve existing status from machine record or mark unknown
                return { ...m, status: m.status || 'unknown' }
            }).sort((a, b) => {
                // Favorites first, then online, then unknown, then offline
                const aFav = favorites.includes(a.id) ? 0 : 1
                const bFav = favorites.includes(b.id) ? 0 : 1
                if (aFav !== bFav) return aFav - bFav
                const statusOrder = { online: 0, unknown: 1, offline: 2 }
                const aOrder = statusOrder[a.status] ?? 1
                const bOrder = statusOrder[b.status] ?? 1
                if (aOrder !== bOrder) return aOrder - bOrder
                return a.name.localeCompare(b.name)
            })
            
            setMachines(updated)
            setHealthData(healthInfo)
        } catch (err) {
            console.error('Failed to load machines:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadHealth = async () => {
        try {
            const res = await fetch('/api/health/cached')
            const data = await res.json() || {}
            setHealthData(data)
            
            // Update machine status based on new health data
            // Only update if we have health data for the machine
            setMachines(prev => prev.map(m => {
                const health = data[m.id]
                if (health) {
                    return { ...m, status: health.online ? 'online' : 'offline' }
                }
                // Preserve existing status if no health data
                return m
            }).sort((a, b) => {
                const statusOrder = { online: 0, unknown: 1, offline: 2 }
                const aOrder = statusOrder[a.status] ?? 1
                const bOrder = statusOrder[b.status] ?? 1
                if (aOrder !== bOrder) return aOrder - bOrder
                return a.name.localeCompare(b.name)
            }))
        } catch (err) {
            console.error('Failed to load health:', err)
        }
    }

    const checkAllHealth = async () => {
        showToast('Checking machine health...', 'info')
        try {
            const res = await fetch('/api/health')
            const data = await res.json() || {}
            setHealthData(data)
            
            // Update machine status based on new health data - ONLY trust health data
            setMachines(prev => prev.map(m => {
                const health = data[m.id]
                const isOnline = health?.online === true
                return { ...m, status: isOnline ? 'online' : 'offline' }
            }).sort((a, b) => {
                if (a.status === 'online' && b.status !== 'online') return -1
                if (a.status !== 'online' && b.status === 'online') return 1
                return a.name.localeCompare(b.name)
            }))
            
            showToast('Health check complete')
        } catch (err) {
            showToast('Health check failed', 'error')
        }
    }

    const showToast = (message, severity = 'success') => {
        setToast({ open: true, message, severity })
    }

    // Export functions
    const exportToCSV = () => {
        const headers = ['Name', 'IP', 'Username', 'Status', 'Tags', 'Category']
        const rows = filteredMachines.map(m => [
            m.name,
            m.ip,
            m.username,
            m.status,
            (m.tags || []).join('; '),
            m.category || ''
        ])
        const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `machines-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        setExportMenuAnchor(null)
        showToast('Exported to CSV')
    }

    const exportToJSON = () => {
        const data = filteredMachines.map(m => ({
            name: m.name,
            ip: m.ip,
            username: m.username,
            status: m.status,
            tags: m.tags,
            category: m.category,
            health: healthData[m.id]
        }))
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `machines-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        setExportMenuAnchor(null)
        showToast('Exported to JSON')
    }

    // Test all machines on initial load
    const testAllMachines = useCallback(async () => {
        for (const m of machines) {
            if (m.status === 'unknown') {
                try {
                    await fetch(`/api/machines/test?id=${m.id}`, { method: 'POST' })
                } catch (err) {
                    console.error('Failed to test machine:', m.id)
                }
            }
        }
    }, [machines])

    useEffect(() => {
        loadMachines(true) // Show loading on initial load
        // Refresh machines every 30s, health every 5s for near real-time agent data
        const interval = setInterval(() => loadMachines(false), 30000)
        const healthInterval = setInterval(loadHealth, 5000)
        return () => {
            clearInterval(interval)
            clearInterval(healthInterval)
        }
    }, [])

    // Test unknown machines on load
    useEffect(() => {
        if (machines.length > 0) {
            const unknownMachines = machines.filter(m => m.status === 'unknown')
            if (unknownMachines.length > 0) {
                testAllMachines()
            }
        }
    }, [machines.length, testAllMachines])

    // Memoized filter for machines by category and search query - sorted by name for stable order
    const filteredMachines = useMemo(() => {
        const searchLower = searchQuery.toLowerCase()
        return machines
            .filter(m => {
                const matchesCategory = filterCategory === 'all' || (m.category || 'Uncategorized') === filterCategory
                const matchesSearch = !searchQuery || 
                    m.name?.toLowerCase().includes(searchLower) ||
                    m.ip?.toLowerCase().includes(searchLower) ||
                    m.username?.toLowerCase().includes(searchLower)
                return matchesCategory && matchesSearch
            })
            .sort((a, b) => a.name.localeCompare(b.name)) // Stable sort by name
    }, [machines, filterCategory, searchQuery])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+N or Cmd+N to add new machine
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !open) {
                e.preventDefault()
                handleOpenAdd()
            }
            // Escape to close dialog
            if (e.key === 'Escape' && open) {
                handleCloseDialog()
            }
            // Ctrl+A to select all (when not in input)
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !open && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault()
                setSelectedMachines(new Set(filteredMachines.map(m => m.id)))
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, filteredMachines])

    const handleAdd = async () => {
        // Validate IP
        if (form.ip && !isValidIP(form.ip)) {
            setIpError('Invalid IP address or hostname')
            return
        }
        setIpError('')

        // Check for duplicate IP
        const duplicateIP = machines.find(m => m.ip === form.ip && m.id !== form.id)
        if (duplicateIP) {
            showToast(`Machine with IP ${form.ip} already exists (${duplicateIP.name})`, 'warning')
            return
        }

        if (!form.name || !form.ip || !form.username || (!editMode && !form.password)) return
        try {
            const method = editMode ? 'PUT' : 'POST'
            await fetch('/api/machines', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    category: form.category || 'Uncategorized'
                })
            })
            handleCloseDialog()
            loadMachines()
            showToast(editMode ? 'Machine updated successfully' : 'Machine added successfully')
        } catch (err) {
            console.error('Failed to save machine:', err)
            showToast('Failed to save machine', 'error')
        }
    }

    const handleEdit = (machine) => {
        setForm({
            id: machine.id,
            name: machine.name,
            ip: machine.ip,
            username: machine.username,
            password: '',
            category: machine.category || 'Uncategorized',
            notes: machine.notes || '',
            tags: machine.tags || []
        })
        setIpError('')
        setEditMode(true)
        setOpen(true)
    }

    const handleCloseDialog = () => {
        setOpen(false)
        setEditMode(false)
        setIpError('')
        setForm({ id: '', name: '', ip: '', username: '', password: '', category: '', notes: '', tags: [] })
    }

    const handleOpenAdd = () => {
        setForm({ id: '', name: '', ip: '', username: '', password: '', category: 'Uncategorized', notes: '', tags: [] })
        setIpError('')
        setEditMode(false)
        setOpen(true)
    }

    // Selection handlers
    const toggleMachineSelection = (id) => {
        setSelectedMachines(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    const selectAllMachines = () => {
        if (selectedMachines.size === filteredMachines.length) {
            setSelectedMachines(new Set())
        } else {
            setSelectedMachines(new Set(filteredMachines.map(m => m.id)))
        }
    }

    // Group machines by category for display
    const groupedMachines = filteredMachines.reduce((acc, m) => {
        const cat = m.category || 'Uncategorized'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(m)
        return acc
    }, {})

    const handleDelete = async (id) => {
        try {
            await fetch(`/api/machines?id=${id}`, { method: 'DELETE' })
            loadMachines()
            setSelectedMachines(prev => {
                const newSet = new Set(prev)
                newSet.delete(id)
                return newSet
            })
            showToast('Machine deleted successfully')
            setDeleteConfirm(null)
        } catch (err) {
            console.error('Failed to delete machine:', err)
            showToast('Failed to delete machine', 'error')
        }
    }

    const handleDeleteSelected = async () => {
        try {
            for (const id of selectedMachines) {
                await fetch(`/api/machines?id=${id}`, { method: 'DELETE' })
            }
            setSelectedMachines(new Set())
            loadMachines()
            showToast(`${selectedMachines.size} machine(s) deleted successfully`)
            setDeleteConfirm(null)
        } catch (err) {
            console.error('Failed to delete machines:', err)
            showToast('Failed to delete machines', 'error')
        }
    }

    const handleTest = async (id) => {
        setTesting(prev => ({ ...prev, [id]: true }))
        try {
            await fetch(`/api/machines/test?id=${id}`, { method: 'POST' })
            setTimeout(() => {
                loadMachines()
                setTesting(prev => ({ ...prev, [id]: false }))
            }, 2000)
        } catch (err) {
            console.error('Failed to test connection:', err)
            setTesting(prev => ({ ...prev, [id]: false }))
            showToast('Failed to test connection', 'error')
        }
    }

    const handleTestSelected = async () => {
        for (const id of selectedMachines) {
            setTesting(prev => ({ ...prev, [id]: true }))
            try {
                await fetch(`/api/machines/test?id=${id}`, { method: 'POST' })
            } catch (err) {
                console.error('Failed to test machine:', id)
            }
        }
        setTimeout(() => {
            loadMachines()
            setTesting({})
        }, 3000)
        showToast(`Testing ${selectedMachines.size} machine(s)...`, 'info')
    }

    // Export machines - show menu
    const handleExport = (e) => {
        setExportMenuAnchor(e.currentTarget)
    }

    // Import machines from JSON file
    const handleImportFile = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result)
                if (Array.isArray(data)) {
                    setImportDialog({ open: true, data: data })
                } else {
                    showToast('Invalid format: expected array of machines', 'error')
                }
            } catch (err) {
                showToast('Failed to parse JSON file', 'error')
            }
        }
        reader.readAsText(file)
        event.target.value = ''
    }

    // Process import
    const handleImportConfirm = async () => {
        const toImport = importDialog.data
        let imported = 0
        for (const m of toImport) {
            if (!m.name || !m.ip || !m.username) continue
            // Check for duplicate IP
            if (machines.find(existing => existing.ip === m.ip)) continue
            try {
                await fetch('/api/machines', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: m.name,
                        ip: m.ip,
                        username: m.username,
                        password: m.password || '',
                        category: m.category || 'Uncategorized'
                    })
                })
                imported++
            } catch (err) {
                console.error('Failed to import machine:', m.name)
            }
        }
        setImportDialog({ open: false, data: '' })
        loadMachines()
        showToast(`Imported ${imported} machine(s)`)
    }

    const getStatusConfig = (status) => {
        switch (status) {
            case 'online': return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: <CheckCircleIcon sx={{ fontSize: 16 }} /> }
            case 'offline': return { color: '#ff4466', bg: 'rgba(255, 68, 102, 0.1)', icon: <ErrorIcon sx={{ fontSize: 16 }} /> }
            default: return { color: '#ffaa00', bg: 'rgba(255, 170, 0, 0.1)', icon: <HelpOutlineIcon sx={{ fontSize: 16 }} /> }
        }
    }

    // Toggle favorite
    const toggleFavorite = (machineId) => {
        setFavorites(prev => {
            const newFavs = prev.includes(machineId) 
                ? prev.filter(id => id !== machineId)
                : [...prev, machineId]
            localStorage.setItem('favoriteMachines', JSON.stringify(newFavs))
            return newFavs
        })
        // Re-sort machines
        setMachines(prev => [...prev].sort((a, b) => {
            const newFavs = favorites.includes(machineId) 
                ? favorites.filter(id => id !== machineId)
                : [...favorites, machineId]
            const aFav = newFavs.includes(a.id) ? 0 : 1
            const bFav = newFavs.includes(b.id) ? 0 : 1
            if (aFav !== bFav) return aFav - bFav
            const statusOrder = { online: 0, unknown: 1, offline: 2 }
            const aOrder = statusOrder[a.status] ?? 1
            const bOrder = statusOrder[b.status] ?? 1
            if (aOrder !== bOrder) return aOrder - bOrder
            return a.name.localeCompare(b.name)
        }))
    }

    // Stats
    const onlineCount = machines.filter(m => m.status === 'online').length
    const offlineCount = machines.filter(m => m.status === 'offline').length
    const categories = [...new Set(machines.map(m => m.category || 'Uncategorized'))]

    return (
        <Box role="main" aria-label="Machines page" sx={scrollableStyles.pageContainer}>
            {/* Modern Header with Stats */}
            <Box sx={{ 
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, rgba(34, 197, 94, 0.03) 100%)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.06)',
                p: 3,
                mb: 4,
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3 }}>
                    <Box>
                        <Typography sx={{ 
                            fontSize: '2.2rem', 
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em',
                            mb: 0.5,
                        }}>
                            Machines
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem' }}>
                            Manage and monitor your deployment targets
                        </Typography>
                        
                        {/* Quick Stats */}
                        <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ 
                                    width: 10, height: 10, borderRadius: '50%', 
                                    background: '#22c55e',
                                    boxShadow: '0 0 10px #22c55e',
                                }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                                    <strong style={{ color: '#22c55e' }}>{onlineCount}</strong> Online
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ 
                                    width: 10, height: 10, borderRadius: '50%', 
                                    background: '#ff4466',
                                }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                                    <strong style={{ color: '#ff4466' }}>{offlineCount}</strong> Offline
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <StorageIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                                    <strong style={{ color: '#fff' }}>{machines.length}</strong> Total
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        {/* Search */}
                        <TextField
                            placeholder="Search machines..."
                            size="small"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 20 }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                width: 220,
                                '& .MuiOutlinedInput-root': {
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '12px',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                    '&:hover fieldset': { borderColor: 'rgba(249, 115, 22, 0.3)' },
                                    '&.Mui-focused fieldset': { borderColor: '#f97316' },
                                }
                            }}
                        />
                        <Tooltip title="Refresh">
                            <IconButton 
                                onClick={loadMachines}
                                sx={{ 
                                    color: 'rgba(255,255,255,0.5)',
                                    background: 'rgba(255,255,255,0.03)',
                                    '&:hover': { color: '#f97316', background: 'rgba(249, 115, 22, 0.1)' }
                                }}
                            >
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Check Health">
                            <IconButton 
                                onClick={checkAllHealth}
                                sx={{ 
                                    color: 'rgba(255,255,255,0.5)',
                                    background: 'rgba(255,255,255,0.03)',
                                    '&:hover': { color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }
                                }}
                            >
                                <WifiIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Export Machines">
                            <IconButton 
                                onClick={handleExport}
                                disabled={machines.length === 0}
                                sx={{ 
                                    color: 'rgba(255,255,255,0.5)',
                                    background: 'rgba(255,255,255,0.03)',
                                    '&:hover': { color: '#ff79c6', background: 'rgba(255, 121, 198, 0.1)' }
                                }}
                            >
                                <FileDownloadIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Import Machines">
                            <IconButton 
                                onClick={() => importFileRef.current?.click()}
                                sx={{ 
                                    color: 'rgba(255,255,255,0.5)',
                                    background: 'rgba(255,255,255,0.03)',
                                    '&:hover': { color: '#8be9fd', background: 'rgba(139, 233, 253, 0.1)' }
                                }}
                            >
                                <FileUploadIcon />
                            </IconButton>
                        </Tooltip>
                        <input type="file" ref={importFileRef} accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                        <Menu
                            anchorEl={exportMenuAnchor}
                            open={Boolean(exportMenuAnchor)}
                            onClose={() => setExportMenuAnchor(null)}
                            PaperProps={{ sx: { bgcolor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(255,255,255,0.1)' } }}
                        >
                            <MenuItem onClick={exportToCSV}>
                                <ListItemIcon><DownloadIcon sx={{ color: '#22c55e' }} /></ListItemIcon>
                                <ListItemText primary="Export as CSV" secondary={`${filteredMachines.length} machines`} />
                            </MenuItem>
                            <MenuItem onClick={exportToJSON}>
                                <ListItemIcon><DownloadIcon sx={{ color: '#f97316' }} /></ListItemIcon>
                                <ListItemText primary="Export as JSON" secondary="With health data" />
                            </MenuItem>
                        </Menu>
                        <Tooltip title="Keyboard Shortcuts (?)">
                            <IconButton 
                                onClick={() => setHelpDialog(true)}
                                sx={{ 
                                    color: 'rgba(255,255,255,0.5)',
                                    background: 'rgba(255,255,255,0.03)',
                                    '&:hover': { color: '#ffaa00', background: 'rgba(255, 170, 0, 0.1)' }
                                }}
                            >
                                <HelpIcon />
                            </IconButton>
                        </Tooltip>
                        {canEditMachines && (
                            <Button 
                                variant="contained" 
                                startIcon={<AddIcon />} 
                                onClick={handleOpenAdd}
                                sx={{
                                    background: 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)',
                                    color: '#0a0a0f',
                                    fontWeight: 700,
                                    px: 3,
                                    py: 1.2,
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontSize: '0.95rem',
                                    boxShadow: '0 4px 20px rgba(249, 115, 22, 0.3)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #fb923c 0%, #4ade80 100%)',
                                        boxShadow: '0 6px 30px rgba(249, 115, 22, 0.5)',
                                        transform: 'translateY(-2px)',
                                    },
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                Add Machine
                            </Button>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Selection Actions Bar - Fixed height container */}
            <Box sx={{ minHeight: selectedMachines.size > 0 ? 56 : 0, mb: selectedMachines.size > 0 ? 3 : 0, transition: 'all 0.2s ease' }}>
            {selectedMachines.size > 0 && (
                <Box sx={{ 
                    p: 2, 
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                }}>
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        background: 'rgba(249, 115, 22, 0.2)',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px',
                    }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: '#f97316' }} />
                        <Typography sx={{ color: '#f97316', fontWeight: 600, fontSize: '0.9rem' }}>
                            {selectedMachines.size} machine{selectedMachines.size > 1 ? 's' : ''} selected
                        </Typography>
                    </Box>
                    
                    <Box sx={{ width: '1px', height: 24, background: 'rgba(255,255,255,0.1)' }} />
                    
                    {canRun && (
                        <Button
                            size="small"
                            startIcon={<PlayArrowIcon />}
                            onClick={() => navigate(`/scripts?machines=${Array.from(selectedMachines).join(',')}`)}
                            sx={{ 
                                background: 'linear-gradient(135deg, #f97316 0%, #00a8cc 100%)',
                                color: '#0a0a0f',
                                fontWeight: 600,
                                '&:hover': { 
                                    background: 'linear-gradient(135deg, #5ce1ff 0%, #f97316 100%)',
                                }
                            }}
                            variant="contained"
                        >
                            Run Script
                        </Button>
                    )}
                    {canUseTerminal && (
                        <Button
                            size="small"
                            startIcon={<TerminalIcon />}
                            onClick={() => navigate(`/run-command?machines=${Array.from(selectedMachines).join(',')}`)}
                            sx={{ 
                                background: 'linear-gradient(135deg, #22c55e 0%, #00cc6a 100%)',
                                color: '#0a0a0f',
                                fontWeight: 600,
                                '&:hover': { 
                                    background: 'linear-gradient(135deg, #66ffaa 0%, #22c55e 100%)',
                                }
                            }}
                            variant="contained"
                        >
                            Run Command
                        </Button>
                    )}
                    
                    <Box sx={{ width: '1px', height: 24, background: 'rgba(255,255,255,0.1)' }} />
                    
                    <Button
                        size="small"
                        startIcon={<WifiIcon />}
                        onClick={handleTestSelected}
                        sx={{ color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.5)' }}
                        variant="outlined"
                    >
                        Test All
                    </Button>
                    {canEditMachines && (
                        <Button
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDeleteConfirm('bulk')}
                            sx={{ color: '#ff4466', borderColor: 'rgba(255, 68, 102, 0.5)' }}
                            variant="outlined"
                        >
                            Delete
                        </Button>
                    )}
                    <Button
                        size="small"
                        onClick={() => setSelectedMachines(new Set())}
                        sx={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                        Clear
                    </Button>
                </Box>
            )}
            </Box>

            {/* Category Filter */}
            <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', minHeight: 40 }}>
            {machines.length > 0 && (
                <>
                    <Tooltip title="Select All (Ctrl+A)">
                        <IconButton 
                            size="small" 
                            onClick={selectAllMachines}
                            sx={{ 
                                color: selectedMachines.size === filteredMachines.length && filteredMachines.length > 0 ? '#f97316' : 'rgba(255,255,255,0.5)',
                                '&:hover': { background: 'rgba(249, 115, 22, 0.1)' }
                            }}
                        >
                            <SelectAllIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Chip
                        label={`All (${machines.length})`}
                        onClick={() => setFilterCategory('all')}
                        sx={{
                            background: filterCategory === 'all' ? 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)' : 'rgba(255,255,255,0.05)',
                            color: filterCategory === 'all' ? '#0a0a0f' : 'rgba(255,255,255,0.7)',
                            fontWeight: 600,
                            '&:hover': { background: filterCategory === 'all' ? 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)' : 'rgba(255,255,255,0.1)' }
                        }}
                    />
                    {[...new Set(machines.map(m => m.category || 'Uncategorized'))].map(cat => (
                        <Chip
                            key={cat}
                            label={`${cat} (${machines.filter(m => (m.category || 'Uncategorized') === cat).length})`}
                            onClick={() => setFilterCategory(cat)}
                            sx={{
                                background: filterCategory === cat ? 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)' : 'rgba(255,255,255,0.05)',
                                color: filterCategory === cat ? '#0a0a0f' : 'rgba(255,255,255,0.7)',
                                fontWeight: 600,
                                '&:hover': { background: filterCategory === cat ? 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)' : 'rgba(255,255,255,0.1)' }
                            }}
                        />
                    ))}
                </>
            )}
            </Box>

            {/* Machine Grid */}
            <Grid container spacing={3}>
                {loading ? (
                    // Show skeleton loaders while loading
                    [1, 2, 3, 4, 5, 6].map(i => (
                        <Grid item xs={12} sm={6} lg={4} key={i}>
                            <MachineSkeleton />
                        </Grid>
                    ))
                ) : machines.length === 0 ? (
                    <Grid item xs={12}>
                        <Box sx={{ 
                            textAlign: 'center', 
                            py: 12,
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '20px',
                            border: '1px dashed rgba(255,255,255,0.1)',
                        }}>
                            <ComputerIcon sx={{ fontSize: 80, color: 'rgba(249, 115, 22, 0.3)', mb: 3 }} />
                            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.2rem', mb: 1 }}>
                                No machines configured
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', mb: 3 }}>
                                Add your first machine to start deploying scripts
                            </Typography>
                            <Button 
                                variant="outlined" 
                                startIcon={<AddIcon />}
                                onClick={handleOpenAdd}
                                sx={{
                                    borderColor: 'rgba(249, 115, 22, 0.5)',
                                    color: '#f97316',
                                    '&:hover': {
                                        borderColor: '#f97316',
                                        background: 'rgba(249, 115, 22, 0.1)',
                                    }
                                }}
                            >
                                Add Your First Machine
                            </Button>
                        </Box>
                    </Grid>
                ) : (
                    filteredMachines.map((m, index) => {
                        const status = getStatusConfig(m.status)
                        const isSelected = selectedMachines.has(m.id)
                        return (
                            <Grid item xs={12} sm={6} lg={4} key={m.id}>
                                <Fade in timeout={300}>
                                    <Box sx={{
                                        background: isSelected ? 'rgba(249, 115, 22, 0.08)' : 'rgba(255,255,255,0.03)',
                                        borderRadius: '16px',
                                        border: isSelected ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                                        overflow: 'hidden',
                                        transition: 'border 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                                        minHeight: 220,
                                        '&:hover': {
                                            border: '1px solid rgba(249, 115, 22, 0.3)',
                                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                                        }
                                    }}>
                                        {/* Status Bar */}
                                        <Box sx={{
                                            height: 3,
                                            background: `linear-gradient(90deg, ${status.color} 0%, transparent 100%)`,
                                        }} />
                                        
                                        <Box sx={{ p: 3 }}>
                                            {/* Header */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onChange={() => toggleMachineSelection(m.id)}
                                                        sx={{
                                                            color: 'rgba(255,255,255,0.3)',
                                                            '&.Mui-checked': { color: '#f97316' },
                                                            p: 0,
                                                            mr: 1,
                                                        }}
                                                    />
                                                    <Box 
                                                        onClick={() => navigate(`/machines/${m.id}`)}
                                                        sx={{
                                                            width: 48,
                                                            height: 48,
                                                            borderRadius: '12px',
                                                            background: 'rgba(249, 115, 22, 0.1)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            '&:hover': { background: 'rgba(249, 115, 22, 0.2)' }
                                                        }}>
                                                        <ComputerIcon sx={{ color: '#f97316', fontSize: 24 }} />
                                                    </Box>
                                                    <Box 
                                                        onClick={() => navigate(`/machines/${m.id}`)}
                                                        sx={{ cursor: 'pointer' }}
                                                    >
                                                        <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', color: '#fff', '&:hover': { color: '#f97316' } }}>
                                                            {m.name}
                                                        </Typography>
                                                        <Typography sx={{ 
                                                            fontSize: '0.8rem', 
                                                            color: 'rgba(255,255,255,0.5)',
                                                            fontFamily: 'monospace',
                                                        }}>
                                                            {m.ip}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Tooltip title={favorites.includes(m.id) ? "Remove from favorites" : "Add to favorites"}>
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={(e) => { e.stopPropagation(); toggleFavorite(m.id) }}
                                                            sx={{ p: 0.5 }}
                                                        >
                                                            {favorites.includes(m.id) 
                                                                ? <StarIcon sx={{ fontSize: 18, color: '#ffaa00' }} />
                                                                : <StarBorderIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                                                            }
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Box sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: '8px',
                                                        background: status.bg,
                                                        color: status.color,
                                                    }}>
                                                        {status.icon}
                                                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                                            {m.status || 'unknown'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>

                                            {/* Health Stats */}
                                            {healthData[m.id] && healthData[m.id].online && (
                                                <Box sx={{ 
                                                    display: 'grid', 
                                                    gridTemplateColumns: 'repeat(2, 1fr)', 
                                                    gap: 1, 
                                                    mb: 2,
                                                    p: 1.5,
                                                    background: 'rgba(0,0,0,0.2)',
                                                    borderRadius: '8px',
                                                }}>
                                                    {healthData[m.id].cpu_usage && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>CPU:</Typography>
                                                            <Typography sx={{ fontSize: '0.7rem', color: '#ffaa00', fontFamily: 'monospace' }}>
                                                                {healthData[m.id].cpu_usage}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    {healthData[m.id].memory_usage && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Mem:</Typography>
                                                            <Typography sx={{ fontSize: '0.7rem', color: '#f97316', fontFamily: 'monospace' }}>
                                                                {healthData[m.id].memory_usage}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    {healthData[m.id].disk_usage && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Disk:</Typography>
                                                            <Typography sx={{ fontSize: '0.7rem', color: '#22c55e', fontFamily: 'monospace' }}>
                                                                {healthData[m.id].disk_usage}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    {healthData[m.id].response_time_ms > 0 ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Ping:</Typography>
                                                            <Typography sx={{ fontSize: '0.7rem', color: '#22c55e', fontFamily: 'monospace' }}>
                                                                {healthData[m.id].response_time_ms}ms
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Mode:</Typography>
                                                            <Typography sx={{ fontSize: '0.7rem', color: '#ff00ff', fontFamily: 'monospace' }}>
                                                                Agent
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                            )}

                                            {/* Info */}
                                            <Box sx={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: 2, 
                                                mb: (m.notes || m.tags?.length) ? 1 : 3,
                                            }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.4)' }}>
                                                    <PersonIcon sx={{ fontSize: 16 }} />
                                                    <Typography sx={{ fontSize: '0.85rem' }}>{m.username}</Typography>
                                                </Box>
                                                {m.category && (
                                                    <Chip 
                                                        size="small" 
                                                        label={m.category}
                                                        icon={<CategoryIcon sx={{ fontSize: 14 }} />}
                                                        sx={{ 
                                                            height: 24,
                                                            background: 'rgba(249, 115, 22, 0.1)',
                                                            color: '#f97316',
                                                            '& .MuiChip-icon': { color: '#f97316' }
                                                        }}
                                                    />
                                                )}
                                            </Box>

                                            {/* Tags */}
                                            {m.tags?.length > 0 && (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: m.notes ? 1 : 3 }}>
                                                    {m.tags.map((tag, i) => (
                                                        <Chip
                                                            key={i}
                                                            label={tag}
                                                            size="small"
                                                            icon={<LabelIcon sx={{ fontSize: '12px !important' }} />}
                                                            sx={{
                                                                height: 22,
                                                                fontSize: '0.7rem',
                                                                background: 'rgba(255, 170, 0, 0.1)',
                                                                border: '1px solid rgba(255, 170, 0, 0.3)',
                                                                color: '#ffaa00',
                                                                '& .MuiChip-icon': { color: '#ffaa00' }
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            )}

                                            {/* Notes */}
                                            {m.notes && (
                                                <Tooltip title={m.notes}>
                                                    <Typography sx={{ 
                                                        fontSize: '0.75rem', 
                                                        color: 'rgba(255,255,255,0.4)',
                                                        fontStyle: 'italic',
                                                        mb: 2,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: '100%',
                                                    }}>
                                                        📝 {m.notes}
                                                    </Typography>
                                                </Tooltip>
                                            )}

                                            {/* Actions */}
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                {canUseTerminal && (
                                                    <Tooltip title="Terminal">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => navigate(`/machines/${m.id}/terminal`)}
                                                            sx={{ 
                                                                color: '#22c55e',
                                                                background: 'rgba(34, 197, 94, 0.1)',
                                                                '&:hover': { background: 'rgba(34, 197, 94, 0.2)' }
                                                            }}
                                                        >
                                                            <TerminalIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {canUseFiles && (
                                                    <Tooltip title="Files">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => navigate(`/machines/${m.id}/files`)}
                                                            sx={{ 
                                                                color: '#ffaa00',
                                                                background: 'rgba(255, 170, 0, 0.1)',
                                                                '&:hover': { background: 'rgba(255, 170, 0, 0.2)' }
                                                            }}
                                                        >
                                                            <FolderIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {canRun && (
                                                    <Tooltip title="Run Script">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => navigate(`/scripts?machines=${m.id}`)}
                                                            sx={{ 
                                                                color: '#ff79c6',
                                                                background: 'rgba(255, 121, 198, 0.1)',
                                                                '&:hover': { background: 'rgba(255, 121, 198, 0.2)' }
                                                            }}
                                                        >
                                                            <RocketLaunchIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <Button
                                                    size="small"
                                                    startIcon={testing[m.id] ? null : <WifiIcon />}
                                                    onClick={() => handleTest(m.id)}
                                                    disabled={testing[m.id]}
                                                    sx={{
                                                        flex: 1,
                                                        color: '#f97316',
                                                        borderColor: 'rgba(249, 115, 22, 0.3)',
                                                        '&:hover': {
                                                            borderColor: '#f97316',
                                                            background: 'rgba(249, 115, 22, 0.1)',
                                                        }
                                                    }}
                                                    variant="outlined"
                                                >
                                                    {testing[m.id] ? 'Testing...' : 'Test'}
                                                </Button>
                                                {canEditMachines && (
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => handleEdit(m)}
                                                        sx={{ 
                                                            color: 'rgba(255, 255, 255, 0.5)',
                                                            '&:hover': { 
                                                                color: '#f97316',
                                                                background: 'rgba(249, 115, 22, 0.1)' 
                                                            }
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                )}
                                                {canEditMachines && (
                                                    <Tooltip title="Delete">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => setDeleteConfirm(m.id)}
                                                            sx={{ 
                                                                color: 'rgba(255, 68, 102, 0.7)',
                                                                '&:hover': { 
                                                                    color: '#ff4466',
                                                                    background: 'rgba(255, 68, 102, 0.1)' 
                                                                }
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>
                                </Fade>
                            </Grid>
                        )
                    })
                )}
            </Grid>

            {/* Add/Edit Machine Dialog */}
            <Dialog 
                open={open} 
                onClose={handleCloseDialog} 
                maxWidth="sm" 
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
                        border: '1px solid rgba(249, 115, 22, 0.2)',
                        borderRadius: '20px',
                    }
                }}
            >
                <Box sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
                            {editMode ? 'Edit Machine' : 'Add New Machine'}
                        </Typography>
                        <IconButton onClick={handleCloseDialog} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <TextField
                            placeholder="Machine Name"
                            fullWidth
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LabelIcon sx={{ color: 'rgba(249, 115, 22, 0.5)' }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: '12px',
                                }
                            }}
                        />
                        <TextField
                            placeholder="IP Address"
                            fullWidth
                            value={form.ip}
                            onChange={(e) => setForm({ ...form, ip: e.target.value })}
                            error={!!ipError}
                            helperText={ipError}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DnsIcon sx={{ color: ipError ? '#ff4466' : 'rgba(249, 115, 22, 0.5)' }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: '12px',
                                },
                                '& .MuiFormHelperText-root': {
                                    color: '#ff4466',
                                }
                            }}
                        />
                        <TextField
                            placeholder="Username"
                            fullWidth
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <PersonIcon sx={{ color: 'rgba(249, 115, 22, 0.5)' }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: '12px',
                                }
                            }}
                        />
                        <TextField
                            placeholder={editMode ? "Password (leave blank to keep current)" : "Password"}
                            type="password"
                            fullWidth
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LockIcon sx={{ color: 'rgba(249, 115, 22, 0.5)' }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: '12px',
                                }
                            }}
                        />
                        
                        {/* Category Selection */}
                        <Box>
                            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', mb: 1 }}>
                                Category
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {defaultCategories.map(cat => (
                                    <Chip
                                        key={cat}
                                        label={cat}
                                        onClick={() => setForm({ ...form, category: cat })}
                                        sx={{
                                            background: form.category === cat 
                                                ? 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)' 
                                                : 'rgba(255,255,255,0.05)',
                                            color: form.category === cat ? '#0a0a0f' : 'rgba(255,255,255,0.7)',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            '&:hover': { 
                                                background: form.category === cat 
                                                    ? 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)' 
                                                    : 'rgba(255,255,255,0.1)' 
                                            }
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>

                        {/* Notes Field */}
                        <TextField
                            placeholder="Notes (optional) - e.g., purpose, configuration, important info..."
                            fullWidth
                            multiline
                            rows={2}
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: '12px',
                                }
                            }}
                        />

                        {/* Tags Field */}
                        <Box>
                            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', mb: 1 }}>
                                Tags (for script filtering) - Press Enter or Tab to add
                            </Typography>
                            <TextField
                                placeholder="Type a tag and press Enter (e.g., build)"
                                fullWidth
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'Tab') {
                                        e.preventDefault()
                                        const value = e.target.value.trim()
                                        if (value && !form.tags?.includes(value)) {
                                            setForm({ ...form, tags: [...(form.tags || []), value] })
                                        }
                                        e.target.value = ''
                                    }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LabelIcon sx={{ color: 'rgba(255,255,255,0.3)' }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        background: 'rgba(0,0,0,0.3)',
                                        borderRadius: '12px',
                                    }
                                }}
                            />
                            {form.tags?.length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                    {form.tags.map((tag, i) => (
                                        <Chip
                                            key={i}
                                            label={tag}
                                            size="small"
                                            onDelete={() => setForm({ ...form, tags: form.tags.filter((_, idx) => idx !== i) })}
                                            sx={{
                                                background: 'rgba(249, 115, 22, 0.1)',
                                                border: '1px solid rgba(249, 115, 22, 0.3)',
                                                color: '#f97316',
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
                        <Button 
                            fullWidth 
                            onClick={handleCloseDialog}
                            sx={{ 
                                py: 1.5,
                                color: 'rgba(255,255,255,0.7)',
                                borderColor: 'rgba(255,255,255,0.2)',
                                '&:hover': { borderColor: 'rgba(255,255,255,0.4)' }
                            }}
                            variant="outlined"
                        >
                            Cancel
                        </Button>
                        <Button 
                            fullWidth 
                            variant="contained" 
                            onClick={handleAdd}
                            disabled={!form.name || !form.ip || !form.username || (!editMode && !form.password)}
                            sx={{
                                py: 1.5,
                                background: 'linear-gradient(135deg, #f97316 0%, #22c55e 100%)',
                                color: '#0a0a0f',
                                fontWeight: 600,
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #fb923c 0%, #4ade80 100%)',
                                },
                                '&:disabled': {
                                    background: 'rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.3)',
                                }
                            }}
                        >
                            {editMode ? 'Save Changes' : 'Add Machine'}
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirm !== null}
                onClose={() => setDeleteConfirm(null)}
                PaperProps={{
                    sx: {
                        background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
                        border: '1px solid rgba(255, 68, 102, 0.3)',
                        borderRadius: '16px',
                        minWidth: 400,
                    }
                }}
            >
                <Box sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Box sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '12px',
                            background: 'rgba(255, 68, 102, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <WarningIcon sx={{ color: '#ff4466', fontSize: 28 }} />
                        </Box>
                        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>
                            Confirm Delete
                        </Typography>
                    </Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                        {deleteConfirm === 'bulk' 
                            ? `Are you sure you want to delete ${selectedMachines.size} machine(s)? This action cannot be undone.`
                            : `Are you sure you want to delete this machine? This action cannot be undone.`
                        }
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            fullWidth
                            onClick={() => setDeleteConfirm(null)}
                            sx={{
                                py: 1.5,
                                color: 'rgba(255,255,255,0.7)',
                                borderColor: 'rgba(255,255,255,0.2)',
                            }}
                            variant="outlined"
                        >
                            Cancel
                        </Button>
                        <Button
                            fullWidth
                            onClick={() => deleteConfirm === 'bulk' ? handleDeleteSelected() : handleDelete(deleteConfirm)}
                            sx={{
                                py: 1.5,
                                background: 'linear-gradient(135deg, #ff4466 0%, #ff6688 100%)',
                                color: '#fff',
                                fontWeight: 600,
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #ff5577 0%, #ff7799 100%)',
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            {/* Toast Notifications */}
            <Snackbar
                open={toast.open}
                autoHideDuration={4000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setToast({ ...toast, open: false })}
                    severity={toast.severity}
                    sx={{
                        background: toast.severity === 'success' ? 'rgba(34, 197, 94, 0.1)' : 
                                   toast.severity === 'error' ? 'rgba(255, 68, 102, 0.1)' :
                                   toast.severity === 'warning' ? 'rgba(255, 170, 0, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                        border: `1px solid ${toast.severity === 'success' ? 'rgba(34, 197, 94, 0.3)' : 
                                            toast.severity === 'error' ? 'rgba(255, 68, 102, 0.3)' :
                                            toast.severity === 'warning' ? 'rgba(255, 170, 0, 0.3)' : 'rgba(249, 115, 22, 0.3)'}`,
                        color: '#fff',
                        '& .MuiAlert-icon': {
                            color: toast.severity === 'success' ? '#22c55e' : 
                                   toast.severity === 'error' ? '#ff4466' :
                                   toast.severity === 'warning' ? '#ffaa00' : '#f97316'
                        }
                    }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>

            {/* Keyboard Shortcuts Help */}
            <Box sx={{
                position: 'fixed',
                bottom: 20,
                left: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
            }}>
                <KeyboardIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                    Ctrl+N: Add • Ctrl+A: Select All • Esc: Close
                </Typography>
            </Box>

            {/* Import Preview Dialog */}
            <Dialog open={importDialog.open} onClose={() => setImportDialog({ open: false, data: '' })} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileUploadIcon sx={{ color: '#8be9fd' }} />
                    Import Machines Preview
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {Array.isArray(importDialog.data) ? `${importDialog.data.length} machine(s) found. Duplicates (same IP) will be skipped.` : 'No machines found'}
                    </Typography>
                    {Array.isArray(importDialog.data) && importDialog.data.length > 0 && (
                        <Box sx={{ maxHeight: 300, overflow: 'auto', bgcolor: '#0d1117', borderRadius: 1, p: 2 }}>
                            {importDialog.data.map((m, i) => (
                                <Box key={i} sx={{ display: 'flex', gap: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <Typography sx={{ fontWeight: 600, color: '#fff', minWidth: 150 }}>{m.name}</Typography>
                                    <Typography sx={{ color: '#f97316', fontFamily: 'monospace' }}>{m.ip}</Typography>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{m.username}</Typography>
                                    <Chip label={m.category || 'Uncategorized'} size="small" sx={{ ml: 'auto' }} />
                                </Box>
                            ))}
                        </Box>
                    )}
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        Note: Passwords are not exported for security. You'll need to update passwords after import.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImportDialog({ open: false, data: '' })}>Cancel</Button>
                    <Button variant="contained" onClick={handleImportConfirm} disabled={!Array.isArray(importDialog.data) || importDialog.data.length === 0}>
                        Import {Array.isArray(importDialog.data) ? importDialog.data.length : 0} Machine(s)
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Help Dialog */}
            <Dialog open={helpDialog} onClose={() => setHelpDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <KeyboardIcon sx={{ color: '#ffaa00' }} />
                    Keyboard Shortcuts
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {[
                            { keys: 'Ctrl + N', desc: 'Add new machine' },
                            { keys: 'Ctrl + A', desc: 'Select all machines' },
                            { keys: 'Ctrl + 1', desc: 'Go to Dashboard' },
                            { keys: 'Ctrl + 2', desc: 'Go to Machines' },
                            { keys: 'Ctrl + 3', desc: 'Go to Scripts' },
                            { keys: 'Ctrl + 4', desc: 'Go to History' },
                            { keys: 'Escape', desc: 'Close dialogs' },
                            { keys: '?', desc: 'Show this help' },
                        ].map(({ keys, desc }) => (
                            <Box key={keys} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ 
                                    px: 1.5, py: 0.5, borderRadius: 1, 
                                    bgcolor: 'rgba(255,255,255,0.1)', 
                                    fontFamily: 'monospace', 
                                    fontSize: '0.85rem',
                                    minWidth: 100,
                                    textAlign: 'center'
                                }}>
                                    {keys}
                                </Box>
                                <Typography color="text.secondary">{desc}</Typography>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setHelpDialog(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Machines
