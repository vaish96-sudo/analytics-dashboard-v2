export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const { access_token } = await req.json()

    if (!access_token) {
      return new Response(JSON.stringify({ error: 'Access token is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Query Google Drive API for spreadsheets
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      orderBy: 'modifiedTime desc',
      pageSize: '50',
      fields: 'files(id,name,modifiedTime,owners)',
    })

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Failed to list sheets' }), { status: res.status, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ files: data.files || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const safeMsg = (err.message || 'Unknown error').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    return new Response(JSON.stringify({ error: safeMsg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
