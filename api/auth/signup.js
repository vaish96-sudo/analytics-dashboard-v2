import { createClient } from '@supabase/supabase-js'
import { checkIPRateLimit } from '../lib/ipRateLimit.js'

export const config = { runtime: 'edge' }

async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const hashArray = new Uint8Array(bits)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:100000:${saltHex}:${hashHex}`
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY

  // IP rate limit: 5 signups per minute per IP
  const ipBlock = checkIPRateLimit(req, 5, 60_000, 'signup')
  if (ipBlock) return ipBlock

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.json()
    const email = (body.email || '').toString().trim().toLowerCase().slice(0, 254)
    const password = (body.password || '').toString()
    const name = (body.name || '').toString().trim().slice(0, 100).replace(/[<>"']/g, '')

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    if (password.length < 8 || password.length > 200) {
      return new Response(JSON.stringify({ error: 'Password must be 8-200 characters' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Check if email already exists
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single()
    if (existing) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }

    // Hash password
    const passwordHash = await hashPassword(password)
    const verificationToken = generateToken()

    // Create user
    const { data: user, error: createErr } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name: name || null,
        verification_token: verificationToken,
        email_verified: false,
      })
      .select('id, email, name, company, avatar_url, email_verified')
      .single()

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    // Create session
    const sessionToken = generateToken()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await supabase.from('sessions').insert({
      user_id: user.id,
      token: sessionToken,
      expires_at: expiresAt.toISOString(),
    })

    // TODO: Send verification email with verificationToken
    // For now, auto-verify in development
    await supabase.from('users').update({ email_verified: true }).eq('id', user.id)
    user.email_verified = true

    return new Response(JSON.stringify({
      user,
      token: sessionToken,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
