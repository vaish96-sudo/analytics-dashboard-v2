import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import {
  Plus, X, Check, Pencil, Trash2, Calculator, Sparkles, FlaskConical,
  Loader2, Lightbulb, ChevronDown,
} from 'lucide-react'

// Theme-aware colors: teal on light, amber on dark
function useCustomMetricColors() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return {
    accent: isDark ? '#d97706' : '#0d9488',
    accentLight: isDark ? 'rgba(217, 119, 6, 0.1)' : 'rgba(13, 148, 136, 0.08)',
    accentBorder: isDark ? 'rgba(217, 119, 6, 0.25)' : 'rgba(13, 148, 136, 0.3)',
    accentBorderLight: isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(13, 148, 136, 0.2)',
    accentBg: isDark ? 'rgba(217, 119, 6, 0.1)' : 'rgba(13, 148, 136, 0.06)',
    accentBgHover: isDark ? 'rgba(217, 119, 6, 0.12)' : 'rgba(13, 148, 136, 0.1)',
    pillBg: isDark ? 'rgba(217, 119, 6, 0.1)' : 'rgba(13, 148, 136, 0.08)',
    pillBorder: isDark ? 'rgba(217, 119, 6, 0.2)' : 'rgba(13, 148, 136, 0.25)',
  }
}

import { callClaudeAPI } from '../utils/claudeClient.js'

// ─── Formula display: replace col keys with labels ───────────────
function formulaToDisplay(formula, schema) {
  if (!formula) return ''
  let display = formula
  const cols = Object.entries(schema)
    .filter(([, def]) => def.type === 'metric' && !def.isCustom)
    .sort((a, b) => b[0].length - a[0].length)
  cols.forEach(([col, def]) => {
    display = display.replaceAll(col, def.label)
  })
  return display
}

