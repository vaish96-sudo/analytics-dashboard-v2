import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (req.method === 'GET') {
    const teamId = req.query.team_id
    if (!teamId) return res.status(400).json({ error: 'Missing team_id' })

    // Must be a member of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (!membership) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('team_members')
      .select('*, users:user_id(email, name)')
      .eq('team_id', teamId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    // Invite a member
    const { teamId, email, role } = req.body || {}
    if (!teamId || !email) return res.status(400).json({ error: 'Missing required fields' })

    // Must be team owner/admin
    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can invite members' })

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single()

    const { data, error } = await supabase.from('team_members').insert({
      team_id: teamId,
      user_id: existingUser?.id || null,
      invited_email: email.toLowerCase().trim(),
      role: role || 'viewer',
      status: 'pending',
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PATCH') {
    const { memberId, updates } = req.body || {}
    if (!memberId) return res.status(400).json({ error: 'Missing memberId' })

    // Get the member to find the team
    const { data: member } = await supabase
      .from('team_members')
      .select('team_id, user_id')
      .eq('id', memberId)
      .single()

    if (!member) return res.status(404).json({ error: 'Member not found' })

    // Allow team owner to change roles, OR allow the member to accept their own invite
    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', member.team_id).single()
    const isOwner = team?.owner_id === userId
    const isSelf = member.user_id === userId

    if (!isOwner && !isSelf) return res.status(403).json({ error: 'Access denied' })

    // If self, only allow status update (accept invite)
    const safeUpdates = {}
    if (isOwner) {
      if (updates.role) safeUpdates.role = updates.role
      if (updates.status) safeUpdates.status = updates.status
    }
    if (isSelf && updates.status) {
      safeUpdates.status = updates.status
      // Set user_id when accepting
      if (updates.status === 'active') safeUpdates.user_id = userId
    }

    const { data, error } = await supabase
      .from('team_members')
      .update(safeUpdates)
      .eq('id', memberId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const memberId = req.query.member_id
    if (!memberId) return res.status(400).json({ error: 'Missing member_id' })

    const { data: member } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('id', memberId)
      .single()

    if (!member) return res.status(404).json({ error: 'Member not found' })

    // Only team owner can remove
    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', member.team_id).single()
    if (!team || team.owner_id !== userId) return res.status(403).json({ error: 'Only the team owner can remove members' })

    const { error } = await supabase.from('team_members').delete().eq('id', memberId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
