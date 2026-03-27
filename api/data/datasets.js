import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { auditLog } from '../lib/auditLog.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeString, sanitizeUUID, sanitizeJSON } from '../lib/sanitize.js'
import { gzipSync } from 'zlib'

export const config = { 
  api: { bodyParser: { sizeLimit: '50mb' } },
  maxDuration: 60 
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  const { projectId, fileName, schemaDef, rowCount, rawData } = req.body || {}
  const safeProjectId = sanitizeUUID(projectId)
  const safeFileName = sanitizeString(fileName, 255)
  if (!safeProjectId || !safeFileName) return res.status(400).json({ error: 'Missing or invalid required fields' })

  // Ownership check: project must belong to user
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', safeProjectId)
    .single()

  if (projErr || !project) return res.status(404).json({ error: 'Project not found' })
  if (project.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

  const storagePath = `${safeProjectId}/${Date.now()}_${safeFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}.json.gz`

  // Compress raw data server-side
  const jsonStr = JSON.stringify(rawData || [])
  const compressed = gzipSync(Buffer.from(jsonStr))

  const { error: uploadErr } = await supabase.storage
    .from('datasets')
    .upload(storagePath, compressed, { contentType: 'application/gzip', upsert: true })

  if (uploadErr) return res.status(500).json({ error: `Upload failed: ${uploadErr.message}` })

  const { data, error } = await supabase
    .from('datasets')
    .insert({
      project_id: safeProjectId,
      file_name: safeFileName,
      schema_def: schemaDef,
      row_count: rowCount,
      raw_data: [],
      raw_data_path: storagePath,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from('datasets').remove([storagePath])
    return res.status(500).json({ error: error.message })
  }

  // Auto-create dashboard state
  await supabase.from('dashboard_states').insert({ dataset_id: data.id })

  await auditLog(supabase, userId, 'dataset.create', { datasetId: data.id, projectId: safeProjectId, fileName: safeFileName })
  return res.status(201).json(data)
}
