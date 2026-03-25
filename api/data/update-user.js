import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  const updates = req.body || {}
  const allowed = ['name', 'company', 'avatar_url']
  const safeUpdates = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key]
  }

  const { data, error } = await supabase
    .from('users')
    .update(safeUpdates)
    .eq('id', userId)
    .select('id, email, name, company, avatar_url, email_verified')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
}
