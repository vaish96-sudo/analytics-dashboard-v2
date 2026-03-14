import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import { getInsights } from '../utils/aiService'
import { exportToPDF, exportToWord } from '../utils/exportService'
import LogoMark from './LogoMark'
import { Lightbulb, TrendingUp, AlertTriangle, Target, Loader2, RefreshCw, FileText, File } from 'lucide-react'

const ICONS = { opportunity: Target, trend: TrendingUp, alert: AlertTriangle, recommendation: Lightbulb }
const IMPACT = { high: 'text-red-600 bg-red-50 border-red-200', medium: 'text-amber-600 bg-amber-50 border-amber-200', low: 'text-slate-500 bg-slate-50 border-slate-200' }
const BORDERS = { opportunity: 'border-l-emerald-500', trend: 'border-l-sky-500', alert: 'border-l-red-500', recommendation: 'border-l-blue-500' }

export default function AIInsights() {
  const { schema, rawData, aggregateUnfiltered, updateDatasetState, insights, insightsLoaded } = useData()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usedModel, setUsedModel] = useState(null)

  const fetchInsights = async () => {
    setLoading(true); setError(null)
    try {
      const result = await getInsights(schema, rawData, aggregateUnfiltered)
      const insightsData = result.insights || result
      setUsedModel(result.model || null)
      updateDatasetState('insights', insightsData)
      updateDatasetState('insights_loaded', true)
      updateDatasetState('insightsLoaded', true)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleExportPDF = () => {
    exportToPDF({ type: 'insights', items: insights }, 'AI_Strategic_Insights')
  }

  const handleExportWord = () => {
    exportToWord({ type: 'insights', items: insights }, 'AI_Strategic_Insights')
  }

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><LogoMark className="w-5 h-5 object-contain" alt="NB" /></div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-semibold text-slate-800">AI Insights</h3>
            <p className="text-xs text-slate-400 truncate">
              Strategic recommendations{usedModel && <span> · Powered by <span className="text-slate-500 font-medium">{usedModel}</span></span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {insights.length > 0 && (
            <>
              <button onClick={handleExportPDF} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Export as PDF">
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleExportWord} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Export as Word">
                <File className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={fetchInsights} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 transition-colors shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{insightsLoaded ? 'Regenerate' : 'Generate Insights'}</span>
            <span className="sm:hidden">{insightsLoaded ? 'Refresh' : 'Generate'}</span>
          </button>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12"><Loader2 className="w-5 h-5 text-accent animate-spin" /><span className="text-sm text-slate-400">Analyzing your data with AI…</span></div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchInsights} className="mt-3 text-xs text-accent hover:underline">Try again</button>
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Click "Generate" to analyze your data with AI</p>
            <p className="text-xs text-slate-300 mt-1">Powered by Claude Opus for deeper strategic analysis</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((ins, i) => {
              const Icon = ICONS[ins.type] || Lightbulb
              return (
                <div key={i} className={`p-4 rounded-xl bg-white border border-slate-200 border-l-4 ${BORDERS[ins.type] || ''} hover:shadow-sm transition-all animate-slide-up`} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h4 className="text-sm font-display font-semibold text-slate-800">{ins.title}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wider ${IMPACT[ins.impact]}`}>{ins.impact}</span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">{ins.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
