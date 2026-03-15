import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useData } from '../context/DataContext'
import { CHART_COLORS, smartFormat, truncate } from '../utils/formatters'
import {
  Sparkles, Send, X, BarChart3, TrendingUp, PieChart as PieIcon,
  AreaChart as AreaIcon, Table2, Maximize2, Minimize2, Loader2,
  Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
} from 'lucide-react'

const API_URL = '/api/claude'

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
  "metrics": ["col_name"],
  "chart_type": "bar|line|pie|area|table",
  "title": "Human readable chart title",
  "sort_by": "col_name",
  "sort_dir": "desc",
  "limit": 12
}

Rules:
- Match column names EXACTLY from the schema above (use the raw col name, not label).
- If the user says "by region" or "by campaign", find the closest dimension column.
- Default to "bar" chart unless the user specifies otherwise or context suggests better (e.g. time series → line, composition → pie).
- For "table" type, include more columns in metrics if relevant.
- If the request doesn't match available data, respond: {"error": "reason"}`

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      model: 'claude-sonnet-4-6',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'AI request failed')
  }

  const data = await res.json()
  const text = data.content?.map(c => c.text || '').join('') || ''
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
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{smartFormat(entry.value, entry.name)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Single AI Chart ─────────────────────────────────────────────
function AIChart({ config, schema, columnsByType, aggregate, index, onRemove, onUpdate }) {
  const [chartType, setChartType] = useState(config.chart_type || 'bar')
  const [expanded, setExpanded] = useState(false)
  const [dim, setDim] = useState(config.dimensions?.[0] || '')
  const [met, setMet] = useState(config.metrics?.[0] || '')

  useEffect(() => {
    onUpdate(index, { ...config, chart_type: chartType, dimensions: [dim], metrics: [met] })
  }, [chartType, dim, met])

  const data = useMemo(() => {
    if (!dim || !met) return []
    const raw = aggregate([dim], [met])
    const sorted = config.sort_by
      ? raw.sort((a, b) => (config.sort_dir === 'asc' ? (a[config.sort_by] || 0) - (b[config.sort_by] || 0) : (b[config.sort_by] || 0) - (a[config.sort_by] || 0)))
      : raw.sort((a, b) => (b[met] || 0) - (a[met] || 0))
    return sorted.slice(0, config.limit || 12)
  }, [dim, met, aggregate, config.sort_by, config.sort_dir, config.limit])

  const pieData = useMemo(() => {
    if (chartType !== 'pie' || !data.length) return []
    const total = data.reduce((s, d) => s + (d[met] || 0), 0)
    return data.slice(0, 8).map(d => ({
      name: truncate(String(d[dim] ?? ''), 20),
      value: d[met] || 0,
      percent: total > 0 ? ((d[met] || 0) / total * 100).toFixed(1) : 0,
      _raw: d[dim],
    }))
  }, [data, chartType, dim, met])

  const types = [
    { v: 'bar', I: BarChart3 },
    { v: 'line', I: TrendingUp },
    { v: 'pie', I: PieIcon },
    { v: 'area', I: AreaIcon },
    { v: 'table', I: Table2 },
  ]

  const allDims = [...columnsByType.dimensions, ...columnsByType.dates]
  const allMets = columnsByType.metrics

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
          <select
            value={met}
            onChange={e => setMet(e.target.value)}
            className="text-xs appearance-none rounded-lg px-2 py-1 pr-5 focus:outline-none nb-input"
          >
            {allMets.map(m => (
              <option key={m} value={m}>{schema[m]?.label || m}</option>
            ))}
          </select>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onRemove(index)}
            className="p-1.5 rounded-lg transition-colors hover:text-red-500"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-4 pb-1">
        <p className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
          {config.title || `${schema[met]?.label || met} by ${schema[dim]?.label || dim}`}
        </p>
        {config._prompt && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            "{config._prompt}"
          </p>
        )}
      </div>

      {/* Chart / Table */}
      <div className={`p-3 sm:p-4 pt-2 ${expanded ? 'h-[500px]' : 'h-[300px]'}`}>
        {chartType === 'table' ? (
          <div className="h-full overflow-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-overlay)' }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {schema[dim]?.label || dim}
                  </th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {schema[met]?.label || met}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{truncate(String(row[dim] ?? ''), 40)}</td>
                    <td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                      {smartFormat(row[met], met)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => smartFormat(v, met)} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey={met} name={schema[met]?.label || met} radius={[4, 4, 0, 0]}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => smartFormat(v, met)} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey={met} name={schema[met]?.label || met} stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS[0] }} />
              </LineChart>
            ) : chartType === 'area' ? (
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <defs>
                  <linearGradient id={`ai-grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis dataKey={dim} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => smartFormat(v, met)} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey={met} name={schema[met]?.label || met} stroke={CHART_COLORS[0]} fill={`url(#ai-grad-${index})`} strokeWidth={2.5} />
              </AreaChart>
            ) : (
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="75%"
                  innerRadius="45%"
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} (${percent}%)`}
                  labelLine={{ stroke: 'var(--text-muted)' }}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            )}
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
        placeholder="Describe a chart... e.g. &quot;Show clicks by campaign as a pie chart&quot;"
        disabled={loading}
        className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
        style={{ color: 'var(--text-primary)' }}
      />
      {loading ? (
        <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--accent)' }} />
      ) : (
        <button
          type="submit"
          disabled={!prompt.trim()}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
          style={{ color: 'var(--accent)' }}
        >
          <Send className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
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

    if (dims[0] && mets[0]) {
      s.push(`${schema[mets[0]]?.label || mets[0]} by ${schema[dims[0]]?.label || dims[0]}`)
    }
    if (dates[0] && mets[0]) {
      s.push(`${schema[mets[0]]?.label || mets[0]} over ${schema[dates[0]]?.label || dates[0]} as a line chart`)
    }
    if (dims[0] && mets[0]) {
      s.push(`${schema[dims[0]]?.label || dims[0]} breakdown as pie chart`)
    }
    if (mets.length > 1 && dims[0]) {
      s.push(`Compare ${schema[mets[0]]?.label} and ${schema[mets[1]]?.label} by ${schema[dims[0]]?.label}`)
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
  const { schema, rawData, columnsByType, aggregate, updateDatasetState } = useData()
  const [charts, setCharts] = useState([])
  const [promptOpen, setPromptOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  // Read saved AI charts from dataset state
  const { activeDataset } = useData()
  const savedCharts = activeDataset?.aiCharts || null

  // Load saved charts on mount
  useEffect(() => {
    if (savedCharts && savedCharts.length > 0 && charts.length === 0) {
      setCharts(savedCharts)
    }
  }, [savedCharts])

  // Save charts to dataset state when they change
  const saveCharts = useCallback((newCharts) => {
    setCharts(newCharts)
    // Save minimal config (no _prompt text for storage efficiency)
    updateDatasetState('aiCharts', newCharts.map(c => ({
      dimensions: c.dimensions,
      metrics: c.metrics,
      chart_type: c.chart_type,
      title: c.title,
      sort_by: c.sort_by,
      sort_dir: c.sort_dir,
      limit: c.limit,
      _prompt: c._prompt,
    })))
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
      saveCharts([...charts, config])
      setPromptOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to create chart')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = (index) => {
    saveCharts(charts.filter((_, i) => i !== index))
  }

  const handleUpdate = useCallback((index, updatedConfig) => {
    setCharts(prev => {
      const next = [...prev]
      next[index] = updatedConfig
      return next
    })
  }, [])

  if (!rawData || !schema) return null

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
              key={`ai-chart-${i}`}
              config={config}
              index={i}
              schema={schema}
              columnsByType={columnsByType}
              aggregate={aggregate}
              onRemove={handleRemove}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
