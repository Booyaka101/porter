import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from './AuthContext'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import LinearProgress from '@mui/material/LinearProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import HomeIcon from '@mui/icons-material/Home'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove'
import SaveIcon from '@mui/icons-material/Save'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import CodeIcon from '@mui/icons-material/Code'
import ImageIcon from '@mui/icons-material/Image'
import TerminalIcon from '@mui/icons-material/Terminal'
import ArchiveIcon from '@mui/icons-material/Archive'
import LinkIcon from '@mui/icons-material/Link'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import InputAdornment from '@mui/material/InputAdornment'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Editor, { DiffEditor } from '@monaco-editor/react'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

const getLanguageFromFilename = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase()
    const langMap = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
        c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
        html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
        json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml',
        md: 'markdown', sql: 'sql', sh: 'shell', bash: 'shell', zsh: 'shell',
        dockerfile: 'dockerfile', php: 'php', swift: 'swift', kt: 'kotlin',
        conf: 'ini', ini: 'ini', env: 'shell', txt: 'plaintext'
    }
    return langMap[ext] || 'plaintext'
}

const MachineFiles = ({ machine, machineId }) => {
    const { canModifyFiles, canAccessFiles, isAdmin, isViewer } = useAuth()
    const [currentPath, setCurrentPath] = useState('/home')
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState([])
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')
    const [viewDialog, setViewDialog] = useState({ open: false, file: null, content: '', loading: false, isImage: false, imageUrl: '' })
    const [editDialog, setEditDialog] = useState({ open: false, file: null, content: '', originalContent: '', saving: false, showDiff: false })
    const [newFolderDialog, setNewFolderDialog] = useState({ open: false, name: '' })
    const [uploadDialog, setUploadDialog] = useState({ open: false, uploading: false, progress: 0 })
    const [deleteDialog, setDeleteDialog] = useState({ open: false, files: [] })
    const [renameDialog, setRenameDialog] = useState({ open: false, file: null, newName: '' })
    const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, file: null })
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef(null)
    const abortControllerRef = useRef(null)
    const isMountedRef = useRef(true)
    const dragCounterRef = useRef(0)

    const loadFiles = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        
        setLoading(true)
        setSelectedFiles([])
        try {
            const res = await fetch(`/api/machines/${machineId}/files?path=${encodeURIComponent(currentPath)}`, {
                signal: abortControllerRef.current.signal
            })
            const data = await res.json()
            if (isMountedRef.current) {
                setFiles(data.files || [])
                setLoading(false)
            }
        } catch (err) {
            if (err.name !== 'AbortError' && isMountedRef.current) {
                console.error('Failed to load files:', err)
                setLoading(false)
            }
        }
    }, [machineId, currentPath])

    useEffect(() => {
        isMountedRef.current = true
        loadFiles()
        return () => {
            isMountedRef.current = false
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [loadFiles])

    const navigateTo = (path) => setCurrentPath(path)
    const navigateUp = () => {
        const parts = currentPath.split('/').filter(Boolean)
        parts.pop()
        setCurrentPath('/' + parts.join('/') || '/')
    }

    const handleFileClick = (file) => { if (file.isDir) navigateTo(file.path) }
    const handleFileDoubleClick = (file) => { if (!file.isDir) handleViewFile(file) }

    const isImageFile = (filename) => {
        const ext = filename?.split('.').pop()?.toLowerCase()
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)
    }

    const handleViewFile = async (file) => {
        if (isImageFile(file.name)) {
            // For images, use download endpoint to get the file
            setViewDialog({ open: true, file, content: '', loading: true, isImage: true, imageUrl: '' })
            try {
                const res = await fetch(`/api/machines/${machineId}/download?path=${encodeURIComponent(file.path)}`)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                setViewDialog(prev => ({ ...prev, imageUrl: url, loading: false }))
            } catch (err) {
                setViewDialog(prev => ({ ...prev, content: 'Failed to load image', loading: false, isImage: false }))
            }
        } else {
            setViewDialog({ open: true, file, content: '', loading: true, isImage: false, imageUrl: '' })
            try {
                const res = await fetch(`/api/machines/${machineId}/file?path=${encodeURIComponent(file.path)}`)
                const data = await res.json()
                setViewDialog(prev => ({ ...prev, content: data.content || '', loading: false }))
            } catch (err) {
                setViewDialog(prev => ({ ...prev, content: 'Failed to load file', loading: false }))
            }
        }
    }

    const handleEditFile = async (file) => {
        setEditDialog({ open: true, file, content: '', originalContent: '', saving: false, showDiff: false })
        try {
            const res = await fetch(`/api/machines/${machineId}/file?path=${encodeURIComponent(file.path)}`)
            const data = await res.json()
            const content = data.content || ''
            setEditDialog(prev => ({ ...prev, content, originalContent: content }))
        } catch (err) {
            setEditDialog(prev => ({ ...prev, content: '', originalContent: '' }))
        }
    }

    const [saveMessage, setSaveMessage] = useState({ open: false, message: '', isSystemd: false })

    const handleSaveFile = async () => {
        setEditDialog(prev => ({ ...prev, saving: true }))
        try {
            const res = await fetch(`/api/machines/${machineId}/file`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: editDialog.file.path, content: editDialog.content })
            })
            const data = await res.json()
            setEditDialog({ open: false, file: null, content: '', saving: false })
            
            // Show systemd notification if applicable
            if (data.systemd) {
                setSaveMessage({ 
                    open: true, 
                    message: data.message || 'Systemd service updated', 
                    isSystemd: true,
                    serviceName: data.serviceName,
                    userService: data.userService
                })
                // Auto-hide after 5 seconds
                setTimeout(() => setSaveMessage({ open: false, message: '', isSystemd: false }), 5000)
            }
            
            loadFiles()
        } catch (err) {
            setEditDialog(prev => ({ ...prev, saving: false }))
        }
    }

    const handleCreateFolder = async () => {
        if (!newFolderDialog.name.trim()) return
        try {
            await fetch(`/api/machines/${machineId}/mkdir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: `${currentPath}/${newFolderDialog.name}` })
            })
            setNewFolderDialog({ open: false, name: '' })
            loadFiles()
        } catch (err) { console.error('Failed to create folder:', err) }
    }

    const handleUpload = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        uploadFile(file)
        if (event.target) event.target.value = ''
    }

    const uploadFile = async (file) => {
        setUploadDialog({ open: true, uploading: true, progress: 0, fileName: file.name })
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', currentPath)
        try {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) setUploadDialog(prev => ({ ...prev, progress: (e.loaded / e.total) * 100 }))
            }
            xhr.onload = () => { setUploadDialog({ open: false, uploading: false, progress: 0 }); loadFiles() }
            xhr.onerror = () => setUploadDialog({ open: false, uploading: false, progress: 0 })
            xhr.open('POST', `/api/machines/${machineId}/upload`)
            xhr.send(formData)
        } catch (err) { setUploadDialog({ open: false, uploading: false, progress: 0 }) }
    }

    const handleDragEnter = (e) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current++
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true)
        }
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current--
        if (dragCounterRef.current === 0) {
            setIsDragging(false)
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        dragCounterRef.current = 0
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0]
            uploadFile(file)
            e.dataTransfer.clearData()
        }
    }

    const handleDownload = async (file) => {
        try {
            const res = await fetch(`/api/machines/${machineId}/download?path=${encodeURIComponent(file.path)}`)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = file.name; a.click()
            URL.revokeObjectURL(url)
        } catch (err) { console.error('Download failed:', err) }
    }

    const handleDelete = async () => {
        try {
            for (const file of deleteDialog.files) {
                await fetch(`/api/machines/${machineId}/delete`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: file.path, recursive: file.isDir })
                })
            }
            setDeleteDialog({ open: false, files: [] })
            setSelectedFiles([])
            loadFiles()
        } catch (err) { console.error('Delete failed:', err) }
    }

    const handleRename = async () => {
        if (!renameDialog.newName.trim()) return
        try {
            await fetch(`/api/machines/${machineId}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath: renameDialog.file.path, newPath: currentPath + '/' + renameDialog.newName })
            })
            setRenameDialog({ open: false, file: null, newName: '' })
            loadFiles()
        } catch (err) { console.error('Rename failed:', err) }
    }

    const handleContextMenu = (event, file) => {
        event.preventDefault()
        setContextMenu({ open: true, x: event.clientX, y: event.clientY, file })
    }

    const getFileIcon = (file) => {
        if (file.isDir) return <FolderIcon sx={{ color: '#ffaa00' }} />
        if (file.isSymlink) return <LinkIcon sx={{ color: '#f97316' }} />
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (['txt', 'md', 'log'].includes(ext)) return <TextSnippetIcon sx={{ color: '#7dd3fc' }} />
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return <ImageIcon sx={{ color: '#ff00ff' }} />
        if (['js', 'ts', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h'].includes(ext)) return <CodeIcon sx={{ color: '#22c55e' }} />
        if (['sh', 'bash'].includes(ext)) return <TerminalIcon sx={{ color: '#ffaa00' }} />
        if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return <ArchiveIcon sx={{ color: '#ff6b6b' }} />
        return <InsertDriveFileIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
    }

    const formatSize = (bytes) => {
        if (!bytes) return '-'
        const units = ['B', 'KB', 'MB', 'GB']
        let i = 0
        while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++ }
        return `${bytes.toFixed(1)} ${units[i]}`
    }

    // Filter files based on search query
    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return files
        const query = searchQuery.toLowerCase()
        return files.filter(file => file.name.toLowerCase().includes(query))
    }, [files, searchQuery])

    const sortedFiles = [...filteredFiles].sort((a, b) => {
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        let cmp = sortBy === 'name' ? a.name.localeCompare(b.name) : sortBy === 'size' ? (a.size || 0) - (b.size || 0) : 0
        return sortOrder === 'asc' ? cmp : -cmp
    })

    // Quick navigation shortcuts
    const quickPaths = [
        { label: 'Home', path: '/home', icon: <HomeIcon sx={{ fontSize: 16 }} /> },
        { label: 'Root', path: '/', icon: <FolderIcon sx={{ fontSize: 16 }} /> },
        { label: 'Etc', path: '/etc', icon: <FolderIcon sx={{ fontSize: 16 }} /> },
        { label: 'Var', path: '/var', icon: <FolderIcon sx={{ fontSize: 16 }} /> },
        { label: 'Tmp', path: '/tmp', icon: <FolderIcon sx={{ fontSize: 16 }} /> },
        { label: 'Opt', path: '/opt', icon: <FolderIcon sx={{ fontSize: 16 }} /> },
    ]

    // Check if user can perform write operations
    const canWrite = canModifyFiles()

    const pathParts = currentPath.split('/').filter(Boolean)

    return (
        <Box 
            sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isDragging && (
                <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
                    bgcolor: 'rgba(249, 115, 22, 0.1)', border: '3px dashed #f97316', borderRadius: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2
                }}>
                    <UploadFileIcon sx={{ fontSize: 64, color: '#f97316' }} />
                    <Typography variant="h5" sx={{ color: '#f97316' }}>Drop file to upload</Typography>
                    <Typography variant="body2" color="text.secondary">File will be uploaded to {currentPath}</Typography>
                </Box>
            )}
            <Paper sx={{ p: 2, mb: 2, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <IconButton onClick={navigateUp} disabled={currentPath === '/'} size="small"><ArrowBackIcon /></IconButton>
                    <IconButton onClick={() => navigateTo('/home')} size="small"><HomeIcon /></IconButton>
                    <IconButton onClick={loadFiles} disabled={loading} size="small">
                        <RefreshIcon sx={{ color: loading ? 'grey' : '#f97316' }} />
                    </IconButton>
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    
                    {/* Quick Navigation */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {quickPaths.map(qp => (
                            <Tooltip key={qp.path} title={qp.path}>
                                <Chip
                                    icon={qp.icon}
                                    label={qp.label}
                                    size="small"
                                    onClick={() => navigateTo(qp.path)}
                                    sx={{ 
                                        cursor: 'pointer',
                                        bgcolor: currentPath === qp.path ? 'rgba(249, 115, 22, 0.2)' : 'transparent',
                                        border: currentPath === qp.path ? '1px solid #f97316' : '1px solid rgba(255,255,255,0.1)',
                                        '&:hover': { bgcolor: 'rgba(249, 115, 22, 0.1)' }
                                    }}
                                />
                            </Tooltip>
                        ))}
                    </Box>
                    
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    
                    {/* Search */}
                    <TextField
                        size="small"
                        placeholder="Filter files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        sx={{ width: 200 }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                            endAdornment: searchQuery && (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                                        <ClearIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                    
                    <Box sx={{ flex: 1 }} />
                    
                    {/* Write actions - only show if user has write permission */}
                    {canWrite && (
                        <>
                            <Button startIcon={<CreateNewFolderIcon />} onClick={() => setNewFolderDialog({ open: true, name: '' })} size="small">New Folder</Button>
                            <Button startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()} size="small">Upload</Button>
                            <input type="file" ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} />
                        </>
                    )}
                    {canWrite && selectedFiles.length > 0 && (
                        <>
                            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                            <Button startIcon={<DeleteIcon />} color="error" onClick={() => setDeleteDialog({ open: true, files: selectedFiles })} size="small">
                                Delete ({selectedFiles.length})
                            </Button>
                        </>
                    )}
                    <Typography variant="body2" color="text.secondary">
                        {searchQuery ? `${filteredFiles.length} of ${files.length}` : `${files.length} items`}
                    </Typography>
                </Box>
            </Paper>

            <Paper sx={{ p: 1.5, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Breadcrumbs sx={{ flex: 1 }}>
                        <Link component="button" onClick={() => navigateTo('/')} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
                            <HomeIcon sx={{ fontSize: 18 }} /> root
                        </Link>
                        {pathParts.map((part, index) => {
                            const path = '/' + pathParts.slice(0, index + 1).join('/')
                            const isLast = index === pathParts.length - 1
                            return isLast ? (
                                <Typography key={path} color="text.primary" sx={{ fontWeight: 500 }}>{part}</Typography>
                            ) : (
                                <Link key={path} component="button" onClick={() => navigateTo(path)} sx={{ cursor: 'pointer' }}>{part}</Link>
                            )
                        })}
                    </Breadcrumbs>
                    {/* Go to path input */}
                    <TextField
                        size="small"
                        placeholder="Go to path..."
                        sx={{ width: 250 }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                const path = e.target.value.trim()
                                if (path.startsWith('/')) {
                                    navigateTo(path)
                                    e.target.value = ''
                                }
                            }
                        }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>cd</Typography></InputAdornment>
                        }}
                    />
                </Box>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : (
                <Paper sx={{ overflow: 'auto', flex: 1 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}>
                                <TableCell padding="checkbox" sx={{ width: 40 }} />
                                <TableCell sx={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => { setSortBy('name'); setSortOrder(sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 100 }}>Size</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 100 }}>Permissions</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 150 }}>Modified</TableCell>
                                <TableCell sx={{ width: 50 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedFiles.map(file => (
                                <TableRow 
                                    key={file.path}
                                    selected={selectedFiles.some(f => f.path === file.path)}
                                    onClick={() => handleFileClick(file)}
                                    onDoubleClick={() => handleFileDoubleClick(file)}
                                    onContextMenu={(e) => handleContextMenu(e, file)}
                                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,212,255,0.05)' } }}
                                >
                                    <TableCell padding="checkbox">
                                        <input 
                                            type="checkbox"
                                            checked={selectedFiles.some(f => f.path === file.path)}
                                            onChange={(e) => {
                                                e.stopPropagation()
                                                setSelectedFiles(prev => e.target.checked ? [...prev, file] : prev.filter(f => f.path !== file.path))
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {getFileIcon(file)}
                                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{file.name}</Typography>
                                            {file.isSymlink && <Chip label="symlink" size="small" sx={{ fontSize: '0.65rem', height: 18 }} />}
                                        </Box>
                                    </TableCell>
                                    <TableCell><Typography variant="body2" color="text.secondary">{file.isDir ? '-' : formatSize(file.size)}</Typography></TableCell>
                                    <TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>{file.permissions || '-'}</Typography></TableCell>
                                    <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>{file.modified || '-'}</Typography></TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file) }}>
                                            <MoreVertIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sortedFiles.length === 0 && (
                                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}><Typography color="text.secondary">Empty directory</Typography></TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* Context Menu */}
            <Menu open={contextMenu.open} onClose={() => setContextMenu({ ...contextMenu, open: false })} anchorReference="anchorPosition" anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}>
                {!contextMenu.file?.isDir && <MenuItem onClick={() => { handleViewFile(contextMenu.file); setContextMenu({ ...contextMenu, open: false }) }}><ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon><ListItemText>View</ListItemText></MenuItem>}
                {!contextMenu.file?.isDir && canWrite && <MenuItem onClick={() => { handleEditFile(contextMenu.file); setContextMenu({ ...contextMenu, open: false }) }}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Edit</ListItemText></MenuItem>}
                <MenuItem onClick={() => { handleDownload(contextMenu.file); setContextMenu({ ...contextMenu, open: false }) }}><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText>Download</ListItemText></MenuItem>
                {canWrite && <Divider />}
                {canWrite && <MenuItem onClick={() => { setRenameDialog({ open: true, file: contextMenu.file, newName: contextMenu.file?.name }); setContextMenu({ ...contextMenu, open: false }) }}><ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon><ListItemText>Rename</ListItemText></MenuItem>}
                {canWrite && <MenuItem onClick={() => { setDeleteDialog({ open: true, files: [contextMenu.file] }); setContextMenu({ ...contextMenu, open: false }) }}><ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete</ListItemText></MenuItem>}
            </Menu>

            {/* Dialogs */}
            <Dialog open={viewDialog.open} onClose={() => { if (viewDialog.imageUrl) URL.revokeObjectURL(viewDialog.imageUrl); setViewDialog({ open: false, file: null, content: '', loading: false, isImage: false, imageUrl: '' }) }} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {viewDialog.isImage ? <ImageIcon sx={{ color: '#ff79c6' }} /> : <VisibilityIcon sx={{ color: '#f97316' }} />}
                    {viewDialog.file?.name}
                </DialogTitle>
                <DialogContent>
                    {viewDialog.loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : viewDialog.isImage ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#0d1117', p: 2, borderRadius: 1, minHeight: 300 }}>
                            <img src={viewDialog.imageUrl} alt={viewDialog.file?.name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                        </Box>
                    ) : (
                        <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>{viewDialog.content}</Box>
                    )}
                </DialogContent>
                <DialogActions>
                    {!viewDialog.isImage && canWrite && <Button onClick={() => { handleEditFile(viewDialog.file); if (viewDialog.imageUrl) URL.revokeObjectURL(viewDialog.imageUrl); setViewDialog({ open: false, file: null, content: '', loading: false, isImage: false, imageUrl: '' }) }}>Edit</Button>}
                    <Button onClick={() => handleDownload(viewDialog.file)}>Download</Button>
                    <Button onClick={() => { if (viewDialog.imageUrl) URL.revokeObjectURL(viewDialog.imageUrl); setViewDialog({ open: false, file: null, content: '', loading: false, isImage: false, imageUrl: '' }) }}>Close</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={editDialog.open} onClose={() => !editDialog.saving && setEditDialog({ open: false, file: null, content: '', originalContent: '', saving: false, showDiff: false })} maxWidth="xl" fullWidth PaperProps={{ sx: { height: '90vh' } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                    <CodeIcon sx={{ color: '#f97316' }} />
                    <Typography variant="h6">Edit: {editDialog.file?.name}</Typography>
                    <Chip label={getLanguageFromFilename(editDialog.file?.name)} size="small" sx={{ ml: 1 }} />
                    <Box sx={{ flex: 1 }} />
                    {editDialog.content !== editDialog.originalContent && (
                        <Chip 
                            label="Modified" 
                            size="small" 
                            color="warning" 
                            sx={{ mr: 1 }} 
                        />
                    )}
                    <Tooltip title={editDialog.showDiff ? "Hide Changes" : "Show Changes"}>
                        <IconButton 
                            onClick={() => setEditDialog(prev => ({ ...prev, showDiff: !prev.showDiff }))}
                            color={editDialog.showDiff ? "primary" : "default"}
                            disabled={editDialog.content === editDialog.originalContent}
                        >
                            <CompareArrowsIcon />
                        </IconButton>
                    </Tooltip>
                </DialogTitle>
                <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                        {editDialog.showDiff ? (
                            <DiffEditor
                                height="100%"
                                language={getLanguageFromFilename(editDialog.file?.name)}
                                original={editDialog.originalContent}
                                modified={editDialog.content}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                    lineNumbers: 'on',
                                    wordWrap: 'on',
                                    automaticLayout: true,
                                    scrollBeyondLastLine: false,
                                    readOnly: true,
                                    renderSideBySide: true
                                }}
                            />
                        ) : (
                            <Editor
                                height="100%"
                                language={getLanguageFromFilename(editDialog.file?.name)}
                                value={editDialog.content}
                                onChange={(value) => setEditDialog(prev => ({ ...prev, content: value || '' }))}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: true },
                                    fontSize: 14,
                                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                    lineNumbers: 'on',
                                    wordWrap: 'on',
                                    automaticLayout: true,
                                    scrollBeyondLastLine: false,
                                    padding: { top: 10 }
                                }}
                            />
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary', ml: 2 }}>
                        {editDialog.content?.split('\n').length || 0} lines • {editDialog.content?.length || 0} characters
                        {editDialog.content !== editDialog.originalContent && (
                            <span style={{ color: '#f97316', marginLeft: 8 }}>
                                • {Math.abs((editDialog.content?.split('\n').length || 0) - (editDialog.originalContent?.split('\n').length || 0))} lines changed
                            </span>
                        )}
                    </Typography>
                    <Button onClick={() => setEditDialog(prev => ({ ...prev, content: prev.originalContent, showDiff: false }))} disabled={editDialog.saving || editDialog.content === editDialog.originalContent}>Revert</Button>
                    <Button onClick={() => setEditDialog({ open: false, file: null, content: '', originalContent: '', saving: false, showDiff: false })} disabled={editDialog.saving}>Cancel</Button>
                    <Button variant="contained" startIcon={editDialog.saving ? <CircularProgress size={16} /> : <SaveIcon />} onClick={handleSaveFile} disabled={editDialog.saving}>Save</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={newFolderDialog.open} onClose={() => setNewFolderDialog({ open: false, name: '' })}>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogContent><TextField autoFocus fullWidth label="Folder Name" value={newFolderDialog.name} onChange={(e) => setNewFolderDialog(prev => ({ ...prev, name: e.target.value }))} sx={{ mt: 1 }} onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()} /></DialogContent>
                <DialogActions><Button onClick={() => setNewFolderDialog({ open: false, name: '' })}>Cancel</Button><Button variant="contained" onClick={handleCreateFolder}>Create</Button></DialogActions>
            </Dialog>

            <Dialog open={uploadDialog.open}><DialogTitle>Uploading File</DialogTitle><DialogContent sx={{ minWidth: 300 }}><LinearProgress variant="determinate" value={uploadDialog.progress} sx={{ mt: 2 }} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>{Math.round(uploadDialog.progress)}%</Typography></DialogContent></Dialog>

            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, files: [] })}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent><Typography>Delete {deleteDialog.files.length} item(s)?</Typography></DialogContent>
                <DialogActions><Button onClick={() => setDeleteDialog({ open: false, files: [] })}>Cancel</Button><Button variant="contained" color="error" onClick={handleDelete}>Delete</Button></DialogActions>
            </Dialog>

            <Dialog open={renameDialog.open} onClose={() => setRenameDialog({ open: false, file: null, newName: '' })}>
                <DialogTitle>Rename</DialogTitle>
                <DialogContent><TextField autoFocus fullWidth label="New Name" value={renameDialog.newName} onChange={(e) => setRenameDialog(prev => ({ ...prev, newName: e.target.value }))} sx={{ mt: 1 }} onKeyPress={(e) => e.key === 'Enter' && handleRename()} /></DialogContent>
                <DialogActions><Button onClick={() => setRenameDialog({ open: false, file: null, newName: '' })}>Cancel</Button><Button variant="contained" onClick={handleRename}>Rename</Button></DialogActions>
            </Dialog>

            {/* Systemd notification */}
            <Snackbar 
                open={saveMessage.open} 
                autoHideDuration={5000} 
                onClose={() => setSaveMessage({ open: false, message: '', isSystemd: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert 
                    onClose={() => setSaveMessage({ open: false, message: '', isSystemd: false })} 
                    severity="success" 
                    sx={{ width: '100%', bgcolor: '#1a472a', color: '#fff' }}
                    icon={<TerminalIcon />}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {saveMessage.userService ? '👤 User Service Updated' : '🔧 System Service Updated'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', opacity: 0.9 }}>
                        {saveMessage.message}
                    </Typography>
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default MachineFiles
