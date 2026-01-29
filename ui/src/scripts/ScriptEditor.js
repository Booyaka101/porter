import { useState, useCallback, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CodeIcon from '@mui/icons-material/Code'
import CloseIcon from '@mui/icons-material/Close'
import SaveIcon from '@mui/icons-material/Save'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { colors } from './theme'

const DEFAULT_SCRIPT = `#!/bin/bash
# Script Name: My Script
# Description: Add your description here

set -e  # Exit on error

echo "Starting script..."

# Your code here

echo "Script completed successfully!"
`

const ScriptEditor = ({ open, onClose, script, onSave, mode = 'add' }) => {
    const [form, setForm] = useState({
        name: '',
        description: '',
        category: '',
        content: DEFAULT_SCRIPT
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [activeTab, setActiveTab] = useState(0)
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })
    const fileInputRef = useRef(null)
    const editorRef = useRef(null)

    // Load script data when editing
    useEffect(() => {
        if (open && mode === 'edit' && script) {
            setForm({
                name: script.name || '',
                description: script.description || '',
                category: script.category || '',
                content: script.content || ''
            })
        } else if (open && mode === 'add') {
            setForm({
                name: '',
                description: '',
                category: '',
                content: DEFAULT_SCRIPT
            })
        }
        setError('')
        setActiveTab(0)
    }, [open, mode, script])

    const handleChange = useCallback((field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }))
        setError('')
    }, [])

    const handleFileUpload = useCallback((file) => {
        if (!file) return
        
        if (!file.name.endsWith('.sh') && !file.type.includes('text')) {
            setError('Please upload a shell script (.sh) file')
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target?.result
            setForm(prev => ({
                ...prev,
                name: prev.name || file.name.replace(/\.sh$/, ''),
                content: content
            }))
            setSnackbar({ open: true, message: 'File loaded successfully!' })
        }
        reader.onerror = () => setError('Failed to read file')
        reader.readAsText(file)
    }, [])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        handleFileUpload(file)
    }, [handleFileUpload])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleSave = useCallback(async () => {
        if (!form.name.trim()) {
            setError('Script name is required')
            return
        }
        if (!form.content.trim()) {
            setError('Script content is required')
            return
        }

        setSaving(true)
        setError('')

        try {
            await onSave({
                name: form.name.trim(),
                description: form.description.trim(),
                category: form.category.trim() || 'general',
                content: form.content
            })
            onClose()
        } catch (err) {
            setError(err.message || 'Failed to save script')
        } finally {
            setSaving(false)
        }
    }, [form, onSave, onClose])

    const handleCopyContent = useCallback(() => {
        navigator.clipboard.writeText(form.content)
        setSnackbar({ open: true, message: 'Copied to clipboard!' })
    }, [form.content])

    const lineCount = form.content.split('\n').length
    const charCount = form.content.length

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'linear-gradient(180deg, #0d1117 0%, #161b22 100%)',
                        border: '1px solid rgba(249, 115, 22, 0.2)',
                        borderRadius: '16px',
                        height: '90vh',
                        maxHeight: '900px',
                    }
                }}
            >
                {/* Header */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 20px rgba(255, 0, 255, 0.3)',
                        }}>
                            <CodeIcon sx={{ color: '#fff', fontSize: 24 }} />
                        </Box>
                        <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#fff' }}>
                                {mode === 'edit' ? 'Edit Script' : 'Create New Script'}
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                {mode === 'edit' ? 'Modify your custom script' : 'Add a new script to your collection'}
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {saving && <LinearProgress sx={{ height: 2 }} />}

                <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
                    {error && (
                        <Alert severity="error" sx={{ m: 2, mb: 0 }}>{error}</Alert>
                    )}

                    {/* Tabs */}
                    <Tabs
                        value={activeTab}
                        onChange={(_, v) => setActiveTab(v)}
                        sx={{
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            px: 2,
                            '& .MuiTab-root': {
                                color: 'rgba(255,255,255,0.5)',
                                textTransform: 'none',
                                fontWeight: 500,
                                '&.Mui-selected': { color: '#f97316' }
                            },
                            '& .MuiTabs-indicator': {
                                backgroundColor: '#f97316'
                            }
                        }}
                    >
                        <Tab label="Details" />
                        <Tab label="Editor" />
                    </Tabs>

                    {/* Details Tab - Now first */}
                    {activeTab === 0 && (
                        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Box sx={{
                                p: 2,
                                borderRadius: '12px',
                                background: 'rgba(249, 115, 22, 0.05)',
                                border: '1px solid rgba(249, 115, 22, 0.1)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 2,
                            }}>
                                <InfoOutlinedIcon sx={{ color: '#f97316', mt: 0.5 }} />
                                <Box>
                                    <Typography sx={{ color: '#f97316', fontWeight: 600, mb: 0.5 }}>
                                        Script Information
                                    </Typography>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                                        Add details to help identify and organize your script. 
                                        The category helps group related scripts together.
                                    </Typography>
                                </Box>
                            </Box>

                            <TextField
                                label="Script Name"
                                value={form.name}
                                onChange={handleChange('name')}
                                required
                                fullWidth
                                placeholder="e.g., Setup Docker Environment"
                                helperText="A descriptive name for your script"
                                InputLabelProps={{ shrink: true }}
                            />

                            <TextField
                                label="Description"
                                value={form.description}
                                onChange={handleChange('description')}
                                fullWidth
                                multiline
                                rows={3}
                                placeholder="Describe what this script does..."
                                helperText="Optional: Explain the purpose and usage"
                                InputLabelProps={{ shrink: true }}
                            />

                            <TextField
                                label="Category"
                                value={form.category}
                                onChange={handleChange('category')}
                                fullWidth
                                placeholder="e.g., deployment, setup, utilities"
                                helperText="Group scripts by category (default: general)"
                                InputLabelProps={{ shrink: true }}
                            />

                            {mode === 'edit' && script && (
                                <Box sx={{
                                    p: 2,
                                    borderRadius: '8px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                }}>
                                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', mb: 1 }}>
                                        Script Metadata
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                        <Box>
                                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                                Created
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                                {new Date(script.created_at).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                                Last Modified
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                                {new Date(script.updated_at).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                                Size
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                                {(script.size / 1024).toFixed(1)} KB
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Editor Tab - Now second */}
                    {activeTab === 1 && (
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Drop Zone / Editor */}
                            <Box
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                sx={{
                                    flex: 1,
                                    m: 2,
                                    borderRadius: '12px',
                                    border: isDragging 
                                        ? '2px dashed #f97316' 
                                        : '1px solid rgba(255,255,255,0.1)',
                                    background: isDragging 
                                        ? 'rgba(249, 115, 22, 0.05)' 
                                        : 'rgba(0, 0, 0, 0.3)',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Editor Toolbar */}
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    px: 2,
                                    py: 1,
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip 
                                            label="Bash" 
                                            size="small" 
                                            sx={{ 
                                                background: 'rgba(249, 115, 22, 0.15)', 
                                                color: '#f97316',
                                                fontWeight: 600,
                                                fontSize: '0.7rem'
                                            }} 
                                        />
                                        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                            {lineCount} lines • {charCount.toLocaleString()} chars
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        <Button
                                            component="label"
                                            size="small"
                                            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
                                            sx={{ 
                                                color: 'rgba(255,255,255,0.6)', 
                                                fontSize: '0.75rem',
                                                textTransform: 'none'
                                            }}
                                        >
                                            Upload
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".sh,.bash,.txt"
                                                hidden
                                                onChange={(e) => handleFileUpload(e.target.files?.[0])}
                                            />
                                        </Button>
                                        <IconButton 
                                            size="small" 
                                            onClick={handleCopyContent}
                                            sx={{ color: 'rgba(255,255,255,0.5)' }}
                                        >
                                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Box>
                                </Box>

                                {/* Code Editor */}
                                <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                                    {isDragging && (
                                        <Box sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(249, 115, 22, 0.1)',
                                            zIndex: 10,
                                        }}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <UploadFileIcon sx={{ fontSize: 48, color: '#f97316', mb: 1 }} />
                                                <Typography sx={{ color: '#f97316', fontWeight: 600 }}>
                                                    Drop your script here
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}
                                    <TextField
                                        ref={editorRef}
                                        value={form.content}
                                        onChange={handleChange('content')}
                                        multiline
                                        fullWidth
                                        placeholder="#!/bin/bash&#10;&#10;# Your script here"
                                        sx={{
                                            height: '100%',
                                            '& .MuiOutlinedInput-root': {
                                                height: '100%',
                                                alignItems: 'flex-start',
                                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                                fontSize: '0.875rem',
                                                lineHeight: 1.6,
                                                color: '#e6edf3',
                                                background: 'transparent',
                                                '& fieldset': { border: 'none' },
                                                '& textarea': {
                                                    height: '100% !important',
                                                    overflow: 'auto !important',
                                                }
                                            }
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    )}
                </DialogContent>

                {/* Footer */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        Drag & drop a .sh file or paste your script
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            onClick={onClose}
                            sx={{ color: 'rgba(255,255,255,0.6)' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !form.name.trim() || !form.content.trim()}
                            startIcon={<SaveIcon />}
                            sx={{
                                background: 'linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)',
                                color: '#fff',
                                fontWeight: 600,
                                px: 3,
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #ff66ff 0%, #ff00ff 100%)',
                                    boxShadow: '0 0 20px rgba(255, 0, 255, 0.4)',
                                },
                                '&:disabled': {
                                    background: 'rgba(255, 0, 255, 0.2)',
                                    color: 'rgba(255, 255, 255, 0.4)',
                                }
                            }}
                        >
                            {saving ? 'Saving...' : (mode === 'edit' ? 'Save Changes' : 'Create Script')}
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ open: false, message: '' })}
                message={snackbar.message}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </>
    )
}

export default ScriptEditor
