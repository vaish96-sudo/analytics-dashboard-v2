import React, { useState } from 'react'
import LogoMark from './LogoMark'
import { useData } from '../context/DataContext'
import { Target, Loader2, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, Clock, FileText, File } from 'lucide-react'
import { exportToPDF, exportToWord } from '../utils/exportService'

const API_URL = '/api/claude'
const PRIORITY_STYLES = {
  high: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'High Priority' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Medium' },
  low: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Low' },
}

export default function AIRecommendations() {
  const { schema, rawData, aggregateUnfiltered, activeDatasetId, updateDatasetState, recommendations } = useData()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usedModel, setUsedModel] = useState(null)

  const fetchRecommendations = async () => {
    if (!schema || !rawData) return
    setLoading(true)
    setError(null)

    try {
      const metrics = Object.entries(schema).filter(([, d]) => d.type === 'metric').map(([col, d]) => ({ col, label: d.label }))
      const dimensions = Object.entries(schema).filter(([, d]) => d.type === 'dimension').map(([col, d]) => ({ col, label: d.label }))

      const summaryParts = []
      metrics.slice(0, 5).forEach(m => {
        const vals = rawData.map(r => parseFloat(String(r[m.col] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
        summaryParts.push(`${m.label}: total=${vals.reduce((a, b) => a + b, 0).toLocaleString()}, rows=${vals.length}`)
      })

      if (dimensions.length > 0 && metrics.length > 0) {
        const topData = aggregateUnfiltered([dimensions[0].col], [metrics[0].col])
          .sort((a, b) => (b[metrics[0].col] || 0) - (a[metrics[0].col] || 0))
          .slice(0, 5)
        summaryParts.push(`\nTop ${dimensions[0].label} by ${metrics[0].label}:\n` +
          topData.map(r => `  ${r[dimensions[0].col]}: ${r[metrics[0].col]?.toLocaleString()}`).join('\n'))
      }

      const cols = Object.entries(schema)
        .filter(([, def]) => def.type !== 'ignore')
        .map(([col, def]) => `- ${col} (${def.type}): "${def.label}"`)
        .join('\n')

      const system = `You are a senior business strategist and data consultant. The user has a dataset with these columns:

${cols}

Based on the data summary, provide SPECIFIC, ACTIONABLE recommendations the business should implement.
Each recommendation must include concrete steps, expected timeline, and measurable outcomes.

Respond with ONLY a JSON array (no markdown, no backticks):
[{
  "title": "Short actionable title (start with a verb)",
  "description": "2-3 sentences explaining the recommendation with specific numbers from the data.",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "timeline": "e.g. 2-4 weeks",
  "expected_impact": "e.g. 15-20% increase in X",
  "priority": "high|medium|low"
}]

Provide exactly 4-5 recommendations ordered by priority. Be specific — reference actual data values.`

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          messages: [{ role: 'user', content: `Data summary (${rawData.length} total rows):\n${summaryParts.join('\n')}\n\nProvide 4-5 actionable recommendations.` }],
          max_tokens: 2000,
          model: 'claude-opus-4-6',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `API error ${res.status}`)
      }

      const data = await res.json()
      const text = data.content?.map(c => c.text || '').join('') || ''
      setUsedModel('Claude Opus 4.6')

      try {
        const cleaned = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        updateDatasetState('recommendations', parsed)
      } catch {
        updateDatasetState('recommendations', [{ title: 'Analysis', description: text, steps: [], timeline: '', expected_impact: '', priority: 'medium' }])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    const items = recommendations.map(r => ({
      type: 'recommendation',
      title: r.title,
      description: `${r.description}\n\nSteps: ${(r.steps || []).join(', ')}\nTimeline: ${r.timeline}\nExpected Impact: ${r.expected_impact}`,
      impact: r.priority,
    }))
    exportToPDF({ type: 'insights', items }, 'AI_Recommendations')
  }

  const handleExportWord = () => {
    const items = recommendations.map(r => ({
      type: 'recommendation',
      title: r.title,
      description: `${r.description}\n\nSteps: ${(r.steps || []).join(', ')}\nTimeline: ${r.timeline}\nExpected Impact: ${r.expected_impact}`,
      impact: r.priority,
    }))
    exportToWord({ type: 'insights', items }, 'AI_Recommendations')
  }

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-semibold text-slate-800">Recommendations</h3>
            <p className="text-xs text-slate-400 truncate">
              Actionable next steps{usedModel && <span> · Powered by <span className="text-slate-500 font-medium">{usedModel}</span></span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {recommendations.length > 0 && (
            <>
              <button onClick={handleExportPDF} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Export as PDF">
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleExportWord} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Export as Word">
                <File className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={fetchRecommendations} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg text-white hover:opacity-90 disabled:opacity-50 transition-colors shrink-0"
            style={{ background: '#7c3aed' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{recommendations.length > 0 ? 'Regenerate' : 'Get Recommendations'}</span>
            <span className="sm:hidden">{recommendations.length > 0 ? 'Refresh' : 'Generate'}</span>
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
            <span className="text-sm text-slate-400">Generating actionable recommendations…</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchRecommendations} className="mt-3 text-xs text-purple-600 hover:underline">Try again</button>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Click "Get Recommendations" for actionable next steps</p>
            <p className="text-xs text-slate-300 mt-1">AI analyzes your data and suggests specific actions to take</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              const pStyle = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium
              return (
                <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-purple-400 hover:shadow-sm transition-all animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h4 className="text-sm font-display font-semibold text-slate-800">{rec.title}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wider ${pStyle.color} ${pStyle.bg} ${pStyle.border}`}>
                          {pStyle.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed mb-2">{rec.description}</p>

                      {rec.steps && rec.steps.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {rec.steps.map((step, si) => (
                            <div key={si} className="flex items-start gap-2 text-xs text-slate-500">
                              <ArrowRight className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-[11px] text-slate-400">
                        {rec.timeline && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{rec.timeline}
                          </span>
                        )}
                        {rec.expected_impact && (
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />{rec.expected_impact}
                          </span>
                        )}
                      </div>
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
