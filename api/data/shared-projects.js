import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  // Find teams this user belongs to
  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (!memberships || memberships.length === 0) return res.json([])

  const teamIds = memberships.map(m => m.team_id)
  const { data: teams } = await supabase
    .from('teams')
    .select('id, owner_id, name')
    .in('id', teamIds)

  if (!teams || teams.length === 0) return res.json([])

  const ownerIds = teams.map(t => t.owner_id).filter(id => id !== userId)
  if (ownerIds.length === 0) return res.json([])

  // Client-level access
  const { data: clientRules } = await supabase
    .from('client_access')
    .select('client_name, team_id')
    .eq('user_id', userId)

  // Project-level access
  let projectRules = []
  try {
    const { data: projData, error: projErr } = await supabase
      .from('project_access')
      .select('project_id, team_id')
      .eq('user_id', userId)
    if (!projErr && projData) projectRules = projData
  } catch {}

  const hasClientAccess = clientRules && clientRules.length > 0
  const hasProjectAccess = projectRules.length > 0
  if (!hasClientAccess && !hasProjectAccess) return res.json([])

  // Load all projects from team owners
  const { data: allProjects } = await supabase
    .from('projects')
    .select(`
      id, name, client_name, user_id, data_source_type, data_source_meta, created_at, updated_at,
      datasets(id, file_name, row_count, created_at)
    `)
    .in('user_id', ownerIds)
    .order('updated_at', { ascending: false })

  if (!allProjects) return res.json([])

  const accessibleClients = new Set((clientRules || []).map(r => r.client_name))
  const accessibleProjectIds = new Set((projectRules || []).map(r => r.project_id))

  const filtered = allProjects.filter(p =>
    accessibleClients.has(p.client_name || 'Uncategorized') ||
    accessibleProjectIds.has(p.id)
  )

  return res.json(filtered.map(p => ({
    ...p,
    _shared: true,
    _teamName: teams.find(t => t.owner_id === p.user_id)?.name,
  })))
}
