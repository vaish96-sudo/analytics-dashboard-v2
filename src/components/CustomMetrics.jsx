import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useData } from '../context/DataContext'
import {
  Plus, X, Check, Pencil, Trash2, Calculator, ChevronDown, Sparkles, FlaskConical,
} from 'lucide-react'

const OPERATIONS = [
  { id: 'divide', label: 'A ÷ B', desc: 'Divide', fn: (a, b) => b !== 0 ? a / b : 0 },
  { id: 'multiply', label: 'A × B', desc: 'Multiply', fn: (a, b) => a * b },
  { id: 'add', label: 'A + B', desc: 'Add', fn: (a, b) => a + b },
  { id: 'subtract', label: 'A − B', desc: 'Subtract', fn: (a, b) => a - b },
  { id: 'percentage', label: 'A / B × 100', desc: 'Percentage', fn: (a, b) => b !== 0 ? (a / b) * 100 : 0 },
  { id: 'margin', label: '(A − B) / A × 100', desc: 'Margin %', fn: (a, b) => a !== 0 ? ((a - b) / a) * 100 : 0 },
]

function MetricForm({ schema, columnsByType, onSave, onCancel, initial }) {
  const [name, setName] = useState(initial?.name || '')
  const [colA, setColA] = useState(initial?.colA || '')
  const [colB, setColB] = useState(initial?.colB || '')
  const [operation, setOperation] = useState(initial?.operation || 'divide')
  const [suffix, setSuffix] = useState(initial?.suffix || '')
  const nameRef = useRef(null)

  const allMetrics = columnsByType.metrics.filter(m => !m.startsWith('_custom_'))

  useEffect(() => {
    if (!initial && allMetrics.length >= 2) {
      setColA(allMetrics[0])
      setColB(allMetrics[1])
    }
    nameRef.current?.focus()
  }, [])

  const op = OPERATIONS.find(o => o.id === operation) || OPERATIONS[0]

  // Preview value
  const preview = useMemo(() => {
    if (!colA || !colB) return null
    const a = 100, b = 50 // sample values
    const result = op.fn(a, b)
    return `e.g. ${a} and ${b} → ${result.toFixed(2)}${suffix}`
  }, [colA, colB, operation, suffix])

  const canSave = name.trim() && colA && colB

  return (
    <div className="rounded-xl overflow-hidden animate-fade-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-accent)' }}>
      <div className="p-4 space-y-3">
        {/* Name */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Metric name</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Fill Rate, CPA, Profit Margin"
            className="w-full px-3 py-2 text-sm rounded-lg nb-input"
          />
        </div>

        {/* Formula row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Column A</label>
            <select value={colA} onChange={e => setColA(e.target.value)} className="w-full text-xs rounded-lg px-2 py-2 nb-input">
              <option value="">Select...</option>
              {allMetrics.map(m => <option key={m} value={m}>{schema[m]?.label || m}</option>)}
            </select>
          </div>

          <div className="min-w-[100px]">
            <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Operation</label>
            <select value={operation} onChange={e => setOperation(e.target.value)} className="w-full text-xs rounded-lg px-2 py-2 nb-input">
              {OPERATIONS.map(o => <option key={o.id} value={o.id}>{o.label} ({o.desc})</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Column B</label>
            <select value={colB} onChange={e => setColB(e.target.value)} className="w-full text-xs rounded-lg px-2 py-2 nb-input">
              <option value="">Select...</option>
              {allMetrics.map(m => <option key={m} value={m}>{schema[m]?.label || m}</option>)}
            </select>
          </div>

          <div className="w-16">
            <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Suffix</label>
            <input
              type="text"
              value={suffix}
              onChange={e => setSuffix(e.target.value)}
              placeholder="%"
              className="w-full text-xs rounded-lg px-2 py-2 nb-input text-center"
            />
          </div>
        </div>

        {/* Formula preview */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              {name || '?'} = {schema[colA]?.label || 'A'} {op.label.replace('A', '').replace('B', '').trim()} {schema[colB]?.label || 'B'}
              {suffix && ` (${suffix})`}
            </span>
          </div>
          {preview && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{preview}</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button
            onClick={() => canSave && onSave({ name: name.trim(), colA, colB, operation, suffix })}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Check className="w-3.5 h-3.5" /> {initial ? 'Update' : 'Create Metric'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MetricPill({ metric, schema, onEdit, onRemove }) {
  const op = OPERATIONS.find(o => o.id === metric.operation) || OPERATIONS[0]
  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
      style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-light)' }}
    >
      <FlaskConical className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{metric.name}</p>
        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
          {schema[metric.colA]?.label || metric.colA} {op.label.replace('A ', '').replace(' B', '')} {schema[metric.colB]?.label || metric.colB}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><Pencil className="w-3 h-3" /></button>
        <button onClick={onRemove} className="p-1 rounded hover:text-red-500" style={{ color: 'var(--text-muted)' }}><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  )
}

export default function CustomMetrics() {
  const { schema, columnsByType, updateDatasetState } = useData()
  const customMetrics = useData().localCustomMetrics || []

  const [showForm, setShowForm] = useState(false)
  const [editIndex, setEditIndex] = useState(null)

  const handleSave = (metric) => {
    let updated
    if (editIndex !== null) {
      updated = [...customMetrics]
      updated[editIndex] = metric
    } else {
      updated = [...customMetrics, metric]
    }
    updateDatasetState('customMetrics', updated)
    setShowForm(false)
    setEditIndex(null)
  }

  const handleRemove = (index) => {
    updateDatasetState('customMetrics', customMetrics.filter((_, i) => i !== index))
  }

  const handleEdit = (index) => {
    setEditIndex(index)
    setShowForm(true)
  }

  if (!schema) return null

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Custom Metrics</span>
          {customMetrics.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--border-accent)', color: 'var(--accent)' }}>
              {customMetrics.length}
            </span>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditIndex(null) }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-[1.02]"
            style={{ background: 'var(--border-accent)', color: 'var(--accent)' }}
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {/* Existing custom metrics */}
      {customMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {customMetrics.map((m, i) => (
            <MetricPill
              key={`${m.name}-${i}`}
              metric={m}
              schema={schema}
              onEdit={() => handleEdit(i)}
              onRemove={() => handleRemove(i)}
            />
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <MetricForm
          schema={schema}
          columnsByType={columnsByType}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditIndex(null) }}
          initial={editIndex !== null ? customMetrics[editIndex] : null}
        />
      )}

      {/* Empty state */}
      {customMetrics.length === 0 && !showForm && (
        <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
          Create calculated metrics like Fill Rate, CPA, Margin % from your existing columns.
        </p>
      )}
    </div>
  )
}
