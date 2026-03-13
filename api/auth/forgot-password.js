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
    const { email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Always return success to prevent email enumeration
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    if (user) {
      const resetToken = generateToken()
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await supabase.from('users').update({
        reset_token: resetToken,
        reset_token_expires: expires.toISOString(),
      }).eq('id', user.id)

      // TODO: Send actual email with reset link
      // For now, log the token (remove in production)
      console.log(`Password reset token for ${email}: ${resetToken}`)
      console.log(`Reset link: ${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`)
    }

    return new Response(JSON.stringify({
      message: 'If an account exists with that email, a password reset link has been sent.',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
