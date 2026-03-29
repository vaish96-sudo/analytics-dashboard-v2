import { generateToken } from '../lib/crypto.js'
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
    // FIX #19: Don't reveal whether email exists — always say "check your email"
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single()
    if (existing) {
      // Return same shape as success to prevent email enumeration
      return new Response(JSON.stringify({
        requiresVerification: true,
        message: 'Account created. Check your email for a verification code.',
      }), { status: 201, headers: { 'Content-Type': 'application/json' } })
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
      return new Response(JSON.stringify({ error: 'Failed to create account' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    // Generate a 6-digit verification code — store in login_codes table (same as passwordless flow)
    // FIX #4: Use cryptographically secure random for verification code (not Math.random)
    const codeBytes = crypto.getRandomValues(new Uint8Array(4))
    const codeNum = ((codeBytes[0] << 24) | (codeBytes[1] << 16) | (codeBytes[2] << 8) | codeBytes[3]) >>> 0
    const verifyCode = String(codeNum % 900000 + 100000)
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Delete any existing codes for this email, then insert new one
    await supabase.from('login_codes').delete().eq('email', email)
    await supabase.from('login_codes').insert({
      email: email,
      code: verifyCode,
      expires_at: codeExpires,
      attempts: 0,
    })

    // Send verification email via Resend (if configured)
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Meuris Analytics <noreply@meuris.io>',
            to: email,
            subject: `${verifyCode} is your Meuris verification code`,
            html: `<p>Your verification code is: <strong style="font-size:24px;letter-spacing:4px">${verifyCode}</strong></p><p>This code expires in 10 minutes.</p><p>If you didn't create an account, you can ignore this email.</p>`,
          }),
        })
      } catch (emailErr) {
        console.error('Failed to send verification email:', emailErr.message)
      }
    } else {
      console.log(`[DEV] Verification code for ${email}: ${verifyCode}`)
    }

    // DO NOT create session. User must verify email first.
    return new Response(JSON.stringify({
      requiresVerification: true,
      message: 'Account created. Check your email for a verification code.',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