// ─── AI Suggestions ──────────────────────────────────────────────
async function getAISuggestions(schema, rawData) {
  const cols = Object.entries(schema)
    .filter(([, def]) => def.type !== 'ignore' && !def.isCustom)
    .map(([col, def]) => `- ${col} (${def.type}): "${def.label}"`)
    .join('\n')

  const sampleRows = rawData.slice(0, 5).map(row => {
    const obj = {}
    Object.entries(schema).filter(([, d]) => d.type === 'metric' && !d.isCustom).slice(0, 8).forEach(([col]) => {
      obj[col] = row[col]
    })
    return obj
  })

  const system = `You are a senior data analyst and industry expert. The user has a dataset with these columns:

${cols}

Sample metric values from first rows:
${JSON.stringify(sampleRows, null, 2)}

Based on the columns and data, identify the industry/domain and suggest 3-5 custom calculated metrics that would be valuable.

CRITICAL RULES:
- Use ONLY the exact column names from the schema above in formulas (the raw name before the colon, not the label).
- Formulas must use only these operators: + - * / ( )
- Example formula: "cost / (clicks + 1)" or "gold / (equity_market + mutual_funds)"
- Each formula must use at least 2 columns from the dataset.
- Do NOT suggest metrics that already exist as columns.
- For EVERY metric, specify the correct aggregation method:
  - "sum" → the formula result should be summed across rows (e.g. profit = revenue - cost)
  - "ratio" → the metric is a rate/percentage computed from totals: SUM(numerator) / SUM(denominator). The formula should be written as "numerator / denominator". Examples: delivery rate, CTR, conversion rate, CPA.
  - "average" → the metric should be averaged, not summed. Examples: avg order value.
- Getting aggregation wrong makes the metric useless. A rate like "delivered / qty" MUST be "ratio", never "sum".

Respond with ONLY a JSON array (no markdown, no backticks):
[{"name":"Metric Name","formula":"col_a / (col_b + col_c)","aggregation":"sum|ratio|average","description":"What this measures and why it matters.","suffix":"%" or "" or "$"}]`

  const { text } = await callClaudeAPI({
    system,
    messages: [{ role: 'user', content: 'Suggest custom metrics for this dataset.' }],
    max_tokens: 800,
    feature: 'custom_metric',
  })

  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// ─── Column Picker Dropdown ──────────────────────────────────────
function ColumnPicker({ metrics, schema, onSelect, trigger }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(!open)} className="px-2 py-1 text-[11px] rounded-md transition-colors" style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
        {trigger || '+ Column'}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 rounded-xl shadow-lg z-50 overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="max-h-40 overflow-y-auto p-1">
            {metrics.map(m => (
              <button key={m} onClick={() => { onSelect(m); setOpen(false) }}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {schema[m]?.label || m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Metric Form (formula-based) ────────────────────────────────
function MetricForm({ schema, columnsByType, onSave, onCancel, initial, colors }) {
  const [name, setName] = useState(initial?.name || '')
  const [formula, setFormula] = useState(initial?.formula || '')
  const [suffix, setSuffix] = useState(initial?.suffix || '')
  const [aggregation, setAggregation] = useState(initial?.aggregation || 'sum')
  const nameRef = useRef(null)
  const formulaRef = useRef(null)

  const allMetrics = columnsByType.metrics.filter(m => !m.startsWith('_custom_'))

  useEffect(() => { nameRef.current?.focus() }, [])

  const insertColumn = (col) => {
    const el = formulaRef.current
    if (!el) { setFormula(prev => prev + col); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = formula.slice(0, start)
    const after = formula.slice(end)
    const newFormula = before + col + after
    setFormula(newFormula)
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + col.length; el.focus() }, 0)
  }

  // Auto-detect aggregation type from formula and suffix
  useEffect(() => {
    if (suffix === '%' || formula.includes('/')) {
      setAggregation('ratio')
    }
  }, [formula, suffix])

  const canSave = name.trim() && formula.trim()

  return (
    <div className="rounded-xl overflow-hidden animate-fade-in" style={{ background: 'var(--bg-surface)', border: `1px solid ${colors.accentBorder}` }}>
      <div className="p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Metric name</label>
            <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Fill Rate, CPA, Gold Hedge Ratio"
              className="w-full px-3 py-2 text-sm rounded-lg nb-input" />
          </div>
          <div className="w-20">
            <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Suffix</label>
            <input type="text" value={suffix} onChange={e => setSuffix(e.target.value)}
              placeholder="%" className="w-full px-3 py-2 text-sm rounded-lg nb-input text-center" />
          </div>
          <div className="w-28">
            <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Aggregation</label>
            <select value={aggregation} onChange={e => setAggregation(e.target.value)}
              className="w-full px-2 py-2 text-xs rounded-lg nb-input">
              <option value="sum">Sum</option>
              <option value="ratio">Ratio</option>
              <option value="average">Average</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Formula</label>
            <ColumnPicker metrics={allMetrics} schema={schema} onSelect={insertColumn} trigger="+ Insert column" />
          </div>
          <input ref={formulaRef} type="text" value={formula} onChange={e => setFormula(e.target.value)}
            placeholder="e.g. cost / (clicks + 1)  or  gold / (equity_market + mutual_funds)"
            className="w-full px-3 py-2 text-sm font-mono rounded-lg nb-input" />
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Use column names with +, -, *, /, and parentheses. {aggregation === 'ratio' ? 'Ratio = SUM(numerator) / SUM(denominator) across rows.' : aggregation === 'average' ? 'Will be averaged across rows, not summed.' : 'Will be summed across rows.'}
          </p>
        </div>

        {formula && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: colors.accentBg, border: `1px solid ${colors.accentBorderLight}` }}>
            <Calculator className="w-3.5 h-3.5 shrink-0" style={{ color: colors.accent }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {name || '?'} = {formulaToDisplay(formula, schema)}{suffix && ` (${suffix})`}
              <span className="ml-2 opacity-60">({aggregation})</span>
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          <button onClick={() => canSave && onSave({ name: name.trim(), formula: formula.trim(), suffix, aggregation })}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 text-white"
            style={{ background: colors.accent }}>
            <Check className="w-3.5 h-3.5" /> {initial ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AI Suggestion Card ──────────────────────────────────────────
function SuggestionCard({ suggestion, schema, onAccept, accepted, colors }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl transition-all" style={{ background: accepted ? colors.accentBg : 'var(--bg-overlay)', border: `1px solid ${accepted ? colors.accentBorder : 'var(--border-light)'}` }}>
      <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" style={{ color: colors.accent }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{suggestion.name}</p>
        <p className="text-[11px] font-mono mt-0.5" style={{ color: colors.accent }}>{formulaToDisplay(suggestion.formula, schema)}{suggestion.suffix && ` (${suggestion.suffix})`}</p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{suggestion.description}</p>
      </div>
      {accepted ? (
        <span className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium" style={{ background: colors.accentBg, color: colors.accent }}>
          <Check className="w-3 h-3" /> Added
        </span>
      ) : (
        <button onClick={onAccept}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:scale-[1.02] shrink-0 text-white"
          style={{ background: colors.accent }}>
          <Plus className="w-3 h-3" /> Add
        </button>
      )}
    </div>
  )
}

// ─── Metric Pill ─────────────────────────────────────────────────
function MetricPill({ metric, schema, onEdit, onRemove, colors }) {
  return (
    <div className="group flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
      style={{ background: colors.accentBg, border: `1px solid ${colors.pillBorder}` }}>
      <FlaskConical className="w-3.5 h-3.5 shrink-0" style={{ color: colors.accent }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{metric.name}</p>
        <p className="text-[10px] font-mono truncate" style={{ color: colors.accent }}>
          {formulaToDisplay(metric.formula, schema)}{metric.suffix && ` (${metric.suffix})`}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><Pencil className="w-3 h-3" /></button>
        <button onClick={onRemove} className="p-1 rounded hover:text-red-500" style={{ color: 'var(--text-muted)' }}><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export default function CustomMetrics() {
  const { schema, rawData, columnsByType, updateDatasetState, activeDatasetId } = useData()
  const customMetrics = useData().localCustomMetrics || []
  const colors = useCustomMetricColors()

  const [showForm, setShowForm] = useState(false)
  const [editIndex, setEditIndex] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState(null)
  const [acceptedSuggestions, setAcceptedSuggestions] = useState(new Set())

  // Clear stale suggestions when switching datasets/projects
  useEffect(() => {
    setSuggestions(null)
    setAcceptedSuggestions(new Set())
    setShowForm(false)
    setEditIndex(null)
  }, [activeDatasetId])

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

  const handleSuggest = async () => {
    setSuggestLoading(true)
    setSuggestError(null)
    setAcceptedSuggestions(new Set())
    try {
      const results = await getAISuggestions(schema, rawData)
      setSuggestions(results)
    } catch (err) {
      setSuggestError(err.message)
    } finally {
      setSuggestLoading(false)
    }
  }

  const handleAcceptSuggestion = (suggestion, index) => {
    const metric = { name: suggestion.name, formula: suggestion.formula, suffix: suggestion.suffix || '', aggregation: suggestion.aggregation || 'sum' }
    updateDatasetState('customMetrics', [...customMetrics, metric])
    setAcceptedSuggestions(prev => new Set([...prev, index]))
  }

  if (!schema) return null

  return (
    <div className="space-y-3 rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: colors.accent }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.accent }}>Custom Metrics</span>
          {customMetrics.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: colors.accentBg, color: colors.accent }}>
              {customMetrics.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSuggest} disabled={suggestLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: colors.accentBgHover, color: colors.accent, border: `1px solid ${colors.pillBorder}` }}>
            {suggestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            <span className="hidden sm:inline">{suggestLoading ? 'Analyzing...' : 'AI Suggest'}</span>
          </button>
          {!showForm && (
            <button onClick={() => { setShowForm(true); setEditIndex(null) }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] text-white"
              style={{ background: colors.accent }}>
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>
      </div>

      {/* Existing custom metrics */}
      {customMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {customMetrics.map((m, i) => (
            <MetricPill key={`${m.name}-${i}`} metric={m} schema={schema} colors={colors}
              onEdit={() => handleEdit(i)} onRemove={() => handleRemove(i)} />
          ))}
        </div>
      )}

      {/* Manual form */}
      {showForm && (
        <MetricForm schema={schema} columnsByType={columnsByType} colors={colors}
          onSave={handleSave} onCancel={() => { setShowForm(false); setEditIndex(null) }}
          initial={editIndex !== null ? customMetrics[editIndex] : null} />
      )}

      {/* AI Suggestions */}
      {suggestError && (
        <p className="text-xs px-1" style={{ color: '#ef4444' }}>{suggestError}</p>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              <Sparkles className="w-3 h-3 inline mr-1" style={{ color: colors.accent }} />
              AI-Suggested metrics for your data
            </p>
            <button onClick={() => setSuggestions(null)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <SuggestionCard key={i} suggestion={s} schema={schema} colors={colors}
                onAccept={() => handleAcceptSuggestion(s, i)}
                accepted={acceptedSuggestions.has(i)} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {customMetrics.length === 0 && !showForm && !suggestions && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Create calculated metrics from your existing columns, or click <strong>AI Suggest</strong> to get industry-specific recommendations.
        </p>
      )}
    </div>
  )
}
