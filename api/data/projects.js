import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { auditLog } from '../lib/auditLog.js'
import { sanitizeString, sanitizeJSON } from '../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, name, client_name, data_source_type, data_source_meta, created_at, updated_at,
        datasets(id, file_name, row_count, created_at)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { name, clientName, dataSourceType, dataSourceMeta } = req.body || {}
    const safeName = sanitizeString(name, 200)
    if (!safeName) return res.status(400).json({ error: 'Project name is required (max 200 characters)' })
    const safeClient = sanitizeString(clientName, 200)
    const safeType = sanitizeString(dataSourceType, 50)
    const safeMeta = sanitizeJSON(dataSourceMeta, 50000)

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: safeName,
        client_name: safeClient,
        data_source_type: safeType,
        data_source_meta: safeMeta || {},
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    await auditLog(supabase, userId, 'project.create', { projectId: data.id, name: safeName })
    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
