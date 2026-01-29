import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
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
import InputAdornment from '@mui/material/InputAdornment'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import LinearProgress from '@mui/material/LinearProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import SecurityIcon from '@mui/icons-material/Security'
import PersonIcon from '@mui/icons-material/Person'
import InventoryIcon from '@mui/icons-material/Inventory'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BlockIcon from '@mui/icons-material/Block'
import UpgradeIcon from '@mui/icons-material/Upgrade'
import ShieldIcon from '@mui/icons-material/Shield'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import GroupIcon from '@mui/icons-material/Group'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import DnsIcon from '@mui/icons-material/Dns'
import MemoryIcon from '@mui/icons-material/Memory'
import StopIcon from '@mui/icons-material/Stop'
import SortIcon from '@mui/icons-material/Sort'

const MachineSystem = ({ machine, machineId }) => {
    const [tabValue, setTabValue] = useState(0)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [packages, setPackages] = useState([])
    const [firewallStatus, setFirewallStatus] = useState({ enabled: false, rules: [] })
    const [users, setUsers] = useState([])
    const [systemInfo, setSystemInfo] = useState(null)
    const [installDialog, setInstallDialog] = useState({ open: false, packageName: '', installing: false })
    const [upgradeDialog, setUpgradeDialog] = useState({ open: false, upgrading: false, output: '' })
    const [newRuleDialog, setNewRuleDialog] = useState({ open: false, port: '', action: 'allow', protocol: 'tcp' })
    const [newUserDialog, setNewUserDialog] = useState({ open: false, username: '', password: '', groups: '', shell: '/bin/bash' })
    const [hostnameDialog, setHostnameDialog] = useState({ open: false, hostname: '' })
    const [processes, setProcesses] = useState([])
    const [processSort, setProcessSort] = useState({ field: 'cpu', order: 'desc' })
    const [processSearch, setProcessSearch] = useState('')
    const [loadingProcesses, setLoadingProcesses] = useState(false)
    const abortControllerRef = useRef(null)
    const isMountedRef = useRef(true)

    // Load processes
    const loadProcesses = useCallback(async () => {
        setLoadingProcesses(true)
        try {
            const res = await fetch(`/api/machines/${machineId}/processes`)
            const data = await res.json()
            if (isMountedRef.current) {
                setProcesses(data.processes || [])
            }
        } catch (err) {
            console.error('Failed to load processes:', err)
        }
        setLoadingProcesses(false)
    }, [machineId])

    // Kill process
    const killProcess = async (pid, signal = 'TERM') => {
        if (!window.confirm(`Kill process ${pid} with signal ${signal}?`)) return
        try {
            await fetch(`/api/machines/${machineId}/processes/${pid}/kill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signal })
            })
            loadProcesses()
        } catch (err) {
            console.error('Failed to kill process:', err)
        }
    }

    // Sorted and filtered processes
    const sortedProcesses = [...processes]
        .filter(p => !processSearch || 
            p.name?.toLowerCase().includes(processSearch.toLowerCase()) ||
            p.command?.toLowerCase().includes(processSearch.toLowerCase()) ||
            String(p.pid).includes(processSearch)
        )
        .sort((a, b) => {
            const aVal = a[processSort.field] || 0
            const bVal = b[processSort.field] || 0
            return processSort.order === 'desc' ? bVal - aVal : aVal - bVal
        })
        .slice(0, 50)

    const loadData = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal
        
        setLoading(true)
        try {
            const [packagesRes, firewallRes, usersRes, systemRes] = await Promise.all([
                fetch(`/api/machines/${machineId}/packages`, { signal }),
                fetch(`/api/machines/${machineId}/firewall`, { signal }),
                fetch(`/api/machines/${machineId}/users`, { signal }),
                fetch(`/api/machines/${machineId}/system`, { signal })
            ])
            const [packagesData, firewallData, usersData, systemData] = await Promise.all([
                packagesRes.json(), firewallRes.json(), usersRes.json(), systemRes.json()
            ])
            if (isMountedRef.current) {
                setPackages(packagesData.packages || [])
                setFirewallStatus(firewallData)
                setUsers(usersData.users || [])
                setSystemInfo(systemData)
                setLoading(false)
            }
        } catch (err) {
            if (err.name !== 'AbortError' && isMountedRef.current) {
                console.error('Failed to load system data:', err)
                setLoading(false)
            }
        }
    }, [machineId])

    useEffect(() => {
        isMountedRef.current = true
        loadData()
        return () => {
            isMountedRef.current = false
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [loadData])

    const handleInstallPackage = async () => {
        if (!installDialog.packageName.trim()) return
        setInstallDialog(prev => ({ ...prev, installing: true }))
        try {
            await fetch(`/api/machines/${machineId}/packages/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packages: installDialog.packageName.split(/\s+/) })
            })
            setInstallDialog({ open: false, packageName: '', installing: false })
            loadData()
        } catch (err) {
            setInstallDialog(prev => ({ ...prev, installing: false }))
        }
    }

    const handleRemovePackage = async (packageName) => {
        if (!window.confirm(`Remove package "${packageName}"?`)) return
        try {
            await fetch(`/api/machines/${machineId}/packages/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packages: [packageName] })
            })
            loadData()
        } catch (err) { console.error('Remove failed:', err) }
    }

    const handleUpgradeAll = async () => {
        setUpgradeDialog({ open: true, upgrading: true, output: 'Updating package lists...' })
        try {
            const res = await fetch(`/api/machines/${machineId}/packages/upgrade`, { method: 'POST' })
            const data = await res.json()
            setUpgradeDialog(prev => ({ ...prev, upgrading: false, output: data.output || 'Upgrade complete!' }))
            loadData()
        } catch (err) {
            setUpgradeDialog(prev => ({ ...prev, upgrading: false, output: 'Upgrade failed: ' + err.message }))
        }
    }

    const handleToggleFirewall = async () => {
        try {
            await fetch(`/api/machines/${machineId}/firewall/${firewallStatus.enabled ? 'disable' : 'enable'}`, { method: 'POST' })
            loadData()
        } catch (err) { console.error('Firewall toggle failed:', err) }
    }

    const handleAddRule = async () => {
        if (!newRuleDialog.port.trim()) return
        try {
            await fetch(`/api/machines/${machineId}/firewall/rule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port: newRuleDialog.port, action: newRuleDialog.action, protocol: newRuleDialog.protocol })
            })
            setNewRuleDialog({ open: false, port: '', action: 'allow', protocol: 'tcp' })
            loadData()
        } catch (err) { console.error('Add rule failed:', err) }
    }

    const handleDeleteRule = async (rule) => {
        if (!window.confirm(`Delete rule for port ${rule.port}?`)) return
        try {
            await fetch(`/api/machines/${machineId}/firewall/rule`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port: rule.port, action: rule.action })
            })
            loadData()
        } catch (err) { console.error('Delete rule failed:', err) }
    }

    const handleAddUser = async () => {
        if (!newUserDialog.username.trim()) return
        try {
            await fetch(`/api/machines/${machineId}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUserDialog.username, password: newUserDialog.password, groups: newUserDialog.groups, shell: newUserDialog.shell })
            })
            setNewUserDialog({ open: false, username: '', password: '', groups: '', shell: '/bin/bash' })
            loadData()
        } catch (err) { console.error('Add user failed:', err) }
    }

    const handleDeleteUser = async (username) => {
        if (!window.confirm(`Delete user "${username}"?`)) return
        try {
            await fetch(`/api/machines/${machineId}/users/${username}`, { method: 'DELETE' })
            loadData()
        } catch (err) { console.error('Delete user failed:', err) }
    }

    const handleSetHostname = async () => {
        if (!hostnameDialog.hostname.trim()) return
        try {
            await fetch(`/api/machines/${machineId}/hostname`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostname: hostnameDialog.hostname })
            })
            setHostnameDialog({ open: false, hostname: '' })
            loadData()
        } catch (err) { console.error('Set hostname failed:', err) }
    }

    const handleReboot = async () => {
        if (!window.confirm('Reboot this machine?')) return
        try { await fetch(`/api/machines/${machineId}/reboot`, { method: 'POST' }) } catch (err) { console.error('Reboot failed:', err) }
    }

    const handleShutdown = async () => {
        if (!window.confirm('Shutdown this machine?')) return
        try { await fetch(`/api/machines/${machineId}/shutdown`, { method: 'POST' }) } catch (err) { console.error('Shutdown failed:', err) }
    }

    const filteredPackages = packages.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()))

    return (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Tabs value={tabValue} onChange={(e, v) => { setTabValue(v); if (v === 4) loadProcesses(); }} sx={{ mb: 3 }}>
                <Tab label="Packages" icon={<InventoryIcon />} iconPosition="start" />
                <Tab label="Firewall" icon={<SecurityIcon />} iconPosition="start" />
                <Tab label="Users" icon={<PersonIcon />} iconPosition="start" />
                <Tab label="System" icon={<DnsIcon />} iconPosition="start" />
                <Tab label="Processes" icon={<MemoryIcon />} iconPosition="start" />
            </Tabs>

            {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box> : (
                <>
                    {tabValue === 0 && (
                        <Box>
                            <Paper sx={{ p: 2, mb: 3 }}>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <TextField size="small" placeholder="Search packages..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} /></InputAdornment> }} sx={{ minWidth: 250 }} />
                                    <Box sx={{ flex: 1 }} />
                                    <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setInstallDialog({ open: true, packageName: '', installing: false })} size="small">Install</Button>
                                    <Button startIcon={<UpgradeIcon />} variant="contained" onClick={handleUpgradeAll} size="small">Upgrade All</Button>
                                    <IconButton onClick={loadData} size="small"><RefreshIcon sx={{ color: '#f97316' }} /></IconButton>
                                </Box>
                            </Paper>
                            <Paper sx={{ overflow: 'hidden' }}>
                                <Table size="small">
                                    <TableHead><TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}><TableCell sx={{ fontWeight: 600 }}>Package</TableCell><TableCell sx={{ fontWeight: 600 }}>Version</TableCell><TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {filteredPackages.slice(0, 100).map(pkg => (
                                            <TableRow key={pkg.name} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                                <TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{pkg.name}</Typography></TableCell>
                                                <TableCell><Typography variant="body2" color="text.secondary">{pkg.version}</Typography></TableCell>
                                                <TableCell><Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Tooltip title="Remove"><IconButton size="small" onClick={() => handleRemovePackage(pkg.name)}><DeleteIcon sx={{ fontSize: 18, color: '#ff3366' }} /></IconButton></Tooltip></Box></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {filteredPackages.length > 100 && <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">Showing 100 of {filteredPackages.length} packages</Typography></Box>}
                            </Paper>
                        </Box>
                    )}

                    {tabValue === 1 && (
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={4}>
                                <Card sx={{ background: firewallStatus.enabled ? 'linear-gradient(135deg, rgba(0,255,136,0.1) 0%, rgba(0,212,255,0.05) 100%)' : 'linear-gradient(135deg, rgba(255,51,102,0.1) 0%, rgba(255,170,0,0.05) 100%)' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <ShieldIcon sx={{ fontSize: 40, color: firewallStatus.enabled ? '#22c55e' : '#ff3366' }} />
                                                <Box>
                                                    <Typography variant="h6">Firewall</Typography>
                                                    <Typography variant="body2" color="text.secondary">{firewallStatus.enabled ? 'Active' : 'Disabled'}</Typography>
                                                </Box>
                                            </Box>
                                            <Switch checked={firewallStatus.enabled} onChange={handleToggleFirewall} color="success" />
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={8}>
                                <Card>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="h6">Firewall Rules</Typography>
                                            <Button startIcon={<AddIcon />} size="small" onClick={() => setNewRuleDialog({ open: true, port: '', action: 'allow', protocol: 'tcp' })}>Add Rule</Button>
                                        </Box>
                                        {firewallStatus.rules?.length > 0 ? (
                                            <Table size="small">
                                                <TableHead><TableRow><TableCell>Port</TableCell><TableCell>Action</TableCell><TableCell>Protocol</TableCell><TableCell></TableCell></TableRow></TableHead>
                                                <TableBody>
                                                    {firewallStatus.rules.map((rule, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell sx={{ fontFamily: 'monospace' }}>{rule.port}</TableCell>
                                                            <TableCell><Chip label={rule.action} size="small" color={rule.action === 'allow' ? 'success' : 'error'} icon={rule.action === 'allow' ? <CheckCircleIcon /> : <BlockIcon />} /></TableCell>
                                                            <TableCell>{rule.protocol || 'tcp'}</TableCell>
                                                            <TableCell><IconButton size="small" onClick={() => handleDeleteRule(rule)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        ) : <Typography variant="body2" color="text.secondary">No rules configured</Typography>}
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}

                    {tabValue === 2 && (
                        <Box>
                            <Paper sx={{ p: 2, mb: 3 }}>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}><GroupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />System Users</Typography>
                                    <Box sx={{ flex: 1 }} />
                                    <Button startIcon={<PersonAddIcon />} variant="contained" onClick={() => setNewUserDialog({ open: true, username: '', password: '', groups: '', shell: '/bin/bash' })}>Add User</Button>
                                </Box>
                            </Paper>
                            <Paper sx={{ overflow: 'hidden' }}>
                                <Table size="small">
                                    <TableHead><TableRow sx={{ bgcolor: 'rgba(0,212,255,0.05)' }}><TableCell sx={{ fontWeight: 600 }}>Username</TableCell><TableCell sx={{ fontWeight: 600 }}>UID</TableCell><TableCell sx={{ fontWeight: 600 }}>Groups</TableCell><TableCell sx={{ fontWeight: 600 }}>Shell</TableCell><TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {users.map(user => (
                                            <TableRow key={user.username} sx={{ '&:hover': { bgcolor: 'rgba(0,212,255,0.03)' } }}>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {user.uid === 0 ? <AdminPanelSettingsIcon sx={{ color: '#ff3366', fontSize: 18 }} /> : <PersonIcon sx={{ color: '#f97316', fontSize: 18 }} />}
                                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{user.username}</Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>{user.uid}</TableCell>
                                                <TableCell><Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.groups || '-'}</Typography></TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{user.shell}</TableCell>
                                                <TableCell><Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Tooltip title="Delete"><IconButton size="small" onClick={() => handleDeleteUser(user.username)} disabled={user.uid === 0}><DeleteIcon sx={{ fontSize: 18, color: user.uid === 0 ? 'grey' : '#ff3366' }} /></IconButton></Tooltip></Box></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Paper>
                        </Box>
                    )}

                    {tabValue === 3 && systemInfo && (
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ mb: 2 }}>System Information</Typography>
                                        <Table size="small">
                                            <TableBody>
                                                <TableRow><TableCell sx={{ fontWeight: 600, border: 0 }}>Hostname</TableCell><TableCell sx={{ border: 0 }}>{systemInfo.hostname}</TableCell></TableRow>
                                                <TableRow><TableCell sx={{ fontWeight: 600, border: 0 }}>OS</TableCell><TableCell sx={{ border: 0 }}>{systemInfo.os}</TableCell></TableRow>
                                                <TableRow><TableCell sx={{ fontWeight: 600, border: 0 }}>Kernel</TableCell><TableCell sx={{ border: 0 }}>{systemInfo.kernel}</TableCell></TableRow>
                                                <TableRow><TableCell sx={{ fontWeight: 600, border: 0 }}>Uptime</TableCell><TableCell sx={{ border: 0 }}>{systemInfo.uptime}</TableCell></TableRow>
                                                <TableRow><TableCell sx={{ fontWeight: 600, border: 0 }}>Architecture</TableCell><TableCell sx={{ border: 0 }}>{systemInfo.arch}</TableCell></TableRow>
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ mb: 2 }}>System Actions</Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <Button variant="outlined" startIcon={<DnsIcon />} onClick={() => setHostnameDialog({ open: true, hostname: systemInfo.hostname })}>Change Hostname</Button>
                                            <Button variant="outlined" color="warning" startIcon={<RestartAltIcon />} onClick={handleReboot}>Reboot System</Button>
                                            <Button variant="outlined" color="error" startIcon={<PowerSettingsNewIcon />} onClick={handleShutdown}>Shutdown System</Button>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}

                    {tabValue === 4 && (
                        <Box>
                            <Paper sx={{ p: 2, mb: 3 }}>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                        Running Processes
                                    </Typography>
                                    <TextField
                                        size="small"
                                        placeholder="Search processes..."
                                        value={processSearch}
                                        onChange={(e) => setProcessSearch(e.target.value)}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} /></InputAdornment>
                                        }}
                                        sx={{ minWidth: 200 }}
                                    />
                                    <Box sx={{ flex: 1 }} />
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Chip
                                            label="CPU"
                                            onClick={() => setProcessSort({ field: 'cpu', order: processSort.field === 'cpu' && processSort.order === 'desc' ? 'asc' : 'desc' })}
                                            color={processSort.field === 'cpu' ? 'primary' : 'default'}
                                            size="small"
                                            icon={<SortIcon />}
                                        />
                                        <Chip
                                            label="Memory"
                                            onClick={() => setProcessSort({ field: 'mem', order: processSort.field === 'mem' && processSort.order === 'desc' ? 'asc' : 'desc' })}
                                            color={processSort.field === 'mem' ? 'primary' : 'default'}
                                            size="small"
                                            icon={<SortIcon />}
                                        />
                                        <Chip
                                            label="PID"
                                            onClick={() => setProcessSort({ field: 'pid', order: processSort.field === 'pid' && processSort.order === 'desc' ? 'asc' : 'desc' })}
                                            color={processSort.field === 'pid' ? 'primary' : 'default'}
                                            size="small"
                                            icon={<SortIcon />}
                                        />
                                    </Box>
                                    <IconButton onClick={loadProcesses} disabled={loadingProcesses}>
                                        <RefreshIcon />
                                    </IconButton>
                                </Box>
                            </Paper>
                            
                            {loadingProcesses ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <Paper sx={{ overflow: 'hidden' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'rgba(139, 92, 246, 0.1)' }}>
                                                <TableCell sx={{ fontWeight: 600, width: 80 }}>PID</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                                <TableCell sx={{ fontWeight: 600, width: 100 }}>User</TableCell>
                                                <TableCell sx={{ fontWeight: 600, width: 80, textAlign: 'right' }}>CPU %</TableCell>
                                                <TableCell sx={{ fontWeight: 600, width: 80, textAlign: 'right' }}>MEM %</TableCell>
                                                <TableCell sx={{ fontWeight: 600, width: 60 }}></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {sortedProcesses.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                                                        {processes.length === 0 ? 'Click refresh to load processes' : 'No matching processes'}
                                                    </TableCell>
                                                </TableRow>
                                            ) : sortedProcesses.map(proc => (
                                                <TableRow key={proc.pid} sx={{ '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.05)' } }}>
                                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{proc.pid}</TableCell>
                                                    <TableCell>
                                                        <Tooltip title={proc.command || proc.name}>
                                                            <Typography sx={{ 
                                                                fontSize: '0.85rem', 
                                                                maxWidth: 300, 
                                                                overflow: 'hidden', 
                                                                textOverflow: 'ellipsis', 
                                                                whiteSpace: 'nowrap' 
                                                            }}>
                                                                {proc.name}
                                                            </Typography>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{proc.user}</TableCell>
                                                    <TableCell sx={{ textAlign: 'right' }}>
                                                        <Chip
                                                            label={`${(proc.cpu || 0).toFixed(1)}%`}
                                                            size="small"
                                                            sx={{
                                                                minWidth: 55,
                                                                bgcolor: proc.cpu > 50 ? 'rgba(239, 68, 68, 0.2)' : proc.cpu > 20 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                                                color: proc.cpu > 50 ? '#ef4444' : proc.cpu > 20 ? '#eab308' : '#22c55e',
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ textAlign: 'right' }}>
                                                        <Chip
                                                            label={`${(proc.mem || 0).toFixed(1)}%`}
                                                            size="small"
                                                            sx={{
                                                                minWidth: 55,
                                                                bgcolor: proc.mem > 50 ? 'rgba(239, 68, 68, 0.2)' : proc.mem > 20 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                                                                color: proc.mem > 50 ? '#ef4444' : proc.mem > 20 ? '#eab308' : '#8b5cf6',
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip title="Kill Process">
                                                            <IconButton 
                                                                size="small" 
                                                                onClick={() => killProcess(proc.pid)}
                                                                sx={{ color: '#ef4444' }}
                                                            >
                                                                <StopIcon sx={{ fontSize: 18 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {sortedProcesses.length > 0 && (
                                        <Box sx={{ p: 1, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Showing top {sortedProcesses.length} of {processes.length} processes (sorted by {processSort.field} {processSort.order})
                                            </Typography>
                                        </Box>
                                    )}
                                </Paper>
                            )}
                        </Box>
                    )}
                </>
            )}

            {/* Dialogs */}
            <Dialog open={installDialog.open} onClose={() => !installDialog.installing && setInstallDialog({ open: false, packageName: '', installing: false })}>
                <DialogTitle>Install Package</DialogTitle>
                <DialogContent><TextField autoFocus fullWidth label="Package Name(s)" value={installDialog.packageName} onChange={(e) => setInstallDialog(prev => ({ ...prev, packageName: e.target.value }))} placeholder="e.g., nginx htop vim" helperText="Separate multiple packages with spaces" sx={{ mt: 1 }} disabled={installDialog.installing} /></DialogContent>
                <DialogActions><Button onClick={() => setInstallDialog({ open: false, packageName: '', installing: false })} disabled={installDialog.installing}>Cancel</Button><Button variant="contained" onClick={handleInstallPackage} disabled={installDialog.installing}>{installDialog.installing ? <CircularProgress size={20} /> : 'Install'}</Button></DialogActions>
            </Dialog>

            <Dialog open={upgradeDialog.open} onClose={() => !upgradeDialog.upgrading && setUpgradeDialog({ open: false, upgrading: false, output: '' })}>
                <DialogTitle>System Upgrade</DialogTitle>
                <DialogContent sx={{ minWidth: 400 }}>{upgradeDialog.upgrading && <LinearProgress sx={{ mb: 2 }} />}<Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#e0f7ff' }}>{upgradeDialog.output}</Box></DialogContent>
                <DialogActions><Button onClick={() => setUpgradeDialog({ open: false, upgrading: false, output: '' })} disabled={upgradeDialog.upgrading}>Close</Button></DialogActions>
            </Dialog>

            <Dialog open={newRuleDialog.open} onClose={() => setNewRuleDialog({ open: false, port: '', action: 'allow', protocol: 'tcp' })}>
                <DialogTitle>Add Firewall Rule</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField label="Port" value={newRuleDialog.port} onChange={(e) => setNewRuleDialog(prev => ({ ...prev, port: e.target.value }))} placeholder="e.g., 80, 443" />
                        <FormControl><InputLabel>Action</InputLabel><Select value={newRuleDialog.action} onChange={(e) => setNewRuleDialog(prev => ({ ...prev, action: e.target.value }))} label="Action"><MenuItem value="allow">Allow</MenuItem><MenuItem value="deny">Deny</MenuItem></Select></FormControl>
                        <FormControl><InputLabel>Protocol</InputLabel><Select value={newRuleDialog.protocol} onChange={(e) => setNewRuleDialog(prev => ({ ...prev, protocol: e.target.value }))} label="Protocol"><MenuItem value="tcp">TCP</MenuItem><MenuItem value="udp">UDP</MenuItem><MenuItem value="both">Both</MenuItem></Select></FormControl>
                    </Box>
                </DialogContent>
                <DialogActions><Button onClick={() => setNewRuleDialog({ open: false, port: '', action: 'allow', protocol: 'tcp' })}>Cancel</Button><Button variant="contained" onClick={handleAddRule}>Add Rule</Button></DialogActions>
            </Dialog>

            <Dialog open={newUserDialog.open} onClose={() => setNewUserDialog({ open: false, username: '', password: '', groups: '', shell: '/bin/bash' })}>
                <DialogTitle>Add User</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 350 }}>
                        <TextField label="Username" value={newUserDialog.username} onChange={(e) => setNewUserDialog(prev => ({ ...prev, username: e.target.value }))} />
                        <TextField label="Password" type="password" value={newUserDialog.password} onChange={(e) => setNewUserDialog(prev => ({ ...prev, password: e.target.value }))} />
                        <TextField label="Groups" value={newUserDialog.groups} onChange={(e) => setNewUserDialog(prev => ({ ...prev, groups: e.target.value }))} placeholder="e.g., sudo,docker" helperText="Comma-separated" />
                        <TextField label="Shell" value={newUserDialog.shell} onChange={(e) => setNewUserDialog(prev => ({ ...prev, shell: e.target.value }))} />
                    </Box>
                </DialogContent>
                <DialogActions><Button onClick={() => setNewUserDialog({ open: false, username: '', password: '', groups: '', shell: '/bin/bash' })}>Cancel</Button><Button variant="contained" onClick={handleAddUser}>Create User</Button></DialogActions>
            </Dialog>

            <Dialog open={hostnameDialog.open} onClose={() => setHostnameDialog({ open: false, hostname: '' })}>
                <DialogTitle>Change Hostname</DialogTitle>
                <DialogContent><TextField autoFocus fullWidth label="New Hostname" value={hostnameDialog.hostname} onChange={(e) => setHostnameDialog(prev => ({ ...prev, hostname: e.target.value }))} sx={{ mt: 1 }} /></DialogContent>
                <DialogActions><Button onClick={() => setHostnameDialog({ open: false, hostname: '' })}>Cancel</Button><Button variant="contained" onClick={handleSetHostname}>Change</Button></DialogActions>
            </Dialog>
        </Box>
    )
}

export default MachineSystem
