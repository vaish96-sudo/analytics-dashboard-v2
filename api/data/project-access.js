import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { auditLog } from '../lib/auditLog.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeUUID } from '../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const { teamId, projectId } = req.query
    const safeTeamId = sanitizeUUID(teamId)
    if (!safeTeamId) return res.status(400).json({ error: 'Missing or invalid teamId' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', safeTeamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Access denied' })

    let query = supabase.from('project_access').select('user_id, project_id').eq('team_id', safeTeamId)
    const safeProjId = sanitizeUUID(projectId)
    if (safeProjId) query = query.eq('project_id', safeProjId)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { teamId, targetUserId, projectId } = req.body || {}
    const safeTeamId = sanitizeUUID(teamId)
    const safeTargetId = sanitizeUUID(targetUserId)
    const safeProjId = sanitizeUUID(projectId)
    if (!safeTeamId || !safeTargetId || !safeProjId) return res.status(400).json({ error: 'Missing or invalid required fields' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', safeTeamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can grant access' })

    const { error } = await supabase.from('project_access').insert({
      team_id: safeTeamId, user_id: safeTargetId, project_id: safeProjId,
    })
    if (error && !error.message.includes('duplicate')) return res.status(500).json({ error: 'Something went wrong' })
    await auditLog(supabase, userId, 'sharing.project_grant', { teamId: safeTeamId, targetUserId: safeTargetId, projectId: safeProjId })
    return res.status(201).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const safeTeamId = sanitizeUUID(req.query.teamId)
    const safeTargetId = sanitizeUUID(req.query.targetUserId)
    const safeProjId = sanitizeUUID(req.query.projectId)
    if (!safeTeamId || !safeTargetId || !safeProjId) return res.status(400).json({ error: 'Missing or invalid required fields' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', safeTeamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can grant access' })

    await supabase.from('project_access').delete().eq('team_id', safeTeamId).eq('user_id', safeTargetId).eq('project_id', safeProjId)
    await auditLog(supabase, userId, 'sharing.project_revoke', { teamId: safeTeamId, targetUserId: safeTargetId, projectId: safeProjId })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
