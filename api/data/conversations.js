import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeUUID } from '../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const projectId = sanitizeUUID(req.query.project_id)
    if (!projectId) return res.status(400).json({ error: 'Missing or invalid project_id' })

    const { data: project } = await supabase.from('projects').select('user_id').eq('id', projectId).single()
    if (!project || project.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, dataset_id, created_at, updated_at')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })

    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { projectId, datasetId } = req.body || {}
    const safeProjectId = sanitizeUUID(projectId)
    const safeDatasetId = sanitizeUUID(datasetId)
    if (!safeProjectId) return res.status(400).json({ error: 'Missing or invalid projectId' })

    const { data: project } = await supabase.from('projects').select('user_id').eq('id', safeProjectId).single()
    if (!project || project.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('conversations')
      .insert({ project_id: safeProjectId, dataset_id: safeDatasetId || null })
      .select()
      .single()

    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
