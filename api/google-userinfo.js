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

  const ipBlock = checkIPRateLimit(req, 10, 60_000, 'google-userinfo')
  if (ipBlock) return ipBlock

  if (!(await verifySession(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const { access_token } = await req.json()
    if (!access_token) {
      return new Response(JSON.stringify({ error: 'Access token is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const userInfo = await res.json()
    const email = userInfo.email?.toLowerCase()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Could not retrieve email from Google' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const allowedRaw = process.env.ALLOWED_EMAILS || ''
    const allowedEmails = allowedRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    const isAllowed = allowedEmails.length === 0 || allowedEmails.includes(email)

    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Access denied. Your email is not authorized to use this application.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      email: userInfo.email, name: userInfo.name, picture: userInfo.picture, authorized: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
