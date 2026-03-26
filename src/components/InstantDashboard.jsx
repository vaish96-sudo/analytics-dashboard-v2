import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Upload, BarChart3, Sparkles, ArrowRight, Loader2, FileSpreadsheet,
  TrendingUp, Target, AlertTriangle, Lightbulb, PieChart as PieIcon,
  AreaChart as AreaIcon, Download, Share2, Save, Lock, Maximize2, Minimize2
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import LogoMark from './LogoMark'
import { detectTemplate, applyTemplate, applyTemplateToSchema, resolveChartLayout } from '../lib/templates'
import { smartFormat, truncate, CHART_COLORS } from '../utils/formatters'

/**
 * Instant Dashboard — free tool, no login required.
 * Drop a CSV → full dashboard with KPIs, interactive Recharts, AI insights.
 * Export/save/share gated behind "Sign up" CTAs.
 */

// --- Column detection (same as DataContext) ---
function detectColumnType(values, colName) {
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 50)
  if (sample.length === 0) return 'ignore'
  const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{1,2}\/\d{1,2}\/\d{2,4}/, /^\d{1,2}-\d{1,2}-\d{2,4}/, /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i]
  if (sample.filter(v => { const s = String(v).trim(); return datePatterns.some(p => p.test(s)) || (!isNaN(Date.parse(s)) && s.length > 6) }).length > sample.length * 0.7) return 'date'
  const numericCount = sample.filter(v => !isNaN(typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$%]/g, '')))).length
  if (numericCount > sample.length * 0.8) {
    const name = (colName || '').toLowerCase()
    const dimNames = ['id', 'age', 'year', 'month', 'day', 'zip', 'zipcode', 'zip_code', 'postal', 'code', 'phone', 'number', 'no', 'num', 'rank', 'ranking', 'rating', 'score', 'grade', 'level', 'tier', 'floor', 'room', 'seat', 'size', 'group', 'class', 'category', 'region', 'zone', 'district']
    if (dimNames.some(d => name === d || name.startsWith(d + '_') || name.endsWith('_' + d))) return 'dimension'
    const uniqueValues = new Set(sample.map(v => String(v).trim()))
    if (uniqueValues.size <= Math.min(20, sample.length * 0.3)) return 'dimension'
    if (sample.some(v => /^\d+\s*[-–]\s*\d+/.test(String(v)))) return 'dimension'
    return 'metric'
  }
  return 'dimension'
}

function toLabel(colName) {
  return colName.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase()).trim()
}

function buildSchema(data) {
  const columns = Object.keys(data[0])
  const schema = {}
  columns.forEach(col => {
    schema[col] = { type: detectColumnType(data.map(r => r[col]), col), label: toLabel(col) }
  })
  return schema
}

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  // Handle quoted fields with commas
  function splitRow(line, delimiter) {
    const fields = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === delimiter && !inQuotes) { fields.push(current.trim()); current = ''; continue }
      current += ch
    }
    fields.push(current.trim())
    return fields
  }
  const headers = splitRow(lines[0], sep)
  return lines.slice(1).map(line => {
    const vals = splitRow(line, sep)
    const obj = {}
    headers.forEach((h, i) => {
      const v = vals[i] || ''
      const num = parseFloat(v.replace(/[,$%]/g, ''))
      obj[h] = v && !isNaN(num) && !/^0\d/.test(v) ? num : v
    })
    return obj
  }).filter(row => Object.values(row).some(v => v !== '' && v !== null))
}

// --- Aggregation helper ---
function aggregateData(data, dims, mets) {
  if (dims.length === 0) {
    const totals = {}
    mets.forEach(m => {
      totals[m] = data.reduce((sum, row) => { const v = parseFloat(String(row[m] ?? 0).replace(/[,$%]/g, '')); return sum + (isNaN(v) ? 0 : v) }, 0)
    })
    return [totals]
  }
  const groups = {}
  data.forEach(row => {
    const key = dims.map(d => String(row[d] ?? '(empty)')).join('|||')
    if (!groups[key]) { groups[key] = { _rows: [] }; dims.forEach(d => { groups[key][d] = row[d] ?? '(empty)' }) }
    groups[key]._rows.push(row)
  })
  return Object.values(groups).map(group => {
    const result = {}
    dims.forEach(d => { result[d] = group[d] })
    mets.forEach(m => {
      result[m] = group._rows.reduce((sum, row) => { const v = parseFloat(String(row[m] ?? 0).replace(/[,$%]/g, '')); return sum + (isNaN(v) ? 0 : v) }, 0)
    })
    return result
  })
}

