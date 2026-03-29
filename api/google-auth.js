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

  const ipBlock = checkIPRateLimit(req, 10, 60_000, 'google-auth')
  if (ipBlock) return ipBlock

  if (!(await verifySession(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const { code, redirect_uri } = await req.json()

    if (!code) {
      return new Response(JSON.stringify({ error: 'Authorization code is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      })
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error || 'Token exchange failed' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_in: tokenData.expires_in,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
