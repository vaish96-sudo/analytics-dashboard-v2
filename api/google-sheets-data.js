import { createClient } from '@supabase/supabase-js'
import { checkIPRateLimit } from './lib/ipRateLimit.js'

export const config = { runtime: 'edge' }

async function verifySession(req) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ') || authHeader.length < 40) return false
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) return false
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: session } = await supabase.from('sessions').select('user_id, expires_at').eq('token', authHeader.slice(7)).single()
  return session && new Date(session.expires_at) >= new Date()
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const ipBlock = checkIPRateLimit(req, 20, 60_000, 'google-sheets')
  if (ipBlock) return ipBlock

  if (!(await verifySession(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const { access_token, spreadsheet_id, sheet_name } = await req.json()

    if (!access_token || !spreadsheet_id) {
      return new Response(JSON.stringify({ error: 'Access token and spreadsheet ID are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // First, get the spreadsheet metadata to find sheet names
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}?fields=sheets.properties`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}))
      return new Response(JSON.stringify({ error: err.error?.message || 'Failed to access spreadsheet' }), { status: metaRes.status, headers: { 'Content-Type': 'application/json' } })
    }

    const meta = await metaRes.json()
    const targetSheet = sheet_name || meta.sheets?.[0]?.properties?.title || 'Sheet1'

    // Fetch the data from the first (or specified) sheet
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(targetSheet)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
      { headers: { 'Authorization': `Bearer ${access_token}` } }
    )

    if (!dataRes.ok) {
      const err = await dataRes.json().catch(() => ({}))
      return new Response(JSON.stringify({ error: err.error?.message || 'Failed to read sheet data' }), { status: dataRes.status, headers: { 'Content-Type': 'application/json' } })
    }

    const sheetData = await dataRes.json()
    const values = sheetData.values || []

    if (values.length < 2) {
      return new Response(JSON.stringify({ error: 'Sheet has no data rows (needs at least a header row and one data row)' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Convert to array of objects (first row = headers)
    const headers = values[0].map((h, i) => h ? String(h).trim() : `Column_${i + 1}`)
    const rows = values.slice(1).map(row => {
      const obj = {}
      headers.forEach((header, i) => {
        const val = row[i] !== undefined ? row[i] : null
        obj[header] = val
      })
      return obj
    }).filter(row => {
      // Remove completely empty rows
      return Object.values(row).some(v => v !== null && v !== undefined && v !== '')
    })

    return new Response(JSON.stringify({
      rows,
      sheet_name: targetSheet,
      row_count: rows.length,
      column_count: headers.length,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    // M5: Sanitize error — never expose access tokens in error messages
    const safeMsg = (err.message || 'Unknown error').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    return new Response(JSON.stringify({ error: safeMsg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
