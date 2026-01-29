import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Fade from '@mui/material/Fade'
import Collapse from '@mui/material/Collapse'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import CodeIcon from '@mui/icons-material/Code'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RefreshIcon from '@mui/icons-material/Refresh'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import TerminalIcon from '@mui/icons-material/Terminal'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import AddIcon from '@mui/icons-material/Add'
import ComputerIcon from '@mui/icons-material/Computer'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'
import { colors, gradients, buttonStyles, inputStyles, skeletonStyles, scrollableStyles } from './theme'

// Script Templates
const SCRIPT_TEMPLATES = [
    {
        name: 'System Update',
        description: 'Update and upgrade system packages',
        category: 'System',
        icon: '🔄',
        content: `#!/bin/bash
# System Update Script
# Updates all system packages

set -e

echo "Updating package lists..."
sudo apt update

echo "Upgrading packages..."
sudo apt upgrade -y

echo "Cleaning up..."
sudo apt autoremove -y
sudo apt autoclean

echo "System update complete!"
`
    },
    {
        name: 'Service Restart',
        description: 'Restart a systemd service with status check',
        category: 'Services',
        icon: '🔁',
        content: `#!/bin/bash
# Service Restart Script
# Usage: Provide SERVICE_NAME as parameter

SERVICE_NAME="\${1:-nginx}"

echo "Restarting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

echo "Checking status..."
sudo systemctl status "$SERVICE_NAME" --no-pager

echo "Done!"
`
    },
    {
        name: 'Disk Cleanup',
        description: 'Clean up disk space by removing old files and caches',
        category: 'Maintenance',
        icon: '🧹',
        content: `#!/bin/bash
# Disk Cleanup Script

set -e

echo "Current disk usage:"
df -h /

echo ""
echo "Cleaning apt cache..."
sudo apt clean

echo "Removing old kernels..."
sudo apt autoremove -y

echo "Cleaning journal logs older than 7 days..."
sudo journalctl --vacuum-time=7d

echo "Cleaning tmp files older than 7 days..."
sudo find /tmp -type f -atime +7 -delete 2>/dev/null || true

echo ""
echo "Disk usage after cleanup:"
df -h /
`
    },
    {
        name: 'Docker Cleanup',
        description: 'Remove unused Docker resources',
        category: 'Docker',
        icon: '🐳',
        content: `#!/bin/bash
# Docker Cleanup Script

echo "Docker disk usage before cleanup:"
docker system df

echo ""
echo "Removing stopped containers..."
docker container prune -f

echo "Removing unused images..."
docker image prune -a -f

echo "Removing unused volumes..."
docker volume prune -f

echo "Removing unused networks..."
docker network prune -f

echo ""
echo "Docker disk usage after cleanup:"
docker system df
`
    },
    {
        name: 'Backup Directory',
        description: 'Create a timestamped backup of a directory',
        category: 'Backup',
        icon: '💾',
        content: `#!/bin/bash
# Backup Directory Script
# Usage: Set SOURCE_DIR and BACKUP_DIR

SOURCE_DIR="/var/www/html"
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_\${TIMESTAMP}.tar.gz"

echo "Creating backup of $SOURCE_DIR..."
sudo mkdir -p "$BACKUP_DIR"
sudo tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C "$(dirname $SOURCE_DIR)" "$(basename $SOURCE_DIR)"

echo "Backup created: $BACKUP_DIR/$BACKUP_NAME"
ls -lh "$BACKUP_DIR/$BACKUP_NAME"

echo "Removing backups older than 30 days..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete

echo "Done!"
`
    },
    {
        name: 'Health Check',
        description: 'Check system health metrics',
        category: 'Monitoring',
        icon: '🏥',
        content: `#!/bin/bash
# System Health Check Script

echo "=== System Health Check ==="
echo ""

echo "--- Uptime ---"
uptime

echo ""
echo "--- Memory Usage ---"
free -h

echo ""
echo "--- Disk Usage ---"
df -h

echo ""
echo "--- CPU Load ---"
cat /proc/loadavg

echo ""
echo "--- Top Processes (by CPU) ---"
ps aux --sort=-%cpu | head -6

echo ""
echo "--- Top Processes (by Memory) ---"
ps aux --sort=-%mem | head -6

echo ""
echo "--- Failed Services ---"
systemctl --failed --no-pager || echo "No failed services"

echo ""
echo "=== Health Check Complete ==="
`
    },
    {
        name: 'Log Rotation',
        description: 'Compress and rotate application logs',
        category: 'Maintenance',
        icon: '📋',
        content: `#!/bin/bash
# Log Rotation Script

LOG_DIR="/var/log/myapp"
DAYS_TO_KEEP=30

echo "Rotating logs in $LOG_DIR..."

# Compress logs older than 1 day
find "$LOG_DIR" -name "*.log" -mtime +1 -exec gzip {} \\;

# Remove compressed logs older than retention period
find "$LOG_DIR" -name "*.log.gz" -mtime +$DAYS_TO_KEEP -delete

echo "Log rotation complete!"
ls -lh "$LOG_DIR"
`
    },
    {
        name: 'SSL Certificate Check',
        description: 'Check SSL certificate expiration dates',
        category: 'Security',
        icon: '🔒',
        content: `#!/bin/bash
# SSL Certificate Check Script

DOMAIN="\${1:-localhost}"
PORT="\${2:-443}"

echo "Checking SSL certificate for $DOMAIN:$PORT..."
echo ""

echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:$PORT" 2>/dev/null | openssl x509 -noout -dates -subject -issuer

echo ""
echo "Days until expiration:"
EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:$PORT" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
echo "$DAYS_LEFT days"

if [ $DAYS_LEFT -lt 30 ]; then
    echo "⚠️  WARNING: Certificate expires in less than 30 days!"
fi
`
    }
]
import ScriptEditor from './ScriptEditor'
import { useAuth } from './AuthContext'

