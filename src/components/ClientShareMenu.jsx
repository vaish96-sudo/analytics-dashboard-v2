import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTier } from '../context/TierContext'
import { supabase } from '../lib/supabase'
import { grantClientAccess, revokeClientAccess } from '../lib/projectService'
import { Users, Check, X, Loader2 } from 'lucide-react'

/**
 * Share menu for a client folder — lets the agency owner
 * grant/revoke access for specific team members.
 */
export default function ClientShareMenu({ clientName, teamId, onClose }) {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [access, setAccess] = useState({}) // userId → boolean
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Load team members and their access
  useEffect(() => {
    if (!teamId) return
    loadData()
  }, [teamId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Get team members (exclude owner)
      const { data: memberData } = await supabase
        .from('team_members')
        .select('user_id, invited_email, role, status, users:user_id(name, email)')
        .eq('team_id', teamId)
        .neq('user_id', user.id)

      // Get current access for this client
      const { data: accessData } = await supabase
        .from('client_access')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('client_name', clientName)

      const accessMap = {}
      ;(accessData || []).forEach(a => { accessMap[a.user_id] = true })

      setMembers(memberData || [])
      setAccess(accessMap)
    } catch {} finally { setLoading(false) }
  }

  const toggleAccess = async (memberId) => {
    if (!memberId) return
    setSaving(memberId)
    try {
      if (access[memberId]) {
        await revokeClientAccess(teamId, memberId, clientName)
        setAccess(prev => { const n = { ...prev }; delete n[memberId]; return n })
      } else {
        await grantClientAccess(teamId, memberId, clientName)
        setAccess(prev => ({ ...prev, [memberId]: true }))
      }
    } catch {} finally { setSaving(null) }
  }

  const activeMembers = members.filter(m => m.status === 'active' && m.user_id)
  const sharedCount = Object.keys(access).length

  return (
    <div ref={ref} className="absolute left-full top-0 ml-2 z-50 w-56 rounded-xl shadow-xl animate-fade-in"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Share "{clientName}"</span>
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
                  style={{ background: hasAccess ? '#8b5cf6' : 'var(--text-muted)' }}>
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
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#8b5cf6' }}>
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
}
