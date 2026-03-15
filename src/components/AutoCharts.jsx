import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useData } from '../context/DataContext'
import { CHART_COLORS, smartFormat, truncate } from '../utils/formatters'
import { BarChart3, TrendingUp, PieChart as PieIcon, AreaChart as AreaIcon, Maximize2, Minimize2 } from 'lucide-react'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-xs font-medium text-slate-700 mb-1.5">{truncate(String(label), 40)}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} /><span className="text-slate-500">{entry.name}:</span>
          <span className="text-slate-800 font-medium">{smartFormat(entry.value, entry.name)}</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ defaultType, defaultDim, defaultMet, index, schema, columnsByType, aggregate, savedState, onStateChange, onBarClick, globalFilters }) {
  const [expanded, setExpanded] = useState(false)
  const [dim, setDim] = useState(savedState?.dim || defaultDim)
  const [met, setMet] = useState(savedState?.met || defaultMet)
  const [chartType, setChartType] = useState(savedState?.chartType || defaultType)

  useEffect(() => { onStateChange(index, { dim, met, chartType }) }, [dim, met, chartType, index])

  const data = useMemo(() => {
    if (!dim || !met) return []
    return aggregate([dim], [met]).sort((a, b) => (b[met] || 0) - (a[met] || 0)).slice(0, 12)
  }, [dim, met, aggregate])

  const pieData = useMemo(() => {
    if (chartType !== 'pie' || !data.length) return []
    const total = data.reduce((s, d) => s + (d[met] || 0), 0)
    return data.slice(0, 8).map(d => ({ name: truncate(String(d[dim] ?? ''), 20), value: d[met] || 0, percent: total > 0 ? ((d[met] || 0) / total * 100).toFixed(1) : 0, _raw: d[dim] }))
  }, [data, chartType, dim, met])

  const types = [{ v: 'bar', I: BarChart3 }, { v: 'line', I: TrendingUp }, { v: 'pie', I: PieIcon }, { v: 'area', I: AreaIcon }]

  const handleClick = (row) => {
    if (!row || !dim) return
    const val = row[dim] || row._raw || row.name
    if (val) onBarClick(dim, String(val))
  }

  const dimFilter = globalFilters[dim] || []
  const hasDimFilter = dimFilter.length > 0

  return (
    <div className={`rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden transition-all animate-slide-up ${expanded ? 'col-span-full' : ''}`} style={{ animationDelay: `${index * 80}ms` }}>
      <div className="flex items-center justify-between p-4 pb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {types.map(t => (<button key={t.v} onClick={() => setChartType(t.v)} className={`p-1.5 rounded-md transition-colors ${chartType === t.v ? 'bg-accent text-white' : 'text-slate-400 hover:bg-slate-100'}`}><t.I className="w-3.5 h-3.5" /></button>))}
        </div>
        <div className="flex items-center gap-2">
          <select value={dim} onChange={(e) => setDim(e.target.value)} className="text-xs appearance-none bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 pr-6 text-slate-600 focus:outline-none focus:border-accent">
            {columnsByType.dimensions.map(d => <option key={d} value={d}>{schema[d].label}</option>)}
            {columnsByType.dates.map(d => <option key={d} value={d}>{schema[d].label}</option>)}
          </select>
          <select value={met} onChange={(e) => setMet(e.target.value)} className="text-xs appearance-none bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 pr-6 text-slate-600 focus:outline-none focus:border-accent">
            {columnsByType.metrics.map(m => <option key={m} value={m}>{schema[m].label}</option>)}
          </select>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="text-sm font-display font-semibold text-slate-700 px-4">{schema[met]?.label} by {schema[dim]?.label}</div>
      <div className={`p-4 pt-2 ${expanded ? 'h-[500px]' : 'h-[280px]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }} onClick={(e) => { if (e?.activePayload) handleClick(e.activePayload[0]?.payload) }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={dim} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => smartFormat(v, met)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={met} name={schema[met]?.label || met} radius={[4, 4, 0, 0]} cursor="pointer">
                {data.map((entry, i) => {
                  const isActive = hasDimFilter && dimFilter.includes(String(entry[dim]))
                  return <Cell key={i} fill={isActive ? '#1e40af' : CHART_COLORS[index % CHART_COLORS.length]} opacity={hasDimFilter && !isActive ? 0.3 : 1} />
                })}
              </Bar>
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={dim} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} /><Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey={met} name={schema[met]?.label || met} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <defs><linearGradient id={`ag-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.3} /><stop offset="95%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={dim} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => truncate(String(v), 12)} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} /><Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={met} name={schema[met]?.label || met} stroke={CHART_COLORS[index % CHART_COLORS.length]} fill={`url(#ag-${index})`} strokeWidth={2} />
            </AreaChart>
          ) : (
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" innerRadius="45%" paddingAngle={2}
                label={({ name, percent }) => `${name} (${percent}%)`} labelLine={{ stroke: '#94a3b8' }}
                onClick={(_, idx) => { if (pieData[idx]) handleClick({ [dim]: pieData[idx]._raw || pieData[idx].name }) }}>
                {pieData.map((entry, i) => {
                  const isActive = hasDimFilter && dimFilter.includes(String(entry._raw || entry.name))
                  return <Cell key={i} fill={CHART_COLORS[i]} cursor="pointer" opacity={hasDimFilter && !isActive ? 0.3 : 1} />
                })}
              </Pie><Tooltip content={<CustomTooltip />} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function AutoCharts() {
  const { rawData, schema, columnsByType, aggregate, activeDatasetId, updateDatasetState, globalFilters, setGlobalFilters, chartsState } = useData()
  const [aiChartConfigs, setAiChartConfigs] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const aiRequestedRef = useRef(null)

  // Basic heuristic charts (instant fallback)
  const basicCharts = useMemo(() => {
    if (!rawData || !schema) return []
    const { dimensions, metrics, dates } = columnsByType; const c = []
    if (dimensions.length > 0 && metrics.length > 0) c.push({ type: 'bar', dim: dimensions[0], met: metrics[0] })
    if (dates.length > 0 && metrics.length > 0) c.push({ type: 'area', dim: dates[0], met: metrics[0] })
    if (dimensions.length > 0 && metrics.length > 0) c.push({ type: 'pie', dim: dimensions[0], met: metrics[0] })
    if (metrics.length > 1 && dimensions.length > 0) c.push({ type: 'bar', dim: dimensions.length > 1 ? dimensions[1] : dimensions[0], met: metrics[1] })
    if (metrics.length >= 2 && dimensions.length > 0) c.push({ type: 'line', dim: dimensions[0], met: metrics.length > 2 ? metrics[2] : metrics[1] })
    return c.slice(0, 4)
  }, [rawData, schema, columnsByType])

  // AI-powered smart chart selection — runs once per dataset
  useEffect(() => {
    if (!rawData || !schema || !activeDatasetId) return
    if (activeDatasetId === '__pending__') return
    if (aiRequestedRef.current === activeDatasetId) return
    // If user already has saved chart states, don't override
    if (chartsState && Object.keys(chartsState).length > 0) return

    aiRequestedRef.current = activeDatasetId
    setAiLoading(true)

    const cols = Object.entries(schema)
      .filter(([, def]) => def.type !== 'ignore')
      .map(([col, def]) => `- ${col} (${def.type}): "${def.label}"`)
      .join('\n')

    // Build a data summary for AI
    const { dimensions, metrics, dates } = columnsByType
    const summaryParts = []

    // Unique value counts for dimensions
    dimensions.slice(0, 6).forEach(dim => {
      const unique = new Set(rawData.map(r => r[dim])).size
      summaryParts.push(`${dim}: ${unique} unique values`)
    })

    // Metric ranges
    metrics.slice(0, 6).forEach(met => {
      const vals = rawData.map(r => parseFloat(String(r[met] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
      if (vals.length > 0) {
        const min = Math.min(...vals), max = Math.max(...vals), avg = vals.reduce((a, b) => a + b, 0) / vals.length
        summaryParts.push(`${met}: min=${min.toFixed(1)}, max=${max.toFixed(1)}, avg=${avg.toFixed(1)}`)
      }
    })

    if (dates.length > 0) summaryParts.push(`Date columns: ${dates.join(', ')}`)

    const system = `You are a data visualization expert. Given a dataset's columns and statistics, recommend the 4 most insightful chart combinations.

Dataset columns:
${cols}

Data summary (${rawData.length} rows):
${summaryParts.join('\n')}

Rules:
- Use EXACT column names from the list above.
- Pick combinations that reveal interesting patterns, not obvious totals.
- If there are date columns, include at least one time series (line or area chart).
- If a dimension has 2-8 unique values, it's great for pie charts. If 8+, use bar.
- Pair high-variance metrics with the most relevant dimensions.
- Avoid repeating the same dimension+metric combo.
- Chart types: "bar", "line", "pie", "area"

Respond with ONLY a JSON array (no markdown, no backticks):
[{"type":"bar","dim":"column_name","met":"column_name","reason":"Brief explanation"}]`

    fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system,
        messages: [{ role: 'user', content: 'Recommend the 4 best chart combinations for this dataset.' }],
        max_tokens: 500,
        model: 'claude-sonnet-4-6',
      }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return
        const text = data.content?.map(c => c.text || '').join('') || ''
        try {
          const configs = JSON.parse(text.replace(/```json|```/g, '').trim())
          // Validate: all dimensions and metrics must exist in schema
          const validTypes = ['bar', 'line', 'pie', 'area']
          const valid = configs.filter(c =>
            validTypes.includes(c.type) &&
            schema[c.dim] &&
            schema[c.met]
          )
          if (valid.length >= 2) {
            setAiChartConfigs(valid.slice(0, 4))
            console.log('Smart charts:', valid.map(c => `${c.met} by ${c.dim} (${c.type})`).join(', '))
          }
        } catch (e) {
          console.log('Smart chart parsing failed:', e.message)
        }
      })
      .catch(() => {})
      .finally(() => setAiLoading(false))
  }, [activeDatasetId, rawData, schema, columnsByType])

  // Use AI configs if available, otherwise fallback to basic
  const charts = aiChartConfigs || basicCharts

  const handleChartStateChange = useCallback((index, state) => { updateDatasetState('chartsState', { ...chartsState, [index]: state }) }, [chartsState, updateDatasetState])

  const handleBarClick = useCallback((dimension, value) => {
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
  }, [setGlobalFilters])

  if (charts.length === 0) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {charts.map((ch, i) => (
        <ChartCard key={`${activeDatasetId}-${i}`} index={i}
          defaultType={ch.type} defaultDim={ch.dim} defaultMet={ch.met}
          savedState={chartsState[i]} onStateChange={handleChartStateChange}
          onBarClick={handleBarClick} globalFilters={globalFilters}
          schema={schema} columnsByType={columnsByType} aggregate={aggregate} />
      ))}
    </div>
  )
}
