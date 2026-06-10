import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Chip from '@mui/material/Chip'

import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import ViewStreamIcon from '@mui/icons-material/ViewStream'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

import { colors } from './theme'

const DiffViewer = () => {
    const [machines, setMachines] = useState([])
    const [machine1, setMachine1] = useState('')
    const [machine2, setMachine2] = useState('')
    const [filePath, setFilePath] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [viewMode, setViewMode] = useState('unified')
    const leftPanelRef = useRef(null)
    const rightPanelRef = useRef(null)

    useEffect(() => {
        fetch('/api/machines')
            .then(res => res.json())
            .then(data => setMachines(data || []))
            .catch(err => setError(err.message))
    }, [])

    const compareMachines = async () => {
        if (!machine1 || !machine2 || !filePath) return

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch('/api/diff/machines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine1_id: machine1,
                    machine2_id: machine2,
                    file_path: filePath
                })
            })
            const data = await res.json()
            if (data.success) {
                setResult(data)
            } else {
                setError(data.error)
            }
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    const syncScroll = (source) => {
        if (source === 'left' && leftPanelRef.current && rightPanelRef.current) {
            rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop
        } else if (source === 'right' && leftPanelRef.current && rightPanelRef.current) {
            leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop
        }
    }

    const stats = result?.diff ? {
        added: result.diff.filter(l => l.status === 'added').length,
        removed: result.diff.filter(l => l.status === 'removed').length,
        changed: result.diff.filter(l => l.status === 'changed').length,
    } : { added: 0, removed: 0, changed: 0 }

    const renderUnifiedDiff = () => {
        if (!result?.diff) return null

        return (
            <Box sx={{ 
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '12px',
                lineHeight: '20px',
                overflow: 'auto',
                maxHeight: 'calc(100vh - 350px)',
                background: '#0d0d0d',
                borderRadius: 1
            }}>
                {result.diff.map((line, i) => {
                    let bgColor = 'transparent'
                    let borderColor = 'transparent'
                    let prefix = ' '
                    let textColor = '#a1a1aa'

                    if (line.status === 'added') {
                        bgColor = 'rgba(34, 197, 94, 0.15)'
                        borderColor = '#22c55e'
                        prefix = '+'
                        textColor = '#4ade80'
                    } else if (line.status === 'removed') {
                        bgColor = 'rgba(239, 68, 68, 0.15)'
                        borderColor = '#ef4444'
                        prefix = '-'
                        textColor = '#f87171'
                    } else if (line.status === 'changed') {
                        bgColor = 'rgba(249, 115, 22, 0.15)'
                        borderColor = '#f97316'
                        prefix = '~'
                        textColor = '#fb923c'
                    }

                    return (
                        <Box 
                            key={i}
                            sx={{
                                display: 'flex',
                                background: bgColor,
                                borderLeft: `3px solid ${borderColor}`,
                                '&:hover': { background: 'rgba(255,255,255,0.05)' }
                            }}
                        >
                            <Box sx={{ 
                                width: 50, 
                                textAlign: 'right', 
                                pr: 1,
                                color: '#52525b',
                                background: 'rgba(0,0,0,0.3)',
                                borderRight: '1px solid #27272a',
                                userSelect: 'none'
                            }}>
                                {line.line1 || ''}
                            </Box>
                            <Box sx={{ 
                                width: 50, 
                                textAlign: 'right', 
                                pr: 1,
                                color: '#52525b',
                                background: 'rgba(0,0,0,0.3)',
                                borderRight: '1px solid #27272a',
                                userSelect: 'none'
                            }}>
                                {line.line2 || ''}
                            </Box>
                            <Box sx={{ 
                                width: 24, 
                                textAlign: 'center',
                                color: textColor,
                                fontWeight: 700,
                                userSelect: 'none'
                            }}>
                                {prefix}
                            </Box>
                            <Box sx={{ 
                                flex: 1,
                                color: textColor,
                                whiteSpace: 'pre',
                                overflow: 'hidden',
                                pr: 2
                            }}>
                                {line.status === 'changed' ? (
                                    <>
                                        <Box component="span" sx={{ color: '#f87171', textDecoration: 'line-through', opacity: 0.7 }}>
                                            {line.content1}
                                        </Box>
                                        {' → '}
                                        <Box component="span" sx={{ color: '#4ade80' }}>
                                            {line.content2}
                                        </Box>
                                    </>
                                ) : (
                                    line.status === 'added' ? line.content2 : line.content1
                                )}
                            </Box>
                        </Box>
                    )
                })}
            </Box>
        )
    }

    const renderSplitDiff = () => {
        if (!result?.diff) return null

        const DiffLine = ({ line, side }) => {
            const isLeft = side === 'left'
            const content = isLeft ? line.content1 : line.content2
            const lineNum = isLeft ? line.line1 : line.line2
            const isEmpty = isLeft ? line.status === 'added' : line.status === 'removed'

            let bgColor = 'transparent'
            let textColor = '#a1a1aa'

            if (isEmpty) {
                bgColor = 'rgba(63, 63, 70, 0.3)'
                textColor = '#52525b'
            } else if (line.status === 'added' && !isLeft) {
                bgColor = 'rgba(34, 197, 94, 0.15)'
                textColor = '#4ade80'
            } else if (line.status === 'removed' && isLeft) {
                bgColor = 'rgba(239, 68, 68, 0.15)'
                textColor = '#f87171'
            } else if (line.status === 'changed') {
                bgColor = isLeft ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'
                textColor = isLeft ? '#fca5a5' : '#86efac'
            }

            return (
                <Box sx={{
                    display: 'flex',
                    background: bgColor,
                    minHeight: 20,
                    '&:hover': { background: isEmpty ? bgColor : 'rgba(255,255,255,0.03)' }
                }}>
                    <Box sx={{ 
                        width: 45, 
                        textAlign: 'right', 
                        pr: 1,
                        color: '#52525b',
                        background: 'rgba(0,0,0,0.3)',
                        borderRight: '1px solid #27272a',
                        userSelect: 'none',
                        fontSize: '11px'
                    }}>
                        {lineNum || ''}
                    </Box>
                    <Box sx={{ 
                        flex: 1,
                        pl: 1,
                        pr: 1,
                        color: textColor,
                        whiteSpace: 'pre',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {content}
                    </Box>
                </Box>
            )
        }

        return (
            <Box sx={{ display: 'flex', gap: 0, maxHeight: 'calc(100vh - 350px)' }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '2px solid #27272a' }}>
                    <Box sx={{ 
                        p: 1, 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        borderBottom: '1px solid #27272a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}>
                        <RemoveIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                        <Typography sx={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>
                            {result.machine1}
                        </Typography>
                    </Box>
                    <Box 
                        ref={leftPanelRef}
                        onScroll={() => syncScroll('left')}
                        sx={{ 
                            flex: 1,
                            overflow: 'auto',
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                            fontSize: '12px',
                            lineHeight: '20px',
                            background: '#0d0d0d'
                        }}
                    >
                        {result.diff.map((line, i) => (
                            <DiffLine key={i} line={line} side="left" />
                        ))}
                    </Box>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ 
                        p: 1, 
                        background: 'rgba(34, 197, 94, 0.1)', 
                        borderBottom: '1px solid #27272a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}>
                        <AddIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                        <Typography sx={{ color: '#86efac', fontSize: '0.8rem', fontWeight: 600 }}>
                            {result.machine2}
                        </Typography>
                    </Box>
                    <Box 
                        ref={rightPanelRef}
                        onScroll={() => syncScroll('right')}
                        sx={{ 
                            flex: 1,
                            overflow: 'auto',
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                            fontSize: '12px',
                            lineHeight: '20px',
                            background: '#0d0d0d'
                        }}
                    >
                        {result.diff.map((line, i) => (
                            <DiffLine key={i} line={line} side="right" />
                        ))}
                    </Box>
                </Box>
            </Box>
        )
    }

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h5" sx={{ color: colors.text.primary, fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CompareArrowsIcon sx={{ color: colors.primary }} />
                File Diff Viewer
            </Typography>

            <Paper sx={{ background: colors.background.card, border: `1px solid ${colors.border.light}`, p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                        select
                        label="Machine 1"
                        value={machine1}
                        onChange={(e) => setMachine1(e.target.value)}
                        sx={{ minWidth: 180 }}
                        size="small"
                    >
                        {machines.map(m => (
                            <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Machine 2"
                        value={machine2}
                        onChange={(e) => setMachine2(e.target.value)}
                        sx={{ minWidth: 180 }}
                        size="small"
                    >
                        {machines.map(m => (
                            <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="File Path"
                        value={filePath}
                        onChange={(e) => setFilePath(e.target.value)}
                        placeholder="/home/user/docker-compose.yml"
                        sx={{ flex: 1, minWidth: 250 }}
                        size="small"
                    />

                    <Button
                        variant="contained"
                        onClick={compareMachines}
                        disabled={loading || !machine1 || !machine2 || !filePath}
                        startIcon={loading ? <CircularProgress size={16} /> : <CompareArrowsIcon />}
                        sx={{ background: colors.primary, height: 40 }}
                    >
                        Compare
                    </Button>
                </Box>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {result && (
                <Paper sx={{ 
                    background: '#18181b', 
                    border: '1px solid #27272a',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    borderRadius: 2
                }}>
                    <Box sx={{ 
                        p: 1.5, 
                        borderBottom: '1px solid #27272a', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        background: '#0f0f0f'
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography sx={{ color: '#e4e4e7', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                {result.file}
                            </Typography>
                            {result.identical ? (
                                <Chip 
                                    icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                                    label="Identical" 
                                    size="small" 
                                    sx={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}
                                />
                            ) : (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Chip label={`+${stats.added}`} size="small" sx={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontWeight: 600 }} />
                                    <Chip label={`-${stats.removed}`} size="small" sx={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 600 }} />
                                    <Chip label={`~${stats.changed}`} size="small" sx={{ background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', fontWeight: 600 }} />
                                </Box>
                            )}
                        </Box>

                        {!result.identical && (
                            <ToggleButtonGroup
                                value={viewMode}
                                exclusive
                                onChange={(e, v) => v && setViewMode(v)}
                                size="small"
                            >
                                <ToggleButton value="unified" sx={{ color: '#a1a1aa', '&.Mui-selected': { color: '#f97316', background: 'rgba(249, 115, 22, 0.1)' } }}>
                                    <ViewStreamIcon sx={{ fontSize: 18, mr: 0.5 }} /> Unified
                                </ToggleButton>
                                <ToggleButton value="split" sx={{ color: '#a1a1aa', '&.Mui-selected': { color: '#f97316', background: 'rgba(249, 115, 22, 0.1)' } }}>
                                    <ViewColumnIcon sx={{ fontSize: 18, mr: 0.5 }} /> Split
                                </ToggleButton>
                            </ToggleButtonGroup>
                        )}
                    </Box>

                    {!result.identical && (
                        <Box sx={{ flex: 1, overflow: 'hidden' }}>
                            {viewMode === 'unified' ? renderUnifiedDiff() : renderSplitDiff()}
                        </Box>
                    )}
                </Paper>
            )}
        </Box>
    )
}

export default DiffViewer
