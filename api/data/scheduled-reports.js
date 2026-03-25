import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  // Helper: verify ownership via dataset → project
  async function checkDatasetOwnership(datasetId) {
    const { data } = await supabase
      .from('datasets')
      .select('id, projects!inner(user_id)')
      .eq('id', datasetId)
      .single()
    return data && data.projects.user_id === userId
  }

  if (req.method === 'GET') {
    const datasetId = req.query.dataset_id
    if (!datasetId) return res.status(400).json({ error: 'Missing dataset_id' })
    if (!(await checkDatasetOwnership(datasetId))) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { datasetId, frequency, recipients, format, sections } = req.body || {}
    if (!datasetId) return res.status(400).json({ error: 'Missing datasetId' })
    if (!(await checkDatasetOwnership(datasetId))) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase.from('scheduled_reports').insert({
      dataset_id: datasetId,
      user_id: userId,
      frequency: frequency || 'weekly',
      recipients: recipients || [],
      format: format || 'pdf',
      sections: sections || [],
      enabled: true,
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PATCH') {
    const { reportId, updates } = req.body || {}
    if (!reportId) return res.status(400).json({ error: 'Missing reportId' })

    // Check ownership via the report's dataset
    const { data: report } = await supabase.from('scheduled_reports').select('dataset_id').eq('id', reportId).single()
    if (!report) return res.status(404).json({ error: 'Report not found' })
    if (!(await checkDatasetOwnership(report.dataset_id))) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('scheduled_reports')
      .update(updates)
      .eq('id', reportId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const reportId = req.query.report_id
    if (!reportId) return res.status(400).json({ error: 'Missing report_id' })

    const { data: report } = await supabase.from('scheduled_reports').select('dataset_id').eq('id', reportId).single()
    if (!report) return res.status(404).json({ error: 'Report not found' })
    if (!(await checkDatasetOwnership(report.dataset_id))) return res.status(403).json({ error: 'Access denied' })

    const { error } = await supabase.from('scheduled_reports').delete().eq('id', reportId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
