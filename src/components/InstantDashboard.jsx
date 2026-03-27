import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Upload, BarChart3, Sparkles, ArrowRight, Loader2, FileSpreadsheet,
  TrendingUp, Target, AlertTriangle, Lightbulb, PieChart as PieIcon,
  AreaChart as AreaIcon, Lock, Maximize2, Minimize2,
  LayoutDashboard, Table2, Wand2, Settings, MessageSquare, Send,
  Filter, X, FileDown, Crown
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import LogoMark from './LogoMark'
import { smartFormat, truncate, CHART_COLORS } from '../utils/formatters'

// === CSV PARSER ===
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  function splitRow(line, d) {
    const fields = []; let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === d && !inQ) { fields.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    fields.push(cur.trim()); return fields
  }
  const headers = splitRow(lines[0], sep)
  return lines.slice(1).map(line => {
    const vals = splitRow(line, sep); const obj = {}
    headers.forEach((h, i) => {
      const v = vals[i] || ''; const num = parseFloat(v.replace(/[,$%]/g, ''))
      obj[h] = v && !isNaN(num) && !/^0\d/.test(v) ? num : v
    })
    return obj
  }).filter(row => Object.values(row).some(v => v !== '' && v !== null))
}

// === HEURISTIC CLASSIFICATION (fallback if AI fails) ===
function detectColumnType(values, colName) {
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 50)
  if (sample.length === 0) return 'ignore'
  const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{1,2}\/\d{1,2}\/\d{2,4}/, /^\d{1,2}-\d{1,2}-\d{2,4}/, /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i]
  if (sample.filter(v => { const s = String(v).trim(); return datePatterns.some(p => p.test(s)) || (!isNaN(Date.parse(s)) && s.length > 6) }).length > sample.length * 0.7) return 'date'
  const numericCount = sample.filter(v => !isNaN(typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$%]/g, '')))).length
  if (numericCount > sample.length * 0.8) {
    const name = (colName || '').toLowerCase()
    const dimensionNames = ['id', 'age', 'year', 'month', 'day', 'zip', 'zipcode', 'zip_code', 'postal',
      'code', 'phone', 'number', 'no', 'num', 'rank', 'ranking',
      'region', 'zone', 'district', 'ward', 'block', 'batch', 'version']
    if (dimensionNames.some(d => name === d || name.startsWith(d + '_') || name.endsWith('_' + d))) return 'dimension'
    const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').split(/\s+/)
    if (words.some(w => ['id', 'age', 'zip', 'postal', 'code', 'phone'].includes(w))) return 'dimension'
    const uniqueValues = new Set(sample.map(v => String(v).trim()))
    if (uniqueValues.size > sample.length * 0.9) return 'dimension'
    if (uniqueValues.size <= Math.min(20, sample.length * 0.3)) return 'dimension'
    if (sample.some(v => /^\d+\s*[-–]\s*\d+/.test(String(v)))) return 'dimension'
    return 'metric'
  }
  return 'dimension'
}

function toLabel(col) { return col.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase()).trim() }

function buildHeuristicSchema(data) {
  const cols = Object.keys(data[0]); const s = {}
  cols.forEach(col => { s[col] = { type: detectColumnType(data.map(r => r[col]), col), label: toLabel(col) } })
  return s
}

function computeColumnsByType(s) {
  const cbt = { dimensions: [], metrics: [], dates: [], ignored: [] }
  Object.entries(s).forEach(([col, def]) => {
    if (def.type === 'dimension') cbt.dimensions.push(col)
    else if (def.type === 'metric') cbt.metrics.push(col)
    else if (def.type === 'date') cbt.dates.push(col)
    else cbt.ignored.push(col)
  })
  return cbt
}

