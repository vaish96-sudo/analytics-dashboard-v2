import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { useData } from '../context/DataContext'
import { CHART_COLORS, smartFormat, truncate } from '../utils/formatters'
import { Tag, Hash, X, BarChart3, TrendingUp, PieChart as PieIcon, Table2, Plus, Filter, Trash2, Download, Check, RotateCcw, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

function TogglePill({ col, label, type, isSelected, onToggle, isCustom }) {
  const baseColors = type === 'dimension'
    ? (isSelected ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-sky-50 text-sky-600 border-sky-200 opacity-70')
    : isCustom
      ? (isSelected ? 'bg-teal-100 text-teal-800 border-teal-400 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600' : 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 opacity-80')
      : (isSelected ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-50 text-emerald-600 border-emerald-200 opacity-70')
  const Icon = type === 'dimension' ? Tag : Hash
  return (
    <button draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ col, type })) }}
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer hover:shadow-sm transition-all ${baseColors}`}>
      {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
      <Icon className="w-3 h-3" /><span>{label}</span>
    </button>
  )
}

function DropZone({ label, items, onDrop, onRemove, accept }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); try { const d = JSON.parse(e.dataTransfer.getData('text/plain')); if (accept.includes(d.type)) onDrop(d.col) } catch {} }}
      className={`min-h-[44px] p-2.5 rounded-xl border-2 border-dashed transition-all ${dragOver ? 'border-accent bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {items.length === 0 && <span className="text-xs text-slate-400 flex items-center gap-1"><Plus className="w-3 h-3" />{label}</span>}
        {items.map(item => (
          <span key={item.col} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${item.type === 'dimension' ? 'bg-sky-50 text-sky-700 border-sky-200' : item.isCustom ? 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {item.type === 'dimension' ? <Tag className="w-2.5 h-2.5" /> : <Hash className="w-2.5 h-2.5" />}
            {item.label}
            <button onClick={() => onRemove(item.col)} className="ml-0.5 hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}
      </div>
    </div>
  )
}

function MultiSelectFilter({ col, schema, uniqueValues, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef(null)
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const toggle = (val) => { if (selected.includes(val)) onChange(selected.filter(v => v !== val)); else onChange([...selected, val]) }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:border-slate-300 flex items-center gap-1.5 min-w-[100px]">
        <span className="truncate">{selected.length > 0 ? `${selected.length} selected` : schema[col]?.label || col}</span>
        <Filter className="w-3 h-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50">
          <div className="p-1 border-b border-slate-100 flex gap-1">
            <button onClick={() => onChange(uniqueValues.map(String))} className="text-[10px] text-accent hover:underline px-2 py-1">All</button>
            <button onClick={() => onChange([])} className="text-[10px] text-red-500 hover:underline px-2 py-1">None</button>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {uniqueValues.map(val => (
              <label key={val} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
                <input type="checkbox" checked={selected.includes(String(val))} onChange={() => toggle(String(val))} className="w-3.5 h-3.5 rounded border-slate-300 text-accent" />
                <span className="truncate">{truncate(String(val), 30)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const CHART_TYPES = [{ value: 'bar', icon: BarChart3 }, { value: 'line', icon: TrendingUp }, { value: 'pie', icon: PieIcon }, { value: 'table', icon: Table2 }]
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (<div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
    <p className="text-xs font-medium text-slate-700 mb-1.5">{truncate(String(label), 40)}</p>
    {payload.map((e, i) => (<div key={i} className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} /><span className="text-slate-500">{e.name}:</span><span className="text-slate-800 font-medium">{smartFormat(e.value, e.name)}</span></div>))}
  </div>)
}

const PIE_MAX = 12

export default function ReportBuilder() {
  const { schema, columnsByType, aggregate, getUniqueValues, activeDatasetId, updateDatasetState, reportBuilderState } = useData()
  const saved = reportBuilderState || {}
  const [selectedDims, setSelectedDims] = useState(saved.selectedDims || [])
  const [selectedMetrics, setSelectedMetrics] = useState(saved.selectedMetrics || [])
  const [chartType, setChartType] = useState(saved.chartType || 'bar')
  const [filters, setFilters] = useState(saved.filters || [])
  const [dimSearch, setDimSearch] = useState('')
  const [metSearch, setMetSearch] = useState('')
  const [tableSortCol, setTableSortCol] = useState(null)
  const [tableSortDir, setTableSortDir] = useState('desc')

  useEffect(() => { updateDatasetState('reportBuilderState', { selectedDims, selectedMetrics, chartType, filters }) }, [selectedDims, selectedMetrics, chartType, filters])
  useEffect(() => { const s = reportBuilderState || {}; setSelectedDims(s.selectedDims || []); setSelectedMetrics(s.selectedMetrics || []); setChartType(s.chartType || 'bar'); setFilters(s.filters || []) }, [activeDatasetId])

  const toggleDim = useCallback((col) => { setSelectedDims(p => p.includes(col) ? p.filter(c => c !== col) : [...p, col]) }, [])
  const toggleMetric = useCallback((col) => { setSelectedMetrics(p => p.includes(col) ? p.filter(c => c !== col) : [...p, col]) }, [])
  const addDim = useCallback((col) => { if (!selectedDims.includes(col)) setSelectedDims(p => [...p, col]) }, [selectedDims])
  const addMetric = useCallback((col) => { if (!selectedMetrics.includes(col)) setSelectedMetrics(p => [...p, col]) }, [selectedMetrics])
  const removeDim = useCallback((col) => setSelectedDims(p => p.filter(c => c !== col)), [])
  const removeMetric = useCallback((col) => setSelectedMetrics(p => p.filter(c => c !== col)), [])
  const clearAllSelections = () => { setSelectedDims([]); setSelectedMetrics([]); setFilters([]); setTableSortCol(null) }

  const addFilter = () => { const available = columnsByType.dimensions.filter(d => !filters.some(f => f.col === d)); if (available.length > 0) setFilters(prev => [...prev, { col: available[0], values: [] }]) }
  const removeFilter = (idx) => setFilters(prev => prev.filter((_, i) => i !== idx))
  const updateFilterCol = (idx, col) => setFilters(prev => prev.map((f, i) => i === idx ? { col, values: [] } : f))
  const updateFilterVals = (idx, values) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, values } : f))

  const hasSelections = selectedDims.length > 0 || selectedMetrics.length > 0

  // Filter dimensions and metrics by search
  const filteredDims = useMemo(() => {
    if (!dimSearch.trim()) return columnsByType.dimensions
    const q = dimSearch.toLowerCase()
    return columnsByType.dimensions.filter(col => (schema[col]?.label || col).toLowerCase().includes(q))
  }, [columnsByType.dimensions, dimSearch, schema])

  const filteredMets = useMemo(() => {
    if (!metSearch.trim()) return columnsByType.metrics
    const q = metSearch.toLowerCase()
    return columnsByType.metrics.filter(col => (schema[col]?.label || col).toLowerCase().includes(q))
  }, [columnsByType.metrics, metSearch, schema])

  const reportData = useMemo(() => {
    if (selectedMetrics.length === 0) return []
    const filterObj = {}; filters.forEach(f => { if (f.values.length > 0) filterObj[f.col] = f.values })
    return aggregate(selectedDims, selectedMetrics, filterObj).sort((a, b) => (b[selectedMetrics[0]] || 0) - (a[selectedMetrics[0]] || 0)).slice(0, 50)
  }, [selectedDims, selectedMetrics, filters, aggregate])

  const displayData = useMemo(() => reportData.map((row, i) => ({ ...row, _label: selectedDims.length > 0 ? selectedDims.map(d => truncate(String(row[d] ?? ''), 20)).join(' / ') : `Row ${i + 1}` })), [reportData, selectedDims])

  // Sortable table data
  const sortedTableData = useMemo(() => {
    if (!tableSortCol || chartType !== 'table') return displayData
    return [...displayData].sort((a, b) => {
      const va = a[tableSortCol]; const vb = b[tableSortCol]
      const na = typeof va === 'number' ? va : parseFloat(String(va ?? '').replace(/[,$%]/g, ''))
      const nb = typeof vb === 'number' ? vb : parseFloat(String(vb ?? '').replace(/[,$%]/g, ''))
      if (!isNaN(na) && !isNaN(nb)) return tableSortDir === 'asc' ? na - nb : nb - na
      return tableSortDir === 'asc' ? String(va ?? '').localeCompare(String(vb ?? '')) : String(vb ?? '').localeCompare(String(va ?? ''))
    })
  }, [displayData, tableSortCol, tableSortDir, chartType])

  const handleTableSort = (col) => {
    if (tableSortCol === col) setTableSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setTableSortCol(col); setTableSortDir('desc') }
  }

  const pieData = useMemo(() => {
    if (selectedMetrics.length === 0 || displayData.length === 0) return []
    const metric = selectedMetrics[0]
    if (displayData.length <= PIE_MAX) return displayData.map(d => ({ name: d._label, value: d[metric] || 0 }))
    const top = displayData.slice(0, PIE_MAX - 1); const rest = displayData.slice(PIE_MAX - 1)
    return [...top.map(d => ({ name: d._label, value: d[metric] || 0 })), { name: `Other (${rest.length})`, value: rest.reduce((s, d) => s + (d[metric] || 0), 0) }]
  }, [displayData, selectedMetrics])

  const handleExportExcel = async () => {
    if (displayData.length === 0) return
    const XLSX = await import('xlsx')
    const exportRows = reportData.map(row => { const r = {}; selectedDims.forEach(d => { r[schema[d]?.label || d] = row[d] }); selectedMetrics.forEach(m => { r[schema[m]?.label || m] = row[m] }); return r })
    const ws = XLSX.utils.json_to_sheet(exportRows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Report'); XLSX.writeFile(wb, 'report_export.xlsx')
  }

  const showDimSearch = columnsByType.dimensions.length > 8
  const showMetSearch = columnsByType.metrics.length > 8

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-display font-semibold text-slate-800">Report Builder</h3>
          {hasSelections && (
            <button onClick={clearAllSelections} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              <RotateCcw className="w-3 h-3" /> Reset All
            </button>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dimensions <span className="normal-case text-slate-400 font-normal">({columnsByType.dimensions.length})</span></p>
              {showDimSearch && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input type="text" value={dimSearch} onChange={e => setDimSearch(e.target.value)} placeholder="Search dimensions…"
                    className="pl-7 pr-3 py-1 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:border-accent w-48" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredDims.map(col => <TogglePill key={col} col={col} label={schema[col].label} type="dimension" isSelected={selectedDims.includes(col)} onToggle={() => toggleDim(col)} />)}
              {filteredDims.length === 0 && <span className="text-xs text-slate-400">No dimensions match "{dimSearch}"</span>}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Metrics <span className="normal-case text-slate-400 font-normal">({columnsByType.metrics.length})</span></p>
              {showMetSearch && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input type="text" value={metSearch} onChange={e => setMetSearch(e.target.value)} placeholder="Search metrics…"
                    className="pl-7 pr-3 py-1 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:border-accent w-48" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredMets.map(col => <TogglePill key={col} col={col} label={schema[col].label} type="metric" isSelected={selectedMetrics.includes(col)} onToggle={() => toggleMetric(col)} isCustom={!!schema[col]?.isCustom} />)}
              {filteredMets.length === 0 && <span className="text-xs text-slate-400">No metrics match "{metSearch}"</span>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><p className="text-xs font-medium text-slate-500 mb-1.5">Selected Dimensions</p>
              <DropZone label="Dimensions" items={selectedDims.map(c => ({ col: c, label: schema[c]?.label || c, type: 'dimension' }))} onDrop={addDim} onRemove={removeDim} accept={['dimension']} /></div>
            <div><p className="text-xs font-medium text-slate-500 mb-1.5">Selected Metrics</p>
              <DropZone label="Metrics" items={selectedMetrics.map(c => ({ col: c, label: schema[c]?.label || c, type: 'metric', isCustom: !!schema[c]?.isCustom }))} onDrop={addMetric} onRemove={removeMetric} accept={['metric']} /></div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {CHART_TYPES.map(ct => (<button key={ct.value} onClick={() => setChartType(ct.value)}
                className={`p-2 rounded-md transition-colors ${chartType === ct.value ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}><ct.icon className="w-4 h-4" /></button>))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {filters.map((f, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
                  <select value={f.col} onChange={(e) => updateFilterCol(idx, e.target.value)} className="text-xs appearance-none bg-transparent border-none text-slate-600 focus:outline-none pr-4">
                    {columnsByType.dimensions.map(d => <option key={d} value={d}>{schema[d].label}</option>)}
                  </select>
                  <MultiSelectFilter col={f.col} schema={schema} uniqueValues={getUniqueValues(f.col).map(String)} selected={f.values} onChange={(vals) => updateFilterVals(idx, vals)} />
                  <button onClick={() => removeFilter(idx)} className="p-1 text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button onClick={addFilter} className="text-xs text-accent hover:text-accent-dark flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-blue-50"><Plus className="w-3 h-3" /> Filter</button>
              {filters.length > 0 && <button onClick={() => setFilters([])} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3 h-3" /> Clear</button>}
            </div>
          </div>
          {displayData.length > 0 ? (
            <div>
              {chartType === 'table' ? (
                <div>
                  <div className="flex justify-end mb-2">
                    <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Export to Excel
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200" style={{ minHeight: '200px' }}>
                    <table className="w-full">
                      <thead><tr className="bg-slate-50">
                        {selectedDims.map(d => (
                          <th key={d} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700" onClick={() => handleTableSort(d)}>
                            <div className="flex items-center gap-1">
                              {schema[d]?.label}
                              {tableSortCol === d ? (tableSortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                            </div>
                          </th>
                        ))}
                        {selectedMetrics.map(m => (
                          <th key={m} className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700" onClick={() => handleTableSort(m)}>
                            <div className="flex items-center gap-1 justify-end">
                              {schema[m]?.label}
                              {tableSortCol === m ? (tableSortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                            </div>
                          </th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedTableData.map((row, i) => (<tr key={i} className="hover:bg-slate-50">
                          {selectedDims.map(d => <td key={d} className="px-4 py-2 text-sm text-slate-600">{truncate(String(row[d] ?? '–'), 40)}</td>)}
                          {selectedMetrics.map(m => <td key={m} className="px-4 py-2 text-sm text-right font-mono text-slate-800">{smartFormat(row[m], m)}</td>)}
                        </tr>))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={displayData} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="_label" tick={{ fill: '#64748b', fontSize: 11 }} angle={-35} textAnchor="end" height={80} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} /><Tooltip content={<CustomTooltip />} /><Legend />
                        {selectedMetrics.map((m, i) => <Bar key={m} dataKey={m} name={schema[m]?.label} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]} />)}
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={displayData} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="_label" tick={{ fill: '#64748b', fontSize: 11 }} angle={-35} textAnchor="end" height={80} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} /><Tooltip content={<CustomTooltip />} /><Legend />
                        {selectedMetrics.map((m, i) => <Line key={m} type="monotone" dataKey={m} name={schema[m]?.label} stroke={CHART_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />)}
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" innerRadius="35%" paddingAngle={2}
                          label={({ name, percent }) => `${truncate(name, 12)} (${(percent * 100).toFixed(0)}%)`} labelLine={{ stroke: '#94a3b8' }}>
                          {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie><Tooltip /><Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, maxHeight: 300, overflowY: 'auto' }} />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (<div className="h-[150px] flex items-center justify-center text-sm text-slate-400">Tap dimensions and metrics above to build your report</div>)}
        </div>
      </div>
    </div>
  )
}
