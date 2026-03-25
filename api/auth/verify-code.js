import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

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
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { email, code, name } = await req.json()

    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'Email and code are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const normalizedCode = code.trim()

    // Find the code
    const { data: codeRow, error: findErr } = await supabase
      .from('login_codes')
      .select('id, code, expires_at, attempts')
      .eq('email', normalizedEmail)
      .single()

    if (findErr || !codeRow) {
      return new Response(JSON.stringify({ error: 'No code found for this email. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Check expiry
    if (new Date(codeRow.expires_at) < new Date()) {
      await supabase.from('login_codes').delete().eq('id', codeRow.id)
      return new Response(JSON.stringify({ error: 'Code has expired. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Check attempts (max 5 guesses per code)
    if (codeRow.attempts >= 5) {
      await supabase.from('login_codes').delete().eq('id', codeRow.id)
      return new Response(JSON.stringify({ error: 'Too many incorrect attempts. Please request a new code.' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify code
    if (codeRow.code !== normalizedCode) {
      await supabase.from('login_codes').update({ attempts: codeRow.attempts + 1 }).eq('id', codeRow.id)
      const remaining = 4 - codeRow.attempts
      return new Response(JSON.stringify({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Code is valid — delete it immediately (single use)
    await supabase.from('login_codes').delete().eq('id', codeRow.id)

    // Find or create user
    let { data: user } = await supabase
      .from('users')
      .select('id, email, name, company, avatar_url, email_verified')
      .eq('email', normalizedEmail)
      .single()

    if (!user) {
      // New user — create account (no password needed for passwordless)
      const { data: newUser, error: createErr } = await supabase
        .from('users')
        .insert({
          email: normalizedEmail,
          password_hash: 'passwordless', // marker: this user has no password
          name: name || null,
          email_verified: true, // verified by code
        })
        .select('id, email, name, company, avatar_url, email_verified')
        .single()

      if (createErr) {
        return new Response(JSON.stringify({ error: 'Failed to create account' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
      user = newUser
    } else if (!user.email_verified) {
      // Existing user verifying for the first time
      await supabase.from('users').update({ email_verified: true }).eq('id', user.id)
      user.email_verified = true
    }

    // Clean up expired sessions for this user
    await supabase.from('sessions').delete().eq('user_id', user.id).lt('expires_at', new Date().toISOString())

    // Create session
    const sessionToken = generateToken()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await supabase.from('sessions').insert({
      user_id: user.id,
      token: sessionToken,
      expires_at: expiresAt.toISOString(),
    })

    return new Response(JSON.stringify({
      user,
      token: sessionToken,
      isNewUser: !user.company && !user.name, // hint for onboarding
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
