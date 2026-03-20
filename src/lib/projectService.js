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
  // Step 1: Fetch project + datasets (without nested dashboard_states — nested select is unreliable)
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, data_source_type, data_source_meta, created_at, updated_at,
      datasets(id, file_name, schema_def, row_count, raw_data_path, raw_data, created_at)
    `)
    .eq('id', projectId)
    .single()

  if (error) throw new Error(error.message)

  // Step 2: Fetch dashboard_states directly for all datasets in this project
  if (data?.datasets && data.datasets.length > 0) {
    const datasetIds = data.datasets.map(ds => ds.id)

    const { data: allStates, error: stErr } = await supabase
      .from('dashboard_states')
      .select('id, dataset_id, active_tab, global_filters, charts_state, report_builder_state, data_table_state, insights, insights_loaded, recommendations, ai_charts, custom_metrics, updated_at')
      .in('dataset_id', datasetIds)

    if (stErr) console.error('Failed to fetch dashboard_states:', stErr.message)

    // Step 3: Attach states to their datasets, auto-create if missing
    for (const ds of data.datasets) {
      const matched = (allStates || []).filter(s => s.dataset_id === ds.id)

      if (matched.length > 0) {
        ds.dashboard_states = matched
        const st = matched[0]
        console.log('DB READ for dataset', ds.id, '→ filters:', Object.keys(st.global_filters || {}).length, 'insights:', (st.insights || []).length, 'ai_charts:', (st.ai_charts || []).length)
      } else {
        console.log('No dashboard_states row for dataset', ds.id, '— creating one')
        const { data: newRow } = await supabase
          .from('dashboard_states')
          .insert({ dataset_id: ds.id })
          .select('id, dataset_id, active_tab, global_filters, charts_state, report_builder_state, data_table_state, insights, insights_loaded, recommendations, ai_charts, custom_metrics, updated_at')
        ds.dashboard_states = newRow || []
      }
    }
  }

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
  const storagePath = `${projectId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}.json.gz`

  // Compress raw data with gzip
  const jsonStr = JSON.stringify(rawData)
  let uploadBlob

  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'))
    uploadBlob = await new Response(stream).blob()
    console.log(`Compressed: ${(jsonStr.length / 1024 / 1024).toFixed(1)}MB → ${(uploadBlob.size / 1024 / 1024).toFixed(1)}MB`)
  } else {
    uploadBlob = new Blob([jsonStr], { type: 'application/gzip' })
  }

  // Use resumable upload (TUS protocol) for files > 5MB, standard for smaller
  if (uploadBlob.size > 5 * 1024 * 1024) {
    await uploadResumable(storagePath, uploadBlob)
  } else {
    const { error: uploadErr } = await supabase.storage
      .from('datasets')
      .upload(storagePath, uploadBlob, { contentType: 'application/gzip', upsert: true })
    if (uploadErr) throw new Error(`Failed to upload data: ${uploadErr.message}`)
  }

  console.log('Uploaded to Storage:', storagePath, `(${rawData.length} rows, ${(uploadBlob.size / 1024 / 1024).toFixed(1)}MB)`)

  const { data, error } = await supabase
    .from('datasets')
    .insert({
      project_id: projectId,
      file_name: fileName,
      schema_def: schemaDef,
      row_count: rowCount,
      raw_data: [],
      raw_data_path: storagePath,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from('datasets').remove([storagePath])
    throw new Error(error.message)
  }

  data._fullRawData = rawData
  await supabase.from('dashboard_states').insert({ dataset_id: data.id })
  return data
}

// Resumable upload using TUS protocol — bypasses 50MB proxy limit, supports up to 5GB
async function uploadResumable(storagePath, blob) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  return new Promise((resolve, reject) => {
    const chunkSize = 6 * 1024 * 1024 // 6MB chunks

    const xhr = new XMLHttpRequest()
    const file = new File([blob], storagePath.split('/').pop(), { type: 'application/gzip' })

    // TUS upload via manual chunked approach
    const totalSize = blob.size
    let offset = 0

    console.log(`Starting resumable upload: ${(totalSize / 1024 / 1024).toFixed(1)}MB in ${Math.ceil(totalSize / chunkSize)} chunks`)

    // Step 1: Create the upload
    const createXhr = new XMLHttpRequest()
    createXhr.open('POST', `${supabaseUrl}/storage/v1/upload/resumable`, true)
    createXhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`)
    createXhr.setRequestHeader('apikey', supabaseKey)
    createXhr.setRequestHeader('x-upsert', 'true')
    createXhr.setRequestHeader('Upload-Length', String(totalSize))
    createXhr.setRequestHeader('Upload-Metadata', `bucketName ${btoa('datasets')},objectName ${btoa(storagePath)},contentType ${btoa('application/gzip')}`)
    createXhr.setRequestHeader('Tus-Resumable', '1.0.0')

    createXhr.onload = function () {
      if (createXhr.status !== 201) {
        reject(new Error(`TUS create failed: ${createXhr.status} ${createXhr.responseText}`))
        return
      }

      const uploadUrl = createXhr.getResponseHeader('Location')
      if (!uploadUrl) {
        reject(new Error('TUS create: no Location header'))
        return
      }

      console.log('TUS upload created, sending chunks...')

      // Step 2: Upload chunks
      function uploadNextChunk() {
        if (offset >= totalSize) {
          console.log('TUS upload complete')
          resolve()
          return
        }

        const end = Math.min(offset + chunkSize, totalSize)
        const chunk = blob.slice(offset, end)

        const patchXhr = new XMLHttpRequest()
        patchXhr.open('PATCH', uploadUrl, true)
        patchXhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`)
        patchXhr.setRequestHeader('apikey', supabaseKey)
        patchXhr.setRequestHeader('Tus-Resumable', '1.0.0')
        patchXhr.setRequestHeader('Upload-Offset', String(offset))
        patchXhr.setRequestHeader('Content-Type', 'application/offset+octet-stream')

        patchXhr.onload = function () {
          if (patchXhr.status !== 204) {
            reject(new Error(`TUS patch failed at offset ${offset}: ${patchXhr.status} ${patchXhr.responseText}`))
            return
          }
          offset = end
          const pct = Math.round((offset / totalSize) * 100)
          console.log(`Upload progress: ${pct}% (${(offset / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`)
          uploadNextChunk()
        }

        patchXhr.onerror = function () {
          reject(new Error(`TUS patch network error at offset ${offset}`))
        }

        patchXhr.send(chunk)
      }

      uploadNextChunk()
    }

    createXhr.onerror = function () {
      reject(new Error('TUS create network error'))
    }

    createXhr.send(null)
  })
}

// Download raw data from Supabase Storage (handles both gzipped and plain JSON)
export async function downloadRawData(rawDataPath) {
  if (!rawDataPath) return []

  console.log('Downloading raw data from Storage:', rawDataPath)

  const { data, error } = await supabase.storage
    .from('datasets')
    .download(rawDataPath)

  if (error) {
    console.error('Storage download failed:', error.message)
    return []
  }

  try {
    let text

    // If gzipped, decompress first
    if (rawDataPath.endsWith('.gz') && typeof DecompressionStream !== 'undefined') {
      const stream = data.stream().pipeThrough(new DecompressionStream('gzip'))
      const decompressed = await new Response(stream).blob()
      text = await decompressed.text()
    } else {
      text = await data.text()
    }

    const parsed = JSON.parse(text)
    console.log('Downloaded and parsed', parsed.length, 'rows')
    return parsed
  } catch (err) {
    console.error('Failed to parse downloaded data:', err.message)
    return []
  }
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
  const { insights, insights_loaded, ...safeState } = state

  // Try update first
  const { data, error } = await supabase
    .from('dashboard_states')
    .update({ ...safeState, updated_at: new Date().toISOString() })
    .eq('dataset_id', datasetId)
    .select('id')

  if (error) {
    console.error('DB WRITE update error:', error.message)
    throw new Error(error.message)
  }

  // If no row existed, insert one
  if (!data || data.length === 0) {
    console.log('DB WRITE: no row found for dataset', datasetId, '— inserting new row')
    const { data: inserted, error: insertErr } = await supabase
      .from('dashboard_states')
      .insert({ dataset_id: datasetId, ...safeState })
      .select('id')
    if (insertErr) {
      console.error('DB WRITE insert error:', insertErr.message)
      throw new Error(insertErr.message)
    }
    console.log('DB WRITE: inserted new row', inserted?.[0]?.id)
  } else {
    console.log('DB WRITE for dataset', datasetId, '→ filters:', Object.keys(safeState.global_filters || {}).length, 'ai_charts:', (safeState.ai_charts || []).length, 'updated row:', data[0]?.id)
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
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, updated_at, datasets(id, file_name, row_count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!projects) return []

  const allDatasetIds = projects.flatMap(p => (p.datasets || []).map(d => d.id))
  if (allDatasetIds.length === 0) return []

  const { data: states } = await supabase
    .from('dashboard_states')
    .select('dataset_id, insights, insights_loaded')
    .in('dataset_id', allDatasetIds)

  const stateMap = Object.fromEntries((states || []).map(s => [s.dataset_id, s]))

  const results = []
  for (const project of projects) {
    for (const ds of (project.datasets || [])) {
      const state = stateMap[ds.id]
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
