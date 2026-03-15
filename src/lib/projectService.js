import { supabase } from '../lib/supabase'

// ============================================================
// PROJECTS
// ============================================================

export async function createProject(userId, { name, dataSourceType, dataSourceMeta }) {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name,
      data_source_type: dataSourceType,
      data_source_meta: dataSourceMeta || {},
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function listProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, data_source_type, data_source_meta, created_at, updated_at,
      datasets(id, file_name, row_count, created_at)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function getProject(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, data_source_type, data_source_meta, created_at, updated_at,
      datasets(id, file_name, schema_def, row_count, raw_data, created_at,
        dashboard_states(id, active_tab, global_filters, charts_state, report_builder_state, data_table_state, insights, insights_loaded)
      )
    `)
    .eq('id', projectId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateProject(projectId, updates) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteProject(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) throw new Error(error.message)
}

// ============================================================
// DATASETS
// ============================================================

export async function createDataset(projectId, { fileName, schemaDef, rowCount, rawData }) {
  const { data, error } = await supabase
    .from('datasets')
    .insert({
      project_id: projectId,
      file_name: fileName,
      schema_def: schemaDef,
      row_count: rowCount,
      raw_data: rawData,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Create default dashboard state
  await supabase.from('dashboard_states').insert({
    dataset_id: data.id,
  })

  return data
}

export async function updateDataset(datasetId, updates) {
  const { data, error } = await supabase
    .from('datasets')
    .update(updates)
    .eq('id', datasetId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteDataset(datasetId) {
  const { error } = await supabase
    .from('datasets')
    .delete()
    .eq('id', datasetId)

  if (error) throw new Error(error.message)
}

// ============================================================
// DASHBOARD STATE
// ============================================================

export async function getDashboardState(datasetId) {
  const { data, error } = await supabase
    .from('dashboard_states')
    .select('*')
    .eq('dataset_id', datasetId)
    .single()

  if (error) return null
  return data
}

export async function saveDashboardState(datasetId, state) {
  // CRITICAL: Strip insights fields — they must ONLY be written by saveInsightsOnly()
  // This prevents any caller from accidentally overwriting insights with stale data
  const { insights, insights_loaded, ...safeState } = state

  // Check if row exists
  const { data: existing } = await supabase
    .from('dashboard_states')
    .select('id')
    .eq('dataset_id', datasetId)
    .limit(1)

  if (existing && existing.length > 0) {
    // Update the first matching row — insights fields are guaranteed excluded
    const { error } = await supabase
      .from('dashboard_states')
      .update({ ...safeState, updated_at: new Date().toISOString() })
      .eq('id', existing[0].id)
    if (error) throw new Error(error.message)
  } else {
    // Insert new row — no insights fields, Supabase defaults apply ([] and false)
    const { error } = await supabase
      .from('dashboard_states')
      .insert({ dataset_id: datasetId, ...safeState })
    if (error) throw new Error(error.message)
  }
  return true
}

export async function saveInsightsOnly(datasetId, insights, insightsLoaded) {
  console.log('saveInsightsOnly called with datasetId:', datasetId, 'insights count:', insights?.length)
  
  // Just do a direct update — we know the row exists from the JOIN query
  const { data, error, count } = await supabase
    .from('dashboard_states')
    .update({ 
      insights: JSON.parse(JSON.stringify(insights)),  // Force clean JSON
      insights_loaded: insightsLoaded 
    })
    .eq('dataset_id', datasetId)
    .select('id, insights_loaded')

  console.log('saveInsightsOnly result:', { data, error, count })
  
  if (error) {
    console.error('saveInsightsOnly error:', error)
    throw new Error(error.message)
  }
  
  if (!data || data.length === 0) {
    console.warn('saveInsightsOnly: no rows matched dataset_id', datasetId)
    // Try insert instead
    const { error: insertErr } = await supabase
      .from('dashboard_states')
      .insert({ 
        dataset_id: datasetId, 
        insights: JSON.parse(JSON.stringify(insights)), 
        insights_loaded: insightsLoaded 
      })
    if (insertErr) console.error('saveInsightsOnly insert error:', insertErr)
    else console.log('saveInsightsOnly: inserted new row')
  }
  
  return true
}

// ============================================================
// CONVERSATIONS
// ============================================================

export async function listConversations(projectId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, dataset_id, created_at, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createConversation(projectId, datasetId) {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      project_id: projectId,
      dataset_id: datasetId || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateConversation(conversationId, updates) {
  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteConversation(conversationId) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)

  if (error) throw new Error(error.message)
}

// ============================================================
// MESSAGES
// ============================================================

export async function getMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, sql_plan, meta, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function addMessage(conversationId, { role, content, sqlPlan, meta }) {
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

  if (error) throw new Error(error.message)

  // Touch conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data
}

// ============================================================
// CROSS-PROJECT QUERIES (for home screen)
// ============================================================

export async function listAllConversations(userId) {
  // Get all projects for this user, then all conversations
  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId)

  if (pErr) throw new Error(pErr.message)
  if (!projects || projects.length === 0) return []

  const projectIds = projects.map(p => p.id)
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))

  const { data: convos, error: cErr } = await supabase
    .from('conversations')
    .select('id, title, project_id, dataset_id, created_at, updated_at')
    .in('project_id', projectIds)
    .order('updated_at', { ascending: false })

  if (cErr) throw new Error(cErr.message)
  return (convos || []).map(c => ({ ...c, projectName: projectMap[c.project_id] || 'Unknown' }))
}

export async function listAllInsights(userId) {
  // Get all projects with their datasets and dashboard states
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      id, name, updated_at,
      datasets(id, file_name, row_count,
        dashboard_states(insights, insights_loaded)
      )
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!projects) return []

  const results = []
  for (const project of projects) {
    for (const ds of (project.datasets || [])) {
      const state = ds.dashboard_states?.[0]
      if (state?.insights?.length > 0) {
        results.push({
          projectId: project.id,
          projectName: project.name,
          datasetId: ds.id,
          fileName: ds.file_name,
          rowCount: ds.row_count,
          insights: state.insights,
          updatedAt: project.updated_at,
        })
      }
    }
  }
  return results
}
