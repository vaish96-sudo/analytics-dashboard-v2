/**
 * Validates that a URL is safe to use as an image src.
 * Blocks javascript:, data: (except data:image), and other dangerous schemes.
 */
export function isSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return true // empty is fine
  const trimmed = url.trim().toLowerCase()
  // Block dangerous schemes
  if (trimmed.startsWith('javascript:')) return false
  if (trimmed.startsWith('vbscript:')) return false
  if (trimmed.startsWith('data:') && !trimmed.startsWith('data:image/')) return false
  // Only allow http, https, data:image, and relative URLs
  if (/^[a-z]+:/i.test(trimmed) && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) return false
  return true
}

/**
 * Sanitizes an error message for user display.
 * Strips potential internal details like file paths, stack traces, and SQL.
 */
export function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') return 'Something went wrong'
  // Strip file paths
  let cleaned = message.replace(/\/[a-zA-Z0-9_\-/.]+\.(js|ts|jsx|tsx|mjs)/g, '[internal]')
  // Strip stack trace lines
  cleaned = cleaned.replace(/\s+at\s+.+/g, '')
  // Strip SQL-like content
  cleaned = cleaned.replace(/SELECT\s+.+?FROM/gi, '[query]')
  // Limit length
  if (cleaned.length > 200) cleaned = cleaned.slice(0, 200) + '...'
  return cleaned
}
