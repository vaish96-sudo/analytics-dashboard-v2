import { validateSession } from '../lib/validateSession.js'

async function checkProjectAccess(supabase, projectId, userId) {
  // Owner check
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single()

  if (error || !project) return { allowed: false, isOwner: false }
  if (project.user_id === userId) return { allowed: true, isOwner: true }

  // Shared access: user is an active team member of a team owned by the project owner,
  // AND has client_access or project_access for this project
  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (!memberships || memberships.length === 0) return { allowed: false, isOwner: false }

  const teamIds = memberships.map(m => m.team_id)

  // Check if any of these teams are owned by the project owner
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .in('id', teamIds)
    .eq('owner_id', project.user_id)

  if (!teams || teams.length === 0) return { allowed: false, isOwner: false }

  const relevantTeamIds = teams.map(t => t.id)

  // Check project-level access
  const { data: projAccess } = await supabase
    .from('project_access')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .in('team_id', relevantTeamIds)
    .limit(1)

  if (projAccess && projAccess.length > 0) return { allowed: true, isOwner: false }

  // Check client-level access
  const { data: fullProject } = await supabase
    .from('projects')
    .select('client_name')
    .eq('id', projectId)
    .single()

  const clientName = fullProject?.client_name || 'Uncategorized'
  const { data: clientAccess } = await supabase
    .from('client_access')
    .select('id')
    .eq('user_id', userId)
    .eq('client_name', clientName)
    .in('team_id', relevantTeamIds)
    .limit(1)

  if (clientAccess && clientAccess.length > 0) return { allowed: true, isOwner: false }

  return { allowed: false, isOwner: false }
}

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  const projectId = req.query.id
  if (!projectId) return res.status(400).json({ error: 'Missing project ID' })

  const { allowed, isOwner } = await checkProjectAccess(supabase, projectId, userId)
  if (!allowed) return res.status(403).json({ error: 'Access denied' })

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, name, user_id, client_name, data_source_type, data_source_meta, created_at, updated_at,
        datasets(id, file_name, schema_def, row_count, raw_data_path, raw_data, created_at)
      `)
      .eq('id', projectId)
      .single()

    if (error) return res.status(500).json({ error: error.message })

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
          // Auto-create missing dashboard state
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
    const updates = req.body || {}
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
