import React, { useState, useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import { useTier } from '../context/TierContext'
import { getInsights } from '../utils/aiService'
import { Lightbulb, TrendingUp, AlertTriangle, Target, Loader2, Sparkles, ChevronRight, ArrowRight } from 'lucide-react'

const ICONS = { opportunity: Target, trend: TrendingUp, alert: AlertTriangle, recommendation: Lightbulb }
const COLORS = { 
  opportunity: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '#10b981' },
  trend: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)', icon: '#0ea5e9' },
  alert: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: '#ef4444' },
  recommendation: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', icon: '#6366f1' },
}

/**
 * InsightsPreview — shown at the top of the Overview tab.
 * Auto-generates insights on first dashboard load if they haven't been generated yet.
 * Shows top 3 insights in a compact card format.
 */
export default function InsightsPreview() {
  const { schema, rawData, aggregateUnfiltered, updateDatasetState, insights, insightsLoaded, activeDatasetId, setActiveTab } = useData()
  const { hasRemaining, incrementUsage } = useTier()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const autoTriggered = useRef(false)

  // Auto-generate insights on first load if not already done
  useEffect(() => {
    if (autoTriggered.current) return
    if (!schema || !rawData || rawData.length === 0) return
    if (insightsLoaded && insights.length > 0) return
    if (!activeDatasetId || activeDatasetId === '__pending__') return
    if (!hasRemaining('insightsRuns')) return
    if (loading) return

    autoTriggered.current = true
    autoGenerate()
  }, [schema, rawData, activeDatasetId, insightsLoaded])

  const autoGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getInsights(schema, rawData, aggregateUnfiltered)
      await incrementUsage('insightsRuns')
      const insightsData = result.insights || result

      updateDatasetState('insights', insightsData)
      updateDatasetState('insightsLoaded', true)

      // Persist to backend
      if (activeDatasetId && activeDatasetId !== '__pending__') {
        try {
          const { saveInsightsOnly } = await import('../lib/projectService')
          await saveInsightsOnly(activeDatasetId, insightsData, true)
        } catch {}
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Don't render anything if no data
  if (!rawData || rawData.length === 0) return null

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl p-4 mb-2 animate-fade-in" style={{ 
        background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(37,99,235,0.05))',
        border: '1px solid rgba(139,92,246,0.15)' 
      }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
            <Sparkles className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>AI is analyzing your data...</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Finding patterns, trends, and opportunities</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state — just hide, don't block the dashboard
  if (error && insights.length === 0) return null

  // No insights yet and no remaining runs
  if (insights.length === 0) return null

  // Show top 3 insights
  const topInsights = insights.slice(0, 3)

  return (
    <div className="rounded-xl overflow-hidden mb-2 animate-fade-in" style={{ 
      background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(37,99,235,0.04))',
      border: '1px solid rgba(139,92,246,0.12)' 
    }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            We found {insights.length} things in your data
          </span>
        </div>
        <button onClick={() => setActiveTab('ai')} className="flex items-center gap-1 text-[10px] font-medium transition-colors hover:opacity-80" style={{ color: 'var(--accent)' }}>
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {topInsights.map((ins, i) => {
          const Icon = ICONS[ins.type] || Lightbulb
          const colors = COLORS[ins.type] || COLORS.recommendation
          return (
            <button key={i} onClick={() => setActiveTab('ai')}
              className="p-3 rounded-lg text-left transition-all hover:shadow-sm cursor-pointer"
              style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
              <div className="flex items-start gap-2">
                <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: colors.icon }} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ins.title}</p>
                  <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{ins.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
