import React, { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import LogoMark from './LogoMark'
import { Tag, Hash, Calendar, EyeOff, ArrowRight, ArrowLeft, FileSpreadsheet, ChevronDown, CheckCircle2, AlertCircle, Trash2, Loader2, Settings2, Sparkles } from 'lucide-react'

const TYPE_CONFIG = {
  dimension: { label: 'Category', icon: Tag, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-300', desc: 'Group & filter by' },
  metric: { label: 'Number', icon: Hash, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-300', desc: 'Sum & calculate' },
  date: { label: 'Date', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300', desc: 'Timeline' },
  ignore: { label: 'Skip', icon: EyeOff, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-300', desc: 'Hidden' },
}

// ─── Detailed Row (for advanced editor) ──────────────────────────
function ColumnRow({ colName, def, sampleValues, onUpdate, onRemove }) {
  const config = TYPE_CONFIG[def.type]
  const Icon = config.icon
  return (
    <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs sm:text-sm text-slate-700 truncate block">{colName}</span>
        <span className="text-[10px] sm:text-xs text-slate-400 truncate block mt-0.5">e.g. {sampleValues.slice(0, 3).map(v => String(v ?? 'null')).join(', ')}</span>
      </div>
      <input type="text" value={def.label} onChange={(e) => onUpdate({ label: e.target.value })}
        className="hidden sm:block w-36 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20" placeholder="Display name" />
      <div className="relative">
        <select value={def.type} onChange={(e) => onUpdate({ type: e.target.value })}
          className={`appearance-none pl-2 sm:pl-3 pr-6 sm:pr-8 py-1.5 text-xs sm:text-sm rounded-lg cursor-pointer border ${config.border} ${config.bg} ${config.color} focus:outline-none focus:ring-1 focus:ring-accent/30 font-medium`}>
          <option value="dimension">Category</option>
          <option value="metric">Number</option>
          <option value="date">Date</option>
          <option value="ignore">Skip</option>
        </select>
        <ChevronDown className={`absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 ${config.color} pointer-events-none`} />
      </div>
      <button onClick={onRemove} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0" title="Remove column">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Summary Pill (for confirmation view) ────────────────────────
function SummaryPill({ colName, def, onChangeType }) {
  const config = TYPE_CONFIG[def.type]
  const Icon = config.icon
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${config.bg} ${config.color} ${config.border}`}>
      <Icon className="w-3 h-3" />
      <span>{def.label}</span>
      <select value={def.type} onChange={(e) => onChangeType(e.target.value)}
        className="appearance-none bg-transparent border-none text-inherit font-medium focus:outline-none cursor-pointer pr-1 text-[10px] opacity-0 hover:opacity-100 w-0 hover:w-auto transition-all">
        <option value="dimension">Category</option>
        <option value="metric">Number</option>
        <option value="date">Date</option>
        <option value="ignore">Skip</option>
      </select>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export default function ColumnTagger({ onConfirm }) {
  const { rawData, fileName, schema, updateColumnSchema, removeColumn, cancelTagging, columnsByType, rowCount, confirmTagging, schemaLoading, confirmLoading, confirmError } = useData()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const samplesByCol = useMemo(() => {
    if (!rawData || !schema) return {}
    const s = {}
    Object.keys(schema).forEach(col => {
      s[col] = rawData.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '').slice(0, 5)
    })
    return s
  }, [rawData, schema])

  const canProceed = columnsByType.metrics.length > 0 && columnsByType.dimensions.length > 0

  const handleConfirm = () => {
    if (onConfirm) onConfirm()
    else if (confirmTagging) confirmTagging()
  }

  // Group columns by type for the summary view
  const grouped = useMemo(() => {
    if (!schema) return {}
    const g = { dimension: [], metric: [], date: [], ignore: [] }
    Object.entries(schema).forEach(([col, def]) => {
      if (g[def.type]) g[def.type].push({ col, ...def })
    })
    return g
  }, [schema])

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <LogoMark className="w-5 h-5 object-contain" alt="NB" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                {schemaLoading ? 'Analyzing your data...' : 'We analyzed your data'}
              </h1>
              {schemaLoading && (
                <div className="flex items-center gap-2 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs" style={{ color: 'var(--accent)' }}>AI is classifying your columns for better accuracy</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 mt-4 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <FileSpreadsheet className="w-5 h-5 shrink-0" style={{ color: 'var(--accent)' }} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block" style={{ color: 'var(--text-primary)' }}>{fileName}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rowCount.toLocaleString()} rows · {Object.keys(schema || {}).length} columns</span>
            </div>
            {schemaLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--accent)' }} />}
          </div>
        </div>

        {/* ─── Confirmation View (default) ──────────────────────── */}
        {!showAdvanced && (
          <div className="space-y-4 mb-8 animate-fade-in">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Here's how we've classified your columns. Review and adjust if needed, or go ahead and build your dashboard.
            </p>

            {/* Categories */}
            {grouped.dimension?.length > 0 && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                    Categories ({grouped.dimension.length})
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>— things you group and filter by</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.dimension.map(item => (
                    <SummaryPill key={item.col} colName={item.col} def={item}
                      onChangeType={(type) => updateColumnSchema(item.col, { type })} />
                  ))}
                </div>
              </div>
            )}

            {/* Numbers */}
            {grouped.metric?.length > 0 && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Hash className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                    Numbers ({grouped.metric.length})
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>— values to sum, average, and chart</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.metric.map(item => (
                    <SummaryPill key={item.col} colName={item.col} def={item}
                      onChangeType={(type) => updateColumnSchema(item.col, { type })} />
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            {grouped.date?.length > 0 && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                    Dates ({grouped.date.length})
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>— time-based columns</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.date.map(item => (
                    <SummaryPill key={item.col} colName={item.col} def={item}
                      onChangeType={(type) => updateColumnSchema(item.col, { type })} />
                  ))}
                </div>
              </div>
            )}

            {/* Skipped */}
            {grouped.ignore?.length > 0 && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', opacity: 0.7 }}>
                <div className="flex items-center gap-2 mb-3">
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Skipped ({grouped.ignore.length})
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>— won't appear in dashboard</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.ignore.map(item => (
                    <SummaryPill key={item.col} colName={item.col} def={item}
                      onChangeType={(type) => updateColumnSchema(item.col, { type })} />
                  ))}
                </div>
              </div>
            )}

            {/* Advanced toggle */}
            <button onClick={() => setShowAdvanced(true)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors px-1"
              style={{ color: 'var(--text-muted)' }}>
              <Settings2 className="w-3.5 h-3.5" /> Edit column details
            </button>
          </div>
        )}

        {/* ─── Advanced Editor ──────────────────────────────────── */}
        {showAdvanced && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowAdvanced(false)}
                className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                style={{ color: 'var(--accent)' }}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back to summary
              </button>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="text-sky-600">{columnsByType.dimensions.length} categories</span>
                <span className="text-emerald-600">{columnsByType.metrics.length} numbers</span>
                <span className="text-amber-600">{columnsByType.dates.length} dates</span>
              </div>
            </div>
            <div className="space-y-2 mb-8">
              {schema && Object.entries(schema).map(([col, def], i) => (
                <div key={col} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <ColumnRow colName={col} def={def} sampleValues={samplesByCol[col] || []}
                    onUpdate={(updates) => updateColumnSchema(col, updates)}
                    onRemove={() => removeColumn(col)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Bottom Bar ──────────────────────────────────────── */}
        <div className="space-y-2 sticky bottom-4 sm:bottom-6">
          {confirmError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-600">{confirmError}</span>
            </div>
          )}
          <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl shadow-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <button onClick={cancelTagging} disabled={confirmLoading}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}>
                <ArrowLeft className="w-4 h-4" /> Cancel
              </button>
              <div className="hidden sm:flex items-center gap-2">
                {canProceed
                  ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ready to build</span></>
                  : <><AlertCircle className="w-4 h-4 text-amber-500" /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Need at least 1 category + 1 number</span></>
                }
              </div>
            </div>
            <button onClick={handleConfirm} disabled={!canProceed || schemaLoading || confirmLoading}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-sm font-display font-semibold transition-all disabled:opacity-40"
              style={{ background: canProceed ? 'var(--accent)' : 'var(--border)', color: canProceed ? '#fff' : 'var(--text-muted)' }}>
              {confirmLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Building dashboard...</>
              ) : schemaLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><span>Looks good, build dashboard</span> <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
