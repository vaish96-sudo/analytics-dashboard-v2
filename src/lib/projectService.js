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
  const { data, error } = await supabase
    .from('dashboard_states')
    .upsert({
      dataset_id: datasetId,
      ...state,
    }, { onConflict: 'dataset_id' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
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

export async function listAllConversations(projectIds) {
  if (!projectIds || projectIds.length === 0) return []
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, project_id, dataset_id, created_at, updated_at')
    .in('project_id', projectIds)
    .order('updated_at', { ascending: false })
    .limit(50)

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
