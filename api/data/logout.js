import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(204).end() // Already logged out

  const { supabase, token } = session
  await supabase.from('sessions').delete().eq('token', token).catch(() => {})

  return res.status(204).end()
}
