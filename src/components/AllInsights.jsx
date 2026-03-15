import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { listAllInsights } from '../lib/projectService'
import { Lightbulb, ArrowLeft, Loader2, Search, ChevronRight, TrendingUp, AlertTriangle, Target, Sparkles } from 'lucide-react'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const IMPACT_STYLES = {
  high: { bg: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: 'rgba(220, 38, 38, 0.2)' },
  medium: { bg: 'rgba(217, 119, 6, 0.1)', color: '#d97706', border: 'rgba(217, 119, 6, 0.2)' },
  low: { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: 'rgba(100, 116, 139, 0.2)' },
}

const TYPE_ICONS = {
  trend: TrendingUp,
  alert: AlertTriangle,
  opportunity: Target,
  recommendation: Sparkles,
}

export default function AllInsights({ onBack, onOpenProject }) {
  const { user } = useAuth()
  const [projectInsights, setProjectInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedProject, setExpandedProject] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    listAllInsights(user.id)
      .then(data => setProjectInsights(data))
      .catch(err => console.error('Failed to load insights:', err))
      .finally(() => setLoading(false))
  }, [user?.id])

  const totalInsights = projectInsights.reduce((sum, p) => sum + p.insights.length, 0)

  const filtered = search
    ? projectInsights.filter(p =>
        p.projectName.toLowerCase().includes(search.toLowerCase()) ||
        p.insights.some(i => i.title.toLowerCase().includes(search.toLowerCase()))
      )
    : projectInsights

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>AI Insights</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {totalInsights} insight{totalInsights !== 1 ? 's' : ''} across {projectInsights.length} project{projectInsights.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search insights..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl nb-input"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : projectInsights.length === 0 ? (
          <div className="text-center py-20">
            <Lightbulb className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No insights generated yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Generate insights from the Insights tab in any project</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results for "{search}"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(project => {
              const isExpanded = expandedProject === project.projectId
              const displayInsights = isExpanded ? project.insights : project.insights.slice(0, 2)

              return (
                <div key={`${project.projectId}-${project.datasetId}`} className="rounded-xl overflow-hidden nb-card">
                  {/* Project header */}
                  <button
                    onClick={() => onOpenProject(project.projectId, 'insights')}
                    className="w-full flex items-center gap-3 p-4 text-left transition-colors group"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                      <Lightbulb className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{project.projectName}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {project.fileName} · {project.rowCount} rows · {project.insights.length} insight{project.insights.length !== 1 ? 's' : ''} · {timeAgo(project.updatedAt)}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                  </button>

                  {/* Insights preview */}
                  <div className="p-3 space-y-2">
                    {displayInsights.map((insight, idx) => {
                      const impact = insight.impact || 'medium'
                      const style = IMPACT_STYLES[impact] || IMPACT_STYLES.medium
                      const TypeIcon = TYPE_ICONS[insight.type] || Lightbulb

                      return (
                        <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: style.bg }}>
                          <TypeIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: style.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{insight.title}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: style.color, color: '#fff' }}>
                                {impact.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{insight.description}</p>
                          </div>
                        </div>
                      )
                    })}

                    {project.insights.length > 2 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedProject(isExpanded ? null : project.projectId) }}
                        className="w-full text-center text-[10px] font-medium py-1.5 rounded-lg transition-colors hover:opacity-80"
                        style={{ color: 'var(--accent)' }}
                      >
                        {isExpanded ? 'Show less' : `View all ${project.insights.length} insights`}
                      </button>
                    )}
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
