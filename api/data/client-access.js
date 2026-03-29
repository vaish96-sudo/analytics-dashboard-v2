import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { auditLog } from '../lib/auditLog.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeUUID, sanitizeString } from '../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const teamId = sanitizeUUID(req.query.teamId)
    const clientName = sanitizeString(req.query.clientName, 200)
    if (!teamId) return res.status(400).json({ error: 'Missing or invalid teamId' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Access denied' })

    let query = supabase.from('client_access').select('user_id, client_name').eq('team_id', teamId)
    if (clientName) query = query.eq('client_name', clientName)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { teamId, targetUserId, clientName } = req.body || {}
    const safeTeamId = sanitizeUUID(teamId)
    const safeTargetId = sanitizeUUID(targetUserId)
    const safeClient = sanitizeString(clientName, 200)
    if (!safeTeamId || !safeTargetId || !safeClient) return res.status(400).json({ error: 'Missing or invalid required fields' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', safeTeamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can grant access' })

    const { error } = await supabase.from('client_access').insert({
      team_id: safeTeamId, user_id: safeTargetId, client_name: safeClient,
    })
    if (error && !error.message.includes('duplicate')) return res.status(500).json({ error: 'Something went wrong' })
    await auditLog(supabase, userId, 'sharing.client_grant', { teamId: safeTeamId, targetUserId: safeTargetId, clientName: safeClient })
    return res.status(201).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const safeTeamId = sanitizeUUID(req.query.teamId)
    const safeTargetId = sanitizeUUID(req.query.targetUserId)
    const safeClient = sanitizeString(req.query.clientName, 200)
    if (!safeTeamId || !safeTargetId || !safeClient) return res.status(400).json({ error: 'Missing or invalid required fields' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', safeTeamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can revoke access' })

    await supabase.from('client_access').delete().eq('team_id', safeTeamId).eq('user_id', safeTargetId).eq('client_name', safeClient)
    await auditLog(supabase, userId, 'sharing.client_revoke', { teamId: safeTeamId, targetUserId: safeTargetId, clientName: safeClient })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
