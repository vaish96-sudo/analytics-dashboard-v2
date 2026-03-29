import { createClient } from '@supabase/supabase-js'
import { gzipSync } from 'zlib'

export const config = { maxDuration: 60 }

/**
 * Auto-refresh Google Sheets datasets.
 * Called by Vercel cron (daily) or manually via POST with auth.
 * 
 * For each project with data_source_type='google_sheets' and a stored refresh_token:
 * 1. Use refresh_token to get a new access_token from Google
 * 2. Re-fetch the sheet data
 * 3. Update the dataset in storage + database
 */
export default async function handler(req, res) {
  // Verify this is a cron call or authenticated request
  const authHeader = req.headers.authorization
  const cronSecret = req.headers['x-vercel-cron']

  if (!cronSecret && !authHeader) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // If not cron, validate the Bearer token
  if (!cronSecret && authHeader) {
    if (!authHeader.startsWith('Bearer ') || authHeader.length < 40) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = authHeader.slice(7)
    const tmpSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    const { data: sess } = await tmpSupabase.from('sessions').select('user_id, expires_at').eq('token', token).single()
    if (!sess || new Date(sess.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Unauthorized — invalid session' })
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!supabaseUrl || !supabaseKey || !googleClientId || !googleClientSecret) {
    return res.status(500).json({ error: 'Not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Find all projects with Google Sheets source that have auto_refresh enabled
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, user_id, name, data_source_meta')
      .eq('data_source_type', 'google_sheets')

    if (projErr) return res.status(500).json({ error: projErr.message })
    if (!projects || projects.length === 0) return res.json({ refreshed: 0, message: 'No Google Sheets projects found' })

    let refreshed = 0
    let errors = []

    for (const project of projects) {
      const meta = project.data_source_meta || {}
      
      // Skip if no refresh token or auto-refresh not enabled
      if (!meta.refresh_token || !meta.auto_refresh) continue

      try {
        // Step 1: Use refresh token to get new access token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: meta.refresh_token,
            grant_type: 'refresh_token',
          }),
        })

        const tokenData = await tokenRes.json()
        if (!tokenRes.ok) {
          errors.push({ project: project.name, error: tokenData.error_description || 'Token refresh failed' })
          continue
        }

        const accessToken = tokenData.access_token

        // Step 2: Fetch sheet data
        const spreadsheetId = meta.spreadsheet_id
        const sheetName = meta.sheet_name
        if (!spreadsheetId) continue

        // Get sheet metadata
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        )
        if (!metaRes.ok) {
          errors.push({ project: project.name, error: 'Failed to access spreadsheet' })
          continue
        }

        const sheetMeta = await metaRes.json()
        const targetSheet = sheetName || sheetMeta.sheets?.[0]?.properties?.title || 'Sheet1'

        const dataRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetSheet)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        )
        if (!dataRes.ok) {
          errors.push({ project: project.name, error: 'Failed to read sheet data' })
          continue
        }

        const sheetData = await dataRes.json()
        const values = sheetData.values || []
        if (values.length < 2) continue

        // Convert to array of objects
        const headers = values[0].map((h, i) => h ? String(h).trim() : `Column_${i + 1}`)
        const rows = values.slice(1).map(row => {
          const obj = {}
          headers.forEach((header, i) => { obj[header] = row[i] !== undefined ? row[i] : null })
          return obj
        }).filter(row => Object.values(row).some(v => v !== null && v !== undefined && v !== ''))

        // Step 3: Find the dataset for this project and update it
        const { data: datasets } = await supabase
          .from('datasets')
          .select('id, raw_data_path')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (!datasets || datasets.length === 0) continue

        const dataset = datasets[0]
        const storagePath = dataset.raw_data_path

        if (storagePath) {
          // Compress and re-upload
          const compressed = gzipSync(Buffer.from(JSON.stringify(rows)))
          await supabase.storage.from('datasets').upload(storagePath, compressed, {
            contentType: 'application/gzip',
            upsert: true,
          })
        }

        // Update row count
        await supabase.from('datasets').update({
          row_count: rows.length,
        }).eq('id', dataset.id)

        // Update last refresh timestamp
        await supabase.from('projects').update({
          data_source_meta: { ...meta, last_refreshed: new Date().toISOString() },
        }).eq('id', project.id)

        refreshed++
      } catch (err) {
        errors.push({ project: project.name, error: err.message })
      }
    }

    return res.json({ refreshed, errors: errors.length > 0 ? errors : undefined, message: `Refreshed ${refreshed} datasets` })
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
