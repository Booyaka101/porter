import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'

import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'
import RouteIcon from '@mui/icons-material/Route'
import RadarIcon from '@mui/icons-material/Radar'
import DnsIcon from '@mui/icons-material/Dns'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import HistoryIcon from '@mui/icons-material/History'

import { colors } from './theme'

// Mini chart for ping history
const PingChart = ({ data, height = 40 }) => {
    if (!data || data.length < 2) return null
    
    const validData = data.filter(d => d !== null && d !== undefined)
    if (validData.length < 2) return null
    
    const max = Math.max(...validData, 100)
    const min = 0
    
    return (
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height }}>
            {data.slice(-30).map((val, i) => {
                const isTimeout = val === null || val === undefined
                const barHeight = isTimeout ? height : Math.max(4, (val / max) * height)
                const color = isTimeout ? colors.error : val < 50 ? colors.secondary : val < 150 ? colors.warning : colors.error
                return (
                    <Tooltip key={i} title={isTimeout ? 'Timeout' : `${val}ms`}>
                        <Box sx={{
                            width: 6,
                            height: barHeight,
                            background: color,
                            borderRadius: '2px',
                            opacity: isTimeout ? 0.5 : 0.8,
                            transition: 'height 0.2s ease',
                        }} />
                    </Tooltip>
                )
            })}
        </Box>
    )
}