const categoryIcons = {
    'deploy': '🚀',
    'ubuntu-setup': '🐧',
    'mono-install': '📦',
    'custom': '✨',
    'default': '📁'
}

// Memoized loading skeleton component
const ScriptSkeleton = memo(() => (
    <Box sx={{ mb: 3 }}>
        <Box sx={{
            background: colors.background.glass,
            borderRadius: '16px',
            border: `1px solid ${colors.border.light}`,
            overflow: 'hidden',
        }}>
            <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Skeleton variant="rounded" width={40} height={40} sx={skeletonStyles.base} />
                <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="30%" sx={skeletonStyles.base} />
                    <Skeleton variant="text" width="15%" sx={skeletonStyles.light} />
                </Box>
            </Box>
            <Box sx={{ p: 2 }}>
                {[1, 2].map(i => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 2 }}>
                        <Skeleton variant="rounded" width={36} height={36} sx={skeletonStyles.base} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="40%" sx={skeletonStyles.base} />
                            <Skeleton variant="text" width="60%" sx={skeletonStyles.light} />
                        </Box>
                        <Skeleton variant="rounded" width={70} height={32} sx={skeletonStyles.base} />
                    </Box>
                ))}
            </Box>
        </Box>
    </Box>
))

// Memoized script item component with context menu
const ScriptItem = memo(({ script, onRun, onEdit, onDelete, onDuplicate, onDownload, canRun = true, canEdit = true }) => {
    const [menuAnchor, setMenuAnchor] = useState(null)

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                p: 2,
                mx: 1,
                my: 0.5,
                borderRadius: '14px',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%) scaleY(0)',
                    width: '3px',
                    height: '60%',
                    background: script.is_custom 
                        ? 'linear-gradient(180deg, #ff00ff 0%, #cc00cc 100%)'
                        : 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                    borderRadius: '0 4px 4px 0',
                    transition: 'transform 0.25s ease',
                },
                '&:hover': {
                    background: script.is_custom 
                        ? 'linear-gradient(135deg, rgba(255, 0, 255, 0.08) 0%, rgba(255, 0, 255, 0.02) 100%)'
                        : 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.02) 100%)',
                    transform: 'translateX(4px)',
                    '& .script-actions': { opacity: 1 },
                    '&::before': { transform: 'translateY(-50%) scaleY(1)' },
                }
            }}
        >
            {/* Icon */}
            <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: script.is_custom 
                    ? 'linear-gradient(135deg, rgba(255, 0, 255, 0.15) 0%, rgba(255, 0, 255, 0.05) 100%)'
                    : 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
                border: script.is_custom 
                    ? '1px solid rgba(255, 0, 255, 0.2)'
                    : '1px solid rgba(34, 197, 94, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2,
                flexShrink: 0,
            }}>
                {script.is_custom 
                    ? <AutoAwesomeIcon sx={{ color: '#ff00ff', fontSize: 20 }} />
                    : <CodeIcon sx={{ color: colors.secondary, fontSize: 20 }} />
                }
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, minWidth: 0, mr: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                    <Typography sx={{ 
                        fontWeight: 600, 
                        color: colors.text.primary,
                        fontSize: '0.95rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {script.name}
                    </Typography>
                    {script.is_custom && (
                        <Chip
                            label="Custom"
                            size="small"
                            sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)',
                                color: '#fff',
                                '& .MuiChip-label': { px: 1 }
                            }}
                        />
                    )}
                </Box>
                <Typography sx={{ 
                    fontSize: '0.8rem', 
                    color: colors.text.disabled,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {script.description || 'No description available'}
                </Typography>
            </Box>

            {/* Flags Badge */}
            {script.flags?.length > 0 && (
                <Tooltip title={`${script.flags.length} configurable options`} arrow>
                    <Chip
                        icon={<SettingsIcon sx={{ fontSize: '14px !important' }} />}
                        label={script.flags.length}
                        size="small"
                        sx={{
                            mr: 1,
                            height: 26,
                            background: 'rgba(255, 170, 0, 0.1)',
                            border: '1px solid rgba(255, 170, 0, 0.2)',
                            color: colors.warning,
                            fontWeight: 600,
                            '& .MuiChip-icon': { color: colors.warning }
                        }}
                    />
                </Tooltip>
            )}

            {/* Actions */}
            <Box className="script-actions" sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                opacity: { xs: 1, md: 0 },
                transition: 'opacity 0.2s ease',
            }}>
                {script.is_custom && (
                    <Tooltip title="More actions" arrow>
                        <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget) }}
                            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}
                        >
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                {canRun && (
                    <Button
                        size="small"
                        startIcon={<PlayArrowIcon />}
                        onClick={(e) => { e.stopPropagation(); onRun(script.path) }}
                        sx={{
                            background: 'linear-gradient(135deg, #f97316 0%, #00a8cc 100%)',
                            color: '#0a0e17',
                            fontWeight: 700,
                            px: 2,
                            minWidth: 80,
                            '&:hover': {
                                background: 'linear-gradient(135deg, #5ce1ff 0%, #f97316 100%)',
                                boxShadow: '0 0 20px rgba(249, 115, 22, 0.4)',
                                transform: 'translateY(-1px)',
                            }
                        }}
                    >
                        Run
                    </Button>
                )}
            </Box>

            {/* Context Menu for Custom Scripts */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                onClick={() => setMenuAnchor(null)}
                PaperProps={{
                    sx: {
                        background: 'rgba(17, 24, 39, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        minWidth: 180,
                    }
                }}
            >
                <MenuItem onClick={() => onEdit(script)}>
                    <ListItemIcon><EditIcon sx={{ color: '#f97316' }} /></ListItemIcon>
                    <ListItemText>Edit Script</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => onDuplicate?.(script)}>
                    <ListItemIcon><ContentCopyIcon sx={{ color: '#22c55e' }} /></ListItemIcon>
                    <ListItemText>Duplicate</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => onDownload?.(script)}>
                    <ListItemIcon><DownloadIcon sx={{ color: '#ffaa00' }} /></ListItemIcon>
                    <ListItemText>Download</ListItemText>
                </MenuItem>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <MenuItem onClick={() => onDelete(script)} sx={{ color: colors.error }}>
                    <ListItemIcon><DeleteIcon sx={{ color: colors.error }} /></ListItemIcon>
                    <ListItemText>Delete</ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    )
})