// === AGGREGATION ===
function aggregateData(data, dims, mets) {
  if (dims.length === 0) {
    const totals = {}
    mets.forEach(m => { totals[m] = data.reduce((s, r) => { const v = parseFloat(String(r[m] ?? 0).replace(/[,$%]/g, '')); return s + (isNaN(v) ? 0 : v) }, 0) })
    return [totals]
  }
  const groups = {}
  data.forEach(row => {
    const key = dims.map(d => String(row[d] ?? '(empty)')).join('|||')
    if (!groups[key]) { groups[key] = { _rows: [] }; dims.forEach(d => { groups[key][d] = row[d] ?? '(empty)' }) }
    groups[key]._rows.push(row)
  })
  return Object.values(groups).map(g => {
    const r = {}; dims.forEach(d => { r[d] = g[d] })
    mets.forEach(m => { r[m] = g._rows.reduce((s, row) => { const v = parseFloat(String(row[m] ?? 0).replace(/[,$%]/g, '')); return s + (isNaN(v) ? 0 : v) }, 0) })
    return r
  })
}

// === AI CALL ===
async function callPublicAI(system, userMessage, maxTokens = 500) {
  const res = await fetch('/api/claude-public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages: [{ role: 'user', content: userMessage }], max_tokens: maxTokens }),
  })
  if (!res.ok) return null
  const d = await res.json()
  return d.content?.map(c => c.text || '').join('') || ''
}

// === TOOLTIP ===
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{truncate(String(label), 40)}</p>
      {payload.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} />
          <span style={{ color: 'var(--text-muted)' }}>{e.name}:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{smartFormat(e.value, e.name)}</span>
        </div>
      ))}
    </div>
  )
}

