import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import ApiIcon from '@mui/icons-material/Api'
import SearchIcon from '@mui/icons-material/Search'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

const API_ENDPOINTS = [
    {
        category: 'Machines',
        endpoints: [
            { method: 'GET', path: '/api/machines', description: 'List all machines', response: '[{ id, name, ip, username, status, tags, category }]' },
            { method: 'GET', path: '/api/machines/:id', description: 'Get machine details', response: '{ id, name, ip, username, status, tags, category }' },
            { method: 'POST', path: '/api/machines', description: 'Add a new machine', body: '{ name, ip, username, password?, key?, tags?, category? }', response: '{ id, name, ip, ... }' },
            { method: 'PUT', path: '/api/machines/:id', description: 'Update machine', body: '{ name?, ip?, username?, password?, tags?, category? }' },
            { method: 'DELETE', path: '/api/machines/:id', description: 'Delete machine' },
            { method: 'POST', path: '/api/machines/test', description: 'Test machine connection', query: 'id=<machine_id>', response: '{ success, message }' },
            { method: 'GET', path: '/api/machines/:id/health', description: 'Get machine health metrics', response: '{ online, uptime, load_avg, memory_usage, disk_usage }' },
        ]
    },
    {
        category: 'Scripts',
        endpoints: [
            { method: 'GET', path: '/api/scripts', description: 'List all scripts', response: '[{ path, name, description, category, is_top_level, is_custom }]' },
            { method: 'GET', path: '/api/scripts/:path', description: 'Get script content', response: '{ path, name, content, ... }' },
            { method: 'POST', path: '/api/custom-scripts', description: 'Create custom script', body: '{ name, description, content, category? }' },
            { method: 'PUT', path: '/api/custom-scripts/:id', description: 'Update custom script', body: '{ name?, description?, content? }' },
            { method: 'DELETE', path: '/api/custom-scripts/:id', description: 'Delete custom script' },
        ]
    },
    {
        category: 'Script Execution',
        endpoints: [
            { method: 'POST', path: '/api/run', description: 'Execute script on machines', body: '{ script_path, machine_ids[], params? }', response: '{ execution_id }' },
            { method: 'GET', path: '/api/script-executions', description: 'List executions', query: 'running=true|false', response: '[{ id, script_path, machine_id, status, started_at }]' },
            { method: 'GET', path: '/api/script-executions/:id', description: 'Get execution details', response: '{ id, script_path, machine_id, status, output, started_at, finished_at }' },
            { method: 'DELETE', path: '/api/script-executions/:id', description: 'Cancel execution' },
        ]
    },
    {
        category: 'History',
        endpoints: [
            { method: 'GET', path: '/api/history', description: 'Get execution history', query: 'limit=100', response: '{ history: [{ id, script_name, machine_name, status, started_at, duration }] }' },
            { method: 'GET', path: '/api/history/stats', description: 'Get history statistics', response: '{ total, successful, failed, avg_duration }' },
            { method: 'DELETE', path: '/api/history', description: 'Clear all history' },
        ]
    },
    {
        category: 'Terminal',
        endpoints: [
            { method: 'WS', path: '/api/terminal/:machine_id', description: 'WebSocket terminal connection', note: 'Bidirectional terminal I/O' },
            { method: 'GET', path: '/api/terminal/recordings/:machine_id', description: 'List terminal recordings', response: '[{ id, started_at, duration }]' },
            { method: 'GET', path: '/api/terminal/recordings/:machine_id/:id', description: 'Get recording data', response: '{ events: [{ time, data }] }' },
        ]
    },
    {
        category: 'Files',
        endpoints: [
            { method: 'GET', path: '/api/machines/:id/files', description: 'List directory contents', query: 'path=/home', response: '{ files: [{ name, size, mode, is_dir, mod_time }] }' },
            { method: 'GET', path: '/api/machines/:id/files/download', description: 'Download file', query: 'path=/path/to/file' },
            { method: 'POST', path: '/api/machines/:id/files/upload', description: 'Upload file', body: 'multipart/form-data: file, path' },
            { method: 'DELETE', path: '/api/machines/:id/files', description: 'Delete file', query: 'path=/path/to/file' },
            { method: 'POST', path: '/api/machines/:id/files/mkdir', description: 'Create directory', body: '{ path }' },
        ]
    },
    {
        category: 'Docker',
        endpoints: [
            { method: 'GET', path: '/api/machines/:id/docker/containers', description: 'List containers', response: '[{ id, name, image, state, status }]' },
            { method: 'POST', path: '/api/machines/:id/docker/containers/:cid/:action', description: 'Container action', note: 'action: start|stop|restart|remove' },
            { method: 'GET', path: '/api/machines/:id/docker/images', description: 'List images', response: '[{ id, tags, size, created }]' },
            { method: 'GET', path: '/api/machines/:id/docker/info', description: 'Get Docker info', response: '{ ServerVersion, Containers, Images, ... }' },
        ]
    },
    {
        category: 'Services',
        endpoints: [
            { method: 'GET', path: '/api/machines/:id/services', description: 'List systemd services', response: '{ services: [{ name, status, subState, description }] }' },
            { method: 'POST', path: '/api/machines/:id/services/:name/:action', description: 'Service action', note: 'action: start|stop|restart|enable|disable' },
            { method: 'GET', path: '/api/machines/:id/services/:name/logs', description: 'Get service logs', query: 'lines=100' },
        ]
    },
    {
        category: 'Authentication',
        endpoints: [
            { method: 'POST', path: '/api/auth/login', description: 'User login', body: '{ username, password }', response: '{ token, user }' },
            { method: 'POST', path: '/api/auth/logout', description: 'User logout' },
            { method: 'GET', path: '/api/auth/me', description: 'Get current user', response: '{ id, username, role, permissions }' },
        ]
    },
    {
        category: 'Audit Log',
        endpoints: [
            { method: 'GET', path: '/api/audit-log', description: 'Get audit log entries', query: 'category=script', response: '[{ timestamp, user, action, category, machine_name, success }]' },
        ]
    },
    {
        category: 'Health',
        endpoints: [
            { method: 'GET', path: '/api/health/cached', description: 'Get cached health for all machines', response: '{ machine_id: { online, uptime, load_avg, ... } }' },
            { method: 'POST', path: '/api/health/refresh', description: 'Refresh health data for all machines' },
        ]
    },
    {
        category: 'Webhooks',
        endpoints: [
            { method: 'GET', path: '/api/webhooks', description: 'List webhooks', response: '[{ id, name, url, events, enabled }]' },
            { method: 'POST', path: '/api/webhooks', description: 'Create webhook', body: '{ name, url, events[], secret? }' },
            { method: 'PUT', path: '/api/webhooks/:id', description: 'Update webhook', body: '{ name?, url?, events?, enabled? }' },
            { method: 'DELETE', path: '/api/webhooks/:id', description: 'Delete webhook' },
        ]
    },
]

