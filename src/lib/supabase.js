/**
 * GUTTED: The Supabase client is NO LONGER used for data operations.
 * All data access now goes through /api/data/* routes (see src/lib/api.js).
 *
 * This file is kept ONLY for generating public storage URLs (e.g. dataset downloads
 * via signed URLs, logo display). These use the project URL only — no key needed.
 *
 * After verifying everything works, you can delete this file entirely
 * and replace any getPublicUrl() calls with direct URL construction.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

/**
 * Build a public storage URL without the Supabase client.
 * Works for any file in a public bucket.
 */
export function getPublicStorageUrl(bucket, path) {
  if (!SUPABASE_URL || !path) return ''
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

// Legacy export — any remaining import of `supabase` will get null
// This makes it easy to find remaining usages via runtime errors.
export const supabase = null
