import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTier } from '../context/TierContext'
import { api } from '../lib/api'
import { Users, Check, X, Loader2 } from 'lucide-react'

export default function PendingInvites() {
  const { user } = useAuth()
  const { reloadProfile, updateProfileField } = useTier()
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    if (!user?.email) { setLoading(false); return }
    loadInvites()
  }, [user?.email])

  const loadInvites = async () => {
    try {
      // Use a dedicated pending-invites query — for now we check via team-members
      // We need the server to support filtering by invited_email
      // Workaround: fetch all team memberships and filter client-side
      // Actually, we need a dedicated endpoint. Let's use a query param approach.
      const res = await fetch(`/api/data/pending-invites`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nb_session_token')}` },
      })
      if (res.ok) {
        const data = await res.json()
        setInvites(data || [])
      }
    } catch {} finally { setLoading(false) }
  }

  const handleAccept = async (invite) => {
    setProcessing(invite.id)
    try {
      await api.patch('/api/data/team-members', {
        memberId: invite.id,
        updates: { status: 'active' },
      })

      // Update user profile with team_id
      await updateProfileField({ team_id: invite.team_id, role: invite.role })

      reloadProfile?.()
      await loadInvites()
    } catch {} finally { setProcessing(null) }
  }

  const handleDecline = async (invite) => {
    setProcessing(invite.id)
    try {
      await api.patch('/api/data/team-members', {
        memberId: invite.id,
        updates: { status: 'declined' },
      })
      await loadInvites()
    } catch {} finally { setProcessing(null) }
  }

  if (loading || invites.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {invites.map(inv => (
        <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl animate-slide-up"
          style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(99, 102, 241, 0.05))', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
            <Users className="w-4 h-4" style={{ color: '#8b5cf6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              Team invite: <strong>{inv.teams?.name || inv.team_name || 'A team'}</strong>
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Role: {inv.role === 'admin' ? 'Admin' : inv.role === 'editor' ? 'Editor' : 'Viewer'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {processing === inv.id ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
            ) : (
              <>
                <button onClick={() => handleAccept(inv)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-white" style={{ background: '#8b5cf6' }}>
                  <Check className="w-3 h-3" /> Accept
                </button>
                <button onClick={() => handleDecline(inv)}
                  className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
