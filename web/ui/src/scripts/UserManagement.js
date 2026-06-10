import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonIcon from '@mui/icons-material/Person'
import VisibilityIcon from '@mui/icons-material/Visibility'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAuth } from './AuthContext'
import { colors } from './theme'

const roleColors = {
    admin: '#ef4444',
    operator: '#f97316',
    viewer: '#22c55e'
}

const roleIcons = {
    admin: AdminPanelSettingsIcon,
    operator: PersonIcon,
    viewer: VisibilityIcon
}

const UserManagement = () => {
    const { user: currentUser, isAdmin } = useAuth()
    const [users, setUsers] = useState([])
    const [roles, setRoles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'viewer',
        display_name: '',
        is_active: true
    })

    const loadUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/users')
            if (res.ok) {
                const data = await res.json()
                setUsers(data || [])
            }
        } catch (err) {
            setError('Failed to load users')
        }
        setLoading(false)
    }, [])

    const loadRoles = useCallback(async () => {
        try {
            const res = await fetch('/api/roles')
            if (res.ok) {
                const data = await res.json()
                setRoles(data || [])
            }
        } catch (err) {
            console.error('Failed to load roles:', err)
        }
    }, [])

    useEffect(() => {
        loadUsers()
        loadRoles()
    }, [loadUsers, loadRoles])

    const handleOpenDialog = (user = null) => {
        if (user) {
            setEditingUser(user)
            setFormData({
                username: user.username,
                email: user.email || '',
                password: '',
                role: user.role,
                display_name: user.display_name || '',
                is_active: user.is_active
            })
        } else {
            setEditingUser(null)
            setFormData({
                username: '',
                email: '',
                password: '',
                role: 'viewer',
                display_name: '',
                is_active: true
            })
        }
        setDialogOpen(true)
    }

    const handleCloseDialog = () => {
        setDialogOpen(false)
        setEditingUser(null)
        setError('')
    }

    const handleSubmit = async () => {
        setError('')
        setSuccess('')

        if (!formData.username) {
            setError('Username is required')
            return
        }

        if (!editingUser && !formData.password) {
            setError('Password is required for new users')
            return
        }

        if (formData.password && formData.password.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }

        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
            const method = editingUser ? 'PUT' : 'POST'

            const body = { ...formData }
            if (!body.password) delete body.password

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            const data = await res.json()

            if (data.success) {
                setSuccess(editingUser ? 'User updated successfully' : 'User created successfully')
                handleCloseDialog()
                loadUsers()
            } else {
                setError(data.error || 'Operation failed')
            }
        } catch (err) {
            setError('Network error')
        }
    }

    const handleDelete = async (userId) => {
        try {
            const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
            const data = await res.json()

            if (data.success) {
                setSuccess('User deleted successfully')
                loadUsers()
            } else {
                setError(data.error || 'Failed to delete user')
            }
        } catch (err) {
            setError('Network error')
        }
        setDeleteConfirm(null)
    }

    if (!isAdmin()) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning">
                    You don't have permission to manage users. Only administrators can access this page.
                </Alert>
            </Box>
        )
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#fafafa' }}>
                        User Management
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                        Manage users and their access permissions
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={loadUsers}
                        sx={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<PersonAddIcon />}
                        onClick={() => handleOpenDialog()}
                    >
                        Add User
                    </Button>
                </Box>
            </Box>

            {/* Alerts */}
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Users Table */}
            <Card sx={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>User</TableCell>
                                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Role</TableCell>
                                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Status</TableCell>
                                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Last Login</TableCell>
                                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }} align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => {
                                const RoleIcon = roleIcons[user.role] || PersonIcon
                                return (
                                    <TableRow key={user.id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Box sx={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: '50%',
                                                    background: `${roleColors[user.role]}20`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <RoleIcon sx={{ fontSize: 18, color: roleColors[user.role] }} />
                                                </Box>
                                                <Box>
                                                    <Typography sx={{ color: '#fafafa', fontWeight: 500 }}>
                                                        {user.display_name || user.username}
                                                    </Typography>
                                                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                                        {user.email || user.username}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.role}
                                                size="small"
                                                sx={{
                                                    background: `${roleColors[user.role]}20`,
                                                    color: roleColors[user.role],
                                                    fontWeight: 600,
                                                    textTransform: 'capitalize'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.is_active ? 'Active' : 'Disabled'}
                                                size="small"
                                                sx={{
                                                    background: user.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: user.is_active ? '#22c55e' : '#ef4444',
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                                                {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Edit">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenDialog(user)}
                                                    sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#f97316' } }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            {user.id !== currentUser?.id && (
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setDeleteConfirm(user)}
                                                        sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#ef4444' } }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ background: 'rgba(0,0,0,0.3)' }}>
                    {editingUser ? 'Edit User' : 'Add New User'}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            disabled={!!editingUser}
                            fullWidth
                        />
                        <TextField
                            label="Display Name"
                            value={formData.display_name}
                            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={formData.role}
                                label="Role"
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                <MenuItem value="admin">Admin - Full access</MenuItem>
                                <MenuItem value="operator">Operator - Execute scripts, manage machines</MenuItem>
                                <MenuItem value="viewer">Viewer - Read-only access</MenuItem>
                            </Select>
                        </FormControl>
                        {editingUser && (
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                }
                                label="Account Active"
                            />
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, background: 'rgba(0,0,0,0.2)' }}>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit}>
                        {editingUser ? 'Save Changes' : 'Create User'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Delete User</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete user <strong>{deleteConfirm?.username}</strong>?
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => handleDelete(deleteConfirm.id)}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default UserManagement