// Memoized category component
const CategorySection = memo(({ category, items, expanded, onToggle, onRunScript, onEditScript, onDeleteScript, onDuplicateScript, onDownloadScript, index, canRun, canEdit }) => (
    <Fade in timeout={300 + index * 100}>
        <Box sx={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
            borderRadius: '20px',
            border: `1px solid ${colors.border.light}`,
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
                borderColor: 'rgba(249, 115, 22, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }
        }}>
            <Box
                onClick={onToggle}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={`${category} category with ${items.length} scripts`}
                onKeyDown={(e) => e.key === 'Enter' && onToggle()}
                sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    p: 2.5,
                    cursor: 'pointer',
                    background: expanded 
                        ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%)'
                        : 'transparent',
                    borderBottom: expanded ? `1px solid ${colors.border.light}` : 'none',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    '&::before': expanded ? {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '4px',
                        background: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
                        borderRadius: '0 4px 4px 0',
                    } : {},
                    '&:hover': {
                        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.04) 100%)',
                    },
                    '&:focus-visible': {
                        outline: `2px solid ${colors.primary}`,
                        outlineOffset: -2,
                    }
                }}
            >
                <Box sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: expanded 
                        ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%)'
                        : 'rgba(249, 115, 22, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 2,
                    fontSize: '1.3rem',
                    transition: 'all 0.3s ease',
                    border: expanded ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid transparent',
                    boxShadow: expanded ? '0 4px 12px rgba(249, 115, 22, 0.2)' : 'none',
                }}>
                    {categoryIcons[category] || categoryIcons.default}
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography sx={{ 
                        fontWeight: 600, 
                        color: colors.text.primary,
                        fontSize: '1rem',
                        textTransform: 'capitalize',
                    }}>
                        {category.replace(/-/g, ' ')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: colors.text.disabled }}>
                        {items.length} script{items.length !== 1 ? 's' : ''}
                    </Typography>
                </Box>
                <Box sx={{
                    color: colors.text.disabled,
                    transition: 'transform 0.2s ease',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                    <ExpandMoreIcon />
                </Box>
            </Box>

            <Collapse in={expanded}>
                <Box sx={{ p: 1 }}>
                    {items.map((s) => (
                        <ScriptItem 
                            key={s.path} 
                            script={s} 
                            onRun={onRunScript} 
                            onEdit={onEditScript}
                            onDelete={onDeleteScript}
                            onDuplicate={onDuplicateScript}
                            onDownload={onDownloadScript}
                            canRun={canRun}
                            canEdit={canEdit}
                        />
                    ))}
                </Box>
            </Collapse>
        </Box>
    </Fade>
))

