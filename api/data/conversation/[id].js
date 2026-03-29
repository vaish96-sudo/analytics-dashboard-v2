import { validateSession, checkOrigin } from '../../lib/validateSession.js'
import { applyRateLimit } from '../../lib/rateLimit.js'
import { sanitizeUUID } from '../../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  const conversationId = sanitizeUUID(req.query.id)
  if (!conversationId) return res.status(400).json({ error: 'Missing or invalid conversation ID' })

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

    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.json(data)
  }

  if (req.method === 'PATCH') {
    const body = req.body || {}
    // Only title is editable
    const safeUpdates = {}
    if (typeof body.title === 'string') safeUpdates.title = body.title.trim().slice(0, 500)
    if (Object.keys(safeUpdates).length === 0) return res.status(400).json({ error: 'No valid fields to update' })

    safeUpdates.updated_at = new Date().toISOString()
    const { data, error } = await supabase
      .from('conversations')
      .update(safeUpdates)
      .eq('id', conversationId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: 'Failed to update conversation' })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('conversations').delete().eq('id', conversationId)
    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
