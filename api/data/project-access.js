import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { auditLog } from '../lib/auditLog.js'
import { applyRateLimit } from '../lib/rateLimit.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const { teamId, projectId } = req.query
    if (!teamId) return res.status(400).json({ error: 'Missing teamId' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Access denied' })

    let query = supabase.from('project_access').select('user_id, project_id').eq('team_id', teamId)
    if (projectId) query = query.eq('project_id', projectId)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { teamId, targetUserId, projectId } = req.body || {}
    if (!teamId || !targetUserId || !projectId) return res.status(400).json({ error: 'Missing required fields' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can grant access' })

    const { error } = await supabase.from('project_access').insert({
      team_id: teamId,
      user_id: targetUserId,
      project_id: projectId,
    })
    if (error && !error.message.includes('duplicate')) return res.status(500).json({ error: error.message })
    await auditLog(supabase, userId, 'sharing.project_grant', { teamId, targetUserId, projectId })
    return res.status(201).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { teamId, targetUserId, projectId } = req.query
    if (!teamId || !targetUserId || !projectId) return res.status(400).json({ error: 'Missing required fields' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can grant access' })

    await supabase.from('project_access')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', targetUserId)
      .eq('project_id', projectId)

    await auditLog(supabase, userId, 'sharing.project_revoke', { teamId, targetUserId, projectId })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
