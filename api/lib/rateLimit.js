/**
 * In-memory rate limiter for Vercel serverless functions.
 * Each Vercel instance has its own memory, so this is per-instance.
 * For true global rate limiting you'd need Redis, but this catches
 * the vast majority of abuse (hammering a single endpoint).
 */

const rateLimitStore = new Map()

// Clean up old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > entry.windowMs * 2) rateLimitStore.delete(key)
  }
}, 300_000)

/**
 * Check rate limit for a given key (usually userId or IP).
 * @param {string} key - Unique identifier (userId, IP, etc.)
 * @param {number} maxRequests - Max requests per window (default: 60)
 * @param {number} windowMs - Window duration in ms (default: 60000 = 1 minute)
 * @returns {{ allowed: boolean, remaining: number, retryAfter: number }}
 */
export function checkRateLimit(key, maxRequests = 60, windowMs = 60_000) {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitStore.set(key, { windowStart: now, count: 1, windowMs })
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 }
  }

  entry.count++

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  return { allowed: true, remaining: maxRequests - entry.count, retryAfter: 0 }
}

/**
 * Express/Vercel middleware-style rate limit check.
 * Returns true if blocked (already sent 429 response).
 * Usage: if (applyRateLimit(req, res, userId)) return
 */
export function applyRateLimit(req, res, userId, maxRequests = 60, windowMs = 60_000) {
  const { allowed, remaining, retryAfter } = checkRateLimit(userId, maxRequests, windowMs)

  res.setHeader('X-RateLimit-Limit', maxRequests)
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining))

  if (!allowed) {
    res.setHeader('Retry-After', retryAfter)
    res.status(429).json({ error: 'Rate limit exceeded. Please wait and try again.' })
    return true // blocked
  }

  return false // allowed
}
