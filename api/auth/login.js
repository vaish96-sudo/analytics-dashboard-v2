import { createClient } from '@supabase/supabase-js'
import { checkIPRateLimit } from '../lib/ipRateLimit.js'

export const config = { runtime: 'edge' }

// --- Rate limiting (in-memory, per Edge instance) ---
const loginAttempts = new Map()
const WINDOW_MS = 300_000 // 5 minutes
const MAX_ATTEMPTS = 10   // 10 attempts per 5 min per IP

function checkLoginRateLimit(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    loginAttempts.set(ip, { windowStart: now, count: 1 })
    return true
  }
  entry.count++
  return entry.count <= MAX_ATTEMPTS
}

async function verifyPassword(password, stored) {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

  const iterations = parseInt(parts[1])
  const saltHex = parts[2]
  const storedHashHex = parts[3]

  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex === storedHashHex
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  // M1: Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkLoginRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too many login attempts. Please try again in a few minutes.' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Find user
    const { data: user, error: findErr } = await supabase
      .from('users')
      .select('id, email, name, company, avatar_url, email_verified, password_hash')
      .eq('email', email.toLowerCase())
      .single()

    if (findErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    // Clean up expired sessions for this user
    await supabase.from('sessions').delete().eq('user_id', user.id).lt('expires_at', new Date().toISOString())

    // Create new session
    const sessionToken = generateToken()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await supabase.from('sessions').insert({
      user_id: user.id,
      token: sessionToken,
      expires_at: expiresAt.toISOString(),
    })

    // Don't return password_hash
    const { password_hash, ...safeUser } = user

    return new Response(JSON.stringify({
      user: safeUser,
      token: sessionToken,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