const NetworkTools = () => {
    const { id: routeId } = useParams()
    const [machines, setMachines] = useState([])
    const [selectedMachine, setSelectedMachine] = useState(routeId || '')
    const [tab, setTab] = useState(0)
    const [target, setTarget] = useState('')
    const [ports, setPorts] = useState('22,80,443,3306,5432,8080')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [savedTargets, setSavedTargets] = useState([])
    const [continuousPing, setContinuousPing] = useState(false)
    const [pingHistory, setPingHistory] = useState([])
    const [pingStats, setPingStats] = useState({ sent: 0, received: 0, min: null, max: null, avg: null })
    const pingIntervalRef = useRef(null)

    // Load saved targets from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('networkToolsSavedTargets')
        if (saved) {
            try {
                setSavedTargets(JSON.parse(saved))
            } catch (e) {}
        }
    }, [])

    // Save targets to localStorage
    const saveTarget = () => {
        if (!target) return
        const newTargets = [...savedTargets.filter(t => t !== target), target].slice(-10)
        setSavedTargets(newTargets)
        localStorage.setItem('networkToolsSavedTargets', JSON.stringify(newTargets))
    }

    const removeTarget = (t) => {
        const newTargets = savedTargets.filter(x => x !== t)
        setSavedTargets(newTargets)
        localStorage.setItem('networkToolsSavedTargets', JSON.stringify(newTargets))
    }

    // Continuous ping
    const startContinuousPing = useCallback(() => {
        if (!target || !selectedMachine) return
        setContinuousPing(true)
        setPingHistory([])
        setPingStats({ sent: 0, received: 0, min: null, max: null, avg: null })
        
        const doPing = async () => {
            try {
                const res = await fetch(`/api/machines/${selectedMachine}/network/ping`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target, count: 1 })
                })
                const data = await res.json()
                
                // Parse ping time from output
                const match = data.output?.match(/time[=<](\d+\.?\d*)\s*ms/i)
                const pingTime = match ? parseFloat(match[1]) : null
                const isSuccess = data.output?.includes('1 received') || data.output?.includes('1 packets received')
                
                setPingHistory(prev => [...prev.slice(-59), pingTime])
                setPingStats(prev => {
                    const newSent = prev.sent + 1
                    const newReceived = isSuccess ? prev.received + 1 : prev.received
                    const validPings = [...(pingTime ? [pingTime] : []), ...(prev.min !== null ? [prev.min, prev.max] : [])]
                    return {
                        sent: newSent,
                        received: newReceived,
                        min: validPings.length > 0 ? Math.min(...validPings) : null,
                        max: validPings.length > 0 ? Math.max(...validPings) : null,
                        avg: pingTime && prev.avg ? ((prev.avg * (newReceived - 1) + pingTime) / newReceived) : pingTime || prev.avg,
                    }
                })
            } catch (err) {
                setPingHistory(prev => [...prev.slice(-59), null])
                setPingStats(prev => ({ ...prev, sent: prev.sent + 1 }))
            }
        }
        
        doPing()
        pingIntervalRef.current = setInterval(doPing, 2000)
    }, [target, selectedMachine])

    const stopContinuousPing = useCallback(() => {
        setContinuousPing(false)
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
        }
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current)
            }
        }
    }, [])

    useEffect(() => {
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => {
                setMachines(data || [])
                if (!routeId && data?.length > 0) {
                    setSelectedMachine(data[0].id)
                }
            })
            .catch(err => setError(err.message))
    }, [])

    const runPing = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/network/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, count: 4 })
            })
            const data = await res.json()
            setResult(data)
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    const runTraceroute = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/network/traceroute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target })
            })
            const data = await res.json()
            setResult(data)
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    const runPortScan = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/network/portscan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, ports })
            })
            const data = await res.json()
            setResult(data)
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    const runDNS = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/machines/${selectedMachine}/network/dns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: target, type: 'A' })
            })
            const data = await res.json()
            setResult(data)
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    const handleRun = () => {
        switch (tab) {
            case 0: runPing(); break
            case 1: runTraceroute(); break
            case 2: runPortScan(); break
            case 3: runDNS(); break
        }
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 3,
                p: 3,
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderRadius: '16px',
                border: '1px solid rgba(236, 72, 153, 0.2)',
            }}>
                <Box>
                    <Typography variant="h5" sx={{ color: colors.text.primary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <NetworkCheckIcon sx={{ color: '#ec4899' }} />
                        Network Tools
                    </Typography>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.9rem', mt: 0.5 }}>
                        Ping, traceroute, port scan, and DNS lookup
                    </Typography>
                </Box>
            </Box>

            {/* Saved Targets */}
            {savedTargets.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography sx={{ color: colors.text.muted, fontSize: '0.85rem', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <BookmarkIcon sx={{ fontSize: 16 }} />
                        Saved Targets
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {savedTargets.map(t => (
                            <Chip
                                key={t}
                                label={t}
                                onClick={() => setTarget(t)}
                                onDelete={() => removeTarget(t)}
                                sx={{
                                    background: target === t ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255,255,255,0.05)',
                                    color: target === t ? '#ec4899' : colors.text.secondary,
                                    border: `1px solid ${target === t ? 'rgba(236, 72, 153, 0.4)' : colors.border.light}`,
                                    '&:hover': { background: 'rgba(236, 72, 153, 0.15)' },
                                }}
                            />
                        ))}
                    </Box>
                </Box>
            )}

            <Paper sx={{ background: colors.background.card, border: `1px solid ${colors.border.light}`, mb: 3, borderRadius: '12px', overflow: 'hidden' }}>
                <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border.light}`, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        select
                        label="Run from Machine"
                        value={selectedMachine}
                        onChange={(e) => setSelectedMachine(e.target.value)}
                        size="small"
                        sx={{ minWidth: 250 }}
                    >
                        {machines.map(m => (
                            <MenuItem key={m.id} value={m.id}>{m.name} ({m.ip})</MenuItem>
                        ))}
                    </TextField>
                </Box>
                <Tabs value={tab} onChange={(e, v) => { setTab(v); setResult(null); }} sx={{
                    borderBottom: `1px solid ${colors.border.light}`,
                    '& .MuiTab-root': { color: colors.text.muted, textTransform: 'none' },
                    '& .Mui-selected': { color: colors.primary },
                    '& .MuiTabs-indicator': { background: colors.primary }
                }}>
                    <Tab icon={<NetworkCheckIcon />} label="Ping" iconPosition="start" />
                    <Tab icon={<RouteIcon />} label="Traceroute" iconPosition="start" />
                    <Tab icon={<RadarIcon />} label="Port Scan" iconPosition="start" />
                    <Tab icon={<DnsIcon />} label="DNS Lookup" iconPosition="start" />
                </Tabs>

                <Box sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                        <TextField
                            label={tab === 3 ? "Domain" : "Target Host/IP"}
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            fullWidth
                            size="small"
                            placeholder={tab === 3 ? "example.com" : "192.168.1.1 or google.com"}
                            sx={{ '& .MuiOutlinedInput-root': { background: colors.background.dark } }}
                        />
                        <Tooltip title={savedTargets.includes(target) ? "Already saved" : "Save target"}>
                            <IconButton 
                                onClick={saveTarget}
                                disabled={!target || savedTargets.includes(target)}
                                sx={{ color: savedTargets.includes(target) ? '#ec4899' : colors.text.muted }}
                            >
                                {savedTargets.includes(target) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                            </IconButton>
                        </Tooltip>
                        {tab === 2 && (
                            <TextField
                                label="Ports"
                                value={ports}
                                onChange={(e) => setPorts(e.target.value)}
                                size="small"
                                placeholder="22,80,443"
                                sx={{ width: 200, '& .MuiOutlinedInput-root': { background: colors.background.dark } }}
                            />
                        )}
                        <Button
                            variant="contained"
                            onClick={handleRun}
                            disabled={loading || !target || !selectedMachine || continuousPing}
                            sx={{ 
                                background: colors.primary,
                                minWidth: 100,
                                '&:hover': { background: colors.primaryHover }
                            }}
                        >
                            {loading ? <CircularProgress size={20} /> : 'Run'}
                        </Button>
                        {tab === 0 && (
                            <Button
                                variant="contained"
                                onClick={continuousPing ? stopContinuousPing : startContinuousPing}
                                disabled={!target || !selectedMachine}
                                startIcon={continuousPing ? <StopIcon /> : <PlayArrowIcon />}
                                sx={{ 
                                    background: continuousPing ? colors.error : colors.secondary,
                                    minWidth: 140,
                                    '&:hover': { background: continuousPing ? '#dc2626' : '#16a34a' }
                                }}
                            >
                                {continuousPing ? 'Stop' : 'Continuous'}
                            </Button>
                        )}
                    </Box>

                    {/* Continuous Ping Monitor */}
                    {tab === 0 && continuousPing && (
                        <Card sx={{ 
                            mb: 3, 
                            background: 'rgba(34, 197, 94, 0.05)', 
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: '12px',
                        }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography sx={{ color: colors.secondary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ 
                                            width: 8, 
                                            height: 8, 
                                            borderRadius: '50%', 
                                            background: colors.secondary,
                                            animation: 'pulse 1s infinite',
                                            '@keyframes pulse': {
                                                '0%, 100%': { opacity: 1 },
                                                '50%': { opacity: 0.5 },
                                            }
                                        }} />
                                        Pinging {target}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 3 }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>SENT</Typography>
                                            <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>{pingStats.sent}</Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>RECV</Typography>
                                            <Typography sx={{ color: colors.secondary, fontWeight: 600 }}>{pingStats.received}</Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>LOSS</Typography>
                                            <Typography sx={{ 
                                                color: pingStats.sent > 0 && pingStats.received < pingStats.sent ? colors.error : colors.text.primary, 
                                                fontWeight: 600 
                                            }}>
                                                {pingStats.sent > 0 ? Math.round((1 - pingStats.received / pingStats.sent) * 100) : 0}%
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>MIN</Typography>
                                            <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>{pingStats.min?.toFixed(1) || '-'}ms</Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>AVG</Typography>
                                            <Typography sx={{ color: colors.primary, fontWeight: 600 }}>{pingStats.avg?.toFixed(1) || '-'}ms</Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: colors.text.muted, fontSize: '0.7rem' }}>MAX</Typography>
                                            <Typography sx={{ color: colors.text.primary, fontWeight: 600 }}>{pingStats.max?.toFixed(1) || '-'}ms</Typography>
                                        </Box>
                                    </Box>
                                </Box>
                                <PingChart data={pingHistory} height={50} />
                            </CardContent>
                        </Card>
                    )}

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    {result && (
                        <Box>
                            {tab === 2 && result.results ? (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ color: colors.text.muted }}>Port</TableCell>
                                            <TableCell sx={{ color: colors.text.muted }}>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {result.results.map((r, i) => (
                                            <TableRow key={i}>
                                                <TableCell sx={{ color: colors.text.primary }}>{r.port}</TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={r.status} 
                                                        size="small"
                                                        color={r.status === 'open' ? 'success' : 'default'}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <Box sx={{ 
                                    background: colors.background.dark, 
                                    borderRadius: 1, 
                                    p: 2,
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                    color: colors.text.secondary,
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: 400,
                                    overflow: 'auto'
                                }}>
                                    {result.output || 'No output'}
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            </Paper>
        </Box>
    )
}

export default NetworkTools
