import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useData } from '../context/DataContext'
import { CHART_COLORS, smartFormat, truncate } from '../utils/formatters'
import {
  Sparkles, Send, X, BarChart3, TrendingUp, PieChart as PieIcon,
  AreaChart as AreaIcon, Table2, Maximize2, Minimize2, Loader2,
  Plus, ChevronDown, ChevronUp, Check,
} from 'lucide-react'

import { callClaudeAPI } from '../utils/claudeClient.js'

// ─── AI Call ──────────────────────────────────────────────────────
async function parseChartRequest(prompt, schema) {
  const cols = Object.entries(schema)
    .filter(([, def]) => def.type !== 'ignore')
    .map(([col, def]) => `- ${col} (${def.type}): "${def.label}"`)
    .join('\n')

  const system = `You are a data visualization expert. The user has a dataset with these columns:

${cols}

The user will describe a chart they want. Respond with ONLY a JSON object (no markdown, no backticks):
{
  "dimensions": ["col_name"],
  "metrics": ["col_name", "col_name"],
  "chart_type": "bar|line|pie|area|table",
  "title": "Human readable chart title",
  "sort_by": "col_name",
  "sort_dir": "desc",
  "limit": 12
}

Rules:
- Match column names EXACTLY from the schema above (use the raw col name, not the label).
- If the user mentions MULTIPLE metrics (e.g. "conversions and impressions", "cost and clicks"), include ALL of them in the metrics array.
- If the user says "by region" or "by campaign", find the closest dimension column.
- Default to "bar" chart unless the user specifies otherwise or context suggests better (e.g. time series = line, composition = pie).
- For "table" type, include all relevant metric columns.
- If the request doesn't match available data, respond: {"error": "reason"}`

  const { text } = await callClaudeAPI({
    system,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    feature: 'chart_builder',
  })

  const cleaned = text.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned)
}

