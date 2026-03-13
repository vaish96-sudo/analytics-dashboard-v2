import React, { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { Tag, Hash, Calendar, EyeOff, ArrowRight, ArrowLeft, FileSpreadsheet, ChevronDown, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'

const TYPE_CONFIG = {
  dimension: { label: 'Dimension', icon: Tag, color: 'text-sky', bg: 'bg-sky-50', border: 'border-sky-300' },
  metric: { label: 'Metric', icon: Hash, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-300' },
  date: { label: 'Date', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300' },
  ignore: { label: 'Ignore', icon: EyeOff, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-300' },
}

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
          <option value="dimension">Dimension</option>
          <option value="metric">Metric</option>
          <option value="date">Date</option>
          <option value="ignore">Ignore</option>
        </select>
        <ChevronDown className={`absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 ${config.color} pointer-events-none`} />
      </div>
      <button onClick={onRemove} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0" title="Remove column">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function ColumnTagger({ onConfirm }) {
  const { rawData, fileName, schema, updateColumnSchema, removeColumn, cancelTagging, columnsByType, rowCount, datasets, confirmTagging } = useData()

  const samplesByCol = useMemo(() => {
    if (!rawData || !schema) return {}
    const s = {}; Object.keys(schema).forEach(col => { s[col] = rawData.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '').slice(0, 5) }); return s
  }, [rawData, schema])

  const canProceed = columnsByType.metrics.length > 0 && columnsByType.dimensions.length > 0

  const handleConfirm = () => {
    if (onConfirm) onConfirm()
    else if (confirmTagging) confirmTagging()
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><img src="/logo_mark.png" alt="NB" className="w-5 h-5 object-contain" /></div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900">Tag Your Columns</h1>
          </div>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Tell us what each column represents. Adjust anything that's off.</p>
          <div className="flex items-center gap-3 sm:gap-4 mt-4 p-3 rounded-xl bg-white border border-slate-200">
            <FileSpreadsheet className="w-5 h-5 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-700 truncate block">{fileName}</span>
              <span className="text-xs text-slate-400">{rowCount.toLocaleString()} rows · {Object.keys(schema || {}).length} columns</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="text-sky">{columnsByType.dimensions.length} dim</span>
              <span className="text-emerald-600">{columnsByType.metrics.length} met</span>
              <span className="text-amber-600">{columnsByType.dates.length} date</span>
            </div>
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
        <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-sm sticky bottom-4 sm:bottom-6">
          <div className="flex items-center gap-3">
            <button onClick={cancelTagging}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Cancel
            </button>
            <div className="hidden sm:flex items-center gap-2">
              {canProceed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
              <span className="text-xs text-slate-500">{canProceed ? 'Ready to save' : 'Need 1 dimension + 1 metric'}</span>
            </div>
          </div>
          <button onClick={handleConfirm} disabled={!canProceed}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-sm font-display font-semibold transition-all
              ${canProceed ? 'bg-accent hover:bg-accent-dark text-white shadow-md shadow-accent/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            Save & Build Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