// === CHART CARD ===
function ChartCard({ defaultType, defaultDim, defaultMet, index, schema, columnsByType, data, globalFilters, onBarClick }) {
  const [expanded, setExpanded] = useState(false)
  const [dim, setDim] = useState(defaultDim)
  const [met, setMet] = useState(defaultMet)
  const [chartType, setChartType] = useState(defaultType)

  const chartData = useMemo(() => {
    if (!dim || !met) return []
    let filtered = data
    if (globalFilters) {
      Object.entries(globalFilters).forEach(([col, vals]) => {
        if (vals?.length > 0) filtered = filtered.filter(r => vals.includes(String(r[col])))
      })
    }
    return aggregateData(filtered, [dim], [met]).sort((a, b) => (b[met] || 0) - (a[met] || 0)).slice(0, 12)
  }, [dim, met, data, globalFilters])

  const pieData = useMemo(() => {
    if (chartType !== 'pie' || !chartData.length) return []
    const total = chartData.reduce((s, d) => s + (d[met] || 0), 0)
    return chartData.slice(0, 8).map(d => ({ name: truncate(String(d[dim] ?? ''), 20), value: d[met] || 0, percent: total > 0 ? ((d[met] || 0) / total * 100).toFixed(1) : 0, _raw: d[dim] }))
  }, [chartData, chartType, dim, met])

  const types = [{ v: 'bar', I: BarChart3 }, { v: 'line', I: TrendingUp }, { v: 'pie', I: PieIcon }, { v: 'area', I: AreaIcon }]
  const allDims = [...columnsByType.dimensions, ...columnsByType.dates]
  const dimFilter = globalFilters?.[dim] || []
  const hasDimFilter = dimFilter.length > 0

  const handleClick = (row) => {
    if (!row || !dim || !onBarClick) return
    const val = row[dim] || row._raw || row.name
    if (val) onBarClick(dim, String(val))
  }

  return (
    <div className={`rounded-xl overflow-hidden transition-all ${expanded ? 'col-span-full' : ''}`}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between p-4 pb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {types.map(t => (
            <button key={t.v} onClick={() => setChartType(t.v)} className="p-1.5 rounded-md transition-colors"
              style={{ background: chartType === t.v ? 'var(--accent)' : 'transparent', color: chartType === t.v ? '#fff' : 'var(--text-muted)' }}>
              <t.I style={{ width: 14, height: 14 }} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={dim} onChange={e => setDim(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 pr-6 focus:outline-none"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {allDims.map(d => <option key={d} value={d}>{schema[d]?.label || d}</option>)}
          </select>
          <select value={met} onChange={e => setMet(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 pr-6 focus:outline-none"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {columnsByType.metrics.map(m => <option key={m} value={m}>{schema[m]?.label || m}</option>)}
          </select>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            {expanded ? <Minimize2 style={{ width: 14, height: 14 }} /> : <Maximize2 style={{ width: 14, height: 14 }} />}
          </button>
        </div>
      </div>
      <div className="text-sm font-semibold px-4" style={{ color: 'var(--text-primary)' }}>{schema[met]?.label || met} by {schema[dim]?.label || dim}</div>
      <div className="p-4 pt-2" style={{ height: expanded ? 500 : 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }} onClick={e => { if (e?.activePayload) handleClick(e.activePayload[0]?.payload) }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => smartFormat(v, met)} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey={met} name={schema[met]?.label || met} radius={[4, 4, 0, 0]} cursor="pointer">
                {chartData.map((entry, i) => {
                  const isActive = hasDimFilter && dimFilter.includes(String(entry[dim]))
                  return <Cell key={i} fill={isActive ? '#1e40af' : CHART_COLORS[index % CHART_COLORS.length]} opacity={hasDimFilter && !isActive ? 0.3 : 1} />
                })}
              </Bar>
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey={met} name={schema[met]?.label || met} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <defs><linearGradient id={`ig-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.3} /><stop offset="95%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey={met} name={schema[met]?.label || met} stroke={CHART_COLORS[index % CHART_COLORS.length]} fill={`url(#ig-${index})`} strokeWidth={2} />
            </AreaChart>
          ) : (
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" innerRadius="45%" paddingAngle={2}
                label={({ name, percent }) => `${name} (${percent}%)`} labelLine={{ stroke: 'var(--text-muted)' }}
                onClick={(_, idx) => { if (pieData[idx]) handleClick({ [dim]: pieData[idx]._raw || pieData[idx].name }) }}>
                {pieData.map((entry, i) => {
                  const isActive = hasDimFilter && dimFilter.includes(String(entry._raw || entry.name))
                  return <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} cursor="pointer" opacity={hasDimFilter && !isActive ? 0.3 : 1} />
                })}
              </Pie><Tooltip content={<ChartTooltip />} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// === STYLING ===
const INSIGHT_ICONS = { opportunity: Target, trend: TrendingUp, alert: AlertTriangle, recommendation: Lightbulb }
const INSIGHT_COLORS = {
  opportunity: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '#10b981' },
  trend: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)', icon: '#0ea5e9' },
  alert: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: '#ef4444' },
  recommendation: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', icon: '#6366f1' },
}
const KPI_COLORS = ['#3b82f6', '#0ea5e9', '#f97316', '#10b981', '#8b5cf6', '#ec4899']

function SignupGate({ title, description, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(37,99,235,0.12))' }}>
        <Icon className="w-7 h-7" style={{ color: 'var(--accent)' }} />
      </div>
      <h3 className="text-base font-display font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm mb-4 max-w-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
      <a href="/#login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
        Sign up free <ArrowRight className="w-4 h-4" />
      </a>
      <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>No credit card required</p>
    </div>
  )
}

// =============================================
// MAIN COMPONENT
// =============================================
export default function InstantDashboard() {
  const [data, setData] = useState(null)
  const [schema, setSchema] = useState(null)
  const [columnsByType, setColumnsByType] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [insights, setInsights] = useState([])
  const [insightLoading, setInsightLoading] = useState(false)
  const [error, setError] = useState(null)
  const [building, setBuilding] = useState(false)
  const [buildingMsg, setBuildingMsg] = useState('Reading your file...')
  const [activeTab, setActiveTab] = useState('overview')
  const [globalFilters, setGlobalFilters] = useState({})
  const [askInput, setAskInput] = useState('')
  const fileRef = useRef(null)

  // Auto-load file if passed from landing page via sessionStorage
  useEffect(() => {
    try {
      const storedFile = sessionStorage.getItem('nb_instant_file')
      const storedName = sessionStorage.getItem('nb_instant_filename')
      if (storedFile && storedName) {
        sessionStorage.removeItem('nb_instant_file')
        sessionStorage.removeItem('nb_instant_filename')
        // Create a fake File-like object and process it
        const blob = new Blob([storedFile], { type: 'text/csv' })
        const file = new File([blob], storedName, { type: 'text/csv' })
        handleFile(file)
      }
    } catch {}
  }, [])

  // === FILE HANDLER ===
  const handleFile = useCallback((file) => {
    if (!file) return
    setError(null)
    setBuilding(true)
    setBuildingMsg('Reading your file...')
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const rows = parseCSV(e.target.result)
        if (rows.length === 0) { setError('No data found in file'); setBuilding(false); return }

        // Start with heuristic
        let s = buildHeuristicSchema(rows)

        // AI classification — same prompt as the main dashboard
        setBuildingMsg('AI is classifying your columns...')
        try {
          const columns = Object.keys(rows[0])
          const samples = {}
          columns.forEach(col => { samples[col] = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '').slice(0, 8) })
          const colList = columns.map(col => `- "${col}": ${samples[col].slice(0, 5).map(v => JSON.stringify(v)).join(', ')}`).join('\n')

          const aiText = await callPublicAI(
            `You are a data classification expert. The user uploaded a dataset. For each column, determine:
1. type: "dimension" (text/categories for grouping — names, regions, ranges like "20-30%", IDs, labels), "metric" (numeric values you would SUM or AVERAGE — revenue, counts, amounts, rates as raw numbers), "date" (dates/timestamps), or "ignore" (irrelevant columns like row IDs, sequential indices)
2. label: A clean, human-readable display name

CRITICAL RULES:
- Columns with ranges like "20-30%", "25-34", "100-200" are DIMENSIONS not metrics — they are categories
- Columns with names/text that happen to contain numbers (IDs, codes, zip codes) are DIMENSIONS
- AGE is ALWAYS a "dimension" — you never SUM ages
- Only classify as "metric" if the values are actual numbers that make sense to sum or average
- Column names like "amount", "total", "count", "revenue", "cost", "price", "sales", "profit", "quantity", "units", "spend" with raw numbers should be METRIC

Respond with ONLY a JSON object (no markdown, no backticks) mapping column names to {type, label}:
{"column_name": {"type": "dimension", "label": "Column Name"}, ...}`,
            `Classify these columns:\n${colList}`, 1500
          )

          if (aiText) {
            const aiSchema = JSON.parse(aiText.replace(/```json|```/g, '').trim())
            const validTypes = ['dimension', 'metric', 'date', 'ignore']
            if (columns.every(col => aiSchema[col] && validTypes.includes(aiSchema[col].type))) {
              const updated = {}
              columns.forEach(col => {
                updated[col] = {
                  type: aiSchema[col]?.type || s[col]?.type || 'dimension',
                  label: aiSchema[col]?.label || s[col]?.label || col,
                }
              })
              s = updated
            }
          }
        } catch (aiErr) { console.warn('AI tagging failed, using heuristic:', aiErr.message) }

        setBuildingMsg('Building your charts...')
        const cbt = computeColumnsByType(s)

        setData(rows)
        setSchema(s)
        setColumnsByType(cbt)
        setFileName(file.name)
        setBuilding(false)

        generateInsights(rows, s, cbt)
      } catch (err) { setError('Failed to parse: ' + err.message); setBuilding(false) }
    }
    reader.readAsText(file)
  }, [])

  // === AI INSIGHTS ===
  const generateInsights = async (rows, s, cbt) => {
    setInsightLoading(true)
    try {
      const metrics = Object.entries(s).filter(([, d]) => d.type === 'metric').map(([col, d]) => ({ col, label: d.label }))
      const dims = Object.entries(s).filter(([, d]) => d.type === 'dimension').map(([col, d]) => ({ col, label: d.label }))
      if (metrics.length === 0) { setInsightLoading(false); return }

      const summaryParts = []
      metrics.slice(0, 5).forEach(m => {
        const vals = rows.map(r => parseFloat(String(r[m.col] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
        summaryParts.push(`${m.label}: total=${vals.reduce((a, b) => a + b, 0).toLocaleString()}, avg=${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}, rows=${vals.length}`)
      })
      if (dims.length > 0 && metrics.length > 0) {
        const topData = aggregateData(rows, [dims[0].col], [metrics[0].col]).sort((a, b) => (b[metrics[0].col] || 0) - (a[metrics[0].col] || 0)).slice(0, 5)
        summaryParts.push(`\nTop ${dims[0].label} by ${metrics[0].label}:\n` + topData.map(r => `  ${r[dims[0].col]}: ${r[metrics[0].col]?.toLocaleString()}`).join('\n'))
      }

      const text = await callPublicAI(
        `You are a world-class strategic analyst. Respond with ONLY a JSON array of 4-5 insights:\n[{"type":"opportunity|trend|alert|recommendation","title":"Short title","description":"2-3 sentence actionable insight with specific numbers.","impact":"high|medium|low"}]\nBe specific. Think C-suite strategist.`,
        `Dataset: ${rows.length} rows, ${Object.keys(s).length} columns.\n${summaryParts.join('\n')}\n\nProvide 4-5 strategic insights.`,
        800
      )
      if (text) {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        setInsights(Array.isArray(parsed) ? parsed : [parsed])
      }
    } catch {} finally { setInsightLoading(false) }
  }

  // === CHART CONFIG ===
  const dimCardinalities = useMemo(() => {
    if (!data || !columnsByType) return {}
    const r = {}; [...columnsByType.dimensions, ...columnsByType.dates].forEach(dim => { r[dim] = new Set(data.map(row => row[dim])).size }); return r
  }, [data, columnsByType])

  const charts = useMemo(() => {
    if (!data || !schema || !columnsByType) return []
    const { dimensions, metrics, dates } = columnsByType; const c = []

    // Filter out bad chart dimensions
    const isGoodChartDim = (dim) => {
      const card = dimCardinalities[dim] || 0
      if (card < 2 || card > 50) return false
      const lower = dim.toLowerCase()
      const words = lower.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').split(/\s+/)
      if (words.includes('id') || lower.endsWith('_id') || lower.endsWith('id')) return false
      return true
    }

    const rankedDims = [...dimensions].filter(isGoodChartDim).sort((a, b) => {
      const ca = dimCardinalities[a] || 0, cb = dimCardinalities[b] || 0
      const scoreA = ca >= 3 && ca <= 15 ? 100 - Math.abs(ca - 7) : ca > 15 ? 30 - ca : 0
      const scoreB = cb >= 3 && cb <= 15 ? 100 - Math.abs(cb - 7) : cb > 15 ? 30 - cb : 0
      return scoreB - scoreA
    })
    const rankedDates = dates.filter(d => (dimCardinalities[d] || 0) >= 2)

    if (rankedDims[0] && metrics[0]) c.push({ type: 'bar', dim: rankedDims[0], met: metrics[0] })
    if (rankedDates[0] && metrics[0]) c.push({ type: 'line', dim: rankedDates[0], met: metrics[0] })
    if (rankedDims[0] && metrics[0] && (dimCardinalities[rankedDims[0]] || 0) <= 8) c.push({ type: 'pie', dim: rankedDims[0], met: metrics[0] })
    else if (rankedDims[1] && metrics.length > 1) c.push({ type: 'bar', dim: rankedDims[1], met: metrics[1] })
    if (rankedDims.length > 1 && metrics.length > 1) c.push({ type: 'bar', dim: rankedDims[1], met: metrics[1] })
    else if (rankedDims[0] && metrics.length > 1) c.push({ type: 'bar', dim: rankedDims[0], met: metrics[1] })

    if (c.length === 0 && rankedDates[0] && metrics[0]) c.push({ type: 'line', dim: rankedDates[0], met: metrics[0] })
    if (c.length === 0 && dimensions[0] && metrics[0]) c.push({ type: 'bar', dim: dimensions[0], met: metrics[0] })

    const seen = new Set()
    return c.filter(ch => { const k = `${ch.dim}-${ch.met}-${ch.type}`; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 4)
  }, [data, schema, columnsByType, dimCardinalities])

  // === KPIs ===
  const kpis = useMemo(() => {
    if (!data || !schema || !columnsByType) return []
    return columnsByType.metrics.slice(0, 6).map(col => {
      const vals = data.map(r => { const v = r[col]; return typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[,$%]/g, '')) }).filter(v => !isNaN(v))
      return { col, label: schema[col]?.label || col, total: vals.reduce((a, b) => a + b, 0) }
    })
  }, [data, schema, columnsByType])

  // === GLOBAL FILTER ===
  const handleBarClick = useCallback((dimension, value) => {
    setGlobalFilters(prev => {
      const current = prev[dimension] || []
      if (current.includes(value)) {
        const next = current.filter(v => v !== value)
        const result = { ...prev }; if (next.length === 0) delete result[dimension]; else result[dimension] = next; return result
      } else { return { ...prev, [dimension]: [value] } }
    })
  }, [])
  const hasFilters = Object.values(globalFilters).some(v => v?.length > 0)

  // === DATA TABLE ===
  const tablePreview = useMemo(() => {
    if (!data || !schema) return null
    const visibleCols = Object.entries(schema).filter(([, d]) => d.type !== 'ignore').map(([col]) => col).slice(0, 8)
    let rows = data
    if (hasFilters) { rows = data.filter(row => Object.entries(globalFilters).every(([col, vals]) => !vals?.length || vals.includes(String(row[col])))) }
    return { cols: visibleCols, rows: rows.slice(0, 20), total: rows.length }
  }, [data, schema, globalFilters, hasFilters])

  const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'data', label: 'Data', icon: Table2 },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'builder', label: 'Builder', icon: Wand2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  // ======= BUILDING SCREEN =======
  if (building) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(37,99,235,0.15))' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-lg font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Building your dashboard</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{buildingMsg}</p>
        </div>
      </div>
    )
  }

  // ======= UPLOAD SCREEN =======
  if (!data) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8 object-contain" />
            <div>
              <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>µBoard</span>
              <span className="text-[9px] font-display font-semibold tracking-[0.25em] uppercase ml-1.5" style={{ color: 'var(--accent)' }}>Instant</span>
            </div>
          </div>
          <a href="/#login" className="text-xs font-medium px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>Sign up free</a>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center">
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>See your data in seconds</h1>
            <p className="text-base mb-8" style={{ color: 'var(--text-muted)' }}>Drop any CSV — AI builds your dashboard automatically. Works for sales, marketing, HR, finance, ops, anything.</p>
            <div className="border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer"
              style={{ borderColor: dragging ? 'var(--accent)' : 'var(--border)', background: dragging ? 'rgba(139,92,246,0.05)' : 'var(--bg-surface)' }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}>
              <Upload className="w-10 h-10 mx-auto mb-4" style={{ color: dragging ? 'var(--accent)' : 'var(--text-muted)' }} />
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Drop your CSV here</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>or click to browse · up to 20MB</p>
              <input ref={fileRef} type="file" accept=".csv,.tsv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
            {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
            <div className="mt-8 flex items-center justify-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Interactive charts</span>
              <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI insights</span>
              <span className="flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> No signup needed</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ======= FULL DASHBOARD =======
  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--bg-primary)' }}>
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col fixed h-full z-40" style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
        <div className="p-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8 object-contain" />
            <div>
              <span className="text-sm font-display font-bold block leading-none" style={{ color: 'var(--text-primary)' }}>µBoard</span>
              <span className="text-[9px] font-display font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--accent)' }}>Instant</span>
            </div>
          </div>
        </div>
        <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-overlay)' }}>
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{fileName}</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)', background: activeTab === tab.id ? 'var(--border-accent)' : 'transparent' }}>
              <tab.icon className="w-4 h-4 shrink-0" /><span>{tab.label}</span>
              {(tab.id === 'builder' || tab.id === 'settings') && <Lock className="w-3 h-3 ml-auto" style={{ color: 'var(--text-muted)' }} />}
            </button>
          ))}
          <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <a href="/#login" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(139,92,246,0.08))', color: 'var(--accent)', border: '1px solid var(--border-accent)' }}>
              <FileDown className="w-4 h-4 shrink-0" /><span>Export report</span><Lock className="w-3 h-3 ml-auto" style={{ color: 'var(--text-muted)' }} />
            </a>
          </div>
        </nav>
        <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{data.length.toLocaleString()} rows · {columnsByType.metrics.length}M {columnsByType.dimensions.length}D</div>
          <a href="/#login" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-white" style={{ background: 'var(--accent)' }}>
            <Crown className="w-4 h-4" /> Sign up free
          </a>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="lg:hidden sticky top-0 z-40 px-4 py-3" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <LogoMark className="w-7 h-7 object-contain" />
            <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>µBoard</span>
          </div>
          <a href="/#login" className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>Sign up</a>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
              style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)', background: activeTab === tab.id ? 'var(--border-accent)' : 'transparent' }}>
              <tab.icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto lg:ml-56 pb-20 lg:pb-0">
        <div className="p-4 lg:p-6 mx-auto max-w-[1400px]">

          {hasFilters && activeTab === 'overview' && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Filter className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
              {Object.entries(globalFilters).filter(([, v]) => v?.length).map(([col, vals]) => (
                <button key={col} onClick={() => setGlobalFilters(prev => { const n = { ...prev }; delete n[col]; return n })}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--border-accent)', color: 'var(--accent)', border: '1px solid var(--border-accent)' }}>
                  {schema[col]?.label}: {vals.join(', ')} <X style={{ width: 12, height: 12 }} />
                </button>
              ))}
              <button onClick={() => setGlobalFilters({})} className="text-xs" style={{ color: 'var(--text-muted)' }}>Clear all</button>
            </div>
          )}

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {(insightLoading || insights.length > 0) && (
                <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(37,99,235,0.04))', border: '1px solid rgba(139,92,246,0.12)' }}>
                  {insightLoading ? (
                    <div className="flex items-center gap-3 p-4">
                      <Sparkles className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent)' }} />
                      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>AI is analyzing your data...</span>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                          <span className="text-xs font-display font-semibold" style={{ color: 'var(--text-primary)' }}>AI found {insights.length} insights</span>
                        </div>
                        <button onClick={() => setActiveTab('ai')} className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>View all →</button>
                      </div>
                      <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {insights.slice(0, 3).map((ins, i) => {
                          const Icon = INSIGHT_ICONS[ins.type] || Lightbulb; const colors = INSIGHT_COLORS[ins.type] || INSIGHT_COLORS.recommendation
                          return (
                            <div key={i} className="p-3 rounded-lg" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                              <div className="flex items-start gap-2">
                                <Icon style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0, color: colors.icon }} />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{ins.title}</p>
                                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ins.description}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {kpis.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {kpis.map((kpi, i) => (
                    <div key={kpi.col} className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: `2px solid ${KPI_COLORS[i % KPI_COLORS.length]}20` }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: KPI_COLORS[i % KPI_COLORS.length] }}>{kpi.label}</span>
                      <div className="text-2xl font-display font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{smartFormat(kpi.total, kpi.col)}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>total</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {charts.map((ch, i) => (
                  <ChartCard key={`${ch.dim}-${ch.met}-${i}`} index={i} defaultType={ch.type} defaultDim={ch.dim} defaultMet={ch.met}
                    schema={schema} columnsByType={columnsByType} data={data} globalFilters={globalFilters} onBarClick={handleBarClick} />
                ))}
              </div>
              {charts.length > 0 && <p className="text-center text-xs pt-2" style={{ color: 'var(--text-muted)' }}>Click any bar to filter · Switch chart types and metrics above</p>}

              <div className="rounded-2xl p-8 text-center mt-2" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(37,99,235,0.06))', border: '1px solid rgba(139,92,246,0.15)' }}>
                <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--accent)' }} />
                <h2 className="text-lg font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>This is just the beginning</h2>
                <p className="text-sm mb-5 max-w-lg mx-auto" style={{ color: 'var(--text-muted)' }}>Sign up to save this dashboard, ask unlimited AI questions, build custom reports, export branded PDFs, share with your team, and connect Google Sheets for live data.</p>
                <div className="flex items-center justify-center gap-3 flex-wrap mb-5">
                  {['Save & revisit', 'Ask AI anything', 'Custom formulas', 'PDF export', 'Team sharing', 'Google Sheets', 'White-label', 'Scheduled reports'].map(f => (
                    <span key={f} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{f}</span>
                  ))}
                </div>
                <a href="/#login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-display font-semibold text-white" style={{ background: 'var(--accent)' }}>Sign up free <ArrowRight className="w-4 h-4" /></a>
                <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>No credit card required · Free tier includes 1 project</p>
              </div>
            </div>
          )}

          {/* DATA */}
          {activeTab === 'data' && tablePreview && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {tablePreview.cols.map(col => (<th key={col} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--text-secondary)', background: 'var(--bg-overlay)' }}>{schema[col]?.label || col}</th>))}
                  </tr></thead>
                  <tbody>{tablePreview.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {tablePreview.cols.map(col => (<td key={col} className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{typeof row[col] === 'number' ? smartFormat(row[col], col) : truncate(String(row[col] ?? ''), 30)}</td>))}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-overlay)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Showing 20 of {tablePreview.total.toLocaleString()} rows</span>
                <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Lock style={{ width: 10, height: 10 }} /> Sign up for full data table</span>
              </div>
            </div>
          )}

          {/* AI */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              {insights.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>AI Insights</h3>
                  {insights.map((ins, i) => {
                    const Icon = INSIGHT_ICONS[ins.type] || Lightbulb; const colors = INSIGHT_COLORS[ins.type] || INSIGHT_COLORS.recommendation
                    return (
                      <div key={i} className="p-4 rounded-xl" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                        <div className="flex items-start gap-3">
                          <Icon style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, color: colors.icon }} />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ins.title}</p>
                              <span className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded"
                                style={{ background: ins.impact === 'high' ? 'rgba(239,68,68,0.1)' : ins.impact === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)', color: ins.impact === 'high' ? '#ef4444' : ins.impact === 'medium' ? '#f59e0b' : '#3b82f6' }}>{ins.impact}</span>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ins.description}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4" style={{ color: 'var(--accent)' }} /><h3 className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Ask AI about your data</h3></div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ask questions in plain English — "What's my top product?" "Show revenue by month"</p>
                </div>
                <div className="p-4">
                  <div className="flex gap-2">
                    <input value={askInput} onChange={e => setAskInput(e.target.value)} placeholder="e.g. What are my top 5 products by revenue?" className="flex-1 text-sm px-4 py-2.5 rounded-xl focus:outline-none" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                    <a href="/#login" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shrink-0" style={{ background: 'var(--accent)' }}><Send className="w-4 h-4" /> Ask</a>
                  </div>
                  <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Lock style={{ width: 10, height: 10 }} /> Sign up free to ask unlimited questions</p>
                </div>
              </div>
              <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border)' }}>
                <Wand2 className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>AI Recommendations</p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Get personalized action items, custom KPI formulas, and strategic recommendations</p>
                <a href="/#login" className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>Unlock with free signup <ArrowRight className="w-3 h-3" /></a>
              </div>
            </div>
          )}

          {activeTab === 'builder' && <SignupGate icon={Wand2} title="Custom Report Builder" description="Build custom reports with drag-and-drop charts, custom formulas, calculated metrics, and scheduled PDF exports." />}
          {activeTab === 'settings' && <SignupGate icon={Settings} title="Dashboard Settings" description="Customize your dashboard with white-label branding, team sharing, scheduled reports, and connected data sources." />}
        </div>
      </main>
    </div>
  )
}
