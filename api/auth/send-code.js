import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

// Rate limit: 3 codes per email per 15 minutes
const codeAttempts = new Map()
const WINDOW_MS = 900_000
const MAX_SENDS = 3

function checkCodeRateLimit(email) {
  const now = Date.now()
  const key = email.toLowerCase()
  const entry = codeAttempts.get(key)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    codeAttempts.set(key, { windowStart: now, count: 1 })
    return true
  }
  entry.count++
  return entry.count <= MAX_SENDS
}

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
  return String(num % 900000 + 100000) // 6-digit code, always 100000-999999
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL || 'Northern Bird <noreply@northernbird.app>'

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { email } = await req.json()

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Rate limit
    if (!checkCodeRateLimit(normalizedEmail)) {
      return new Response(JSON.stringify({ error: 'Too many code requests. Please wait a few minutes.' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
    }

    // Generate code and expiry (10 minutes)
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    // Invalidate any existing codes for this email
    await supabase.from('login_codes').delete().eq('email', normalizedEmail)

    // Store the code
    const { error: insertErr } = await supabase.from('login_codes').insert({
      email: normalizedEmail,
      code,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
    })

    if (insertErr) {
      return new Response(JSON.stringify({ error: 'Failed to generate code' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    // Send email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [normalizedEmail],
        subject: 'Your login code for Northern Bird Analytics',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 8px;">Your login code</h2>
            <p style="font-size: 14px; color: #666; margin: 0 0 32px;">Enter this code in Northern Bird Analytics to sign in.</p>
            <div style="background: #f8f9fa; border: 1px solid #e2e4e8; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 32px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a; font-family: monospace;">${code}</span>
            </div>
            <p style="font-size: 13px; color: #999; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      // Clean up the code if email fails
      await supabase.from('login_codes').delete().eq('email', normalizedEmail)
      return new Response(JSON.stringify({ error: 'Failed to send email. Please try again.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      message: 'Code sent',
      expiresIn: 600, // seconds, for UI countdown
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
