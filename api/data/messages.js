import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const conversationId = req.query.conversation_id
    if (!conversationId) return res.status(400).json({ error: 'Missing conversation_id' })

    // Ownership via project
    const { data: convo } = await supabase
      .from('conversations')
      .select('id, projects!inner(user_id)')
      .eq('id', conversationId)
      .single()

    if (!convo || convo.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, sql_plan, meta, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { conversationId, role, content, sqlPlan, meta } = req.body || {}
    if (!conversationId || !role || content === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Ownership via project
    const { data: convo } = await supabase
      .from('conversations')
      .select('id, projects!inner(user_id)')
      .eq('id', conversationId)
      .single()

    if (!convo || convo.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        sql_plan: sqlPlan || null,
        meta: meta || null,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Touch conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
