import { validateSession } from '../lib/validateSession.js'

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) {
      // Return free defaults if profile doesn't exist yet
      return res.json({
        id: userId,
        tier: 'free',
        ai_queries_used: 0,
        insights_runs_used: 0,
        recommendations_runs_used: 0,
        ai_suggest_runs_used: 0,
      })
    }

    // Monthly usage reset check
    if (data.usage_reset_at && new Date(data.usage_reset_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
      data.ai_queries_used = 0
      data.insights_runs_used = 0
      data.recommendations_runs_used = 0
      data.ai_suggest_runs_used = 0
    }

    return res.json(data)
  }

  if (req.method === 'PATCH') {
    const updates = req.body || {}

    // Allowlist fields that users can update
    const allowed = [
      'ai_queries_used', 'insights_runs_used', 'recommendations_runs_used', 'ai_suggest_runs_used',
      'team_id', 'role', 'playbook', 'logo_url', 'company_name', 'onboarding_completed',
      'custom_branding', 'report_logo_url',
    ]
    const safeUpdates = {}
    for (const key of allowed) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key]
    }

    // Prevent tier escalation from frontend
    if (updates.tier) {
      return res.status(403).json({ error: 'Tier changes are not allowed from the client' })
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(safeUpdates)
      .eq('id', userId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
