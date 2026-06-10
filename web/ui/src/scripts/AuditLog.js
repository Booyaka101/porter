import { useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import Pagination from '@mui/material/Pagination'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Button from '@mui/material/Button'

import HistoryIcon from '@mui/icons-material/History'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import SearchIcon from '@mui/icons-material/Search'
import PersonIcon from '@mui/icons-material/Person'
import ComputerIcon from '@mui/icons-material/Computer'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import InfoIcon from '@mui/icons-material/Info'
import DownloadIcon from '@mui/icons-material/Download'

import { colors } from './theme'

// Helper to safely convert any value to string for rendering
const safeString = (val) => {
    if (val === null || val === undefined) return ''
    if (typeof val === 'string') return val
    if (typeof val === 'number' || typeof val === 'boolean') return String(val)
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
}

const AuditLog = () => {
    const [logs, setLogs] = useState([])
    const [category, setCategory] = useState('')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [detailsDialog, setDetailsDialog] = useState({ open: false, log: null })
    const perPage = 25

    const categories = ['', 'power', 'system', 'security', 'backup', 'terminal', 'groups', 'script', 'machine', 'docker', 'file']

    const loadLogs = async () => {
        setLoading(true)
        try {
            const url = category ? `/api/audit-log?category=${category}&limit=500` : '/api/audit-log?limit=500'
            const res = await fetch(url)
            const data = await res.json()
            // Normalize log entries - map backend fields to frontend expected fields
            const normalizedLogs = (data || []).map(log => ({
                id: log.id,
                // Backend uses created_at, frontend expects timestamp
                timestamp: log.created_at || log.timestamp,
                // Backend uses username, frontend expects user
                user: safeString(log.username || log.user || ''),
                action: safeString(log.action || ''),
                // Backend uses resource_type, frontend expects category
                category: safeString(log.resource_type || log.category || ''),
                // Backend uses resource_id, frontend expects machine_name/target
                machine_name: safeString(log.resource_id || log.machine_name || ''),
                target: safeString(log.resource_id || log.target || ''),
                // Details might be an object
                details: typeof log.details === 'object' ? JSON.stringify(log.details) : safeString(log.details || ''),
                // Backend doesn't have success field - infer from action or default to true
                success: log.success !== undefined ? log.success : !log.action?.includes('fail'),
                error: safeString(log.error || ''),
                ip_address: safeString(log.ip_address || ''),
            }))
            setLogs(normalizedLogs)
        } catch (err) {
            console.error('Failed to load audit log:', err)
        }
        setLoading(false)
    }

    useEffect(() => {
        loadLogs()
    }, [category])

    const filteredLogs = useMemo(() => {
        if (!search) return logs
        const q = search.toLowerCase()
        return logs.filter(log => 
            log.action?.toLowerCase().includes(q) ||
            log.machine_name?.toLowerCase().includes(q) ||
            log.user?.toLowerCase().includes(q) ||
            log.details?.toLowerCase().includes(q)
        )
    }, [logs, search])

    const paginatedLogs = useMemo(() => {
        const start = (page - 1) * perPage
        return filteredLogs.slice(start, start + perPage)
    }, [filteredLogs, page])

    const totalPages = Math.ceil(filteredLogs.length / perPage)

    const formatTime = (timestamp) => {
        if (!timestamp) return '-'
        
        // Handle various timestamp formats
        let date
        if (typeof timestamp === 'number') {
            // Unix timestamp (seconds or milliseconds)
            date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp)
        } else if (typeof timestamp === 'string') {
            // Try parsing as ISO string or other formats
            date = new Date(timestamp)
        } else {
            return '-'
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) return '-'
        
        const now = new Date()
        const diff = now - date
        
        if (diff < 0) return date.toLocaleString() // Future date
        if (diff < 60000) return 'Just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
        return date.toLocaleString()
    }

    const getActionIcon = (action) => {
        if (action?.includes('login') || action?.includes('user')) return <PersonIcon sx={{ fontSize: 16 }} />
        if (action?.includes('machine') || action?.includes('connect')) return <ComputerIcon sx={{ fontSize: 16 }} />
        return <AccessTimeIcon sx={{ fontSize: 16 }} />
    }

    const getActionColor = (action) => {
        if (action?.includes('delete') || action?.includes('remove') || action?.includes('stop')) return '#ef4444'
        if (action?.includes('create') || action?.includes('add') || action?.includes('start')) return '#22c55e'
        if (action?.includes('deploy') || action?.includes('run') || action?.includes('execute')) return '#f97316'
        if (action?.includes('update') || action?.includes('edit') || action?.includes('modify')) return '#8b5cf6'
        return '#6b7280'
    }

    const getCategoryColor = (cat) => {
        const catColors = {
            power: '#ef4444',
            system: '#3b82f6',
            security: '#f59e0b',
            backup: '#10b981',
            terminal: '#8b5cf6',
            groups: '#ec4899',
            script: '#f97316',
            machine: '#06b6d4',
            docker: '#2563eb',
            file: '#84cc16'
        }
        return catColors[cat] || '#6b7280'
    }

    const exportLogs = () => {
        const csv = [
            ['Time', 'User', 'Action', 'Category', 'Machine', 'Status', 'Details'],
            ...filteredLogs.map(log => [
                new Date(log.timestamp).toISOString(),
                log.user || '-',
                log.action,
                log.category,
                log.machine_name || '-',
                log.success ? 'Success' : 'Failed',
                log.details || ''
            ])
        ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
        
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <HistoryIcon sx={{ color: '#f97316', fontSize: 24 }} />
                    </Box>
                    <Box>
                        <Typography variant="h5" sx={{ color: '#fafafa', fontWeight: 700 }}>
                            Audit Log
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            Track who did what and when
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                        placeholder="Search logs..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        size="small"
                        sx={{ width: 200 }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.3)' }} /></InputAdornment>
                        }}
                    />
                    <TextField
                        select
                        label="Category"
                        value={category}
                        onChange={(e) => { setCategory(e.target.value); setPage(1) }}
                        size="small"
                        sx={{ width: 140 }}
                    >
                        <MenuItem value="">All Categories</MenuItem>
                        {categories.filter(c => c).map(c => (
                            <MenuItem key={c} value={c}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getCategoryColor(c) }} />
                                    {c.charAt(0).toUpperCase() + c.slice(1)}
                                </Box>
                            </MenuItem>
                        ))}
                    </TextField>
                    <Tooltip title="Export to CSV">
                        <IconButton onClick={exportLogs} sx={{ color: '#22c55e' }}>
                            <DownloadIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <IconButton onClick={loadLogs} sx={{ color: '#f97316' }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 3 }}>
                <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Total Events</Typography>
                    <Typography variant="h5" sx={{ color: '#fafafa', fontWeight: 700 }}>{logs.length}</Typography>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Successful</Typography>
                    <Typography variant="h5" sx={{ color: '#22c55e', fontWeight: 700 }}>{logs.filter(l => l.success).length}</Typography>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Failed</Typography>
                    <Typography variant="h5" sx={{ color: '#ef4444', fontWeight: 700 }}>{logs.filter(l => !l.success).length}</Typography>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Filtered</Typography>
                    <Typography variant="h5" sx={{ color: '#fafafa', fontWeight: 700 }}>{filteredLogs.length}</Typography>
                </Paper>
            </Box>

            {/* Table */}
            <Paper sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress sx={{ color: '#f97316' }} />
                    </Box>
                ) : (
                    <>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Time</TableCell>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>User</TableCell>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Action</TableCell>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Category</TableCell>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Target</TableCell>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</TableCell>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', width: 50 }}></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedLogs.map((log, i) => (
                                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(249, 115, 22, 0.05)' } }}>
                                            <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <Tooltip title={new Date(log.timestamp).toLocaleString()}>
                                                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                                                        {formatTime(log.timestamp)}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <PersonIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
                                                    <Typography sx={{ color: '#fafafa', fontSize: '0.9rem' }}>
                                                        {log.user || 'System'}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box sx={{ color: getActionColor(log.action) }}>
                                                        {getActionIcon(log.action)}
                                                    </Box>
                                                    <Typography sx={{ color: getActionColor(log.action), fontWeight: 500, fontSize: '0.9rem' }}>
                                                        {log.action?.replace(/_/g, ' ')}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <Chip 
                                                    label={log.category} 
                                                    size="small" 
                                                    sx={{ 
                                                        bgcolor: `${getCategoryColor(log.category)}20`,
                                                        color: getCategoryColor(log.category),
                                                        border: `1px solid ${getCategoryColor(log.category)}40`,
                                                        fontWeight: 500,
                                                        fontSize: '0.75rem'
                                                    }} 
                                                />
                                            </TableCell>
                                            <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                                                    {log.machine_name || log.target || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                {log.success ? (
                                                    <Chip label="Success" size="small" sx={{ bgcolor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', fontWeight: 500 }} />
                                                ) : (
                                                    <Chip label="Failed" size="small" sx={{ bgcolor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 500 }} />
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <Tooltip title="View Details">
                                                    <IconButton size="small" onClick={() => setDetailsDialog({ open: true, log })}>
                                                        <InfoIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {paginatedLogs.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', py: 8 }}>
                                                <HistoryIcon sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                                                <Typography>No audit log entries found</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        {totalPages > 1 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <Pagination 
                                    count={totalPages} 
                                    page={page} 
                                    onChange={(e, p) => setPage(p)}
                                    sx={{ '& .MuiPaginationItem-root': { color: 'rgba(255,255,255,0.7)' } }}
                                />
                            </Box>
                        )}
                    </>
                )}
            </Paper>

            {/* Details Dialog */}
            <Dialog 
                open={detailsDialog.open} 
                onClose={() => setDetailsDialog({ open: false, log: null })}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { bgcolor: 'rgba(20, 20, 20, 0.98)', border: '1px solid rgba(255,255,255,0.1)' } }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <InfoIcon sx={{ color: '#f97316' }} />
                    Event Details
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    {detailsDialog.log && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Timestamp</Typography>
                                <Typography sx={{ color: '#fafafa' }}>{new Date(detailsDialog.log.timestamp).toLocaleString()}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>User</Typography>
                                <Typography sx={{ color: '#fafafa' }}>{detailsDialog.log.user || 'System'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Action</Typography>
                                <Typography sx={{ color: getActionColor(detailsDialog.log.action), fontWeight: 500 }}>
                                    {detailsDialog.log.action?.replace(/_/g, ' ')}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Category</Typography>
                                <Chip label={detailsDialog.log.category} size="small" sx={{ ml: 1, bgcolor: `${getCategoryColor(detailsDialog.log.category)}20`, color: getCategoryColor(detailsDialog.log.category) }} />
                            </Box>
                            <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Target</Typography>
                                <Typography sx={{ color: '#fafafa' }}>{detailsDialog.log.machine_name || detailsDialog.log.target || '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Status</Typography>
                                <Typography sx={{ color: detailsDialog.log.success ? '#22c55e' : '#ef4444' }}>
                                    {detailsDialog.log.success ? 'Success' : 'Failed'}
                                </Typography>
                            </Box>
                            {detailsDialog.log.details && (
                                <Box>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Details</Typography>
                                    <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 1, mt: 0.5 }}>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                                            {detailsDialog.log.details}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            {detailsDialog.log.error && (
                                <Box>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Error</Typography>
                                    <Box sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', p: 2, borderRadius: 1, mt: 0.5, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                        <Typography sx={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                            {detailsDialog.log.error}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    )
}

export default AuditLog
