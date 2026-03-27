import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { auditLog } from '../lib/auditLog.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeUUID, sanitizeEmail, sanitizeString } from '../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const teamId = sanitizeUUID(req.query.team_id)
    if (!teamId) return res.status(400).json({ error: 'Missing or invalid team_id' })

    const { data: membership } = await supabase
      .from('team_members').select('id').eq('team_id', teamId).eq('user_id', userId).eq('status', 'active').single()
    if (!membership) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase.from('team_members').select('*, users:user_id(email, name)').eq('team_id', teamId)
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { teamId, email, role } = req.body || {}
    const safeTeamId = sanitizeUUID(teamId)
    const safeEmail = sanitizeEmail(email)
    const safeRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'viewer'
    if (!safeTeamId || !safeEmail) return res.status(400).json({ error: 'Valid team ID and email are required' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', safeTeamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can invite members' })

    const { data: existingUser } = await supabase.from('users').select('id').eq('email', safeEmail).single()

    const { data, error } = await supabase.from('team_members').insert({
      team_id: safeTeamId,
      user_id: existingUser?.id || null,
      invited_email: safeEmail,
      role: safeRole,
      status: 'pending',
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    await auditLog(supabase, userId, 'team.invite', { teamId: safeTeamId, email: safeEmail, role: safeRole })
    return res.status(201).json(data)
  }

  if (req.method === 'PATCH') {
    const { memberId, updates } = req.body || {}
    const safeMemberId = sanitizeUUID(memberId)
    if (!safeMemberId) return res.status(400).json({ error: 'Missing or invalid memberId' })

    const { data: member } = await supabase.from('team_members').select('team_id, user_id').eq('id', safeMemberId).single()
    if (!member) return res.status(404).json({ error: 'Member not found' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', member.team_id).single()
    const isOwner = team?.owner_id === userId
    const isSelf = member.user_id === userId
    if (!isOwner && !isSelf) return res.status(403).json({ error: 'Access denied' })

    const safeUpdates = {}
    const allowedRoles = ['admin', 'editor', 'viewer']
    const allowedStatuses = ['active', 'inactive', 'pending']
    if (isOwner) {
      if (updates?.role && allowedRoles.includes(updates.role)) safeUpdates.role = updates.role
      if (updates?.status && allowedStatuses.includes(updates.status)) safeUpdates.status = updates.status
    }
    if (isSelf && updates?.status && allowedStatuses.includes(updates.status)) {
      safeUpdates.status = updates.status
      if (updates.status === 'active') safeUpdates.user_id = userId
    }

    const { data, error } = await supabase.from('team_members').update(safeUpdates).eq('id', safeMemberId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    await auditLog(supabase, userId, 'team.member_update', { memberId: safeMemberId, updates: safeUpdates })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const memberId = sanitizeUUID(req.query.member_id)
    if (!memberId) return res.status(400).json({ error: 'Missing or invalid member_id' })

    const { data: member } = await supabase.from('team_members').select('team_id').eq('id', memberId).single()
    if (!member) return res.status(404).json({ error: 'Member not found' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', member.team_id).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can remove members' })

    const { error } = await supabase.from('team_members').delete().eq('id', memberId)
    if (error) return res.status(500).json({ error: error.message })
    await auditLog(supabase, userId, 'team.member_remove', { memberId, teamId: member.team_id })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