const methodColors = {
    GET: '#22c55e',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    DELETE: '#ef4444',
    WS: '#8b5cf6',
}

const EndpointCard = ({ endpoint }) => {
    const [expanded, setExpanded] = useState(false)
    
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
    }

    return (
        <Box sx={{ 
            p: 2, 
            borderRadius: '8px', 
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            '&:hover': { borderColor: 'rgba(249, 115, 22, 0.3)' }
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
                <Chip 
                    label={endpoint.method} 
                    size="small" 
                    sx={{ 
                        bgcolor: `${methodColors[endpoint.method]}20`,
                        color: methodColors[endpoint.method],
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        minWidth: 60
                    }} 
                />
                <Typography sx={{ color: '#fafafa', fontFamily: 'monospace', fontSize: '0.9rem', flex: 1 }}>
                    {endpoint.path}
                </Typography>
                <Tooltip title="Copy path">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); copyToClipboard(endpoint.path) }}>
                        <ContentCopyIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
                    </IconButton>
                </Tooltip>
                {(endpoint.body || endpoint.response || endpoint.query || endpoint.note) && (
                    expanded ? <ExpandLessIcon sx={{ color: 'rgba(255,255,255,0.4)' }} /> : <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />
                )}
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', mt: 1 }}>
                {endpoint.description}
            </Typography>
            <Collapse in={expanded}>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {endpoint.query && (
                        <Box>
                            <Typography variant="caption" sx={{ color: '#f97316', fontWeight: 600 }}>Query Parameters</Typography>
                            <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 1.5, borderRadius: 1, mt: 0.5 }}>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                                    {endpoint.query}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                    {endpoint.body && (
                        <Box>
                            <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>Request Body</Typography>
                            <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 1.5, borderRadius: 1, mt: 0.5 }}>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                                    {endpoint.body}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                    {endpoint.response && (
                        <Box>
                            <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600 }}>Response</Typography>
                            <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 1.5, borderRadius: 1, mt: 0.5 }}>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                                    {endpoint.response}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                    {endpoint.note && (
                        <Box>
                            <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 600 }}>Note</Typography>
                            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                                {endpoint.note}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Box>
    )
}