// ─── Tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg p-2.5 shadow-lg text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{truncate(String(label), 40)}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span style={{ color: 'var(--text-muted)' }}>{entry.name}:</span>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{smartFormat(entry.value, entry.dataKey || entry.name)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Metric Picker (multi-select dropdown) ───────────────────────
function MetricPicker({ allMets, selected, schema, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = (m) => {
    if (selected.includes(m)) {
      if (selected.length === 1) return
      onChange(selected.filter(x => x !== m))
    } else {
      onChange([...selected, m])
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs rounded-lg px-2 py-1 focus:outline-none nb-input max-w-[160px]"
      >
        <span className="truncate">
          {selected.length === 1
            ? (schema[selected[0]]?.label || selected[0])
            : `${selected.length} metrics`}
        </span>
        <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 w-52 rounded-xl shadow-lg z-50 overflow-hidden"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="p-1 max-h-48 overflow-y-auto">
            {allMets.map(m => {
              const active = selected.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => toggle(m)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    background: active ? 'var(--border-accent)' : 'transparent',
                  }}
                >
                  <div
                    className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                      background: active ? 'var(--accent)' : 'transparent',
                    }}
                  >
                    {active && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="truncate">{schema[m]?.label || m}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Single AI Chart ─────────────────────────────────────────────
function AIChart({ config, schema, columnsByType, aggregate, index, onRemove, onUpdate, onBarClick, globalFilters }) {
  const [chartType, setChartType] = useState(config.chart_type || 'bar')
  const [expanded, setExpanded] = useState(false)
  const [dim, setDim] = useState(config.dimensions?.[0] || '')
  const [metrics, setMetrics] = useState(() => {
    const m = config.metrics || []
    return m.length > 0 ? m : [columnsByType.metrics[0] || '']
  })

  // Notify parent of changes for persistence
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    onUpdate(index, { ...config, chart_type: chartType, dimensions: [dim], metrics })
  }, [chartType, dim, metrics.join(',')])

  const primaryMet = metrics[0] || ''

  const data = useMemo(() => {
    if (!dim || metrics.length === 0) return []
    const raw = aggregate([dim], metrics)
    const sortCol = config.sort_by || primaryMet
    const sorted = [...raw].sort((a, b) =>
      config.sort_dir === 'asc'
        ? (a[sortCol] || 0) - (b[sortCol] || 0)
        : (b[sortCol] || 0) - (a[sortCol] || 0)
    )
    return sorted.slice(0, config.limit || 12)
  }, [dim, metrics.join(','), aggregate, config.sort_by, config.sort_dir, config.limit])

  // Click handler for bar/pie/area clicks → triggers global filter
  const handleChartClick = (row) => {
    if (!row || !dim || !onBarClick) return
    const val = row[dim] || row._raw || row.name
    if (val) onBarClick(dim, String(val))
  }

  const dimFilter = (globalFilters && globalFilters[dim]) || []
  const hasDimFilter = dimFilter.length > 0

  const pieData = useMemo(() => {
    if (chartType !== 'pie' || !data.length) return []
    const total = data.reduce((s, d) => s + (d[primaryMet] || 0), 0)
    return data.slice(0, 8).map(d => ({
      name: truncate(String(d[dim] ?? ''), 20),
      value: d[primaryMet] || 0,
      percent: total > 0 ? ((d[primaryMet] || 0) / total * 100).toFixed(1) : 0,
      _raw: d[dim],
    }))
  }, [data, chartType, dim, primaryMet])

  const types = [
    { v: 'bar', I: BarChart3 },
    { v: 'line', I: TrendingUp },
    { v: 'pie', I: PieIcon },
    { v: 'area', I: AreaIcon },
    { v: 'table', I: Table2 },
  ]

  const allDims = [...columnsByType.dimensions, ...columnsByType.dates]
  const allMets = columnsByType.metrics

  const metricLabels = metrics.map(m => schema[m]?.label || m)
  const titleText = config.title || `${metricLabels.join(' & ')} by ${schema[dim]?.label || dim}`

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all animate-slide-up ${expanded ? 'col-span-full' : ''}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 pb-1 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>AI</span>
        </div>
        <div className="flex items-center gap-1">
          {types.map(t => (
            <button
              key={t.v}
              onClick={() => setChartType(t.v)}
              className="p-1.5 rounded-md transition-colors"
              style={{
                background: chartType === t.v ? 'var(--accent)' : 'transparent',
                color: chartType === t.v ? '#fff' : 'var(--text-muted)',
              }}
            >
              <t.I className="w-3.5 h-3.5" />
            </button>
          ))}
          <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
          <select
            value={dim}
            onChange={e => setDim(e.target.value)}
            className="text-xs appearance-none rounded-lg px-2 py-1 pr-5 focus:outline-none nb-input"
          >
            {allDims.map(d => (
              <option key={d} value={d}>{schema[d]?.label || d}</option>
            ))}
          </select>
          <MetricPicker allMets={allMets} selected={metrics} schema={schema} onChange={setMetrics} />
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onRemove(index)} className="p-1.5 rounded-lg transition-colors hover:text-red-500" style={{ color: 'var(--text-muted)' }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-4 pb-1">
        <p className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{titleText}</p>
        {config._prompt && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>"{config._prompt}"</p>
        )}
      </div>

      {/* Chart / Table */}
      <div className={`p-3 sm:p-4 pt-2 ${expanded ? 'h-[500px]' : 'h-[300px]'}`}>
        {chartType === 'table' ? (
          <div className="h-full overflow-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-overlay)' }}>
                  <th className="text-left px-3 py-2 font-semibold sticky top-0" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', background: 'var(--bg-overlay)' }}>
                    {schema[dim]?.label || dim}
                  </th>
                  {metrics.map(m => (
                    <th key={m} className="text-right px-3 py-2 font-semibold sticky top-0" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', background: 'var(--bg-overlay)' }}>
                      {schema[m]?.label || m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{truncate(String(row[dim] ?? ''), 40)}</td>
                    {metrics.map(m => (
                      <td key={m} className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                        {smartFormat(row[m], m)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : chartType === 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius="75%" innerRadius="45%" paddingAngle={2}
                label={({ name, percent }) => `${name} (${percent}%)`}
                labelLine={{ stroke: 'var(--text-muted)' }}
                cursor="pointer"
                onClick={(_, idx) => { if (pieData[idx]) handleChartClick({ [dim]: pieData[idx]._raw || pieData[idx].name }) }}
              >
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
              onClick={(e) => { if (e?.activePayload) handleChartClick(e.activePayload[0]?.payload) }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => smartFormat(v, primaryMet)} />
              <Tooltip content={<ChartTooltip />} />
              {metrics.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {metrics.map((m, mi) => (
                <Bar key={m} dataKey={m} name={schema[m]?.label || m} fill={CHART_COLORS[mi % CHART_COLORS.length]} radius={[3, 3, 0, 0]}
                  cursor="pointer" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : chartType === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
              onClick={(e) => { if (e?.activePayload) handleChartClick(e.activePayload[0]?.payload) }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => smartFormat(v, primaryMet)} />
              <Tooltip content={<ChartTooltip />} />
              {metrics.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {metrics.map((m, mi) => (
                <Line key={m} type="monotone" dataKey={m} name={schema[m]?.label || m}
                  stroke={CHART_COLORS[mi % CHART_COLORS.length]} strokeWidth={2.5}
                  dot={{ r: 4, fill: CHART_COLORS[mi % CHART_COLORS.length] }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
              onClick={(e) => { if (e?.activePayload) handleChartClick(e.activePayload[0]?.payload) }}>
              <defs>
                {metrics.map((m, mi) => (
                  <linearGradient key={m} id={`ai-grad-${index}-${mi}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[mi % CHART_COLORS.length]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[mi % CHART_COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => smartFormat(v, primaryMet)} />
              <Tooltip content={<ChartTooltip />} />
              {metrics.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {metrics.map((m, mi) => (
                <Area key={m} type="monotone" dataKey={m} name={schema[m]?.label || m}
                  stroke={CHART_COLORS[mi % CHART_COLORS.length]}
                  fill={`url(#ai-grad-${index}-${mi})`} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── Prompt Bar ──────────────────────────────────────────────────
function PromptBar({ onSubmit, loading, onClose }) {
  const [prompt, setPrompt] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim() || loading) return
    onSubmit(prompt.trim())
    setPrompt('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all animate-fade-in"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-accent)',
        boxShadow: '0 0 0 3px rgba(196, 160, 105, 0.08)',
      }}
    >
      <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
      <input
        ref={inputRef}
        type="text"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder='Describe a chart... e.g. "cost and clicks by campaign name"'
        disabled={loading}
        className="flex-1 text-sm bg-transparent focus:outline-none"
        style={{ color: 'var(--text-primary)' }}
      />
      {loading ? (
        <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--accent)' }} />
      ) : (
        <button type="submit" disabled={!prompt.trim()} className="p-1.5 rounded-lg transition-colors disabled:opacity-30" style={{ color: 'var(--accent)' }}>
          <Send className="w-4 h-4" />
        </button>
      )}
      <button type="button" onClick={onClose} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  )
}

// ─── Suggestions ─────────────────────────────────────────────────
function Suggestions({ schema, columnsByType, onSelect }) {
  const suggestions = useMemo(() => {
    const s = []
    const dims = columnsByType.dimensions
    const mets = columnsByType.metrics
    const dates = columnsByType.dates

    if (dims[0] && mets.length >= 2) {
      s.push(`${schema[mets[0]]?.label} and ${schema[mets[1]]?.label} by ${schema[dims[0]]?.label}`)
    } else if (dims[0] && mets[0]) {
      s.push(`${schema[mets[0]]?.label || mets[0]} by ${schema[dims[0]]?.label || dims[0]}`)
    }
    if (dates[0] && mets[0]) {
      s.push(`${schema[mets[0]]?.label || mets[0]} over ${schema[dates[0]]?.label || dates[0]} as a line chart`)
    }
    if (dims[0] && mets[0]) {
      s.push(`${schema[dims[0]]?.label || dims[0]} breakdown as pie chart`)
    }

    return s.slice(0, 3)
  }, [schema, columnsByType])

  if (suggestions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 animate-fade-in">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:scale-[1.02]"
          style={{
            background: 'var(--bg-overlay)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-light)',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export default function AIChartBuilder() {
  const { schema, rawData, columnsByType, aggregate, updateDatasetState, aiCharts, globalFilters, setGlobalFilters } = useData()
  const [promptOpen, setPromptOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  // Local charts state, initialized from persisted aiCharts
  const [charts, setCharts] = useState(aiCharts || [])
  const initializedRef = useRef(false)

  // Sync from context when aiCharts changes (project switch, page return)
  useEffect(() => {
    if (aiCharts && aiCharts.length > 0) {
      setCharts(aiCharts)
      initializedRef.current = true
    } else if (aiCharts && aiCharts.length === 0 && initializedRef.current) {
      setCharts([])
    }
  }, [JSON.stringify(aiCharts)])

  // Persist to DataContext (auto-saves to Supabase via debounced save)
  const persistCharts = useCallback((newCharts) => {
    setCharts(newCharts)
    const clean = newCharts.map(c => ({
      dimensions: c.dimensions,
      metrics: c.metrics,
      chart_type: c.chart_type,
      title: c.title,
      sort_by: c.sort_by,
      sort_dir: c.sort_dir,
      limit: c.limit,
      _prompt: c._prompt,
    }))
    updateDatasetState('aiCharts', clean)
  }, [updateDatasetState])

  const handlePromptSubmit = async (prompt) => {
    setLoading(true)
    setError(null)
    try {
      const config = await parseChartRequest(prompt, schema)
      if (config.error) {
        setError(config.error)
        return
      }
      config._prompt = prompt
      persistCharts([...charts, config])
      setPromptOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to create chart')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = (index) => {
    persistCharts(charts.filter((_, i) => i !== index))
  }

  const handleUpdate = useCallback((index, updatedConfig) => {
    setCharts(prev => {
      const next = [...prev]
      next[index] = updatedConfig
      const clean = next.map(c => ({
        dimensions: c.dimensions,
        metrics: c.metrics,
        chart_type: c.chart_type,
        title: c.title,
        sort_by: c.sort_by,
        sort_dir: c.sort_dir,
        limit: c.limit,
        _prompt: c._prompt,
      }))
      setTimeout(() => updateDatasetState('aiCharts', clean), 0)
      return next
    })
  }, [updateDatasetState])

  if (!rawData || !schema) return null

  const handleBarClick = (dimension, value) => {
    setGlobalFilters(prev => {
      const current = prev[dimension] || []
      if (current.includes(value)) {
        const next = current.filter(v => v !== value)
        const result = { ...prev }
        if (next.length === 0) delete result[dimension]
        else result[dimension] = next
        return result
      } else {
        return { ...prev, [dimension]: [value] }
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* Toggle bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {charts.length > 0 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              {charts.length} AI visual{charts.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
        {!promptOpen && (
          <button
            onClick={() => { setPromptOpen(true); setError(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(196, 160, 105, 0.1), rgba(196, 160, 105, 0.05))',
              color: 'var(--accent)',
              border: '1px solid var(--border-accent)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Visual</span>
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Prompt bar */}
      {promptOpen && (
        <div>
          <PromptBar onSubmit={handlePromptSubmit} loading={loading} onClose={() => { setPromptOpen(false); setError(null) }} />
          {!loading && charts.length === 0 && (
            <Suggestions schema={schema} columnsByType={columnsByType} onSelect={handlePromptSubmit} />
          )}
          {error && (
            <p className="text-xs mt-1.5 px-1" style={{ color: '#ef4444' }}>{error}</p>
          )}
        </div>
      )}

      {/* AI Charts grid */}
      {!collapsed && charts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          {charts.map((config, i) => (
            <AIChart
              key={`ai-chart-${i}-${config._prompt || i}`}
              config={config}
              index={i}
              schema={schema}
              columnsByType={columnsByType}
              aggregate={aggregate}
              onRemove={handleRemove}
              onUpdate={handleUpdate}
              onBarClick={handleBarClick}
              globalFilters={globalFilters}
            />
          ))}
        </div>
      )}
    </div>
  )
}
