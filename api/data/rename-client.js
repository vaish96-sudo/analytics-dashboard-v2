import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  const { oldName, newName } = req.body || {}
  if (!newName?.trim()) return res.status(400).json({ error: 'New name is required' })

  if (oldName === 'Uncategorized' || !oldName) {
    await supabase.from('projects').update({ client_name: newName.trim() }).is('client_name', null).eq('user_id', userId)
  } else {
    await supabase.from('projects').update({ client_name: newName.trim() }).eq('client_name', oldName).eq('user_id', userId)
  }

  return res.json({ success: true })
}
