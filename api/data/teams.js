import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (req.method === 'GET') {
    // Get user's team via profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('team_id')
      .eq('id', userId)
      .single()

    if (!profile?.team_id) return res.json(null)

    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', profile.team_id)
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(team)
  }

  if (req.method === 'POST') {
    const { name } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' })

    const { data: newTeam, error: err } = await supabase
      .from('teams')
      .insert({ name: name.trim(), owner_id: userId })
      .select()
      .single()

    if (err) return res.status(500).json({ error: err.message })

    // Update user profile with team
    await supabase.from('user_profiles').update({ team_id: newTeam.id, role: 'owner' }).eq('id', userId)

    // Add owner as admin member
    await supabase.from('team_members').insert({
      team_id: newTeam.id,
      user_id: userId,
      role: 'admin',
      status: 'active',
      invited_email: (await supabase.from('users').select('email').eq('id', userId).single()).data?.email,
    })

    return res.status(201).json(newTeam)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
