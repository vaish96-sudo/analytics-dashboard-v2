import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { grantProjectAccess, revokeProjectAccess } from '../lib/projectService'
import { FolderOpen, Check, X, Loader2 } from 'lucide-react'
import { useToast } from './Toast'

export default function ProjectShareMenu({ projectId, projectName, teamId, onClose, anchorRef }) {
  const toast = useToast()
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [access, setAccess] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef(null)

  useEffect(() => {
    if (!anchorRef?.current) return
    const updatePos = () => {
      const rect = anchorRef.current.getBoundingClientRect()
      const menuWidth = 224
      const menuHeight = 260
      let top = rect.top
      let left = rect.right + 8
      if (left + menuWidth > window.innerWidth - 8) left = rect.left - menuWidth - 8
      if (top + menuHeight > window.innerHeight - 8) top = Math.max(8, window.innerHeight - menuHeight - 8)
      setPos({ top, left })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => { window.removeEventListener('resize', updatePos); window.removeEventListener('scroll', updatePos, true) }
  }, [anchorRef])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !(anchorRef?.current && anchorRef.current.contains(e.target))) onClose?.()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!teamId) return
    loadData()
  }, [teamId])

  const loadData = async () => {
    setLoading(true)
    try {
      const memberData = await api.get(`/api/data/team-members?team_id=${teamId}`)
      const filtered = (memberData || []).filter(m => m.user_id !== user.id)

      let accessData = []
      try {
        accessData = await api.get(`/api/data/project-access?teamId=${teamId}&projectId=${projectId}`)
      } catch (err) { toast.error(err?.message || 'Something went wrong') }

      const accessMap = {}
      ;(Array.isArray(accessData) ? accessData : []).forEach(a => { accessMap[a.user_id] = true })

      setMembers(filtered)
      setAccess(accessMap)
    } catch (err) { toast.error(err?.message || 'Something went wrong') } finally { setLoading(false) }
  }

  const toggleAccess = async (memberId) => {
    if (!memberId) return
    setSaving(memberId)
    try {
      if (access[memberId]) {
        await revokeProjectAccess(teamId, memberId, projectId)
        setAccess(prev => { const n = { ...prev }; delete n[memberId]; return n })
      } else {
        await grantProjectAccess(teamId, memberId, projectId)
        setAccess(prev => ({ ...prev, [memberId]: true }))
      }
    } catch (err) { toast.error(err?.message || 'Something went wrong') } finally { setSaving(null) }
  }

  const activeMembers = members.filter(m => m.status === 'active' && m.user_id)
  const sharedCount = Object.keys(access).length
  const displayName = projectName?.length > 20 ? projectName.slice(0, 20) + '…' : projectName

  const menu = (
    <div ref={ref} className="fixed z-[9999] w-56 rounded-xl shadow-xl animate-fade-in"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', top: pos.top, left: pos.left }}>
      <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
            <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>Share "{displayName}"</span>
          </div>
          <button onClick={onClose} className="p-0.5 rounded" style={{ color: 'var(--text-muted)' }}>
            <X className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {sharedCount === 0 ? 'Not shared with anyone' : `Shared with ${sharedCount} member${sharedCount > 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="p-2 max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : activeMembers.length === 0 ? (
          <p className="text-[10px] text-center py-3" style={{ color: 'var(--text-muted)' }}>
            No team members yet. Invite people in Settings.
          </p>
        ) : (
          activeMembers.map(m => {
            const hasAccess = !!access[m.user_id]
            const isSaving = saving === m.user_id
            return (
              <button key={m.user_id} onClick={() => toggleAccess(m.user_id)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: hasAccess ? '#3b82f6' : 'var(--text-muted)' }}>
                  {(m.users?.name || m.invited_email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {m.users?.name || m.invited_email}
                  </p>
                  <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {m.users?.email || m.invited_email}
                  </p>
                </div>
                <div className="shrink-0">
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
                  ) : hasAccess ? (
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#3b82f6' }}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded" style={{ border: '1.5px solid var(--border)' }} />
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
