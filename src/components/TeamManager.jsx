import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTier } from '../context/TierContext'
import { api } from '../lib/api'
import { Users, UserPlus, Mail, Shield, Trash2, Loader2, CheckCircle, Clock, X, Crown } from 'lucide-react'
import { useToast } from './Toast'

const ROLE_LABELS = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }
const ROLE_DESCRIPTIONS = { admin: 'Manage members + edit', editor: 'Create and edit projects', viewer: 'View-only access' }

export default function TeamManager() {
  const toast = useToast()
  const { user } = useAuth()
  const { profile, can, config, updateProfileField } = useTier()
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState(null)
  const [teamName, setTeamName] = useState('')
  const [creating, setCreating] = useState(false)

  const maxSeats = config.teamSeats || 0
  const isOwner = team?.owner_id === user?.id
  const memberCount = members.filter(m => m.status === 'active').length

  const loadTeam = useCallback(async () => {
    if (!profile?.team_id) { setLoading(false); return }
    try {
      const teamData = await api.get('/api/data/teams')
      if (teamData) {
        setTeam(teamData)
        setTeamName(teamData.name)
        const memberData = await api.get(`/api/data/team-members?team_id=${teamData.id}`)
        setMembers(memberData || [])
      }
    } catch {} finally { setLoading(false) }
  }, [profile?.team_id])

  useEffect(() => { loadTeam() }, [loadTeam])

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return
    setCreating(true); setError(null)
    try {
      const newTeam = await api.post('/api/data/teams', { name: teamName.trim() })
      setTeam(newTeam)
      // Update local profile with team_id
      await updateProfileField({ team_id: newTeam.id, role: 'owner' })
      await loadTeam()
    } catch (err) { setError(err.message); toast.error(err.message) } finally { setCreating(false) }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) { setError('Enter a valid email'); return }
    if (memberCount >= maxSeats && maxSeats > 0) { setError(`Your plan includes ${maxSeats} team seats. Upgrade for more.`); return }
    setInviting(true); setError(null)
    try {
      const existing = members.find(m => m.invited_email?.toLowerCase() === inviteEmail.toLowerCase().trim())
      if (existing) { setError('This email has already been invited'); setInviting(false); return }

      await api.post('/api/data/team-members', {
        teamId: team.id,
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
      })

      // Send invite email
      const sessionToken = localStorage.getItem('nb_session_token')
      try {
        await fetch('/api/auth/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
          body: JSON.stringify({
            to_email: inviteEmail.toLowerCase().trim(),
            team_name: team.name,
            inviter_name: user.name || user.email,
            role: inviteRole,
          }),
        })
      } catch { /* Email failure shouldn't block the invite creation */ }

      setInviteEmail('')
      await loadTeam()
      toast.success('Invite sent!')
    } catch (err) { setError(err.message); toast.error(err.message) } finally { setInviting(false) }
  }

  const handleRemoveMember = async (memberId) => {
    try {
      await api.del(`/api/data/team-members?member_id=${memberId}`)
      await loadTeam()
    } catch {}
  }

  const handleChangeRole = async (memberId, newRole) => {
    try {
      await api.patch('/api/data/team-members', { memberId, updates: { role: newRole } })
      await loadTeam()
    } catch {}
  }

  if (!can('teamSeats') && maxSeats === 0) return null
  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} /></div>

  // No team yet — show create form
  if (!team) {
    return (
      <div className="space-y-4">
        <div className="p-6 text-center rounded-xl" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Create your team</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Invite team members to collaborate on projects. Your plan includes {maxSeats} seats.</p>
          <div className="flex items-center gap-2 max-w-xs mx-auto">
            <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name"
              className="flex-1 px-3 py-2.5 text-sm rounded-xl nb-input" onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()} />
            <button onClick={handleCreateTeam} disabled={creating || !teamName.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Team header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{team.name}</h4>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{memberCount} of {maxSeats} seats used</p>
        </div>
        <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-overlay)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${maxSeats > 0 ? Math.min(100, (memberCount / maxSeats) * 100) : 0}%`, background: memberCount >= maxSeats ? '#ef4444' : 'var(--accent)' }} />
        </div>
      </div>

      {/* Invite form (owner/admin only) */}
      {isOwner && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite by email"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl nb-input" onKeyDown={(e) => e.key === 'Enter' && handleInvite()} />
          </div>
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="px-2 py-2.5 text-xs rounded-xl nb-input" style={{ minWidth: '90px' }}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleInvite} disabled={inviting}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
            {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
            Invite
          </button>
        </div>
      )}

      {error && <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">{error}</div>}

      {/* Members list */}
      <div className="space-y-1">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ background: 'var(--bg-overlay)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>
              {(m.users?.name || m.invited_email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {m.users?.name || m.invited_email}
                {m.user_id === team.owner_id && <Crown className="w-3 h-3 inline ml-1" style={{ color: '#d4a574' }} />}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.users?.email || m.invited_email}</p>
            </div>
            <div className="flex items-center gap-2">
              {m.status === 'pending' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                  <Clock className="w-2.5 h-2.5" /> Pending
                </span>
              )}
              {isOwner && m.user_id !== user.id && (
                <>
                  <select value={m.role} onChange={(e) => handleChangeRole(m.id, e.target.value)}
                    className="px-1.5 py-1 text-[10px] rounded-md nb-input">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={() => handleRemoveMember(m.id)} className="p-1 rounded-md text-red-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
              {!isOwner && <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}>{ROLE_LABELS[m.role]}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
