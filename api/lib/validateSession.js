import { createClient } from '@supabase/supabase-js'

/**
 * Validates session token from Authorization header.
 * Returns { user, supabase } on success, or null on failure.
 */
export async function validateSession(req) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) return null

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Extract token from Authorization: Bearer <token>
  const authHeader = typeof req.headers?.get === 'function'
    ? req.headers.get('authorization')
    : req.headers?.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  if (!token || token.length < 32) return null

  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()

  if (error || !session) return null
  if (new Date(session.expires_at) < new Date()) return null

  return { userId: session.user_id, supabase, token }
}

/**
 * CSRF protection — validates Origin header on mutating requests.
 * Call this at the top of POST/PATCH/DELETE handlers.
 * Returns true if the request should be blocked.
 */
export function checkOrigin(req, res) {
  const method = req.method?.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false

  const origin = (typeof req.headers?.get === 'function'
    ? req.headers.get('origin') || req.headers.get('referer')
    : req.headers?.origin || req.headers?.referer) || ''

  // Require Origin header on mutating requests (blocks curl/Postman CSRF)
  if (!origin) {
    res.status(403).json({ error: 'Forbidden: Origin header required' })
    return true
  }

  const allowed = [
    'https://analytics-dashboard-v2-zeta.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ]

  // Strict check: exact match OR preview deploys matching exact subdomain pattern
  const isAllowed = allowed.some(a => origin.startsWith(a)) ||
    /^https:\/\/analytics-dashboard-v2-git-[a-z0-9-]+-vaish96-5704s-projects\.vercel\.app$/.test(origin)
  if (!isAllowed) {
    res.status(403).json({ error: 'Forbidden: invalid origin' })
    return true
  }

  return false
}