const ApiDocs = () => {
    const [search, setSearch] = useState('')
    const [expandedCategories, setExpandedCategories] = useState(
        API_ENDPOINTS.reduce((acc, cat) => ({ ...acc, [cat.category]: true }), {})
    )

    const toggleCategory = (category) => {
        setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))
    }

    const filteredEndpoints = API_ENDPOINTS.map(cat => ({
        ...cat,
        endpoints: cat.endpoints.filter(ep => 
            !search || 
            ep.path.toLowerCase().includes(search.toLowerCase()) ||
            ep.description.toLowerCase().includes(search.toLowerCase()) ||
            ep.method.toLowerCase().includes(search.toLowerCase())
        )
    })).filter(cat => cat.endpoints.length > 0)

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                <Box sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <ApiIcon sx={{ color: '#3b82f6', fontSize: 28 }} />
                </Box>
                <Box>
                    <Typography variant="h4" sx={{ color: '#fafafa', fontWeight: 700 }}>
                        API Documentation
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        REST API reference for Porter Script Runner
                    </Typography>
                </Box>
            </Box>

            {/* Search */}
            <TextField
                fullWidth
                placeholder="Search endpoints..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ mb: 3 }}
                InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.3)' }} /></InputAdornment>
                }}
            />

            {/* Base URL */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                <Typography variant="caption" sx={{ color: '#f97316', fontWeight: 600 }}>Base URL</Typography>
                <Typography sx={{ fontFamily: 'monospace', color: '#fafafa', mt: 0.5 }}>
                    {window.location.origin}
                </Typography>
            </Paper>

            {/* Authentication Info */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 600 }}>Authentication</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', mt: 0.5 }}>
                    Most endpoints require authentication. Include the session cookie or use the <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>Authorization: Bearer &lt;token&gt;</code> header.
                </Typography>
            </Paper>

            {/* Endpoints by Category */}
            {filteredEndpoints.map(cat => (
                <Paper key={cat.category} sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <Box 
                        sx={{ 
                            p: 2, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            bgcolor: 'rgba(255,255,255,0.02)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' }
                        }}
                        onClick={() => toggleCategory(cat.category)}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '1.1rem' }}>
                                {cat.category}
                            </Typography>
                            <Chip label={cat.endpoints.length} size="small" sx={{ bgcolor: 'rgba(249, 115, 22, 0.2)', color: '#f97316' }} />
                        </Box>
                        {expandedCategories[cat.category] ? <ExpandLessIcon sx={{ color: 'rgba(255,255,255,0.5)' }} /> : <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />}
                    </Box>
                    <Collapse in={expandedCategories[cat.category]}>
                        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {cat.endpoints.map((ep, i) => (
                                <EndpointCard key={i} endpoint={ep} />
                            ))}
                        </Box>
                    </Collapse>
                </Paper>
            ))}

            {filteredEndpoints.length === 0 && (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <ApiIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>No endpoints found matching "{search}"</Typography>
                </Paper>
            )}
        </Box>
    )
}

export default ApiDocs
