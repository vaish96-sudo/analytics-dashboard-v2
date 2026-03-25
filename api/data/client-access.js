import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (req.method === 'GET') {
    const { teamId, clientName } = req.query
    if (!teamId) return res.status(400).json({ error: 'Missing teamId' })

    // Must be team owner to list access
    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Access denied' })

    let query = supabase.from('client_access').select('user_id, client_name').eq('team_id', teamId)
    if (clientName) query = query.eq('client_name', clientName)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { teamId, targetUserId, clientName } = req.body || {}
    if (!teamId || !targetUserId || !clientName) return res.status(400).json({ error: 'Missing required fields' })

    // Only team owner can grant
    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can grant access' })

    const { error } = await supabase.from('client_access').insert({
      team_id: teamId,
      user_id: targetUserId,
      client_name: clientName,
    })
    if (error && !error.message.includes('duplicate')) return res.status(500).json({ error: error.message })
    return res.status(201).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { teamId, targetUserId, clientName } = req.query
    if (!teamId || !targetUserId || !clientName) return res.status(400).json({ error: 'Missing required fields' })

    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can revoke access' })

    await supabase.from('client_access')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', targetUserId)
      .eq('client_name', clientName)

    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
