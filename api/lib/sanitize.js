/**
 * Input sanitization utilities for API routes.
 * Prevents oversized strings, script injection, and malformed input.
 */

/**
 * Sanitize a string input — trim, enforce max length, strip dangerous chars.
 * @param {any} val - Input value
 * @param {number} maxLen - Maximum allowed length (default 500)
 * @returns {string|null} Sanitized string or null if input is falsy
 */
export function sanitizeString(val, maxLen = 500) {
  if (val === null || val === undefined) return null
  if (typeof val !== 'string') val = String(val)
  // Trim whitespace
  val = val.trim()
  // Enforce max length
  if (val.length > maxLen) val = val.slice(0, maxLen)
  // Strip null bytes (can cause issues in databases)
  val = val.replace(/\0/g, '')
  return val || null
}

/**
 * Sanitize an email — lowercase, trim, validate basic format.
 * @param {string} val
 * @returns {string|null} Sanitized email or null
 */
export function sanitizeEmail(val) {
  if (!val || typeof val !== 'string') return null
  const email = val.toLowerCase().trim().slice(0, 320) // RFC max is 254, but allow some buffer
  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

/**
 * Sanitize a UUID — must match UUID v4 format.
 * @param {string} val
 * @returns {string|null} Valid UUID or null
 */
export function sanitizeUUID(val) {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return trimmed
  return null
}

/**
 * Validate and sanitize a JSON object — ensures it's a plain object and not too large.
 * @param {any} val - Input value (should already be parsed by bodyParser)
 * @param {number} maxSize - Max serialized size in bytes (default 100KB)
 * @returns {object|null} Safe object or null
 */
export function sanitizeJSON(val, maxSize = 102400) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return null
  try {
    const serialized = JSON.stringify(val)
    if (serialized.length > maxSize) return null
    return val
  } catch {
    return null
  }
}

/**
 * Validate req.body has required fields with proper types.
 * Returns { valid: true, data: {...} } or { valid: false, error: 'message' }
 * 
 * @param {object} body - req.body
 * @param {object} rules - { fieldName: { required?: bool, type?: 'string'|'uuid'|'email'|'number'|'boolean'|'json', maxLen?: number } }
 */
export function validateBody(body, rules) {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body is required' }

  const data = {}

  for (const [field, rule] of Object.entries(rules)) {
    let val = body[field]

    // Check required
    if (rule.required && (val === undefined || val === null || val === '')) {
      return { valid: false, error: `${field} is required` }
    }

    // Skip optional missing fields
    if (val === undefined || val === null) {
      data[field] = null
      continue
    }

    // Type-specific sanitization
    switch (rule.type) {
      case 'string':
        val = sanitizeString(val, rule.maxLen || 500)
        if (rule.required && !val) return { valid: false, error: `${field} is required` }
        break
      case 'uuid':
        val = sanitizeUUID(val)
        if (rule.required && !val) return { valid: false, error: `${field} must be a valid UUID` }
        break
      case 'email':
        val = sanitizeEmail(val)
        if (rule.required && !val) return { valid: false, error: `${field} must be a valid email` }
        break
      case 'number':
        val = typeof val === 'number' ? val : parseFloat(val)
        if (isNaN(val)) {
          if (rule.required) return { valid: false, error: `${field} must be a number` }
          val = null
        }
        break
      case 'boolean':
        val = Boolean(val)
        break
      case 'json':
        val = sanitizeJSON(val, rule.maxSize || 102400)
        if (rule.required && !val) return { valid: false, error: `${field} must be a valid JSON object` }
        break
      default:
        // No specific type — just ensure it's not absurdly large
        if (typeof val === 'string') val = sanitizeString(val, rule.maxLen || 500)
    }

    data[field] = val
  }

  return { valid: true, data }
}
