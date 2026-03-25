import { validateSession } from '../../lib/validateSession.js'
import { gunzipSync } from 'zlib'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  const session = await validateSession(req)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { userId, supabase } = session

  const datasetId = req.query.id
  if (!datasetId) return res.status(400).json({ error: 'Missing dataset ID' })

  // Ownership check via project
  const { data: dataset, error: dsErr } = await supabase
    .from('datasets')
    .select('*, projects!inner(user_id)')
    .eq('id', datasetId)
    .single()

  if (dsErr || !dataset) return res.status(404).json({ error: 'Dataset not found' })
  if (dataset.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

  if (req.method === 'GET') {
    // Download raw data from storage if path exists
    let rawData = dataset.raw_data || []
    if (dataset.raw_data_path) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from('datasets')
          .download(dataset.raw_data_path)

        if (!dlErr && blob) {
          const buf = Buffer.from(await blob.arrayBuffer())
          let text
          if (dataset.raw_data_path.endsWith('.gz')) {
            text = gunzipSync(buf).toString('utf-8')
          } else {
            text = buf.toString('utf-8')
          }
          rawData = JSON.parse(text)
        }
      } catch (e) {
        console.error('Failed to download raw data:', e.message)
      }
    }

    const { projects, ...rest } = dataset
    // Cache for 5 minutes — dataset data doesn't change after upload
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.json({ ...rest, raw_data: rawData })
  }

  if (req.method === 'DELETE') {
    // Clean up storage
    if (dataset.raw_data_path) {
      await supabase.storage.from('datasets').remove([dataset.raw_data_path]).catch(() => {})
    }
    const { error } = await supabase.from('datasets').delete().eq('id', datasetId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
