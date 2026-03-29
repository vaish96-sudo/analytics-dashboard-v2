import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeString, sanitizeUUID, sanitizeJSON } from '../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const conversationId = sanitizeUUID(req.query.conversation_id)
    if (!conversationId) return res.status(400).json({ error: 'Missing or invalid conversation_id' })

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

    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { conversationId, role, content, sqlPlan, meta } = req.body || {}
    const safeConvoId = sanitizeUUID(conversationId)
    const safeRole = ['user', 'assistant'].includes(role) ? role : null
    const safeContent = sanitizeString(content, 50000)
    if (!safeConvoId || !safeRole || safeContent === null) {
      return res.status(400).json({ error: 'Missing or invalid required fields' })
    }

    // Ownership via project
    const { data: convo } = await supabase
      .from('conversations')
      .select('id, projects!inner(user_id)')
      .eq('id', safeConvoId)
      .single()

    if (!convo || convo.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: safeConvoId,
        role: safeRole,
        content: safeContent,
        sql_plan: sanitizeString(sqlPlan, 5000) || null,
        meta: sanitizeJSON(meta, 50000) || null,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: 'Something went wrong' })

    // Touch conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
