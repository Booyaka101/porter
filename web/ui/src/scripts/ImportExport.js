import { useState, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'

import ImportExportIcon from '@mui/icons-material/ImportExport'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import ComputerIcon from '@mui/icons-material/Computer'
import GroupIcon from '@mui/icons-material/Group'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import BackupIcon from '@mui/icons-material/Backup'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

import { colors } from './theme'

const ImportExport = () => {
    const [message, setMessage] = useState(null)
    const [importResult, setImportResult] = useState(null)
    const fileInputRef = useRef(null)

    const exportConfig = async (what = 'all') => {
        try {
            const res = await fetch(`/api/export?what=${what}`)
            const data = await res.json()
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `porter-export-${what}-${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setMessage({ type: 'success', text: `Configuration exported successfully` })
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to export configuration' })
        }
    }

    const handleImport = async (event) => {
        const file = event.target.files[0]
        if (!file) return

        try {
            const text = await file.text()
            const data = JSON.parse(text)

            const res = await fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: text
            })
            const result = await res.json()

            if (result.success) {
                setImportResult(result.imported)
                setMessage({ type: 'success', text: 'Configuration imported successfully' })
            } else {
                setMessage({ type: 'error', text: result.error || 'Import failed' })
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Invalid import file: ' + err.message })
        }

        event.target.value = ''
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ color: colors.text.primary, fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImportExportIcon sx={{ color: colors.primary }} />
                Import / Export
            </Typography>

            {message && (
                <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 3 }}>
                    {message.text}
                </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {/* Export */}
                <Paper sx={{ background: colors.background.card, border: `1px solid ${colors.border.light}`, p: 3, flex: 1, minWidth: 300 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <DownloadIcon sx={{ color: colors.secondary }} />
                        <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>Export Configuration</Typography>
                    </Box>

                    <Typography sx={{ color: colors.text.secondary, mb: 3, fontSize: '0.9rem' }}>
                        Export your Porter configuration to a JSON file for backup or migration.
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Button
                            variant="contained"
                            startIcon={<DownloadIcon />}
                            onClick={() => exportConfig('all')}
                            fullWidth
                            sx={{ background: colors.primary, justifyContent: 'flex-start' }}
                        >
                            Export All
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<ComputerIcon />}
                            onClick={() => exportConfig('machines')}
                            fullWidth
                            sx={{ justifyContent: 'flex-start' }}
                        >
                            Export Machines Only
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<GroupIcon />}
                            onClick={() => exportConfig('groups')}
                            fullWidth
                            sx={{ justifyContent: 'flex-start' }}
                        >
                            Export Groups Only
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<BackupIcon />}
                            onClick={() => exportConfig('backup_jobs')}
                            fullWidth
                            sx={{ justifyContent: 'flex-start' }}
                        >
                            Export Backup Jobs Only
                        </Button>
                    </Box>
                </Paper>

                {/* Import */}
                <Paper sx={{ background: colors.background.card, border: `1px solid ${colors.border.light}`, p: 3, flex: 1, minWidth: 300 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <UploadIcon sx={{ color: colors.primary }} />
                        <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>Import Configuration</Typography>
                    </Box>

                    <Typography sx={{ color: colors.text.secondary, mb: 3, fontSize: '0.9rem' }}>
                        Import a previously exported Porter configuration file.
                    </Typography>

                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleImport}
                        style={{ display: 'none' }}
                    />

                    <Button
                        variant="contained"
                        startIcon={<UploadIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        fullWidth
                        sx={{ background: colors.primary, mb: 2 }}
                    >
                        Select File to Import
                    </Button>

                    {importResult && (
                        <Box sx={{ mt: 2 }}>
                            <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mb: 1 }}>
                                Imported:
                            </Typography>
                            <List dense>
                                {importResult.machines > 0 && (
                                    <ListItem>
                                        <ListItemIcon><CheckCircleIcon sx={{ color: colors.secondary }} /></ListItemIcon>
                                        <ListItemText primary={`${importResult.machines} machines`} />
                                    </ListItem>
                                )}
                                {importResult.groups > 0 && (
                                    <ListItem>
                                        <ListItemIcon><CheckCircleIcon sx={{ color: colors.secondary }} /></ListItemIcon>
                                        <ListItemText primary={`${importResult.groups} groups`} />
                                    </ListItem>
                                )}
                                {importResult.bookmarks > 0 && (
                                    <ListItem>
                                        <ListItemIcon><CheckCircleIcon sx={{ color: colors.secondary }} /></ListItemIcon>
                                        <ListItemText primary={`${importResult.bookmarks} bookmarks`} />
                                    </ListItem>
                                )}
                                {importResult.ssh_keys > 0 && (
                                    <ListItem>
                                        <ListItemIcon><CheckCircleIcon sx={{ color: colors.secondary }} /></ListItemIcon>
                                        <ListItemText primary={`${importResult.ssh_keys} SSH keys`} />
                                    </ListItem>
                                )}
                                {importResult.backup_jobs > 0 && (
                                    <ListItem>
                                        <ListItemIcon><CheckCircleIcon sx={{ color: colors.secondary }} /></ListItemIcon>
                                        <ListItemText primary={`${importResult.backup_jobs} backup jobs`} />
                                    </ListItem>
                                )}
                            </List>
                        </Box>
                    )}
                </Paper>
            </Box>
        </Box>
    )
}

export default ImportExport
