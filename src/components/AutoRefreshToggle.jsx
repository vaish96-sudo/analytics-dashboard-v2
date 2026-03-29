import React, { useState } from 'react'
import { useProject } from '../context/ProjectContext'
import { api } from '../lib/api'
import { RefreshCw, Clock, ToggleLeft, ToggleRight } from 'lucide-react'
import { useToast } from './Toast'

/**
 * Auto-refresh toggle for Google Sheets connected projects.
 * Shows the last refresh time and a toggle to enable/disable daily auto-refresh.
 */
export default function AutoRefreshToggle() {
  const toast = useToast()
  const { activeProject } = useProject()
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(
    activeProject?.data_source_meta?.auto_refresh || false
  )

  // Only show for Google Sheets projects
  if (!activeProject || activeProject.data_source_type !== 'google_sheets') return null

  const meta = activeProject.data_source_meta || {}
  const lastRefreshed = meta.last_refreshed
    ? new Date(meta.last_refreshed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const handleToggle = async () => {
    const newState = !enabled
    setEnabled(newState)
    setSaving(true)
    try {
      const refreshToken = localStorage.getItem('nb_google_refresh_token')
      await api.post('/api/data/enable-auto-refresh', {
        projectId: activeProject.id,
        refreshToken,
        spreadsheetId: meta.spreadsheet_id,
        sheetName: meta.sheet_name,
        enabled: newState,
      })
      toast.success(newState ? 'Auto-refresh enabled' : 'Auto-refresh disabled')
    } catch (err) {
      toast.error(err?.message || 'Something went wrong')
      setEnabled(!newState) // revert
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-light)' }}>
      <RefreshCw className="w-3 h-3 shrink-0" style={{ color: enabled ? 'var(--accent)' : 'var(--text-muted)' }} />
      <div className="flex-1 min-w-0">
        <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
          Daily auto-refresh
        </p>
        {lastRefreshed && (
          <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Clock className="w-2.5 h-2.5" /> Last: {lastRefreshed}
          </p>
        )}
      </div>
      <button onClick={handleToggle} disabled={saving} className="shrink-0">
        {enabled
          ? <ToggleRight className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
        }
      </button>
    </div>
  )
}
