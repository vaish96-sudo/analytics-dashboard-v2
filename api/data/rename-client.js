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

  const { oldName, newName } = req.body || {}
  const safeNewName = sanitizeString(newName, 200)
  if (!safeNewName) return res.status(400).json({ error: 'New name is required (max 200 characters)' })
  const safeOldName = sanitizeString(oldName, 200)

  if (safeOldName === 'Uncategorized' || !safeOldName) {
    await supabase.from('projects').update({ client_name: safeNewName }).is('client_name', null).eq('user_id', userId)
  } else {
    await supabase.from('projects').update({ client_name: safeNewName }).eq('client_name', safeOldName).eq('user_id', userId)
  }

  return res.json({ success: true })
}
