import { createClient } from '@supabase/supabase-js'
import { validateSession } from '../lib/validateSession.js'
import { checkIPRateLimit } from '../lib/ipRateLimit.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  // IP rate limit: 10 invites per minute
  const ipBlock = checkIPRateLimit(req, 10, 60_000, 'send-invite')
  if (ipBlock) return ipBlock

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL || 'Meuris Analytics <noreply@meuris.io>'
  const appUrl = process.env.APP_URL || 'https://analytics-dashboard-v2-zeta.vercel.app'

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // Validate session
  const session = await validateSession(req)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const { to_email, team_name, inviter_name, role } = await req.json()

    if (!to_email || !to_email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const roleLabel = role === 'admin' ? 'Admin' : role === 'editor' ? 'Editor' : 'Viewer'

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to_email.toLowerCase().trim()],
        subject: `${inviter_name || 'Someone'} invited you to ${team_name || 'a team'} on Meuris Analytics`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px;">
            <div style="margin-bottom: 32px;">
              <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">You've been invited</h2>
              <p style="font-size: 14px; color: #666; margin: 0;">to join <strong style="color: #1a1a1a;">${team_name || 'a team'}</strong> on Meuris Analytics</p>
            </div>

            <div style="background: #f8f9fa; border: 1px solid #e2e4e8; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #999; width: 100px;">Invited by</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #1a1a1a; font-weight: 500;">${inviter_name || 'A team member'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #999;">Your role</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #1a1a1a; font-weight: 500;">${roleLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #999;">Team</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #1a1a1a; font-weight: 500;">${team_name || 'Meuris Analytics Team'}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${appUrl}" style="display: inline-block; background: #0c1425; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 8px;">
                Sign in to get started
              </a>
            </div>

            <p style="font-size: 12px; color: #999; margin: 0; text-align: center;">
              Sign in with <strong>${to_email}</strong> to access shared projects and dashboards.
            </p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const emailErr = await emailRes.json().catch(() => ({}))
      return new Response(JSON.stringify({ error: emailErr.message || 'Failed to send invite email' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ message: 'Invite sent' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to send invite' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
