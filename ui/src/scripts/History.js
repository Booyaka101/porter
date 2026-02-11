import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Collapse from '@mui/material/Collapse'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Pagination from '@mui/material/Pagination'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Menu from '@mui/material/Menu'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HistoryIcon from '@mui/icons-material/History'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DeleteIcon from '@mui/icons-material/Delete'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ComputerIcon from '@mui/icons-material/Computer'
import TerminalIcon from '@mui/icons-material/Terminal'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import DownloadIcon from '@mui/icons-material/Download'
import FilterListIcon from '@mui/icons-material/FilterList'
import ReplayIcon from '@mui/icons-material/Replay'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import TimelineIcon from '@mui/icons-material/Timeline'
import ViewListIcon from '@mui/icons-material/ViewList'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import LabelIcon from '@mui/icons-material/Label'
import Checkbox from '@mui/material/Checkbox'
import { useNavigate } from 'react-router-dom'
import { colors, gradients, scrollableStyles, glassCard } from './theme'
import { useAuth } from './AuthContext'

const History = () => {
    const navigate = useNavigate()
    const { isAdmin } = useAuth()
    const [executions, setExecutions] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [expandedId, setExpandedId] = useState(null)
    const [page, setPage] = useState(1)
    const [perPage, setPerPage] = useState(20)
    const [statusFilter, setStatusFilter] = useState('all')
    const [exportMenuAnchor, setExportMenuAnchor] = useState(null)
    const [rerunConfirm, setRerunConfirm] = useState(null)
    const [viewMode, setViewMode] = useState('list') // 'list' or 'timeline'
    const [selectedIds, setSelectedIds] = useState([])
    const [compareDialog, setCompareDialog] = useState({ open: false, executions: [] })
    const [loadedDetails, setLoadedDetails] = useState({}) // Cache for lazy-loaded execution details
    const [loadingDetail, setLoadingDetail] = useState(null) // ID of currently loading detail

    const loadHistory = useCallback(async () => {
        setLoading(true)
        try {
            const [historyRes, statsRes] = await Promise.all([
                fetch('/api/history?limit=100'),
                fetch('/api/history/stats')
            ])
            const historyData = await historyRes.json()
            const statsData = await statsRes.json()
            setExecutions(historyData || [])
            setStats(statsData)
            setLoadedDetails({}) // Clear cached details on refresh
        } catch (err) {
            console.error('Failed to load history:', err)
        }
        setLoading(false)
    }, [])

    // Lazy load execution details (including output) when expanding
    const loadExecutionDetail = useCallback(async (id) => {
        if (loadedDetails[id]) return // Already loaded
        
        setLoadingDetail(id)
        try {
            const res = await fetch(`/api/history/${id}`)
            if (res.ok) {
                const detail = await res.json()
                setLoadedDetails(prev => ({ ...prev, [id]: detail }))
            }
        } catch (err) {
            console.error('Failed to load execution detail:', err)
        }
        setLoadingDetail(null)
    }, [loadedDetails])

    const handleRerun = (execution) => {
        setRerunConfirm(execution)
    }

    const confirmRerun = () => {
        if (rerunConfirm) {
            navigate(`/scripts?rerun=${rerunConfirm.id}`)
        }
        setRerunConfirm(null)
    }

    useEffect(() => {
        loadHistory()
    }, [loadHistory])

    const clearHistory = async () => {
        if (!window.confirm('Clear all execution history?')) return
        try {
            await fetch('/api/history', { method: 'DELETE' })
            loadHistory()
        } catch (err) {
            console.error('Failed to clear history:', err)
        }
    }

    const filteredExecutions = executions.filter(e => {
        const matchesSearch = 
            e.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
            e.script_name?.toLowerCase().includes(search.toLowerCase()) ||
            e.script_path?.toLowerCase().includes(search.toLowerCase())
        
        const matchesStatus = statusFilter === 'all' || 
            (statusFilter === 'success' && e.success) ||
            (statusFilter === 'failed' && !e.success)
        
        return matchesSearch && matchesStatus
    })

    // Pagination
    const totalPages = Math.ceil(filteredExecutions.length / perPage)
    const paginatedExecutions = filteredExecutions.slice((page - 1) * perPage, page * perPage)

    const formatDuration = (duration) => {
        if (!duration) return '-'
        return duration.replace('s', ' sec').replace('m', ' min ')
    }

    // Export functions
    const exportToJSON = () => {
        const data = JSON.stringify(filteredExecutions, null, 2)
        downloadFile(data, 'execution-history.json', 'application/json')
        setExportMenuAnchor(null)
    }

    const exportToCSV = () => {
        const headers = ['ID', 'Machine', 'Script', 'Status', 'Started', 'Duration', 'Error']
        const rows = filteredExecutions.map(e => [
            e.id,
            e.machine_name,
            e.script_name || e.script_path,
            e.success ? 'Success' : 'Failed',
            new Date(e.started_at).toISOString(),
            e.duration || '',
            e.error || ''
        ])
        const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
        downloadFile(csv, 'execution-history.csv', 'text/csv')
        setExportMenuAnchor(null)
    }

    const downloadFile = (content, filename, type) => {
        const blob = new Blob([content], { type })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    // Bulk selection handlers
    const toggleSelect = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const selectAll = () => {
        if (selectedIds.length === paginatedExecutions.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(paginatedExecutions.map(e => e.id))
        }
    }

    const bulkRerun = () => {
        if (selectedIds.length === 0) return
        const selected = executions.filter(e => selectedIds.includes(e.id))
        if (selected.length === 1) {
            handleRerun(selected[0])
        } else {
            // For multiple, navigate to scripts with the first one
            navigate(`/scripts?rerun=${selected[0].id}`)
        }
    }

    // Compare executions
    const openCompare = () => {
        if (selectedIds.length !== 2) return
        const selected = executions.filter(e => selectedIds.includes(e.id))
        setCompareDialog({ open: true, executions: selected })
    }

    // Group executions by date for timeline view
    const groupedByDate = filteredExecutions.reduce((acc, exec) => {
        const date = new Date(exec.started_at).toLocaleDateString()
        if (!acc[date]) acc[date] = []
        acc[date].push(exec)
        return acc
    }, {})

    return (
        <Box sx={scrollableStyles.pageContainer}>
            {/* Header */}
            <Box sx={{ 
                background: gradients.header,
                borderRadius: '24px',
                border: `1px solid ${colors.border.light}`,
                p: 3,
                mb: 4,
            }}>
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start', 
                    flexWrap: 'wrap',
                    gap: 2
                }}>
                    <Box>
                        <Typography sx={{ 
                            fontSize: '2.2rem', 
                            fontWeight: 800,
                            background: gradients.text,
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em',
                            mb: 0.5,
                        }}>
                            Execution History
                        </Typography>
                        <Typography sx={{ color: colors.text.muted, fontSize: '0.95rem' }}>
                            View past script executions and their results
                        </Typography>
                        
                        {/* Quick Stats in Header */}
                        {stats && (
                            <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <HistoryIcon sx={{ fontSize: 16, color: colors.primary }} />
                                    <Typography sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                        <strong style={{ color: colors.primary }}>{stats.total}</strong> Total
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CheckCircleIcon sx={{ fontSize: 16, color: colors.secondary }} />
                                    <Typography sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                        <strong style={{ color: colors.secondary }}>{stats.successful}</strong> Success
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ErrorIcon sx={{ fontSize: 16, color: colors.error }} />
                                    <Typography sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                        <strong style={{ color: colors.error }}>{stats.failed}</strong> Failed
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TrendingUpIcon sx={{ fontSize: 16, color: colors.warning }} />
                                    <Typography sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                        <strong style={{ color: colors.warning }}>{stats.success_rate?.toFixed(1)}%</strong> Rate
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {/* View Mode Toggle */}
                        <Box sx={{ 
                            display: 'flex', 
                            background: 'rgba(255,255,255,0.03)', 
                            borderRadius: '10px',
                            border: `1px solid ${colors.border.light}`,
                            p: 0.5,
                        }}>
                            <Tooltip title="List View">
                                <IconButton 
                                    size="small"
                                    onClick={() => setViewMode('list')}
                                    sx={{ 
                                        color: viewMode === 'list' ? colors.primary : colors.text.muted,
                                        background: viewMode === 'list' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                                        borderRadius: '8px',
                                        '&:hover': { background: 'rgba(249, 115, 22, 0.1)' }
                                    }}
                                >
                                    <ViewListIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Timeline View">
                                <IconButton 
                                    size="small"
                                    onClick={() => setViewMode('timeline')}
                                    sx={{ 
                                        color: viewMode === 'timeline' ? colors.primary : colors.text.muted,
                                        background: viewMode === 'timeline' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                                        borderRadius: '8px',
                                        '&:hover': { background: 'rgba(249, 115, 22, 0.1)' }
                                    }}
                                >
                                    <TimelineIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <Button
                            startIcon={<DownloadIcon />}
                            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                            sx={{ 
                                color: colors.text.secondary,
                                textTransform: 'none',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '10px',
                                '&:hover': { background: 'rgba(249, 115, 22, 0.1)' }
                            }}
                        >
                            Export
                        </Button>
                        <Menu
                            anchorEl={exportMenuAnchor}
                            open={Boolean(exportMenuAnchor)}
                            onClose={() => setExportMenuAnchor(null)}
                            PaperProps={{
                                sx: {
                                    background: 'rgba(17, 24, 39, 0.95)',
                                    backdropFilter: 'blur(20px)',
                                    border: `1px solid ${colors.border.light}`,
                                    borderRadius: '12px',
                                }
                            }}
                        >
                            <MenuItem onClick={exportToJSON}>Export as JSON</MenuItem>
                            <MenuItem onClick={exportToCSV}>Export as CSV</MenuItem>
                        </Menu>
                        <Tooltip title="Refresh">
                            <IconButton 
                                onClick={loadHistory} 
                                sx={{ 
                                    color: colors.text.muted,
                                    background: 'rgba(255,255,255,0.03)',
                                    '&:hover': { color: colors.primary, background: 'rgba(249, 115, 22, 0.1)' }
                                }}
                            >
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <Button
                            onClick={clearHistory}
                            startIcon={<DeleteIcon />}
                            size="small"
                            sx={{ 
                                color: colors.text.muted,
                                textTransform: 'none',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '10px',
                                px: 2,
                                '&:hover': { color: colors.error, background: 'rgba(255, 68, 102, 0.1)' }
                            }}
                        >
                            Clear All
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Search and Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <TextField
                    size="small"
                    placeholder="Search by machine or script..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: colors.text.disabled }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ 
                        flex: 1,
                        minWidth: 200,
                        '& .MuiOutlinedInput-root': {
                            background: colors.background.glass,
                            borderRadius: '12px',
                        }
                    }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        startAdornment={<FilterListIcon sx={{ mr: 1, color: colors.text.disabled }} />}
                        sx={{
                            background: colors.background.glass,
                            borderRadius: '12px',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: colors.border.light,
                            }
                        }}
                    >
                        <MenuItem value="all">All Status</MenuItem>
                        <MenuItem value="success">Success</MenuItem>
                        <MenuItem value="failed">Failed</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                    <Select
                        value={perPage}
                        onChange={(e) => { setPerPage(e.target.value); setPage(1); }}
                        sx={{
                            background: colors.background.glass,
                            borderRadius: '12px',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: colors.border.light,
                            }
                        }}
                    >
                        <MenuItem value={10}>10 / page</MenuItem>
                        <MenuItem value={20}>20 / page</MenuItem>
                        <MenuItem value={50}>50 / page</MenuItem>
                        <MenuItem value={100}>100 / page</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    mb: 2,
                    p: 2,
                    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
                    borderRadius: '12px',
                    border: `1px solid rgba(249, 115, 22, 0.3)`,
                }}>
                    <Checkbox
                        checked={selectedIds.length === paginatedExecutions.length}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < paginatedExecutions.length}
                        onChange={selectAll}
                        sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                    />
                    <Typography sx={{ color: colors.primary, fontWeight: 600 }}>
                        {selectedIds.length} selected
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    {isAdmin() && (
                        <Button
                            size="small"
                            startIcon={<ReplayIcon />}
                            onClick={bulkRerun}
                            sx={{ 
                                color: colors.primary,
                                textTransform: 'none',
                                '&:hover': { background: 'rgba(249, 115, 22, 0.15)' }
                            }}
                        >
                            Re-run Selected
                        </Button>
                    )}
                    {selectedIds.length === 2 && (
                        <Button
                            size="small"
                            startIcon={<CompareArrowsIcon />}
                            onClick={openCompare}
                            sx={{ 
                                color: '#06b6d4',
                                textTransform: 'none',
                                '&:hover': { background: 'rgba(6, 182, 212, 0.15)' }
                            }}
                        >
                            Compare Outputs
                        </Button>
                    )}
                    <Button
                        size="small"
                        onClick={() => setSelectedIds([])}
                        sx={{ 
                            color: colors.text.muted,
                            textTransform: 'none',
                        }}
                    >
                        Clear
                    </Button>
                </Box>
            )}

            {/* Results count */}
            {!loading && (
                <Typography sx={{ color: colors.text.disabled, fontSize: '0.85rem', mb: 2 }}>
                    Showing {paginatedExecutions.length} of {filteredExecutions.length} executions
                </Typography>
            )}

            {/* Loading Skeleton */}
            {loading ? (
                <Box>
                    {[1, 2, 3, 4, 5].map(i => (
                        <Box key={i} sx={{ 
                            mb: 2, 
                            p: 2,
                            background: colors.background.glass,
                            borderRadius: '12px',
                            border: `1px solid ${colors.border.light}`,
                            borderLeft: `4px solid ${colors.border.light}`,
                        }}>
                            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                <Box sx={{ width: 120, height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }} />
                                <Box sx={{ width: 60, height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }} />
                            </Box>
                            <Box sx={{ width: 200, height: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 1, mb: 1 }} />
                            <Box sx={{ width: 150, height: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 1 }} />
                        </Box>
                    ))}
                </Box>
            ) : paginatedExecutions.length === 0 ? (
                <Box sx={{ 
                    textAlign: 'center', 
                    py: 8, 
                    background: colors.background.glass,
                    borderRadius: '16px',
                    border: `1px solid ${colors.border.light}`
                }}>
                    <HistoryIcon sx={{ fontSize: 64, color: colors.text.disabled, mb: 2 }} />
                    <Typography sx={{ color: colors.text.muted }}>
                        {search ? 'No matching executions found' : 'No execution history yet'}
                    </Typography>
                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.85rem' }}>
                        Run a script to see it appear here
                    </Typography>
                </Box>
            ) : (
                paginatedExecutions.map((r, index) => (
                    <Card 
                        key={r.id} 
                        sx={{ 
                            mb: 1.5, 
                            background: index % 2 === 0 
                                ? 'rgba(255,255,255,0.02)' 
                                : 'rgba(255,255,255,0.04)',
                            borderRadius: '12px',
                            border: `1px solid ${colors.border.light}`,
                            borderLeft: `4px solid ${r.success ? colors.secondary : colors.error}`,
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                                borderColor: r.success ? colors.secondary : colors.error,
                                background: r.success 
                                    ? 'rgba(34, 197, 94, 0.05)' 
                                    : 'rgba(255, 68, 102, 0.05)',
                                transform: 'translateX(4px)',
                                boxShadow: `0 4px 20px ${r.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 68, 102, 0.15)'}`,
                            }
                        }}
                    >
                        <CardContent sx={{ pb: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                                    <Checkbox
                                        size="small"
                                        checked={selectedIds.includes(r.id)}
                                        onChange={() => toggleSelect(r.id)}
                                        sx={{ 
                                            mt: -0.5,
                                            color: colors.text.muted, 
                                            '&.Mui-checked': { color: colors.primary } 
                                        }}
                                    />
                                    <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <ComputerIcon sx={{ fontSize: 18, color: colors.primary }} />
                                        <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>
                                            {r.machine_name}
                                        </Typography>
                                        <Chip
                                            icon={r.success ? <CheckCircleIcon /> : <ErrorIcon />}
                                            label={r.success ? 'Success' : 'Failed'}
                                            size="small"
                                            sx={{
                                                background: r.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 68, 102, 0.1)',
                                                color: r.success ? colors.secondary : colors.error,
                                                '& .MuiChip-icon': {
                                                    color: r.success ? colors.secondary : colors.error,
                                                }
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <TerminalIcon sx={{ fontSize: 16, color: colors.text.disabled }} />
                                        <Typography sx={{ color: colors.text.secondary, fontSize: '0.9rem' }}>
                                            {r.script_name || r.script_path}
                                        </Typography>
                                        {r.preset_name && (
                                            <Chip label={r.preset_name} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <AccessTimeIcon sx={{ fontSize: 14 }} />
                                            {new Date(r.started_at).toLocaleString()}
                                        </Typography>
                                        {r.duration && (
                                            <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem' }}>
                                                Duration: {formatDuration(r.duration)}
                                            </Typography>
                                        )}
                                    </Box>
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    {isAdmin() && (
                                        <Tooltip title="Re-run this execution">
                                            <IconButton 
                                                size="small" 
                                                onClick={() => handleRerun(r)}
                                                sx={{ 
                                                    color: colors.text.muted,
                                                    '&:hover': { color: colors.primary, background: 'rgba(249, 115, 22, 0.1)' }
                                                }}
                                            >
                                                <ReplayIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    <IconButton 
                                        size="small" 
                                        onClick={() => {
                                            const newExpandedId = expandedId === r.id ? null : r.id
                                            setExpandedId(newExpandedId)
                                            if (newExpandedId) loadExecutionDetail(r.id)
                                        }}
                                        sx={{ color: colors.text.secondary }}
                                    >
                                        {expandedId === r.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    </IconButton>
                                </Box>
                            </Box>
                        </CardContent>
                        <Collapse in={expandedId === r.id}>
                            <CardContent sx={{ pt: 0 }}>
                                {loadingDetail === r.id ? (
                                    <Box sx={{ py: 2 }}>
                                        <LinearProgress sx={{ borderRadius: 1 }} />
                                        <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mt: 1, textAlign: 'center' }}>
                                            Loading output...
                                        </Typography>
                                    </Box>
                                ) : (
                                    <>
                                        {(loadedDetails[r.id]?.error || r.error) && (
                                            <Box sx={{ 
                                                background: 'rgba(255, 68, 102, 0.1)', 
                                                borderRadius: '8px', 
                                                p: 2, 
                                                mb: 2 
                                            }}>
                                                <Typography sx={{ color: colors.error, fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }}>
                                                    Error
                                                </Typography>
                                                <Typography sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                                    {loadedDetails[r.id]?.error || r.error}
                                                </Typography>
                                            </Box>
                                        )}
                                        {loadedDetails[r.id]?.output ? (
                                            <Box sx={{ 
                                                background: 'rgba(0,0,0,0.3)', 
                                                borderRadius: '8px', 
                                                p: 2,
                                                maxHeight: 300,
                                                overflow: 'auto'
                                            }}>
                                                <Typography sx={{ color: colors.text.muted, fontWeight: 600, fontSize: '0.85rem', mb: 1 }}>
                                                    Output
                                                </Typography>
                                                <pre style={{ 
                                                    margin: 0, 
                                                    color: colors.text.secondary, 
                                                    fontSize: '0.8rem',
                                                    fontFamily: '"JetBrains Mono", monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}>
                                                    {loadedDetails[r.id].output}
                                                </pre>
                                            </Box>
                                        ) : !loadedDetails[r.id] ? null : (
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', fontStyle: 'italic' }}>
                                                No output recorded
                                            </Typography>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Collapse>
                    </Card>
                ))
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    mt: 3,
                    pb: 2
                }}>
                    <Pagination 
                        count={totalPages}
                        page={page}
                        onChange={(e, value) => setPage(value)}
                        color="primary"
                        sx={{
                            '& .MuiPaginationItem-root': {
                                color: colors.text.secondary,
                                '&.Mui-selected': {
                                    background: 'rgba(249, 115, 22, 0.2)',
                                    color: colors.primary,
                                }
                            }
                        }}
                    />
                </Box>
            )}

            {/* Re-run Confirmation Dialog */}
            <Dialog
                open={Boolean(rerunConfirm)}
                onClose={() => setRerunConfirm(null)}
                PaperProps={{
                    sx: {
                        background: 'rgba(17, 24, 39, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: `1px solid ${colors.border.light}`,
                        borderRadius: '16px',
                        minWidth: 400,
                    }
                }}
            >
                <DialogTitle sx={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ReplayIcon sx={{ color: colors.primary }} />
                    Confirm Re-run
                </DialogTitle>
                <DialogContent>
                    {rerunConfirm && (
                        <Box>
                            <Typography sx={{ color: colors.text.secondary, mb: 2 }}>
                                Are you sure you want to re-run this execution?
                            </Typography>
                            <Box sx={{ 
                                background: 'rgba(255,255,255,0.03)', 
                                borderRadius: '8px', 
                                p: 2,
                                border: `1px solid ${colors.border.light}`
                            }}>
                                <Typography sx={{ color: colors.text.primary, fontWeight: 600, mb: 0.5 }}>
                                    {rerunConfirm.script_name}
                                </Typography>
                                <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem' }}>
                                    Machine: {rerunConfirm.machine_name}
                                </Typography>
                                {rerunConfirm.args && (
                                    <Typography sx={{ color: colors.text.disabled, fontSize: '0.8rem', mt: 0.5, fontFamily: 'monospace' }}>
                                        Args: {rerunConfirm.args}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button 
                        onClick={() => setRerunConfirm(null)}
                        sx={{ color: colors.text.secondary }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={confirmRerun}
                        variant="contained"
                        startIcon={<ReplayIcon />}
                        sx={{ 
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            '&:hover': { background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)' }
                        }}
                    >
                        Re-run
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Compare Outputs Dialog */}
            <Dialog
                open={compareDialog.open}
                onClose={() => setCompareDialog({ open: false, executions: [] })}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'rgba(17, 24, 39, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: `1px solid ${colors.border.light}`,
                        borderRadius: '16px',
                        maxHeight: '80vh',
                    }
                }}
            >
                <DialogTitle sx={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CompareArrowsIcon sx={{ color: '#06b6d4' }} />
                    Compare Execution Outputs
                </DialogTitle>
                <DialogContent>
                    {compareDialog.executions.length === 2 && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {compareDialog.executions.map((exec, idx) => (
                                <Box key={exec.id} sx={{ flex: 1 }}>
                                    <Box sx={{ 
                                        p: 2, 
                                        mb: 2,
                                        background: exec.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 68, 102, 0.1)',
                                        borderRadius: '8px',
                                        border: `1px solid ${exec.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 68, 102, 0.3)'}`,
                                    }}>
                                        <Typography sx={{ color: colors.text.primary, fontWeight: 600, fontSize: '0.9rem' }}>
                                            {exec.script_name}
                                        </Typography>
                                        <Typography sx={{ color: colors.text.muted, fontSize: '0.8rem' }}>
                                            {exec.machine_name} • {new Date(exec.started_at).toLocaleString()}
                                        </Typography>
                                        <Chip
                                            label={exec.success ? 'Success' : 'Failed'}
                                            size="small"
                                            sx={{
                                                mt: 1,
                                                background: exec.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 68, 102, 0.2)',
                                                color: exec.success ? colors.secondary : colors.error,
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ 
                                        background: 'rgba(0,0,0,0.3)', 
                                        borderRadius: '8px', 
                                        p: 2,
                                        maxHeight: 400,
                                        overflow: 'auto',
                                    }}>
                                        <Typography sx={{ color: colors.text.muted, fontWeight: 600, fontSize: '0.8rem', mb: 1 }}>
                                            Output {idx + 1}
                                        </Typography>
                                        <pre style={{ 
                                            margin: 0, 
                                            color: colors.text.secondary, 
                                            fontSize: '0.75rem',
                                            fontFamily: '"JetBrains Mono", monospace',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}>
                                            {exec.output || '(No output)'}
                                        </pre>
                                        {exec.error && (
                                            <Box sx={{ mt: 2, p: 1, background: 'rgba(255, 68, 102, 0.1)', borderRadius: '4px' }}>
                                                <Typography sx={{ color: colors.error, fontSize: '0.75rem' }}>
                                                    Error: {exec.error}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button 
                        onClick={() => setCompareDialog({ open: false, executions: [] })}
                        sx={{ color: colors.text.secondary }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default History
