export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
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
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
