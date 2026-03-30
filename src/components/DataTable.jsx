import React, { useState, useMemo, useRef, useEffect, memo } from 'react'
import { useData } from '../context/DataContext'
import { smartFormat, truncate } from '../utils/formatters'
import { useDebounce } from '../hooks/useDebounce'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, Filter, X, Download } from 'lucide-react'

const PAGE_SIZE = 25

const ColumnFilter = memo(function ColumnFilter({ col, schema, uniqueValues, selected, hasFilter, onToggle, onClear, onSelectAll }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [])
  const filtered = search ? uniqueValues.filter(v => String(v).toLowerCase().includes(search.toLowerCase())) : uniqueValues
  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(!open)} className={`ml-1 p-0.5 rounded transition-colors ${hasFilter ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
        <Filter className="w-3 h-3" />
      </button>
      {open && (
        <div className="fixed mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-[100] animate-fade-in"
          style={{ top: ref.current?.getBoundingClientRect().bottom + 4, left: ref.current?.getBoundingClientRect().left }}>
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div className="p-1 border-b border-slate-100 flex gap-1">
            <button onClick={onSelectAll} className="text-[10px] text-accent hover:underline px-2 py-1">Select All</button>
            <button onClick={onClear} className="text-[10px] text-red-500 hover:underline px-2 py-1">Clear</button>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map(val => {
              const strVal = String(val)
              const isChecked = !hasFilter || selected.includes(strVal)
              return (
                <label key={val} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
                  <input type="checkbox" checked={isChecked} onChange={() => onToggle(strVal)} className="w-3.5 h-3.5 rounded border-slate-300 text-accent focus:ring-accent/30" />
                  <span className="truncate">{truncate(strVal, 30)}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

export default function DataTable() {
  const { rawData, schema, getUniqueValues, activeDatasetId, updateDatasetState, dataTableState } = useData()

  // Load persisted state from context
  const saved = dataTableState || {}
  const [sortCol, setSortCol] = useState(saved.sortCol || null)
  const [sortDir, setSortDir] = useState(saved.sortDir || 'asc')
  const [page, setPage] = useState(saved.page || 0)
  const [search, setSearch] = useState(saved.search || '')
  const [colFilters, setColFilters] = useState(saved.colFilters || {})
  const debouncedSearch = useDebounce(search, 250)

  // Sync state back to DataContext
  useEffect(() => {
    updateDatasetState('dataTableState', { sortCol, sortDir, page, search, colFilters })
  }, [sortCol, sortDir, page, search, colFilters])

  // Restore state when switching datasets
  useEffect(() => {
    const s = dataTableState || {}
    setSortCol(s.sortCol || null)
    setSortDir(s.sortDir || 'asc')
    setPage(s.page || 0)
    setSearch(s.search || '')
    setColFilters(s.colFilters || {})
  }, [activeDatasetId])

  const visibleCols = useMemo(() => {
    if (!schema) return []
    return Object.entries(schema).filter(([, def]) => def.type !== 'ignore').map(([col]) => col)
  }, [schema])

  const uniqueByCol = useMemo(() => {
    const u = {}; visibleCols.forEach(col => { u[col] = getUniqueValues(col) }); return u
  }, [visibleCols, getUniqueValues])

  const toggleFilter = (col, val) => {
    setColFilters(prev => {
      const hasFilter = col in prev
      const current = prev[col] || []
      const allVals = uniqueByCol[col]?.map(v => String(v)) || []
      if (!hasFilter) { return { ...prev, [col]: allVals.filter(v => v !== val) } }
      else if (current.includes(val)) { return { ...prev, [col]: current.filter(v => v !== val) } }
      else { const next = [...current, val]; if (next.length >= allVals.length) { const { [col]: _, ...rest } = prev; return rest }; return { ...prev, [col]: next } }
    })
    setPage(0)
  }
  const selectAllFilter = (col) => { setColFilters(prev => { const { [col]: _, ...rest } = prev; return rest }); setPage(0) }
  const clearFilter = (col) => { setColFilters(prev => ({ ...prev, [col]: [] })); setPage(0) }
  const clearAllFilters = () => { setColFilters({}); setSearch(''); setSortCol(null); setSortDir('asc'); setPage(0) }

  const filteredData = useMemo(() => {
    if (!rawData) return []
    let d = rawData
    Object.entries(colFilters).forEach(([col, vals]) => {
      if (vals.length === 0) d = []
      else d = d.filter(row => vals.includes(String(row[col])))
    })
    if (debouncedSearch.trim()) { const q = debouncedSearch.toLowerCase(); d = d.filter(row => visibleCols.some(col => { const v = row[col]; return v !== null && v !== undefined && String(v).toLowerCase().includes(q) })) }
    return d
  }, [rawData, debouncedSearch, visibleCols, colFilters])

  const sortedData = useMemo(() => {
    if (!sortCol) return filteredData
    return [...filteredData].sort((a, b) => {
      const na = typeof a[sortCol] === 'number' ? a[sortCol] : parseFloat(String(a[sortCol] ?? '').replace(/[,$%]/g, ''))
      const nb = typeof b[sortCol] === 'number' ? b[sortCol] : parseFloat(String(b[sortCol] ?? '').replace(/[,$%]/g, ''))
      if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na
      return sortDir === 'asc' ? String(a[sortCol] ?? '').localeCompare(String(b[sortCol] ?? '')) : String(b[sortCol] ?? '').localeCompare(String(a[sortCol] ?? ''))
    })
  }, [filteredData, sortCol, sortDir])

  const pageCount = Math.ceil(sortedData.length / PAGE_SIZE)
  const pageData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc') }; setPage(0) }

  const exportToExcel = async () => {
    const XLSX = await import('xlsx')
    const exportData = sortedData.map(row => { const obj = {}; visibleCols.forEach(col => { obj[schema[col].label] = row[col] }); return obj })
    const ws = XLSX.utils.json_to_sheet(exportData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data'); XLSX.writeFile(wb, 'export.xlsx')
  }

  const hasActiveFilters = Object.keys(colFilters).length > 0 || search.trim()

  if (!rawData) return null
  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Search data…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20" />
        </div>
        <span className="text-xs text-slate-500">{filteredData.length.toLocaleString()} rows</span>
        {hasActiveFilters && (
          <button onClick={clearAllFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"><X className="w-3 h-3" /> Clear all filters</button>
        )}
        <button onClick={exportToExcel} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-dark px-3 py-1.5 rounded-lg border border-accent/30 hover:bg-blue-50 ml-auto transition-colors">
          <Download className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>
      <div className="overflow-x-auto" style={{ minHeight: '500px' }}>
        <table className="w-full data-table">
          <thead>
            <tr>
              {visibleCols.map(col => (
                <th key={col} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort(col)} className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                      <span>{schema[col].label}</span>
                      {sortCol === col ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                    </button>
                    <ColumnFilter col={col} schema={schema} uniqueValues={uniqueByCol[col] || []}
                      selected={colFilters[col] || []} hasFilter={col in colFilters}
                      onToggle={(val) => toggleFilter(col, val)} onClear={() => clearFilter(col)} onSelectAll={() => selectAllFilter(col)} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageData.length === 0 ? (
              <tr><td colSpan={visibleCols.length} className="px-4 py-12 text-center text-sm text-slate-400">
                No rows match your filters.{hasActiveFilters && <button onClick={clearAllFilters} className="ml-2 text-accent hover:underline">Clear all filters</button>}
              </td></tr>
            ) : pageData.map((row, ri) => (
              <tr key={ri} className="hover:bg-slate-50 transition-colors">
                {visibleCols.map(col => (
                  <td key={col} className="px-4 py-2.5 text-sm whitespace-nowrap">
                    <span className={schema[col].type === 'metric' ? 'text-slate-800 font-mono text-xs' : 'text-slate-600'}>
                      {schema[col].type === 'metric' ? smartFormat(row[col], col) : truncate(String(row[col] ?? '–'), 40)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Page {page + 1} of {pageCount}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
