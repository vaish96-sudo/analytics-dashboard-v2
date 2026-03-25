import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, updated_at, datasets(id, file_name, row_count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  if (!projects) return res.json([])

  const allDatasetIds = projects.flatMap(p => (p.datasets || []).map(d => d.id))
  if (allDatasetIds.length === 0) return res.json([])

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

  return res.json(results)
}
