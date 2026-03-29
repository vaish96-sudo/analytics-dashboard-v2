/**
 * Lightweight audit logger.
 * Logs user actions to the audit_log table for enterprise compliance.
 * 
 * Call this AFTER a successful action (not before).
 * Failures are silently swallowed — audit logging should never block operations.
 *
 * Usage: await auditLog(supabase, userId, 'project.delete', { projectId: '...' }, req)
 */
export async function auditLog(supabase, userId, action, details = {}, req = null) {
  try {
    // FIX #22: Capture IP and user agent for incident response
    let ip = null
    let userAgent = null
    if (req) {
      if (typeof req.headers?.get === 'function') {
        ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
        userAgent = req.headers.get('user-agent') || null
      } else {
        ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.headers?.['x-real-ip'] || null
        userAgent = req.headers?.['user-agent'] || null
      }
    }

    await supabase.from('audit_log').insert({
      user_id: userId,
      action,
      details: { ...details, ...(ip ? { ip } : {}), ...(userAgent ? { user_agent: userAgent } : {}) },
      created_at: new Date().toISOString(),
    })
  } catch {
    // Never let audit logging break the actual operation
  }
}
