import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'
import { IncomingForm } from 'formidable'
import { readFileSync } from 'fs'

export const config = {
  api: { bodyParser: false },
  maxDuration: 30,
}

// Magic bytes for allowed image formats
const IMAGE_SIGNATURES = {
  'image/png':  [0x89, 0x50, 0x4E, 0x47],           // ‰PNG
  'image/jpeg': [0xFF, 0xD8, 0xFF],                   // ÿØÿ
  'image/gif':  [0x47, 0x49, 0x46],                   // GIF
  'image/webp': [0x52, 0x49, 0x46, 0x46],             // RIFF (then WEBP at offset 8)
  'image/svg+xml': [0x3C],                             // < (XML start)
}

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

function validateImageBytes(buffer) {
  if (!buffer || buffer.length < 4) return false

  // Check PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png'
  // Check JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg'
  // Check GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif'
  // Check WEBP (RIFF....WEBP)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp'
  // Check SVG (starts with < and contains <svg)
  if (buffer[0] === 0x3C) {
    const text = buffer.slice(0, Math.min(1024, buffer.length)).toString('utf-8').toLowerCase()
    if (text.includes('<svg')) return 'image/svg+xml'
  }

  return false
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

  if (applyRateLimit(req, res, userId, 10, 60_000)) return // 10 uploads per minute max

  try {
    const { files } = await parseForm(req)
    const file = files.logo?.[0] || files.logo
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    // Validate file extension
    const ext = (file.originalFilename || 'logo.png').split('.').pop().toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type. Allowed: PNG, JPG, GIF, WebP' })
    }

    // Validate actual file content (magic bytes)
    const buffer = readFileSync(file.filepath)
    const detectedType = validateImageBytes(buffer)
    if (!detectedType) {
      return res.status(400).json({ error: 'File content is not a valid image' })
    }

    const path = `${userId}/logo_${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('logos')
      .upload(path, buffer, { upsert: true, contentType: detectedType })

    if (uploadErr) return res.status(500).json({ error: uploadErr.message })

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)

    return res.json({ url: publicUrl })
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
