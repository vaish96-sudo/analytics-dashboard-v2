import { createClient } from '@supabase/supabase-js'
import { checkIPRateLimit } from './lib/ipRateLimit.js'

export const config = { runtime: 'edge' }

async function verifySession(req) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ') || authHeader.length < 40) return false
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) return false
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: session } = await supabase.from('sessions').select('user_id, expires_at').eq('token', authHeader.slice(7)).single()
  return session && new Date(session.expires_at) >= new Date()
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const ipBlock = checkIPRateLimit(req, 20, 60_000, 'google-sheets')
  if (ipBlock) return ipBlock

  if (!(await verifySession(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const { access_token } = await req.json()

    if (!access_token) {
      return new Response(JSON.stringify({ error: 'Access token is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Query Google Drive API for spreadsheets
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      orderBy: 'modifiedTime desc',
      pageSize: '50',
      fields: 'files(id,name,modifiedTime,owners)',
    })

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Failed to list sheets' }), { status: res.status, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ files: data.files || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const safeMsg = (err.message || 'Unknown error').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    return new Response(JSON.stringify({ error: safeMsg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
