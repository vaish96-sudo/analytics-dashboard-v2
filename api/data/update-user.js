import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { sanitizeString } from '../lib/sanitize.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  if (applyRateLimit(req, res, userId)) return
  if (checkOrigin(req, res)) return

  const updates = req.body || {}
  const safeUpdates = {}
  if (updates.name !== undefined) safeUpdates.name = sanitizeString(updates.name, 100)
  if (updates.company !== undefined) safeUpdates.company = sanitizeString(updates.company, 200)
  if (updates.avatar_url !== undefined) {
    const url = sanitizeString(updates.avatar_url, 2000)
    // Only allow URLs that look like valid image URLs
    if (url && (url.startsWith('https://') || url.startsWith('http://localhost'))) safeUpdates.avatar_url = url
  }

  if (Object.keys(safeUpdates).length === 0) return res.status(400).json({ error: 'No valid fields to update' })

  const { data, error } = await supabase
    .from('users')
    .update(safeUpdates)
    .eq('id', userId)
    .select('id, email, name, company, avatar_url, email_verified')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
}
