import React, { useState, useEffect, useCallback } from 'react'
import { useData } from '../context/DataContext'
import { useTier } from '../context/TierContext'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Calendar, Mail, Clock, Trash2, Loader2, Plus, CheckCircle, Send, ToggleLeft, ToggleRight } from 'lucide-react'

export default function ScheduledReports() {
  const { user } = useAuth()
  const { activeDatasetId } = useData()
  const { can } = useTier()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [frequency, setFrequency] = useState('weekly')
  const [recipients, setRecipients] = useState('')
  const [includeInsights, setIncludeInsights] = useState(true)
  const [includeRecommendations, setIncludeRecommendations] = useState(false)
  const [includeKpis, setIncludeKpis] = useState(true)

  const loadReports = useCallback(async () => {
    if (!activeDatasetId || activeDatasetId === '__pending__') { setLoading(false); return }
    try {
      const data = await api.get(`/api/data/scheduled-reports?dataset_id=${activeDatasetId}`)
      setReports(data || [])
    } catch (err) { console.warn('Failed to load scheduled reports:', err.message) } finally { setLoading(false) }
  }, [activeDatasetId])

  useEffect(() => { loadReports() }, [loadReports])

  const calcNextSend = (freq) => {
    const now = new Date()
    if (freq === 'daily') { now.setDate(now.getDate() + 1); now.setHours(8, 0, 0, 0) }
    else if (freq === 'weekly') { now.setDate(now.getDate() + (8 - now.getDay()) % 7); now.setHours(8, 0, 0, 0) }
    else { now.setMonth(now.getMonth() + 1, 1); now.setHours(8, 0, 0, 0) }
    return now.toISOString()
  }

  const handleCreate = async () => {
    const emailList = recipients.split(',').map(e => e.trim()).filter(e => e.includes('@'))
    if (emailList.length === 0) { setError('Add at least one recipient email'); return }
    setSaving(true); setError(null)
    try {
      await api.post('/api/data/scheduled-reports', {
        datasetId: activeDatasetId,
        frequency,
        recipients: emailList,
        sections: { include_insights: includeInsights, include_recommendations: includeRecommendations, include_kpis: includeKpis },
      })
      setShowForm(false)
      setRecipients('')
      await loadReports()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const toggleEnabled = async (id, currentEnabled) => {
    try {
      await api.patch('/api/data/scheduled-reports', { reportId: id, updates: { enabled: !currentEnabled } })
      await loadReports()
    } catch (err) { console.warn('Failed to toggle report:', err.message) }
  }

  const handleDelete = async (id) => {
    try {
      await api.del(`/api/data/scheduled-reports?report_id=${id}`)
      await loadReports()
    } catch (err) { console.warn('Failed to delete report:', err.message) }
  }

  if (!can('scheduledReports')) return null

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Scheduled Reports</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto-email reports to clients</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white" style={{ background: 'var(--accent)' }}>
          <Plus className="w-3 h-3" /> New schedule
        </button>
      </div>

      <div className="p-4 space-y-3">
        {showForm && (
          <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Frequency</label>
              <div className="flex gap-2">
                {['daily', 'weekly', 'monthly'].map(f => (
                  <button key={f} onClick={() => setFrequency(f)}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize"
                    style={{ background: frequency === f ? 'var(--accent)' : 'transparent', color: frequency === f ? '#fff' : 'var(--text-secondary)', border: `1px solid ${frequency === f ? 'var(--accent)' : 'var(--border)'}` }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                <Mail className="w-3 h-3 inline mr-1" />Recipients (comma-separated)
              </label>
              <input type="text" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="client@company.com, team@agency.com"
                className="w-full px-3 py-2.5 text-sm rounded-xl nb-input" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium block" style={{ color: 'var(--text-secondary)' }}>Include in report</label>
              {[
                { label: 'KPI Summary', value: includeKpis, set: setIncludeKpis },
                { label: 'AI Insights', value: includeInsights, set: setIncludeInsights },
                { label: 'Recommendations', value: includeRecommendations, set: setIncludeRecommendations },
              ].map(opt => (
                <label key={opt.label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={opt.value} onChange={() => opt.set(!opt.value)} className="rounded" />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{opt.label}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-2 text-xs rounded-lg" style={{ color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Create schedule
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} /></div>
        ) : reports.length === 0 && !showForm ? (
          <div className="text-center py-6">
            <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No scheduled reports yet</p>
          </div>
        ) : (
          reports.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', opacity: r.enabled ? 1 : 0.5 }}>
              <button onClick={() => toggleEnabled(r.id, r.enabled)} className="shrink-0">
                {r.enabled ? <ToggleRight className="w-5 h-5" style={{ color: 'var(--accent)' }} /> : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                  {r.frequency} report
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  To: {r.recipients?.join(', ')}
                </p>
                {r.next_send_at && (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Next: {new Date(r.next_send_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
