/**
 * Public Claude API endpoint for the /instant page.
 * No auth required, but heavily rate-limited by IP.
 * Used for column tagging + insights on the instant page.
 */

export const config = { maxDuration: 60 }

// IP-based rate limiting — 8 requests per hour per IP (column tagging + insights per session)
const ipRateLimitMap = new Map()
const IP_WINDOW_MS = 3600_000 // 1 hour
const IP_MAX_REQUESTS = 8

function checkIpRateLimit(ip) {
  const now = Date.now()
  const entry = ipRateLimitMap.get(ip)
  if (!entry || now - entry.windowStart > IP_WINDOW_MS) {
    ipRateLimitMap.set(ip, { windowStart: now, count: 1 })
    return true
  }
  entry.count++
  return entry.count <= IP_MAX_REQUESTS
}

// Clean old entries every 10 min
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of ipRateLimitMap) {
    if (now - entry.windowStart > IP_WINDOW_MS * 2) ipRateLimitMap.delete(key)
  }
}, 600_000)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CORS — strict origin check, require Origin header
  const origin = req.headers.origin || ''
  if (!origin) {
    return res.status(403).json({ error: 'Forbidden: Origin header required' })
  }
  // FIX #8: Strict origin check — exact match + Vercel preview regex (not startsWith)
  const allowedOrigins = [
    'https://analytics-dashboard-v2-zeta.vercel.app',
  ]
  // FIX #18: Only allow localhost in development
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production') {
    allowedOrigins.push('http://localhost:5173', 'http://localhost:3000')
  }
  const validOrigin = allowedOrigins.some(a => origin === a) ||
    /^https:\/\/analytics-dashboard-v2-git-[a-z0-9-]+-vaish96-5704s-projects\.vercel\.app$/.test(origin)
  if (!validOrigin) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // IP rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  if (!checkIpRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. The instant tool allows 5 AI requests per hour. Sign up for unlimited access.' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const { messages, system, max_tokens = 300 } = req.body

    // FIX #6: Validate input size to prevent cost abuse via oversized payloads
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 5) {
      return res.status(400).json({ error: 'Invalid messages: must be an array of 1-5 messages' })
    }
    const systemLen = typeof system === 'string' ? system.length : 0
    const messagesLen = messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0)
    if (systemLen + messagesLen > 30000) {
      return res.status(400).json({ error: 'Input too large for instant analysis' })
    }

    // Allow up to 1500 tokens (column tagging needs ~1200)
    const safeMaxTokens = Math.min(Number(max_tokens) || 300, 1500)

    // Always use Sonnet for public endpoint (cheaper)
    const model = 'claude-sonnet-4-20250514'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: safeMaxTokens, system, messages }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API request failed' })
    }

    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
