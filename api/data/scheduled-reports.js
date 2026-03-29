import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeUUID, sanitizeString } from '../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  async function checkDatasetOwnership(datasetId) {
    const safe = sanitizeUUID(datasetId)
    if (!safe) return false
    const { data } = await supabase.from('datasets').select('id, projects!inner(user_id)').eq('id', safe).single()
    return data && data.projects.user_id === userId
  }

  if (req.method === 'GET') {
    const datasetId = sanitizeUUID(req.query.dataset_id)
    if (!datasetId) return res.status(400).json({ error: 'Missing or invalid dataset_id' })
    if (!(await checkDatasetOwnership(datasetId))) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase.from('scheduled_reports').select('*').eq('dataset_id', datasetId).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { datasetId, frequency, recipients, format, sections } = req.body || {}
    const safeDatasetId = sanitizeUUID(datasetId)
    if (!safeDatasetId) return res.status(400).json({ error: 'Missing or invalid datasetId' })
    if (!(await checkDatasetOwnership(safeDatasetId))) return res.status(403).json({ error: 'Access denied' })

    const allowedFreq = ['daily', 'weekly', 'monthly']
    const allowedFormat = ['pdf', 'csv']
    const safeFreq = allowedFreq.includes(frequency) ? frequency : 'weekly'
    const safeFormat = allowedFormat.includes(format) ? format : 'pdf'
    // Validate recipients are emails
    const safeRecipients = Array.isArray(recipients) ? recipients.filter(r => typeof r === 'string' && r.includes('@')).slice(0, 10).map(r => r.toLowerCase().trim().slice(0, 320)) : []

    const { data, error } = await supabase.from('scheduled_reports').insert({
      dataset_id: safeDatasetId, user_id: userId, frequency: safeFreq, recipients: safeRecipients,
      format: safeFormat, sections: Array.isArray(sections) ? sections.slice(0, 20) : [], enabled: true,
    }).select().single()

    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.status(201).json(data)
  }

  if (req.method === 'PATCH') {
    const { reportId, updates } = req.body || {}
    const safeReportId = sanitizeUUID(reportId)
    if (!safeReportId) return res.status(400).json({ error: 'Missing or invalid reportId' })

    const { data: report } = await supabase.from('scheduled_reports').select('dataset_id').eq('id', safeReportId).single()
    if (!report) return res.status(404).json({ error: 'Report not found' })
    if (!(await checkDatasetOwnership(report.dataset_id))) return res.status(403).json({ error: 'Access denied' })

    // Whitelist allowed update fields
    const safeUpdates = {}
    if (updates?.enabled !== undefined) safeUpdates.enabled = Boolean(updates.enabled)
    if (updates?.frequency && ['daily', 'weekly', 'monthly'].includes(updates.frequency)) safeUpdates.frequency = updates.frequency
    if (updates?.format && ['pdf', 'csv'].includes(updates.format)) safeUpdates.format = updates.format
    if (Array.isArray(updates?.recipients)) safeUpdates.recipients = updates.recipients.filter(r => typeof r === 'string' && r.includes('@')).slice(0, 10)
    if (Array.isArray(updates?.sections)) safeUpdates.sections = updates.sections.slice(0, 20)

    const { data, error } = await supabase.from('scheduled_reports').update(safeUpdates).eq('id', safeReportId).select().single()
    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const reportId = sanitizeUUID(req.query.report_id)
    if (!reportId) return res.status(400).json({ error: 'Missing or invalid report_id' })

    const { data: report } = await supabase.from('scheduled_reports').select('dataset_id').eq('id', reportId).single()
    if (!report) return res.status(404).json({ error: 'Report not found' })
    if (!(await checkDatasetOwnership(report.dataset_id))) return res.status(403).json({ error: 'Access denied' })

    const { error } = await supabase.from('scheduled_reports').delete().eq('id', reportId)
    if (error) return res.status(500).json({ error: 'Something went wrong' })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
