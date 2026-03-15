import React, { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { smartFormat } from '../utils/formatters'

const BORDER_COLORS = ['border-blue-400', 'border-sky-400', 'border-orange-400', 'border-emerald-400', 'border-purple-400', 'border-pink-400']
const LABEL_COLORS = ['text-blue-600', 'text-sky-600', 'text-orange-600', 'text-emerald-600', 'text-purple-600', 'text-pink-600']

export default function KPICards() {
  const { filteredRawData, schema, columnsByType } = useData()
  const kpis = useMemo(() => {
    if (!filteredRawData || !schema) return []
    return columnsByType.metrics.slice(0, 6).map(col => {
      const values = filteredRawData.map(r => { const v = r[col]; return typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[,$%]/g, '')) }).filter(v => !isNaN(v))
      return { col, label: schema[col].label, total: values.reduce((a, b) => a + b, 0), isCustom: !!schema[col]?.isCustom }
    })
  }, [filteredRawData, schema, columnsByType.metrics])

  if (kpis.length === 0) return null
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi, i) => (
        <div key={kpi.col} className={`p-4 rounded-xl bg-white border-2 ${kpi.isCustom ? 'border-amber-400' : BORDER_COLORS[i % BORDER_COLORS.length]} hover:shadow-md transition-all duration-300 animate-slide-up`} style={{ animationDelay: `${i * 60}ms` }}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${kpi.isCustom ? 'text-amber-600' : LABEL_COLORS[i % LABEL_COLORS.length]}`}>{kpi.label}</span>
          <div className="text-2xl font-display font-bold text-slate-900 mt-1">{smartFormat(kpi.total, kpi.col)}</div>
          <div className="text-xs text-slate-400 mt-1">{kpi.isCustom ? 'calculated' : 'total'}</div>
        </div>
      ))}
    </div>
  )
}
