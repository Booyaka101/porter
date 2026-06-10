import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Tooltip from '@mui/material/Tooltip'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import LinearProgress from '@mui/material/LinearProgress'
import Menu from '@mui/material/Menu'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove'
import VisibilityIcon from '@mui/icons-material/Visibility'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import ImageIcon from '@mui/icons-material/Image'
import CodeIcon from '@mui/icons-material/Code'
import TerminalIcon from '@mui/icons-material/Terminal'
import ArchiveIcon from '@mui/icons-material/Archive'
import LockIcon from '@mui/icons-material/Lock'
import LinkIcon from '@mui/icons-material/Link'
import SaveIcon from '@mui/icons-material/Save'

const FileManager = () => {
    const [machines, setMachines] = useState([])
    const [selectedMachine, setSelectedMachine] = useState('')
    const [currentPath, setCurrentPath] = useState('/home')
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState([])
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')
    
    // Dialog states
    const [viewDialog, setViewDialog] = useState({ open: false, file: null, content: '', loading: false })
    const [editDialog, setEditDialog] = useState({ open: false, file: null, content: '', saving: false })
    const [newFolderDialog, setNewFolderDialog] = useState({ open: false, name: '' })
    const [uploadDialog, setUploadDialog] = useState({ open: false, uploading: false, progress: 0 })
    const [deleteDialog, setDeleteDialog] = useState({ open: false, files: [] })
    const [renameDialog, setRenameDialog] = useState({ open: false, file: null, newName: '' })
    const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, file: null })
    
    const fileInputRef = useRef(null)

    useEffect(() => {
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => setMachines(data || []))
            .catch(console.error)
    }, [])

    const loadFiles = useCallback(async () => {
        if (!selectedMachine) return
        setLoading(true)
        setSelectedFiles([])
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/files?path=${encodeURIComponent(currentPath)}`)
            const data = await res.json()
            setFiles(data.files || [])
        } catch (err) {
            console.error('Failed to load files:', err)
        } finally {
            setLoading(false)
        }
    }, [selectedMachine, currentPath])

    useEffect(() => {
        if (selectedMachine) loadFiles()
    }, [selectedMachine, currentPath, loadFiles])

    const navigateTo = (path) => {
        setCurrentPath(path)
    }

    const navigateUp = () => {
        const parts = currentPath.split('/').filter(Boolean)
        parts.pop()
        setCurrentPath('/' + parts.join('/') || '/')
    }

    const handleFileClick = (file) => {
        if (file.isDir) {
            navigateTo(file.path)
        }
    }

    const handleFileDoubleClick = (file) => {
        if (!file.isDir) {
            handleViewFile(file)
        }
    }

    const handleViewFile = async (file) => {
        setViewDialog({ open: true, file, content: '', loading: true })
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/file?path=${encodeURIComponent(file.path)}`)
            const data = await res.json()
            setViewDialog(prev => ({ ...prev, content: data.content || '', loading: false }))
        } catch (err) {
            setViewDialog(prev => ({ ...prev, content: 'Failed to load file: ' + err.message, loading: false }))
        }
    }

    const handleEditFile = async (file) => {
        setEditDialog({ open: true, file, content: '', saving: false })
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/file?path=${encodeURIComponent(file.path)}`)
            const data = await res.json()
            setEditDialog(prev => ({ ...prev, content: data.content || '' }))
        } catch (err) {
            setEditDialog(prev => ({ ...prev, content: '' }))
        }
    }

    const handleSaveFile = async () => {
        setEditDialog(prev => ({ ...prev, saving: true }))
        try {
            await fetch(`/api/machines/${selectedMachine}/file`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: editDialog.file.path, content: editDialog.content })
            })
            setEditDialog({ open: false, file: null, content: '', saving: false })
            loadFiles()
        } catch (err) {
            console.error('Failed to save file:', err)
            setEditDialog(prev => ({ ...prev, saving: false }))
        }
    }

    const handleCreateFolder = async () => {
        if (!newFolderDialog.name.trim()) return
        try {
            await fetch(`/api/machines/${selectedMachine}/mkdir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: `${currentPath}/${newFolderDialog.name}` })
            })
            setNewFolderDialog({ open: false, name: '' })
            loadFiles()
        } catch (err) {
            console.error('Failed to create folder:', err)
        }
    }

    const handleUpload = async (event) => {
        const file = event.target.files[0]
        if (!file) return
        
        setUploadDialog({ open: true, uploading: true, progress: 0 })
        
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', currentPath)
        
        try {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    setUploadDialog(prev => ({ ...prev, progress: (e.loaded / e.total) * 100 }))
                }
            }
            xhr.onload = () => {
                setUploadDialog({ open: false, uploading: false, progress: 0 })
                loadFiles()
            }
            xhr.onerror = () => {
                setUploadDialog({ open: false, uploading: false, progress: 0 })
            }
            xhr.open('POST', `/api/machines/${selectedMachine}/upload`)
            xhr.send(formData)
        } catch (err) {
            console.error('Upload failed:', err)
            setUploadDialog({ open: false, uploading: false, progress: 0 })
        }
        
        event.target.value = ''
    }

    const handleDownload = async (file) => {
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/download?path=${encodeURIComponent(file.path)}`)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = file.name
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Download failed:', err)
        }
    }

    const handleDelete = async () => {
        try {
            for (const file of deleteDialog.files) {
                await fetch(`/api/machines/${selectedMachine}/delete`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: file.path, recursive: file.isDir })
                })
            }
            setDeleteDialog({ open: false, files: [] })
            setSelectedFiles([])
            loadFiles()
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const handleRename = async () => {
        if (!renameDialog.newName.trim()) return
        try {
            const newPath = currentPath + '/' + renameDialog.newName
            await fetch(`/api/machines/${selectedMachine}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath: renameDialog.file.path, newPath })
            })
            setRenameDialog({ open: false, file: null, newName: '' })
            loadFiles()
        } catch (err) {
            console.error('Rename failed:', err)
        }
    }

    const handleContextMenu = (event, file) => {
        event.preventDefault()
        setContextMenu({ open: true, x: event.clientX, y: event.clientY, file })
    }

    const getFileIcon = (file) => {
        if (file.isDir) return <FolderIcon sx={{ color: '#ffaa00' }} />
        if (file.isSymlink) return <LinkIcon sx={{ color: '#f97316' }} />
        
        const ext = file.name.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'txt':
            case 'md':
            case 'log':
                return <TextSnippetIcon sx={{ color: '#7dd3fc' }} />
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'svg':
                return <ImageIcon sx={{ color: '#ff00ff' }} />
            case 'js':
            case 'ts':
            case 'py':
            case 'go':
            case 'rs':
            case 'java':
            case 'c':
            case 'cpp':
            case 'h':
                return <CodeIcon sx={{ color: '#22c55e' }} />
            case 'sh':
            case 'bash':
                return <TerminalIcon sx={{ color: '#ffaa00' }} />
            case 'zip':
            case 'tar':
            case 'gz':
            case 'rar':
                return <ArchiveIcon sx={{ color: '#ff6b6b' }} />
            default:
                return <InsertDriveFileIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
        }
    }

    const formatSize = (bytes) => {
        if (bytes === undefined || bytes === null) return '-'
        if (bytes === 0) return '0 B'
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(1024))
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
    }

    const formatDate = (date) => {
        if (!date) return '-'
        return new Date(date).toLocaleString()
    }

    const sortedFiles = [...files].sort((a, b) => {
        // Directories first
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        
        let comparison = 0
        switch (sortBy) {
            case 'name':
                comparison = a.name.localeCompare(b.name)
                break
            case 'size':
                comparison = (a.size || 0) - (b.size || 0)
                break
            case 'modified':
                comparison = new Date(a.modified || 0) - new Date(b.modified || 0)
                break
            default:
                comparison = 0
        }
        return sortOrder === 'asc' ? comparison : -comparison
    })

    const pathParts = currentPath.split('/').filter(Boolean)

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    File Manager
                </Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Machine</InputLabel>
                    <Select
                        value={selectedMachine}
                        onChange={(e) => { setSelectedMachine(e.target.value); setCurrentPath('/home') }}
                        label="Machine"
                    >
                        {machines.map(m => (
                            <MenuItem key={m.id} value={m.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.status === 'online' ? '#22c55e' : '#ff3366' }} />
                                    {m.name}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {selectedMachine && (
                <>
                    {/* Toolbar */}
                    <Paper sx={{ p: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconButton onClick={navigateUp} disabled={currentPath === '/'}>
                                <ArrowBackIcon />
                            </IconButton>
                            <IconButton onClick={() => navigateTo('/home')}>
                                <HomeIcon />
                            </IconButton>
                            <IconButton onClick={loadFiles} disabled={loading}>
                                <RefreshIcon sx={{ color: loading ? 'grey' : '#f97316' }} />
                            </IconButton>
                            
                            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                            
                            <Button startIcon={<CreateNewFolderIcon />} onClick={() => setNewFolderDialog({ open: true, name: '' })} size="small">
                                New Folder
                            </Button>
                            <Button startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()} size="small">
                                Upload
                            </Button>
                            <input type="file" ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} />
                            
                            {selectedFiles.length > 0 && (
                                <>
                                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                                    <Button 
                                        startIcon={<DeleteIcon />} 
                                        color="error" 
                                        onClick={() => setDeleteDialog({ open: true, files: selectedFiles })}
                                        size="small"
                                    >
                                        Delete ({selectedFiles.length})
                                    </Button>
                                </>
                            )}
                            
                            <Box sx={{ flex: 1 }} />
                            
                            <Typography variant="body2" color="text.secondary">
                                {files.length} items
                            </Typography>
                        </Box>
                    </Paper>

                    {/* Breadcrumb */}
                    <Paper sx={{ p: 1.5, mb: 2 }}>
                        <Breadcrumbs>
                            <Link 
                                component="button" 
                                onClick={() => navigateTo('/')}
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
                            >
                                <HomeIcon sx={{ fontSize: 18 }} /> root
                            </Link>
                            {pathParts.map((part, index) => {
                                const path = '/' + pathParts.slice(0, index + 1).join('/')
                                const isLast = index === pathParts.length - 1
                                return isLast ? (
                                    <Typography key={path} color="text.primary" sx={{ fontWeight: 500 }}>
                                        {part}
                                    </Typography>
                                ) : (
                                    <Link key={path} component="button" onClick={() => navigateTo(path)} sx={{ cursor: 'pointer' }}>
                                        {part}
                                    </Link>
                                )
                            })}
                        </Breadcrumbs>
                    </Paper>

                    {/* File List */}
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Paper sx={{ overflow: 'hidden' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}>
                                        <TableCell padding="checkbox" sx={{ width: 40 }} />
                                        <TableCell 
                                            sx={{ fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => { setSortBy('name'); setSortOrder(sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc') }}
                                        >
                                            Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </TableCell>
                                        <TableCell 
                                            sx={{ fontWeight: 600, cursor: 'pointer', width: 100 }}
                                            onClick={() => { setSortBy('size'); setSortOrder(sortBy === 'size' && sortOrder === 'asc' ? 'desc' : 'asc') }}
                                        >
                                            Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 100 }}>Permissions</TableCell>
                                        <TableCell 
                                            sx={{ fontWeight: 600, cursor: 'pointer', width: 180 }}
                                            onClick={() => { setSortBy('modified'); setSortOrder(sortBy === 'modified' && sortOrder === 'asc' ? 'desc' : 'asc') }}
                                        >
                                            Modified {sortBy === 'modified' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </TableCell>
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
                                            sx={{ 
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: 'rgba(0,212,255,0.05)' },
                                                '&.Mui-selected': { bgcolor: 'rgba(0,212,255,0.1)' }
                                            }}
                                        >
                                            <TableCell padding="checkbox">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedFiles.some(f => f.path === file.path)}
                                                    onChange={(e) => {
                                                        e.stopPropagation()
                                                        if (e.target.checked) {
                                                            setSelectedFiles(prev => [...prev, file])
                                                        } else {
                                                            setSelectedFiles(prev => prev.filter(f => f.path !== file.path))
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {getFileIcon(file)}
                                                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                        {file.name}
                                                    </Typography>
                                                    {file.isSymlink && (
                                                        <Chip label="symlink" size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {file.isDir ? '-' : formatSize(file.size)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                                                    {file.permissions || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                                    {formatDate(file.modified)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file) }}>
                                                    <MoreVertIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {sortedFiles.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography color="text.secondary">Empty directory</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Paper>
                    )}
                </>
            )}

            {!selectedMachine && (
                <Paper sx={{ p: 6, textAlign: 'center' }}>
                    <FolderIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                    <Typography color="text.secondary">Select a machine to browse files</Typography>
                </Paper>
            )}

            {/* Context Menu */}
            <Menu
                open={contextMenu.open}
                onClose={() => setContextMenu({ ...contextMenu, open: false })}
                anchorReference="anchorPosition"
                anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
            >
                {!contextMenu.file?.isDir && (
                    <MenuItem onClick={() => { handleViewFile(contextMenu.file); setContextMenu({ ...contextMenu, open: false }) }}>
                        <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>View</ListItemText>
                    </MenuItem>
                )}
                {!contextMenu.file?.isDir && (
                    <MenuItem onClick={() => { handleEditFile(contextMenu.file); setContextMenu({ ...contextMenu, open: false }) }}>
                        <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Edit</ListItemText>
                    </MenuItem>
                )}
                <MenuItem onClick={() => { handleDownload(contextMenu.file); setContextMenu({ ...contextMenu, open: false }) }}>
                    <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Download</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { setRenameDialog({ open: true, file: contextMenu.file, newName: contextMenu.file?.name }); setContextMenu({ ...contextMenu, open: false }) }}>
                    <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Rename</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { setDeleteDialog({ open: true, files: [contextMenu.file] }); setContextMenu({ ...contextMenu, open: false }) }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText>Delete</ListItemText>
                </MenuItem>
            </Menu>

            {/* View File Dialog */}
            <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, file: null, content: '', loading: false })} maxWidth="lg" fullWidth>
                <DialogTitle>{viewDialog.file?.name}</DialogTitle>
                <DialogContent>
                    {viewDialog.loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : (
                        <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>
                            {viewDialog.content}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { handleEditFile(viewDialog.file); setViewDialog({ open: false, file: null, content: '', loading: false }) }}>Edit</Button>
                    <Button onClick={() => setViewDialog({ open: false, file: null, content: '', loading: false })}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Edit File Dialog */}
            <Dialog open={editDialog.open} onClose={() => !editDialog.saving && setEditDialog({ open: false, file: null, content: '', saving: false })} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EditIcon /> Edit: {editDialog.file?.name}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        multiline
                        fullWidth
                        minRows={20}
                        maxRows={30}
                        value={editDialog.content}
                        onChange={(e) => setEditDialog(prev => ({ ...prev, content: e.target.value }))}
                        sx={{ mt: 1, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialog({ open: false, file: null, content: '', saving: false })} disabled={editDialog.saving}>Cancel</Button>
                    <Button variant="contained" startIcon={editDialog.saving ? <CircularProgress size={16} /> : <SaveIcon />} onClick={handleSaveFile} disabled={editDialog.saving}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* New Folder Dialog */}
            <Dialog open={newFolderDialog.open} onClose={() => setNewFolderDialog({ open: false, name: '' })}>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Folder Name"
                        value={newFolderDialog.name}
                        onChange={(e) => setNewFolderDialog(prev => ({ ...prev, name: e.target.value }))}
                        sx={{ mt: 1 }}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewFolderDialog({ open: false, name: '' })}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateFolder}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* Upload Progress Dialog */}
            <Dialog open={uploadDialog.open} onClose={() => {}}>
                <DialogTitle>Uploading File</DialogTitle>
                <DialogContent sx={{ minWidth: 300 }}>
                    <LinearProgress variant="determinate" value={uploadDialog.progress} sx={{ mt: 2 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                        {Math.round(uploadDialog.progress)}%
                    </Typography>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, files: [] })}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete {deleteDialog.files.length} item(s)?
                    </Typography>
                    <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
                        {deleteDialog.files.map(f => (
                            <Typography key={f.path} variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {f.name}
                            </Typography>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({ open: false, files: [] })}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Rename Dialog */}
            <Dialog open={renameDialog.open} onClose={() => setRenameDialog({ open: false, file: null, newName: '' })}>
                <DialogTitle>Rename</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="New Name"
                        value={renameDialog.newName}
                        onChange={(e) => setRenameDialog(prev => ({ ...prev, newName: e.target.value }))}
                        sx={{ mt: 1 }}
                        onKeyPress={(e) => e.key === 'Enter' && handleRename()}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenameDialog({ open: false, file: null, newName: '' })}>Cancel</Button>
                    <Button variant="contained" onClick={handleRename}>Rename</Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default FileManager
