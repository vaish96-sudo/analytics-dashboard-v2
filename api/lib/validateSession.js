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
