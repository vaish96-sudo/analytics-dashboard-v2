/**
 * Secure API client — all data operations go through Vercel API routes.
 * No Supabase anon key is exposed to the browser.
 */

const TOKEN_KEY = 'nb_session_token'

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

async function request(method, path, body, opts = {}) {
  const token = getToken()
  if (!token && !opts.skipAuth) {
    // Redirect to login
    window.location.href = '/'
    throw new Error('Not authenticated')
  }

  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  let fetchOpts = { method, headers }

  if (body instanceof FormData) {
    // Let browser set Content-Type with boundary for multipart
    fetchOpts.body = body
  } else if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json'
    fetchOpts.body = JSON.stringify(body)
  }

  const res = await fetch(path, fetchOpts)

  if (res.status === 401) {
    // Session expired — clear and redirect
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem('nb_user')
    } catch {}
    window.location.href = '/'
    throw new Error('Session expired')
  }

  if (res.status === 429) {
    throw new Error('Rate limit exceeded. Please wait a moment and try again.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }

  // Some DELETE routes return 204 No Content
  if (res.status === 204) return null

  return res.json()
}

export const api = {
  get:   (path)       => request('GET', path),
  post:  (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del:   (path)       => request('DELETE', path),
  // For file uploads (FormData)
  upload: (path, formData) => request('POST', path, formData),
}
