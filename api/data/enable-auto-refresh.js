import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeUUID, sanitizeString } from '../lib/sanitize.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  const { projectId, refreshToken, spreadsheetId, sheetName, enabled } = req.body || {}
  const safeProjectId = sanitizeUUID(projectId)
  if (!safeProjectId) return res.status(400).json({ error: 'Missing or invalid projectId' })

  const { data: project, error: projErr } = await supabase
    .from('projects').select('id, user_id, data_source_meta').eq('id', safeProjectId).single()

  if (projErr || !project) return res.status(404).json({ error: 'Project not found' })
  if (project.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

  const meta = project.data_source_meta || {}
  const updatedMeta = {
    ...meta,
    auto_refresh: enabled !== false,
    refresh_token: sanitizeString(refreshToken, 2000) || meta.refresh_token,
    spreadsheet_id: sanitizeString(spreadsheetId, 200) || meta.spreadsheet_id,
    sheet_name: sanitizeString(sheetName, 200) || meta.sheet_name,
  }

  const { error } = await supabase.from('projects').update({ data_source_meta: updatedMeta }).eq('id', safeProjectId)
  if (error) return res.status(500).json({ error: 'Something went wrong' })

  return res.json({ success: true, auto_refresh: updatedMeta.auto_refresh })
}
