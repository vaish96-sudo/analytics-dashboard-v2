import { createClient } from '@supabase/supabase-js'
import { checkIPRateLimit } from './lib/ipRateLimit.js'

export const config = { runtime: 'edge' }

function getNestedValue(obj, path) {
  if (!path || path.trim() === '') return obj
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return null
    current = current[part]
  }
  return current
}

function flattenObject(obj, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey))
    } else {
      result[newKey] = value
    }
  }
  return result
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    // Rate limit: 30 requests per minute per IP
    const ipBlock = checkIPRateLimit(req, 30, 60_000, 'fetch-external')
    if (ipBlock) return ipBlock

    // Auth check — require valid session
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ') || authHeader.length < 40) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }
    const token = authHeader.slice(7)
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data: session } = await supabase.from('sessions').select('user_id, expires_at').eq('token', token).single()
      if (!session || new Date(session.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Unauthorized — invalid session' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
      }
    }

    const body = await req.json()
    const { url, auth_method, auth_value, json_path } = body

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Validate URL
    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Block internal/private IPs and cloud metadata endpoints
    const hostname = parsedUrl.hostname.toLowerCase()
    const blockedPatterns = [
      // Localhost
      'localhost',
      '127.0.0.1',
      '[::1]',
      '0.0.0.0',
      // Private IPv4 ranges
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      // Link-local
      /^169\.254\./,
      // AWS/cloud metadata endpoint (CRITICAL on Vercel)
      '169.254.169.254',
      // IPv6 private/reserved
      /^\[?fd[0-9a-f]{2}:/i,
      /^\[?fc[0-9a-f]{2}:/i,
      /^\[?fe80:/i,
      /^\[?::1\]?$/,
      /^\[?::ffff:127\./i,
      /^\[?0+:0+:0+:0+:0+:0+:0+:0*1\]?$/,
    ]

    const isBlocked = blockedPatterns.some(pattern => {
      if (typeof pattern === 'string') return hostname === pattern
      return pattern.test(hostname)
    })

    // Also block non-http(s) schemes
    if (isBlocked || !['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Cannot fetch from internal/private addresses' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Build headers
    const headers = { 'Accept': 'application/json' }
    if (auth_method === 'api_key' && auth_value) {
      headers['X-API-Key'] = auth_value
    } else if (auth_method === 'bearer' && auth_value) {
      headers['Authorization'] = `Bearer ${auth_value}`
    }

    // Fetch the external API
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000), // 15s timeout
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `API returned ${res.status}: ${res.statusText}` }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('json')) {
      return new Response(JSON.stringify({ error: 'API did not return JSON. Content-Type: ' + contentType }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const data = await res.json()

    // Navigate to the data array using json_path
    let rows = getNestedValue(data, json_path)

    if (!Array.isArray(rows)) {
      // If the result is an object, try to find the first array property
      if (rows && typeof rows === 'object') {
        const arrayProp = Object.entries(rows).find(([, v]) => Array.isArray(v))
        if (arrayProp) {
          rows = arrayProp[1]
        } else {
          // Wrap single object as array
          rows = [rows]
        }
      } else {
        return new Response(JSON.stringify({ error: 'Could not find an array of records in the response. Try specifying a JSON path.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'The API returned an empty data array' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Flatten nested objects in each row
    const flatRows = rows.slice(0, 10000).map(row => {
      if (typeof row !== 'object' || row === null) return { value: row }
      return flattenObject(row)
    })

    return new Response(JSON.stringify({
      rows: flatRows,
      row_count: flatRows.length,
      column_count: Object.keys(flatRows[0] || {}).length,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return new Response(JSON.stringify({ error: 'Request timed out after 15 seconds' }), { status: 408, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