const Scripts = () => {
    const navigate = useNavigate()
    const { canExecute, canWrite } = useAuth()
    const canRunScripts = canExecute()
    const canEditScripts = canWrite('scripts')
    const [searchParams, setSearchParams] = useSearchParams()
    const [scripts, setScripts] = useState([])
    const [expanded, setExpanded] = useState({})
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    
    // Pre-selected machines from URL (when coming from Machines page)
    // Memoize to prevent infinite re-renders in useEffect dependencies
    const machinesParam = searchParams.get('machines')
    const preSelectedMachines = useMemo(() => 
        machinesParam?.split(',').filter(Boolean) || [], 
        [machinesParam]
    )
    const [machineNames, setMachineNames] = useState({})
    const [selectedMachineTags, setSelectedMachineTags] = useState([])
    
    // Editor dialog state
    const [editorOpen, setEditorOpen] = useState(false)
    const [editorMode, setEditorMode] = useState('add')
    const [editingScript, setEditingScript] = useState(null)
    
    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, script: null })
    
    // Snackbar notifications
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
    
    // Templates dialog
    const [templatesOpen, setTemplatesOpen] = useState(false)
    
    // Load machine names and tags for display and filtering - only once on mount
    const hasFetchedMachines = useRef(false)
    useEffect(() => {
        if (hasFetchedMachines.current) return
        hasFetchedMachines.current = true
        
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => {
                const names = {}
                const tags = new Set()
                data?.forEach(m => {
                    names[m.id] = m.name
                    // Collect tags from selected machines
                    if (preSelectedMachines.includes(m.id) && m.tags) {
                        m.tags.forEach(t => tags.add(t))
                    }
                })
                setMachineNames(names)
                setSelectedMachineTags([...tags])
            })
            .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadScripts = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/scripts')
            const data = await res.json()
            setScripts(data || [])
            // Auto-expand all categories
            const categories = [...new Set((data || []).filter(s => s.is_top_level).map(s => s.category))]
            setExpanded(categories.reduce((acc, c) => ({ ...acc, [c]: true }), {}))
        } catch (err) {
            console.error('Failed to load scripts:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadScripts()
    }, [loadScripts])

    // Keyboard shortcut for search focus
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                document.getElementById('script-search')?.focus()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Memoized computed values - filter by machine tags if machines are selected
    const topLevelScripts = useMemo(() => {
        let filtered = scripts.filter(s => s.is_top_level)
        
        // When NO machines are selected, show all scripts EXCEPT those requiring specific tags
        if (preSelectedMachines.length === 0) {
            filtered = filtered.filter(s => !s.required_tags || s.required_tags.length === 0)
        }
        // When machines ARE selected, show scripts that either:
        // 1. Have no required_tags (general scripts)
        // 2. Have required_tags that match the selected machine's tags
        else if (selectedMachineTags.length > 0) {
            filtered = filtered.filter(s => {
                if (!s.required_tags || s.required_tags.length === 0) return true
                return s.required_tags.some(tag => selectedMachineTags.includes(tag))
            })
        }
        // Machines selected but have no tags - only show scripts without required_tags
        else {
            filtered = filtered.filter(s => !s.required_tags || s.required_tags.length === 0)
        }
        
        return filtered
    }, [scripts, preSelectedMachines, selectedMachineTags])
    
    const filteredScripts = useMemo(() => {
        if (!search) return topLevelScripts
        const searchLower = search.toLowerCase()
        return topLevelScripts.filter(s => 
            s.name.toLowerCase().includes(searchLower) ||
            s.description?.toLowerCase().includes(searchLower) ||
            s.category?.toLowerCase().includes(searchLower)
        )
    }, [topLevelScripts, search])

    const grouped = useMemo(() => 
        filteredScripts.reduce((acc, s) => {
            if (!acc[s.category]) acc[s.category] = []
            acc[s.category].push(s)
            return acc
        }, {}),
        [filteredScripts]
    )

    // Memoized callbacks
    const toggleCategory = useCallback((category) => {
        setExpanded(prev => ({ ...prev, [category]: !prev[category] }))
    }, [])

    const handleRunScript = useCallback((path) => {
        // Pass pre-selected machines to the wizard if any
        const machineParam = preSelectedMachines.length > 0 
            ? `?machines=${preSelectedMachines.join(',')}`
            : ''
        navigate(`/script-wizard/${encodeURIComponent(path)}${machineParam}`)
    }, [navigate, preSelectedMachines])

    const handleSearchChange = useCallback((e) => {
        setSearch(e.target.value)
    }, [])

    // Show notification
    const showNotification = useCallback((message, severity = 'success') => {
        setSnackbar({ open: true, message, severity })
    }, [])

    // Open editor for new script
    const openAddEditor = useCallback(() => {
        setEditorMode('add')
        setEditingScript(null)
        setEditorOpen(true)
    }, [])

    // Use a template to create new script
    const useTemplate = useCallback((template) => {
        setEditorMode('add')
        setEditingScript({
            name: template.name,
            description: template.description,
            content: template.content,
            category: 'custom'
        })
        setEditorOpen(true)
        setTemplatesOpen(false)
    }, [])

    // Open editor for editing existing script
    const openEditEditor = useCallback(async (script) => {
        if (!script.custom_id) return
        try {
            const res = await fetch(`/api/custom-scripts/${script.custom_id}`)
            if (!res.ok) throw new Error('Failed to load script')
            const data = await res.json()
            setEditorMode('edit')
            setEditingScript(data)
            setEditorOpen(true)
        } catch (err) {
            showNotification('Failed to load script', 'error')
        }
    }, [showNotification])

    // Save script (create or update)
    const handleSaveScript = useCallback(async (formData) => {
        const isEdit = editorMode === 'edit'
        const url = isEdit 
            ? `/api/custom-scripts/${editingScript.id}`
            : '/api/custom-scripts'
        
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })

        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Failed to save' }))
            throw new Error(error.error || 'Failed to save script')
        }

        showNotification(isEdit ? 'Script updated successfully!' : 'Script created successfully!')
        loadScripts()
    }, [editorMode, editingScript, loadScripts, showNotification])

    // Delete script
    const handleDeleteScript = useCallback((script) => {
        setDeleteConfirm({ open: true, script })
    }, [])

    const confirmDelete = useCallback(async () => {
        if (!deleteConfirm.script?.custom_id) return
        
        try {
            const res = await fetch(`/api/custom-scripts/${deleteConfirm.script.custom_id}`, {
                method: 'DELETE'
            })
            if (!res.ok) throw new Error('Failed to delete')
            setDeleteConfirm({ open: false, script: null })
            showNotification('Script deleted successfully!')
            loadScripts()
        } catch (err) {
            showNotification('Failed to delete script', 'error')
        }
    }, [deleteConfirm, loadScripts, showNotification])

    // Duplicate script
    const handleDuplicateScript = useCallback(async (script) => {
        if (!script.custom_id) return
        try {
            const res = await fetch(`/api/custom-scripts/${script.custom_id}/duplicate`, {
                method: 'POST'
            })
            if (!res.ok) throw new Error('Failed to duplicate')
            showNotification('Script duplicated successfully!')
            loadScripts()
        } catch (err) {
            showNotification('Failed to duplicate script', 'error')
        }
    }, [loadScripts, showNotification])

    // Download script
    const handleDownloadScript = useCallback((script) => {
        if (!script.custom_id) return
        window.open(`/api/custom-scripts/${script.custom_id}/download`, '_blank')
    }, [])

    return (
        <Box role="main" aria-label="Scripts page" sx={scrollableStyles.pageContainer}>
            {/* Modern Header */}
            <Box sx={{ 
                background: gradients.headerAlt,
                borderRadius: '24px',
                border: `1px solid ${colors.border.light}`,
                p: 3,
                mb: 4,
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3 }}>
                    <Box>
                        <Typography component="h1" sx={{ 
                            fontSize: '2.2rem', 
                            fontWeight: 800,
                            background: gradients.text,
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em',
                            mb: 0.5,
                        }}>
                            Scripts
                        </Typography>
                        <Typography sx={{ color: colors.text.muted, fontSize: '0.95rem' }}>
                            Deploy and configure your machines with automated scripts
                        </Typography>
                        
                        {/* Pre-selected machines banner */}
                        {preSelectedMachines.length > 0 && (
                            <Box sx={{ 
                                mt: 2, 
                                p: 1.5, 
                                borderRadius: '12px', 
                                background: 'rgba(255, 121, 198, 0.1)', 
                                border: '1px solid rgba(255, 121, 198, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                <RocketLaunchIcon sx={{ color: '#ff79c6', fontSize: 18 }} />
                                <Typography sx={{ color: '#ff79c6', fontSize: '0.85rem' }}>
                                    Ready to run on: <strong>{preSelectedMachines.map(id => machineNames[id] || id).join(', ')}</strong>
                                </Typography>
                                <IconButton size="small" onClick={() => setSearchParams({})} sx={{ ml: 'auto', color: '#ff79c6' }}>
                                    <CloseIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Box>
                        )}
                        
                        {/* Quick Stats */}
                        <Box sx={{ display: 'flex', gap: 3, mt: 2 }} role="status" aria-live="polite">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CodeIcon sx={{ fontSize: 16, color: colors.secondary }} />
                                <Typography sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                    <strong style={{ color: colors.secondary }}>{topLevelScripts.length}</strong> Scripts
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TerminalIcon sx={{ fontSize: 16, color: colors.primary }} />
                                <Typography sx={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                                    <strong style={{ color: colors.primary }}>{Object.keys(grouped).length}</strong> Categories
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                            id="script-search"
                            placeholder="Search... (Ctrl+K)"
                            size="small"
                            value={search}
                            onChange={handleSearchChange}
                            aria-label="Search scripts"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: colors.text.disabled, fontSize: 20 }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={inputStyles.search}
                        />
                        <Tooltip title="Script Templates">
                            <Button
                                startIcon={<LibraryBooksIcon />}
                                onClick={() => setTemplatesOpen(true)}
                                sx={{
                                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                                    color: '#a78bfa',
                                    fontWeight: 600,
                                    px: 2,
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%)',
                                        borderColor: '#a78bfa',
                                    }
                                }}
                            >
                                Templates
                            </Button>
                        </Tooltip>
                        <Button
                            startIcon={<AddIcon />}
                            onClick={openAddEditor}
                            sx={{
                                background: 'linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)',
                                color: '#fff',
                                fontWeight: 600,
                                px: 2.5,
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #ff66ff 0%, #ff00ff 100%)',
                                    boxShadow: '0 0 20px rgba(255, 0, 255, 0.4)',
                                }
                            }}
                        >
                            Add Script
                        </Button>
                        <Tooltip title="Refresh scripts">
                            <IconButton 
                                onClick={loadScripts}
                                aria-label="Refresh scripts list"
                                sx={buttonStyles.icon}
                            >
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>

            {/* Pre-selected Machines Banner */}
            {preSelectedMachines.length > 0 && (
                <Box sx={{ 
                    mb: 3,
                    p: 2,
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '10px',
                            background: 'rgba(249, 115, 22, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <ComputerIcon sx={{ color: '#f97316', fontSize: 22 }} />
                        </Box>
                        <Box>
                            <Typography sx={{ color: '#f97316', fontWeight: 600, fontSize: '0.95rem' }}>
                                {preSelectedMachines.length} machine{preSelectedMachines.length > 1 ? 's' : ''} selected
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                                {preSelectedMachines.map(id => machineNames[id] || id).join(', ')}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            size="small"
                            onClick={() => setSearchParams({})}
                            sx={{ color: 'rgba(255,255,255,0.5)' }}
                        >
                            Clear Selection
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Loading Skeletons */}
            {loading ? (
                <Box aria-busy="true" aria-label="Loading scripts">
                    <ScriptSkeleton />
                    <ScriptSkeleton />
                </Box>
            ) : Object.keys(grouped).length === 0 ? (
                <Box sx={{ 
                    textAlign: 'center', 
                    py: 12,
                    background: colors.background.glass,
                    borderRadius: '20px',
                    border: `1px dashed ${colors.border.light}`,
                }} role="status">
                    <TerminalIcon sx={{ fontSize: 80, color: 'rgba(249, 115, 22, 0.3)', mb: 3 }} />
                    <Typography sx={{ color: colors.text.secondary, fontSize: '1.2rem', mb: 1 }}>
                        {search ? 'No scripts match your search' : 'No scripts found'}
                    </Typography>
                    <Typography sx={{ color: colors.text.disabled }}>
                        {search ? 'Try a different search term' : 'Scripts will appear here when available'}
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} role="list" aria-label="Script categories">
                    {Object.entries(grouped).map(([category, items], catIndex) => (
                        <CategorySection
                            key={category}
                            category={category}
                            items={items}
                            expanded={expanded[category]}
                            onToggle={() => toggleCategory(category)}
                            onRunScript={handleRunScript}
                            onEditScript={openEditEditor}
                            onDeleteScript={handleDeleteScript}
                            onDuplicateScript={handleDuplicateScript}
                            onDownloadScript={handleDownloadScript}
                            index={catIndex}
                            canRun={canRunScripts}
                            canEdit={canEditScripts}
                        />
                    ))}
                </Box>
            )}

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
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${colors.border.light}`,
            }} aria-label="Keyboard shortcuts">
                <KeyboardIcon sx={{ fontSize: 16, color: colors.text.disabled }} />
                <Typography sx={{ fontSize: '0.7rem', color: colors.text.disabled }}>
                    Ctrl+K: Search
                </Typography>
            </Box>

            {/* Script Editor Dialog */}
            <ScriptEditor
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                script={editingScript}
                onSave={handleSaveScript}
                mode={editorMode}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirm.open}
                onClose={() => setDeleteConfirm({ open: false, script: null })}
                PaperProps={{
                    sx: {
                        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
                        border: '1px solid rgba(255, 51, 102, 0.3)',
                        borderRadius: '16px',
                        minWidth: 400,
                    }
                }}
            >
                <DialogTitle sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    pb: 2,
                }}>
                    <Box sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        background: 'rgba(255, 51, 102, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <DeleteIcon sx={{ color: colors.error, fontSize: 24 }} />
                    </Box>
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            Delete Script
                        </Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                            This action cannot be undone
                        </Typography>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ py: 3 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Are you sure you want to delete{' '}
                        <Box component="span" sx={{ 
                            color: '#ff00ff', 
                            fontWeight: 600,
                            background: 'rgba(255, 0, 255, 0.1)',
                            px: 1,
                            py: 0.3,
                            borderRadius: '4px',
                        }}>
                            {deleteConfirm.script?.name}
                        </Box>
                        ?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button 
                        onClick={() => setDeleteConfirm({ open: false, script: null })}
                        sx={{ 
                            color: 'rgba(255,255,255,0.6)',
                            '&:hover': { background: 'rgba(255,255,255,0.05)' }
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDelete}
                        startIcon={<DeleteIcon />}
                        sx={{
                            background: 'linear-gradient(135deg, #ff3366 0%, #cc2952 100%)',
                            color: '#fff',
                            fontWeight: 600,
                            px: 3,
                            '&:hover': {
                                background: 'linear-gradient(135deg, #ff6688 0%, #ff3366 100%)',
                                boxShadow: '0 0 20px rgba(255, 51, 102, 0.4)',
                            }
                        }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar Notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert 
                    severity={snackbar.severity}
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    sx={{ 
                        borderRadius: '12px',
                        fontWeight: 500,
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Script Templates Dialog */}
            <Dialog 
                open={templatesOpen} 
                onClose={() => setTemplatesOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(15, 15, 30, 0.98) 100%)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '16px',
                    }
                }}
            >
                <DialogTitle sx={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                }}>
                    <LibraryBooksIcon sx={{ color: '#a78bfa' }} />
                    <Typography sx={{ color: '#fafafa', fontWeight: 600 }}>Script Templates</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', ml: 1 }}>
                        Pre-built scripts for common tasks
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ py: 3 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                        {SCRIPT_TEMPLATES.map((template, idx) => (
                            <Box
                                key={idx}
                                onClick={() => useTemplate(template)}
                                sx={{
                                    p: 2,
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        borderColor: 'rgba(139, 92, 246, 0.4)',
                                        transform: 'translateY(-2px)',
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                    <Typography sx={{ fontSize: '1.5rem' }}>{template.icon}</Typography>
                                    <Box>
                                        <Typography sx={{ color: '#fafafa', fontWeight: 600, fontSize: '0.95rem' }}>
                                            {template.name}
                                        </Typography>
                                        <Chip 
                                            label={template.category} 
                                            size="small" 
                                            sx={{ 
                                                height: 18, 
                                                fontSize: '0.65rem',
                                                bgcolor: 'rgba(139, 92, 246, 0.2)',
                                                color: '#a78bfa',
                                            }} 
                                        />
                                    </Box>
                                </Box>
                                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                                    {template.description}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button 
                        onClick={() => setTemplatesOpen(false)}
                        sx={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Scripts
