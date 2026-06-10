import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SettingsIcon from '@mui/icons-material/Settings'

const Execute = () => {
    const [machines, setMachines] = useState([])
    const [scripts, setScripts] = useState([])
    const [selectedMachines, setSelectedMachines] = useState([])
    const [selectedScript, setSelectedScript] = useState('')
    const [selectedFlags, setSelectedFlags] = useState({})
    const [flagValues, setFlagValues] = useState({})
    const [executing, setExecuting] = useState(false)
    const [results, setResults] = useState([])

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [machinesRes, scriptsRes] = await Promise.all([
                fetch('/api/machines'),
                fetch('/api/scripts')
            ])
            const machinesData = await machinesRes.json()
            const scriptsData = await scriptsRes.json()
            setMachines(machinesData || [])
            setScripts((scriptsData || []).filter(s => s.is_top_level))
        } catch (err) {
            console.error('Failed to load data:', err)
        }
    }

    const currentScript = scripts.find(s => s.path === selectedScript)

    const handleMachineToggle = (id) => {
        setSelectedMachines(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        )
    }

    const handleFlagToggle = (flag) => {
        setSelectedFlags(prev => ({ ...prev, [flag]: !prev[flag] }))
    }

    const handleFlagValueChange = (flag, value) => {
        setFlagValues(prev => ({ ...prev, [flag]: value }))
    }

    const handleExecute = async () => {
        if (selectedMachines.length === 0 || !selectedScript) {
            alert('Please select machines and a script')
            return
        }

        setExecuting(true)
        setResults([])

        const flags = {}
        Object.entries(selectedFlags).forEach(([flag, enabled]) => {
            if (enabled) {
                const scriptFlag = currentScript?.flags?.find(f => (f.long || f.short) === flag)
                if (scriptFlag?.has_value) {
                    flags[flag] = flagValues[flag] || ''
                } else {
                    flags[flag] = 'true'
                }
            }
        })

        try {
            const res = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_ids: selectedMachines,
                    script_path: selectedScript,
                    flags
                })
            })
            const data = await res.json()
            setResults(data || [])
        } catch (err) {
            console.error('Execution failed:', err)
            alert('Execution failed: ' + err.message)
        } finally {
            setExecuting(false)
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return 'success'
            case 'offline': return 'error'
            default: return 'warning'
        }
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3 }}>Execute Script</Typography>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>Select Machines</Typography>
                            {machines.length === 0 ? (
                                <Typography color="text.secondary">No machines available</Typography>
                            ) : (
                                <FormGroup>
                                    {machines.map((m) => (
                                        <FormControlLabel
                                            key={m.id}
                                            control={
                                                <Checkbox
                                                    checked={selectedMachines.includes(m.id)}
                                                    onChange={() => handleMachineToggle(m.id)}
                                                />
                                            }
                                            label={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <span>{m.name}</span>
                                                    <Chip label={m.status} color={getStatusColor(m.status)} size="small" />
                                                </Box>
                                            }
                                        />
                                    ))}
                                </FormGroup>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>Select Script</Typography>
                            <Select
                                fullWidth
                                value={selectedScript}
                                onChange={(e) => {
                                    setSelectedScript(e.target.value)
                                    setSelectedFlags({})
                                    setFlagValues({})
                                }}
                                displayEmpty
                            >
                                <MenuItem value="">Choose a script...</MenuItem>
                                {scripts.map((s) => (
                                    <MenuItem key={s.path} value={s.path}>
                                        {s.category}/{s.name}
                                    </MenuItem>
                                ))}
                            </Select>
                            {currentScript && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    {currentScript.description}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {currentScript?.flags?.length > 0 && (
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <SettingsIcon color="secondary" />
                                    <Typography variant="h6">Script Options</Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    {currentScript.flags.map((f, i) => {
                                        const flagName = f.long || f.short
                                        return (
                                            <Grid item xs={12} sm={6} md={4} key={i}>
                                                <Paper variant="outlined" sx={{ p: 2 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={!!selectedFlags[flagName]}
                                                                onChange={() => handleFlagToggle(flagName)}
                                                            />
                                                        }
                                                        label={
                                                            <Box>
                                                                <Typography variant="body2" component="span" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                                                                    {f.short && `${f.short}, `}{f.long || f.short}
                                                                </Typography>
                                                            </Box>
                                                        }
                                                    />
                                                    {f.description && (
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            {f.description}
                                                        </Typography>
                                                    )}
                                                    <Collapse in={selectedFlags[flagName] && f.has_value}>
                                                        <TextField
                                                            size="small"
                                                            fullWidth
                                                            placeholder={f.value_hint || 'value'}
                                                            value={flagValues[flagName] || ''}
                                                            onChange={(e) => handleFlagValueChange(flagName, e.target.value)}
                                                            sx={{ mt: 1 }}
                                                        />
                                                    </Collapse>
                                                </Paper>
                                            </Grid>
                                        )
                                    })}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                <Grid item xs={12}>
                    <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={executing ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                        onClick={handleExecute}
                        disabled={executing || selectedMachines.length === 0 || !selectedScript}
                    >
                        {executing ? 'Executing...' : 'Execute on Selected Machines'}
                    </Button>
                </Grid>

                {results.length > 0 && (
                    <Grid item xs={12}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Execution Results</Typography>
                        {results.map((r, i) => (
                            <Card key={i} sx={{ mb: 2, borderLeft: 4, borderColor: r.success ? 'success.main' : 'error.main' }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Box>
                                            <Typography variant="h6">{r.machine_name}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {r.script_path.split('/').pop()}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            icon={r.success ? <CheckCircleIcon /> : <ErrorIcon />}
                                            label={r.success ? 'Success' : 'Failed'}
                                            color={r.success ? 'success' : 'error'}
                                        />
                                    </Box>
                                    {r.output && (
                                        <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.900', maxHeight: 200, overflow: 'auto' }}>
                                            <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', m: 0 }}>
                                                {r.output}
                                            </Typography>
                                        </Paper>
                                    )}
                                    {r.error && (
                                        <Typography color="error" sx={{ mt: 1 }}>{r.error}</Typography>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </Grid>
                )}
            </Grid>
        </Box>
    )
}

export default Execute
