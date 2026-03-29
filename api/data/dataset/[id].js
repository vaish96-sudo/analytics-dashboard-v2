import { validateSession, checkOrigin } from '../../lib/validateSession.js'
import { auditLog } from '../../lib/auditLog.js'
import { applyRateLimit } from '../../lib/rateLimit.js'
import { sanitizeUUID } from '../../lib/sanitize.js'
import { gunzipSync } from 'zlib'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  const datasetId = sanitizeUUID(req.query.id)
  if (!datasetId) return res.status(400).json({ error: 'Missing or invalid dataset ID' })

  // Ownership check via project
  const { data: dataset, error: dsErr } = await supabase
    .from('datasets')
    .select('*, projects!inner(user_id)')
    .eq('id', datasetId)
    .single()

  if (dsErr || !dataset) return res.status(404).json({ error: 'Dataset not found' })

  const isOwner = dataset.projects.user_id === userId

  // FIX #7: Allow shared access (team members with project/client access) — same logic as project/[id].js
  if (!isOwner) {
    let hasAccess = false
    try {
      const { data: memberships } = await supabase
        .from('team_members').select('team_id').eq('user_id', userId).eq('status', 'active')
      if (memberships && memberships.length > 0) {
        const teamIds = memberships.map(m => m.team_id)
        const { data: teams } = await supabase
          .from('teams').select('id').in('id', teamIds).eq('owner_id', dataset.projects.user_id)
        if (teams && teams.length > 0) {
          const relevantTeamIds = teams.map(t => t.id)
          // Check project-level access
          try {
            const { data: projAccess } = await supabase
              .from('project_access').select('id').eq('user_id', userId).eq('project_id', dataset.project_id).in('team_id', relevantTeamIds).limit(1)
            if (projAccess && projAccess.length > 0) hasAccess = true
          } catch {}
          // Check client-level access
          if (!hasAccess) {
            try {
              const { data: fullProj } = await supabase
                .from('projects').select('client_name').eq('id', dataset.project_id).single()
              const clientName = fullProj?.client_name || 'Uncategorized'
              const { data: clientAccess } = await supabase
                .from('client_access').select('id').eq('user_id', userId).eq('client_name', clientName).in('team_id', relevantTeamIds).limit(1)
              if (clientAccess && clientAccess.length > 0) hasAccess = true
            } catch {}
          }
        }
      }
    } catch {}
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })
  }

  if (req.method === 'GET') {
    // Download raw data from storage if path exists
    let rawData = dataset.raw_data || []
    if (dataset.raw_data_path) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from('datasets')
          .download(dataset.raw_data_path)

        if (!dlErr && blob) {
          const buf = Buffer.from(await blob.arrayBuffer())
          let text
          if (dataset.raw_data_path.endsWith('.gz')) {
            text = gunzipSync(buf).toString('utf-8')
          } else {
            text = buf.toString('utf-8')
          }
          rawData = JSON.parse(text)
        }
      } catch (e) {
        console.error('Failed to download raw data:', e.message)
      }
    }

    const { projects, ...rest } = dataset
    return res.json({ ...rest, raw_data: rawData })
  }

  if (req.method === 'DELETE') {
    // Only owners can delete datasets
    if (!isOwner) return res.status(403).json({ error: 'Only the project owner can delete datasets' })
    // Clean up storage
    if (dataset.raw_data_path) {
      await supabase.storage.from('datasets').remove([dataset.raw_data_path]).catch(() => {})
    }
    const { error } = await supabase.from('datasets').delete().eq('id', datasetId)
    if (error) return res.status(500).json({ error: 'Something went wrong' })
    await auditLog(supabase, userId, 'dataset.delete', { datasetId })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
