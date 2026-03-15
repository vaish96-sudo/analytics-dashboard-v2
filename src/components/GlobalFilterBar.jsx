import React, { useState, useRef, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { Filter, X, ChevronDown, RotateCcw } from 'lucide-react'

function FilterDropdown({ col, label, values, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = search ? values.filter(v => String(v).toLowerCase().includes(search.toLowerCase())) : values
  const hasSelection = selected.length > 0

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
          ${hasSelection ? 'bg-accent/10 text-accent border-accent/30' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
        <Filter className="w-3 h-3" />
        <span className="max-w-[100px] truncate">{hasSelection ? `${label} (${selected.length})` : label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-lg z-50 animate-fade-in">
          <div className="p-2 border-b border-slate-100">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-accent" />
          </div>
          <div className="p-1 border-b border-slate-100 flex gap-1">
            <button onClick={() => onChange(values.map(String))} className="text-[10px] text-accent hover:underline px-2 py-1">All</button>
            <button onClick={() => onChange([])} className="text-[10px] text-red-500 hover:underline px-2 py-1">None</button>
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.map(val => {
              const strVal = String(val)
              const isChecked = selected.includes(strVal)
              return (
                <label key={val} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
                  <input type="checkbox" checked={isChecked}
                    onChange={() => { if (isChecked) onChange(selected.filter(v => v !== strVal)); else onChange([...selected, strVal]) }}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-accent" />
                  <span className="truncate">{strVal}</span>
                </label>
              )
            })}
            {filtered.length === 0 && <p className="text-xs text-slate-400 px-2 py-3 text-center">No matches</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GlobalFilterBar() {
  const { schema, columnsByType, getUniqueValues, globalFilters, setGlobalFilters, hasGlobalFilters, filteredRowCount, rowCount } = useData()

  if (!schema || columnsByType.dimensions.length === 0) return null

  const handleChange = (col, values) => {
    setGlobalFilters(prev => {
      const next = { ...prev }
      if (values.length === 0) { delete next[col] }
      else { next[col] = values }
      return next
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-white border border-slate-200 mb-4">
      <span className="text-xs font-medium text-slate-500 mr-1">Filters:</span>
      {columnsByType.dimensions.slice(0, 6).map(col => (
        <FilterDropdown key={col} col={col} label={schema[col].label}
          values={getUniqueValues(col).map(String)}
          selected={globalFilters[col] || []}
          onChange={(vals) => handleChange(col, vals)} />
      ))}
      {hasGlobalFilters && (
        <>
          <button onClick={() => setGlobalFilters({})}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto">
            <RotateCcw className="w-3 h-3" /> Clear all
          </button>
          <span className="text-[10px] text-slate-400">{filteredRowCount.toLocaleString()} of {rowCount.toLocaleString()} rows</span>
        </>
      )}
    </div>
  )
}