// --- Tooltip ---
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{truncate(String(label), 40)}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
          <span style={{ color: 'var(--text-muted)' }}>{entry.name}:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{smartFormat(entry.value, entry.name)}</span>
        </div>
      ))}
    </div>
  )
}

// --- Interactive chart card ---
function InstantChartCard({ defaultType, defaultDim, defaultMet, index, schema, columnsByType, data }) {
  const [expanded, setExpanded] = useState(false)
  const [dim, setDim] = useState(defaultDim)
  const [met, setMet] = useState(defaultMet)
  const [chartType, setChartType] = useState(defaultType)

  const chartData = useMemo(() => {
    if (!dim || !met) return []
    return aggregateData(data, [dim], [met]).sort((a, b) => (b[met] || 0) - (a[met] || 0)).slice(0, 12)
  }, [dim, met, data])

  const pieData = useMemo(() => {
    if (chartType !== 'pie' || !chartData.length) return []
    const total = chartData.reduce((s, d) => s + (d[met] || 0), 0)
    return chartData.slice(0, 8).map(d => ({ name: truncate(String(d[dim] ?? ''), 20), value: d[met] || 0, percent: total > 0 ? ((d[met] || 0) / total * 100).toFixed(1) : 0 }))
  }, [chartData, chartType, dim, met])

  const types = [{ v: 'bar', I: BarChart3 }, { v: 'line', I: TrendingUp }, { v: 'pie', I: PieIcon }, { v: 'area', I: AreaIcon }]
  const allDims = [...columnsByType.dimensions, ...columnsByType.dates]

  return (
    <div className={`rounded-xl overflow-hidden transition-all ${expanded ? 'col-span-full' : ''}`}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between p-4 pb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {types.map(t => (
            <button key={t.v} onClick={() => setChartType(t.v)}
              className="p-1.5 rounded-md transition-colors"
              style={{ background: chartType === t.v ? 'var(--accent)' : 'transparent', color: chartType === t.v ? '#fff' : 'var(--text-muted)' }}>
              <t.I style={{ width: 14, height: 14 }} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={dim} onChange={e => setDim(e.target.value)}
            className="text-xs rounded-lg px-2 py-1.5 pr-6 focus:outline-none"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {allDims.map(d => <option key={d} value={d}>{schema[d]?.label || d}</option>)}
          </select>
          <select value={met} onChange={e => setMet(e.target.value)}
            className="text-xs rounded-lg px-2 py-1.5 pr-6 focus:outline-none"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {columnsByType.metrics.map(m => <option key={m} value={m}>{schema[m]?.label || m}</option>)}
          </select>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            {expanded ? <Minimize2 style={{ width: 14, height: 14 }} /> : <Maximize2 style={{ width: 14, height: 14 }} />}
          </button>
        </div>
      </div>
      <div className="text-sm font-semibold px-4" style={{ color: 'var(--text-primary)' }}>
        {schema[met]?.label || met} by {schema[dim]?.label || dim}
      </div>
      <div className="p-4 pt-2" style={{ height: expanded ? 500 : 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => smartFormat(v, met)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={met} name={schema[met]?.label || met} radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey={met} name={schema[met]?.label || met} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id={`ig-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={met} name={schema[met]?.label || met} stroke={CHART_COLORS[index % CHART_COLORS.length]} fill={`url(#ig-${index})`} strokeWidth={2} />
            </AreaChart>
          ) : (
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" innerRadius="45%" paddingAngle={2}
                label={({ name, percent }) => `${name} (${percent}%)`} labelLine={{ stroke: 'var(--text-muted)' }}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- Gated feature button ---
function GatedButton({ icon: Icon, label }) {
  return (
    <a href="/" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all hover:shadow-sm"
      style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
      <Icon style={{ width: 14, height: 14 }} />
      <span>{label}</span>
      <Lock style={{ width: 10, height: 10, color: 'var(--text-muted)', marginLeft: 'auto' }} />
    </a>
  )
}

// --- Insight icons ---
const INSIGHT_ICONS = { opportunity: Target, trend: TrendingUp, alert: AlertTriangle, recommendation: Lightbulb }
const INSIGHT_COLORS = {
  opportunity: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '#10b981' },
  trend: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)', icon: '#0ea5e9' },
  alert: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: '#ef4444' },
  recommendation: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', icon: '#6366f1' },
}

// ========== MAIN COMPONENT ==========
export default function InstantDashboard() {
  const [data, setData] = useState(null)
  const [schema, setSchema] = useState(null)
  const [columnsByType, setColumnsByType] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [template, setTemplate] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [insights, setInsights] = useState([])
  const [insightLoading, setInsightLoading] = useState(false)
  const [error, setError] = useState(null)
  const [building, setBuilding] = useState(false)
  const fileRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file) return
    setError(null)
    setBuilding(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result)
        if (rows.length === 0) { setError('No data found in file'); setBuilding(false); return }

        // Build schema with heuristic
        let s = buildSchema(rows)

        // Detect and apply template
        const colNames = Object.keys(rows[0])
        const detected = detectTemplate(colNames)
        if (detected) {
          setTemplate(detected.template)
          s = applyTemplateToSchema(detected.template, s)
        }

        // Compute columnsByType
        const cbt = { dimensions: [], metrics: [], dates: [], ignored: [] }
        Object.entries(s).forEach(([col, def]) => {
          if (def.type === 'dimension') cbt.dimensions.push(col)
          else if (def.type === 'metric') cbt.metrics.push(col)
          else if (def.type === 'date') cbt.dates.push(col)
          else cbt.ignored.push(col)
        })

        setData(rows)
        setSchema(s)
        setColumnsByType(cbt)
        setFileName(file.name)

        // Small delay for "building" feel
        setTimeout(() => {
          setBuilding(false)
          generateInsights(rows, s, cbt, detected?.template || null)
        }, 600)
      } catch (err) { setError('Failed to parse file: ' + err.message); setBuilding(false) }
    }
    reader.readAsText(file)
  }, [])

  const generateInsights = async (rows, s, cbt, tmpl) => {
    setInsightLoading(true)
    try {
      const metrics = Object.entries(s).filter(([, d]) => d.type === 'metric').map(([col, d]) => ({ col, label: d.label }))
      const dims = Object.entries(s).filter(([, d]) => d.type === 'dimension').map(([col, d]) => ({ col, label: d.label }))
      if (metrics.length === 0) { setInsightLoading(false); return }

      const summaryParts = []
      metrics.slice(0, 4).forEach(m => {
        const vals = rows.map(r => parseFloat(String(r[m.col] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
        summaryParts.push(`${m.label}: total=${vals.reduce((a, b) => a + b, 0).toLocaleString()}, avg=${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}`)
      })

      // Add top breakdown if possible
      if (dims.length > 0 && metrics.length > 0) {
        const topData = aggregateData(rows, [dims[0].col], [metrics[0].col])
          .sort((a, b) => (b[metrics[0].col] || 0) - (a[metrics[0].col] || 0))
          .slice(0, 5)
        summaryParts.push(`\nTop ${dims[0].label} by ${metrics[0].label}:\n` +
          topData.map(r => `  ${r[dims[0].col]}: ${r[metrics[0].col]?.toLocaleString()}`).join('\n'))
      }

      const focusInstruction = tmpl?.insightFocus
        ? `\n\nDOMAIN FOCUS: ${tmpl.insightFocus}\nTailor insights to this domain.`
        : ''

      const res = await fetch('/api/claude-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are a strategic data analyst. Respond with ONLY a JSON array (no markdown, no backticks) of 3 insights:
[{"type":"opportunity|trend|alert|recommendation","title":"Short title","description":"2 sentence actionable insight with specific numbers.","impact":"high|medium|low"}]
Be specific with numbers. Think like a strategist presenting to an executive.${focusInstruction}`,
          messages: [{ role: 'user', content: `Dataset: ${rows.length} rows, ${Object.keys(s).length} columns.\n${summaryParts.join('\n')}\n\nProvide 3 strategic insights.` }],
          max_tokens: 500,
        }),
      })

      if (res.ok) {
        const d = await res.json()
        const text = d.content?.map(c => c.text || '').join('') || ''
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        setInsights(Array.isArray(parsed) ? parsed : [parsed])
      }
    } catch {} finally { setInsightLoading(false) }
  }

  // Compute dimension cardinalities
  const dimCardinalities = useMemo(() => {
    if (!data || !columnsByType) return {}
    const result = {}
    const allDims = [...columnsByType.dimensions, ...columnsByType.dates]
    allDims.forEach(dim => { result[dim] = new Set(data.map(r => r[dim])).size })
    return result
  }, [data, columnsByType])

  // Chart configs — template-driven or heuristic
  const charts = useMemo(() => {
    if (!data || !schema || !columnsByType) return []

    // Try template charts first
    if (template) {
      const templateCharts = resolveChartLayout(template, columnsByType, dimCardinalities)
      if (templateCharts && templateCharts.length >= 2) return templateCharts
    }

    // Fallback: heuristic
    const { dimensions, metrics, dates } = columnsByType
    const c = []
    const rankedDims = [...dimensions].sort((a, b) => {
      const ca = dimCardinalities[a] || 0, cb = dimCardinalities[b] || 0
      const scoreA = ca >= 2 && ca <= 15 ? 100 - Math.abs(ca - 6) : ca > 15 ? 20 : 0
      const scoreB = cb >= 2 && cb <= 15 ? 100 - Math.abs(cb - 6) : cb > 15 ? 20 : 0
      return scoreB - scoreA
    }).filter(d => (dimCardinalities[d] || 0) >= 2)
    const rankedDates = dates.filter(d => (dimCardinalities[d] || 0) >= 2)

    if (rankedDims[0] && metrics[0]) c.push({ type: 'bar', dim: rankedDims[0], met: metrics[0] })
    if (rankedDates[0] && metrics[0]) c.push({ type: 'line', dim: rankedDates[0], met: metrics[0] })
    if (rankedDims[0] && metrics[0] && (dimCardinalities[rankedDims[0]] || 0) <= 8)
      c.push({ type: 'pie', dim: rankedDims[0], met: metrics[0] })
    else if (rankedDims[1] && metrics.length > 1) c.push({ type: 'bar', dim: rankedDims[1], met: metrics[1] })
    if (rankedDims.length > 1 && metrics.length > 1) c.push({ type: 'bar', dim: rankedDims[1], met: metrics[1] })

    const seen = new Set()
    return c.filter(ch => { const key = `${ch.dim}-${ch.met}-${ch.type}`; if (seen.has(key)) return false; seen.add(key); return true }).slice(0, 4)
  }, [data, schema, columnsByType, dimCardinalities, template])

  // KPIs — template-ordered
  const kpis = useMemo(() => {
    if (!data || !schema || !columnsByType) return []

    let orderedMetrics = columnsByType.metrics
    if (template) {
      const result = applyTemplate(template, schema, columnsByType)
      if (result?.kpiOrder?.length > 0) {
        const valid = result.kpiOrder.filter(col => columnsByType.metrics.includes(col))
        const remaining = columnsByType.metrics.filter(col => !valid.includes(col))
        orderedMetrics = [...valid, ...remaining]
      }
    }

    return orderedMetrics.slice(0, 6).map(col => {
      const vals = data.map(r => { const v = r[col]; return typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[,$%]/g, '')) }).filter(v => !isNaN(v))
      return { col, label: schema[col]?.label || col, total: vals.reduce((a, b) => a + b, 0) }
    })
  }, [data, schema, columnsByType, template])

  // --- Building screen ---
  if (building) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(37,99,235,0.15))' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-lg font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Building your dashboard</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Classifying columns and setting up charts...</p>
        </div>
      </div>
    )
  }

  // --- Upload screen ---
  if (!data) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8 object-contain" />
            <div>
              <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
              <span className="text-[9px] font-display font-semibold tracking-[0.25em] uppercase ml-1.5" style={{ color: 'var(--accent)' }}>Instant</span>
            </div>
          </div>
          <a href="/" className="text-xs font-medium px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
            Sign up free
          </a>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center">
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                See your data in seconds
              </h1>
              <p className="text-base" style={{ color: 'var(--text-muted)' }}>
                Drop a CSV and get a full interactive dashboard with AI insights. No signup required.
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer`}
              style={{ borderColor: dragging ? 'var(--accent)' : 'var(--border)', background: dragging ? 'rgba(139,92,246,0.05)' : 'var(--bg-surface)' }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}>
              <Upload className="w-10 h-10 mx-auto mb-4" style={{ color: dragging ? 'var(--accent)' : 'var(--text-muted)' }} />
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Drop your CSV here</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>or click to browse · CSV files up to 20MB</p>
              <input ref={fileRef} type="file" accept=".csv,.tsv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </div>

            {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

            <div className="mt-8 flex items-center justify-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Interactive charts</span>
              <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI insights</span>
              <span className="flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> No signup</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Dashboard view ---
  const KPI_COLORS = ['#3b82f6', '#0ea5e9', '#f97316', '#10b981', '#8b5cf6', '#ec4899']

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2.5">
          <LogoMark className="w-8 h-8 object-contain" />
          <div>
            <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
            <span className="text-[9px] font-display font-semibold tracking-[0.25em] uppercase ml-1.5" style={{ color: 'var(--accent)' }}>Instant</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
            {fileName} · {data.length.toLocaleString()} rows
            {template && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: 'var(--border-accent)', color: 'var(--accent)' }}>{template.icon} {template.name}</span>}
          </span>
          <a href="/" className="text-xs font-medium px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
            Sign up to save
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* AI Insights */}
        {(insightLoading || insights.length > 0) && (
          <div className="rounded-xl overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(37,99,235,0.04))', border: '1px solid rgba(139,92,246,0.12)' }}>
            {insightLoading ? (
              <div className="flex items-center gap-3 p-4">
                <Sparkles className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent)' }} />
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>AI is analyzing your data...</span>
              </div>
            ) : (
              <>
                <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                  <span className="text-xs font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                    AI found {insights.length} insights in your data
                  </span>
                </div>
                <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {insights.slice(0, 3).map((ins, i) => {
                    const Icon = INSIGHT_ICONS[ins.type] || Lightbulb
                    const colors = INSIGHT_COLORS[ins.type] || INSIGHT_COLORS.recommendation
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

        {/* KPIs */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {kpis.map((kpi, i) => (
              <div key={kpi.col} className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: `2px solid ${KPI_COLORS[i % KPI_COLORS.length]}20` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: KPI_COLORS[i % KPI_COLORS.length] }}>{kpi.label}</span>
                <div className="text-2xl font-display font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{smartFormat(kpi.total, kpi.col)}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>total</div>
              </div>
            ))}
          </div>
        )}

        {/* Gated feature bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <GatedButton icon={Download} label="Export PDF" />
          <GatedButton icon={Share2} label="Share dashboard" />
          <GatedButton icon={Save} label="Save project" />
        </div>

        {/* Interactive Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {charts.map((ch, i) => (
            <InstantChartCard
              key={`${ch.dim}-${ch.met}-${i}`}
              index={i}
              defaultType={ch.type}
              defaultDim={ch.dim}
              defaultMet={ch.met}
              schema={schema}
              columnsByType={columnsByType}
              data={data}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl p-8 text-center mb-8" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(37,99,235,0.06))', border: '1px solid rgba(139,92,246,0.15)' }}>
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <h2 className="text-lg font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Want the full experience?
          </h2>
          <p className="text-sm mb-4 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Sign up free to save this dashboard, get unlimited AI insights, ask questions about your data, export PDF reports, and share with clients.
          </p>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-display font-semibold text-white" style={{ background: 'var(--accent)' }}>
            Sign up free <ArrowRight className="w-4 h-4" />
          </a>
          <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>No credit card required · Free tier includes 1 project</p>
        </div>
      </div>
    </div>
  )
}
