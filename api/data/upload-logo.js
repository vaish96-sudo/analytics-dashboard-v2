import { validateSession } from '../lib/validateSession.js'
import { IncomingForm } from 'formidable'
import { readFileSync } from 'fs'

export const config = {
  api: { bodyParser: false },
  maxDuration: 30,
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ maxFileSize: 5 * 1024 * 1024 })
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  try {
    const { files } = await parseForm(req)
    const file = files.logo?.[0] || files.logo
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    const ext = (file.originalFilename || 'logo.png').split('.').pop()
    const path = `${userId}/logo_${Date.now()}.${ext}`
    const buffer = readFileSync(file.filepath)

    const { error: uploadErr } = await supabase.storage
      .from('logos')
      .upload(path, buffer, { upsert: true, contentType: file.mimetype })

    if (uploadErr) return res.status(500).json({ error: uploadErr.message })

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)

    return res.json({ url: publicUrl })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
