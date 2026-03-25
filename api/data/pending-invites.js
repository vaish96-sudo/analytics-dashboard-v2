import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  // Get user's email
  const { data: user } = await supabase.from('users').select('email').eq('id', userId).single()
  if (!user?.email) return res.json([])

  const { data, error } = await supabase
    .from('team_members')
    .select('id, team_id, role, invited_email, teams:team_id(name, owner_id)')
    .eq('invited_email', user.email.toLowerCase())
    .eq('status', 'pending')

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data || [])
}
