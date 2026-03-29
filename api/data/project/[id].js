import { validateSession, checkOrigin } from '../../lib/validateSession.js'
import { applyRateLimit } from '../../lib/rateLimit.js'
import { auditLog } from '../../lib/auditLog.js'
import { sanitizeUUID } from '../../lib/sanitize.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  const projectId = sanitizeUUID(req.query.id)
  if (!projectId) return res.status(400).json({ error: 'Missing or invalid project ID' })

  // Check if user owns the project OR has shared access
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single()

  if (projErr || !project) return res.status(404).json({ error: 'Project not found' })

  const isOwner = project.user_id === userId

  // If not owner, check shared access (team membership + client/project access)
  if (!isOwner) {
    let hasAccess = false
    try {
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .eq('status', 'active')

      if (memberships && memberships.length > 0) {
        const teamIds = memberships.map(m => m.team_id)

        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .in('id', teamIds)
          .eq('owner_id', project.user_id)

        if (teams && teams.length > 0) {
          const relevantTeamIds = teams.map(t => t.id)

          // Check project-level access
          try {
            const { data: projAccess } = await supabase
              .from('project_access')
              .select('id')
              .eq('user_id', userId)
              .eq('project_id', projectId)
              .in('team_id', relevantTeamIds)
              .limit(1)
            if (projAccess && projAccess.length > 0) hasAccess = true
          } catch {}

          // Check client-level access
          if (!hasAccess) {
            try {
              const { data: fullProj } = await supabase
                .from('projects')
                .select('client_name')
                .eq('id', projectId)
                .single()

              const clientName = fullProj?.client_name || 'Uncategorized'
              const { data: clientAccess } = await supabase
                .from('client_access')
                .select('id')
                .eq('user_id', userId)
                .eq('client_name', clientName)
                .in('team_id', relevantTeamIds)
                .limit(1)
              if (clientAccess && clientAccess.length > 0) hasAccess = true
            } catch {}
          }
        }
      }
    } catch {}

    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, name, user_id, client_name, data_source_type, data_source_meta, created_at, updated_at,
        datasets(id, file_name, schema_def, row_count, raw_data_path, raw_data, created_at)
      `)
      .eq('id', projectId)
      .single()

    if (error) return res.status(500).json({ error: 'Something went wrong' })

    // Fetch dashboard_states for all datasets
    if (data?.datasets && data.datasets.length > 0) {
      const datasetIds = data.datasets.map(ds => ds.id)
      const { data: allStates, error: stErr } = await supabase
        .from('dashboard_states')
        .select('id, dataset_id, active_tab, global_filters, charts_state, report_builder_state, data_table_state, insights, insights_loaded, recommendations, ai_charts, custom_metrics, updated_at')
        .in('dataset_id', datasetIds)

      if (stErr) console.error('Failed to fetch dashboard_states:', stErr.message)

      for (const ds of data.datasets) {
        const matched = (allStates || []).filter(s => s.dataset_id === ds.id)
        if (matched.length > 0) {
          ds.dashboard_states = matched
        } else {
          const { data: newRow } = await supabase
            .from('dashboard_states')
            .insert({ dataset_id: ds.id })
            .select('id, dataset_id, active_tab, global_filters, charts_state, report_builder_state, data_table_state, insights, insights_loaded, recommendations, ai_charts, custom_metrics, updated_at')
          ds.dashboard_states = newRow || []
        }
      }
    }

    return res.json(data)
  }

  // Only owners can modify/delete
  if (!isOwner) return res.status(403).json({ error: 'Only the project owner can modify this project' })

  if (req.method === 'PATCH') {
    const body = req.body || {}
    // Strict field whitelist — prevent overwriting user_id, id, etc.
    const ALLOWED = ['name', 'client_name', 'data_source_type', 'data_source_meta']
    const safeUpdates = {}
    for (const key of ALLOWED) {
      if (body[key] !== undefined) safeUpdates[key] = body[key]
    }
    if (typeof safeUpdates.name === 'string') safeUpdates.name = safeUpdates.name.trim().slice(0, 200)
    if (typeof safeUpdates.client_name === 'string') safeUpdates.client_name = safeUpdates.client_name.trim().slice(0, 200)
    if (typeof safeUpdates.data_source_type === 'string') safeUpdates.data_source_type = safeUpdates.data_source_type.trim().slice(0, 50)

    if (Object.keys(safeUpdates).length === 0) return res.status(400).json({ error: 'No valid fields to update' })

    const { data, error } = await supabase
      .from('projects')
      .update(safeUpdates)
      .eq('id', projectId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: 'Failed to update project' })
    await auditLog(supabase, userId, 'project.update', { projectId, updates: Object.keys(safeUpdates) })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) return res.status(500).json({ error: 'Something went wrong' })
    await auditLog(supabase, userId, 'project.delete', { projectId })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
