import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId)

  if (pErr) return res.status(500).json({ error: pErr.message })
  if (!projects || projects.length === 0) return res.json([])

  const projectIds = projects.map(p => p.id)
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))

  const { data: convos, error: cErr } = await supabase
    .from('conversations')
    .select('id, title, project_id, dataset_id, created_at, updated_at')
    .in('project_id', projectIds)
    .order('updated_at', { ascending: false })

  if (cErr) return res.status(500).json({ error: cErr.message })
  return res.json((convos || []).map(c => ({ ...c, projectName: projectMap[c.project_id] || 'Unknown' })))
}
