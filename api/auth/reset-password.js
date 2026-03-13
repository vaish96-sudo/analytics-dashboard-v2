import { createClient } from '@supabase/supabase-js'

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

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return new Response(JSON.stringify({ error: 'Token and new password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Find user by reset token
    const { data: user, error: findErr } = await supabase
      .from('users')
      .select('id, reset_token_expires')
      .eq('reset_token', token)
      .single()

    if (findErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired reset token' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    if (new Date(user.reset_token_expires) < new Date()) {
      return new Response(JSON.stringify({ error: 'Reset token has expired. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Update password and clear reset token
    const passwordHash = await hashPassword(password)

    await supabase.from('users').update({
      password_hash: passwordHash,
      reset_token: null,
      reset_token_expires: null,
    }).eq('id', user.id)

    // Invalidate all existing sessions
    await supabase.from('sessions').delete().eq('user_id', user.id)

    return new Response(JSON.stringify({
      message: 'Password has been reset successfully. Please log in with your new password.',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
