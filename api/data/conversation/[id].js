import { validateSession, checkOrigin } from '../../lib/validateSession.js'
import { applyRateLimit } from '../../lib/rateLimit.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  const conversationId = req.query.id
  if (!conversationId) return res.status(400).json({ error: 'Missing conversation ID' })

  // Ownership via project
  const { data: convo, error: cErr } = await supabase
    .from('conversations')
    .select('id, project_id, projects!inner(user_id)')
    .eq('id', conversationId)
    .single()

  if (cErr || !convo) return res.status(404).json({ error: 'Conversation not found' })
  if (convo.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, dataset_id, project_id, created_at, updated_at')
      .eq('id', conversationId)
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'PATCH') {
    const updates = req.body || {}
    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('conversations').delete().eq('id', conversationId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
