/**
 * Lightweight audit logger.
 * Logs user actions to the audit_log table for enterprise compliance.
 * 
 * Call this AFTER a successful action (not before).
 * Failures are silently swallowed — audit logging should never block operations.
 *
 * Usage: await auditLog(supabase, userId, 'project.delete', { projectId: '...' })
 */
export async function auditLog(supabase, userId, action, details = {}) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      action,
      details,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Never let audit logging break the actual operation
  }
}
