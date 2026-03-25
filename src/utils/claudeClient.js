/**
 * Authenticated wrapper for /api/claude calls.
 * All AI requests go through this to ensure:
 * - Auth token is attached
 * - Feature name (not model) is sent
 * - Consistent error handling
 */
const API_URL = '/api/claude'

function getSessionToken() {
  try { return localStorage.getItem('nb_session_token') } catch { return null }
}

export async function callClaudeAPI({ system, messages, max_tokens = 1024, feature = 'ask_ai' }) {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated. Please log in again.')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ system, messages, max_tokens, feature }),
  })

  if (res.status === 401) throw new Error('Session expired. Please log in again.')
  if (res.status === 429) throw new Error('Rate limit exceeded. Please wait a moment.')

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'AI request failed' }))
    throw new Error(err.error || `API error ${res.status}`)
  }

  const data = await res.json()
  const text = data.content?.map(c => c.text || '').join('') || ''
  return { text, usage: data.usage || {}, raw: data }
}
