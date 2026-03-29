import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeJSON } from '../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  if (req.method === 'GET') {
    const datasetId = req.query.dataset_id
    if (!datasetId) return res.status(400).json({ error: 'Missing dataset_id' })

    // Ownership via project
    const { data: ds, error: dsErr } = await supabase
      .from('datasets')
      .select('id, projects!inner(user_id)')
      .eq('id', datasetId)
      .single()

    if (dsErr || !ds) return res.status(404).json({ error: 'Dataset not found' })
    if (ds.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('dashboard_states')
      .select('*')
      .eq('dataset_id', datasetId)
      .single()

    if (error) return res.json(null)
    return res.json(data)
  }

  if (req.method === 'PATCH') {
    const body = req.body || {}
    const datasetId = body.datasetId
    if (!datasetId) return res.status(400).json({ error: 'Missing datasetId' })

    // Ownership via project
    const { data: ds, error: dsErr } = await supabase
      .from('datasets')
      .select('id, projects!inner(user_id)')
      .eq('id', datasetId)
      .single()

    if (dsErr || !ds) return res.status(404).json({ error: 'Dataset not found' })
    if (ds.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

    // Strict field whitelist — only these fields can be updated
    // FIX #15: Validate JSON size on all object fields to prevent database bloat
    const ALLOWED_FIELDS = ['charts_state', 'active_tab', 'global_filters', 'report_builder_state', 'data_table_state', 'recommendations', 'ai_charts', 'custom_metrics', 'kpi_order', 'hidden_charts']
    const safeState = {}
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        if (typeof body[key] === 'object' && body[key] !== null) {
          const sanitized = sanitizeJSON(body[key], 500000) // 500KB max per field
          if (sanitized === null) return res.status(400).json({ error: `${key} is too large (max 500KB)` })
          safeState[key] = sanitized
        } else {
          safeState[key] = body[key]
        }
      }
    }

    // Try update first
    const { data, error } = await supabase
      .from('dashboard_states')
      .update({ ...safeState, updated_at: new Date().toISOString() })
      .eq('dataset_id', datasetId)
      .select('id')

    if (error) return res.status(500).json({ error: 'Failed to save dashboard state' })

    // Auto-create if missing
    if (!data || data.length === 0) {
      await supabase
        .from('dashboard_states')
        .insert({ dataset_id: datasetId, ...safeState })
        .select('id')
    }

    return res.json({ success: true })
  }

  if (req.method === 'POST') {
    // Save insights only
    const { datasetId, insights, insightsLoaded } = req.body || {}
    if (!datasetId) return res.status(400).json({ error: 'Missing datasetId' })

    // Ownership via project
    const { data: ds, error: dsErr } = await supabase
      .from('datasets')
      .select('id, projects!inner(user_id)')
      .eq('id', datasetId)
      .single()

    if (dsErr || !ds) return res.status(404).json({ error: 'Dataset not found' })
    if (ds.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabase
      .from('dashboard_states')
      .update({
        insights: JSON.parse(JSON.stringify(insights)),
        insights_loaded: insightsLoaded,
      })
      .eq('dataset_id', datasetId)
      .select('id, insights_loaded')

    if (error) return res.status(500).json({ error: 'Failed to save insights' })

    if (!data || data.length === 0) {
      await supabase.from('dashboard_states').insert({
        dataset_id: datasetId,
        insights: JSON.parse(JSON.stringify(insights)),
        insights_loaded: insightsLoaded,
      })
    }

    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
