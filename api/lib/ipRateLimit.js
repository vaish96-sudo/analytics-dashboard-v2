/**
 * IP-based rate limiter for Edge runtime auth routes.
 * Uses in-memory Map (per-instance, resets on cold start).
 * 
 * For auth routes that use `export const config = { runtime: 'edge' }`
 * and return new Response() instead of res.json().
 */

const ipStore = new Map()

// Clean stale entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of ipStore) {
    if (now - entry.windowStart > 600_000) ipStore.delete(key) // 10min cleanup
  }
}, 300_000)

/**
 * Get client IP from Edge request headers.
 */
export function getClientIP(req) {
  // Vercel sets x-forwarded-for; use the first IP (client's real IP)
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/**
 * Check IP rate limit. Returns a 429 Response if blocked, or null if allowed.
 * @param {Request} req - Edge Request object
 * @param {number} maxRequests - Max requests per window (default: 10)
 * @param {number} windowMs - Window in ms (default: 60000 = 1 minute)
 * @param {string} prefix - Key prefix to separate different endpoints
 * @returns {Response|null} - 429 Response if blocked, null if allowed
 */
export function checkIPRateLimit(req, maxRequests = 10, windowMs = 60_000, prefix = '') {
  const ip = getClientIP(req)
  const key = `${prefix}:${ip}`
  const now = Date.now()

  const entry = ipStore.get(key)
  if (!entry || now - entry.windowStart > windowMs) {
    ipStore.set(key, { windowStart: now, count: 1 })
    return null // allowed
  }

  entry.count++

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000)
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      }
    )
  }

  return null // allowed
}
