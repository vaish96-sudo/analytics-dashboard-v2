import { validateSession } from '../lib/validateSession.js'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, company, avatar_url, email_verified')
    .eq('id', userId)
    .single()

  if (error || !user) return res.status(401).json({ error: 'User not found' })

  return res.json({ user })
}
