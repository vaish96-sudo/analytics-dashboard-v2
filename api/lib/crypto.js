/**
 * Shared crypto utilities for auth routes.
 * Used by login, signup, verify-code, forgot-password.
 */

export function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
