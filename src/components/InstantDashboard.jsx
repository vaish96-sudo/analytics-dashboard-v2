import React, { useState, useCallback, useRef, useMemo } from 'react'
import { Upload, BarChart3, Sparkles, ArrowRight, Loader2, FileSpreadsheet, TrendingUp, Target, AlertTriangle, Lightbulb } from 'lucide-react'
import LogoMark from './LogoMark'

/**
 * Instant Dashboard — free tool, no login required.
 * Drop a CSV → see auto-generated charts + 1 AI insight.
 * CTA at bottom: "Want to save this, get more insights, and share with clients? Sign up free."
 */

function detectColumnType(values, colName) {
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 50)
  if (sample.length === 0) return 'ignore'
  const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{1,2}\/\d{1,2}\/\d{2,4}/]
  if (sample.filter(v => datePatterns.some(p => p.test(String(v).trim()))).length > sample.length * 0.7) return 'date'
  const numericCount = sample.filter(v => !isNaN(typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$%]/g, '')))).length
  if (numericCount > sample.length * 0.8) {
    const name = (colName || '').toLowerCase()
    const dimNames = ['id', 'age', 'year', 'zip', 'code', 'rank', 'rating', 'level']
    if (dimNames.some(d => name === d || name.includes(d))) return 'dimension'
    const uniqueValues = new Set(sample.map(v => String(v).trim()))
    if (uniqueValues.size <= Math.min(20, sample.length * 0.3)) return 'dimension'
    return 'metric'
  }
  return 'dimension'
}

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map(h => h.replace(/^["']|["']$/g, '').trim())
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.replace(/^["']|["']$/g, '').trim())
    const obj = {}
    headers.forEach((h, i) => {
      const v = vals[i] || ''
      const num = parseFloat(v.replace(/[,$%]/g, ''))
      obj[h] = v && !isNaN(num) && !/^0\d/.test(v) ? num : v
    })
    return obj
  }).filter(row => Object.values(row).some(v => v !== '' && v !== null))
}

function SimpleBarChart({ data, dim, met, schema }) {
  const maxVal = Math.max(...data.map(d => d[met] || 0), 1)
  const label = schema[met]?.label || met
  const dimLabel = schema[dim]?.label || dim
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{label} by {dimLabel}</p>
      <div className="space-y-2">
        {data.slice(0, 8).map((row, i) => {
          const val = row[met] || 0
          const pct = (val / maxVal) * 100
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] w-24 truncate text-right" style={{ color: 'var(--text-muted)' }}>{String(row[dim])}</span>
              <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'var(--bg-overlay)' }}>
                <div className="h-full rounded-md transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
              <span className="text-[10px] font-semibold w-16 text-right" style={{ color: 'var(--text-primary)' }}>
                {val >= 1e6 ? `${(val/1e6).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(1)}K` : val.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const INSIGHT_ICONS = { opportunity: Target, trend: TrendingUp, alert: AlertTriangle, recommendation: Lightbulb }

export default function InstantDashboard() {
  const [data, setData] = useState(null)
  const [schema, setSchema] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [insight, setInsight] = useState(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result)
        if (rows.length === 0) { setError('No data found in file'); return }
        const cols = Object.keys(rows[0])
        const s = {}
        cols.forEach(col => {
          const type = detectColumnType(rows.map(r => r[col]), col)
          s[col] = { type, label: col.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() }
        })
        setData(rows)
        setSchema(s)
        setFileName(file.name)
        // Auto-generate 1 insight
        generateInsight(rows, s)
      } catch (err) { setError('Failed to parse file: ' + err.message) }
    }
    reader.readAsText(file)
  }, [])

  const generateInsight = async (rows, s) => {
    setInsightLoading(true)
    try {
      const metrics = Object.entries(s).filter(([,d]) => d.type === 'metric').map(([col, d]) => ({ col, label: d.label }))
      const dims = Object.entries(s).filter(([,d]) => d.type === 'dimension').map(([col, d]) => ({ col, label: d.label }))
      
      if (metrics.length === 0) { setInsightLoading(false); return }

      // Build a quick data summary
      const summaryParts = []
      metrics.slice(0, 3).forEach(m => {
        const vals = rows.map(r => parseFloat(String(r[m.col] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
        summaryParts.push(`${m.label}: total=${vals.reduce((a, b) => a + b, 0).toLocaleString()}, avg=${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}`)
      })

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are a data analyst. Give exactly 1 key insight about this data. Respond with ONLY a JSON object: {"type":"opportunity|trend|alert|recommendation","title":"Short title","description":"2 sentence actionable insight with numbers.","impact":"high|medium|low"}`,
          messages: [{ role: 'user', content: `Dataset: ${rows.length} rows, ${Object.keys(s).length} columns.\n${summaryParts.join('\n')}\n\nGive 1 strategic insight.` }],
          max_tokens: 300,
          feature: 'insights',
        }),
      })

      if (res.ok) {
        const d = await res.json()
        const text = d.content?.map(c => c.text || '').join('') || ''
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        setInsight(parsed)
      }
    } catch {} finally { setInsightLoading(false) }
  }

  // Compute charts from data
  const charts = useMemo(() => {
    if (!data || !schema) return []
    const dims = Object.entries(schema).filter(([,d]) => d.type === 'dimension').map(([col]) => col)
    const mets = Object.entries(schema).filter(([,d]) => d.type === 'metric').map(([col]) => col)
    if (dims.length === 0 || mets.length === 0) return []

    const results = []
    // Top 2 charts
    dims.slice(0, 2).forEach((dim, i) => {
      const met = mets[i % mets.length]
      // Aggregate
      const groups = {}
      data.forEach(row => {
        const k = String(row[dim] || '(empty)')
        const v = parseFloat(String(row[met] ?? 0).replace(/[,$%]/g, ''))
        if (!groups[k]) groups[k] = 0
        if (!isNaN(v)) groups[k] += v
      })
      const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 10)
      results.push({ dim, met, data: sorted.map(([name, value]) => ({ [dim]: name, [met]: value })) })
    })
    return results
  }, [data, schema])

  // KPIs
  const kpis = useMemo(() => {
    if (!data || !schema) return []
    return Object.entries(schema).filter(([,d]) => d.type === 'metric').slice(0, 4).map(([col, def]) => {
      const vals = data.map(r => parseFloat(String(r[col] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
      const total = vals.reduce((a, b) => a + b, 0)
      return { label: def.label, value: total >= 1e6 ? `${(total/1e6).toFixed(1)}M` : total >= 1000 ? `${(total/1000).toFixed(1)}K` : total.toLocaleString() }
    })
  }, [data, schema])

  // Upload screen
  if (!data) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8 object-contain" />
            <div>
              <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
              <span className="text-[9px] font-display font-semibold tracking-[0.25em] uppercase ml-1.5" style={{ color: 'var(--accent)' }}>Instant</span>
            </div>
          </div>
          <a href="/" className="text-xs font-medium px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
            Sign up free
          </a>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center">
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                See your data in seconds
              </h1>
              <p className="text-base" style={{ color: 'var(--text-muted)' }}>
                Drop a CSV file and get instant charts + an AI insight. No signup required.
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer ${dragging ? 'border-blue-400 bg-blue-50' : ''}`}
              style={{ borderColor: dragging ? undefined : 'var(--border)', background: dragging ? undefined : 'var(--bg-surface)' }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-4" style={{ color: dragging ? '#3b82f6' : 'var(--text-muted)' }} />
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Drop your CSV here
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>or click to browse · CSV files up to 20MB</p>
              <input ref={fileRef} type="file" accept=".csv,.tsv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </div>

            {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

            <div className="mt-8 flex items-center justify-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Instant charts</span>
              <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI insight</span>
              <span className="flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> No signup</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard view
  const InsightIcon = insight ? (INSIGHT_ICONS[insight.type] || Lightbulb) : Lightbulb

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <LogoMark className="w-8 h-8 object-contain" />
          <div>
            <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
            <span className="text-[9px] font-display font-semibold tracking-[0.25em] uppercase ml-1.5" style={{ color: 'var(--accent)' }}>Instant</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fileName} · {data.length} rows</span>
          <a href="/" className="text-xs font-medium px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
            Sign up to save
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {/* AI Insight */}
        {(insightLoading || insight) && (
          <div className="rounded-xl p-4 mb-6" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(37,99,235,0.05))', border: '1px solid rgba(139,92,246,0.15)' }}>
            {insightLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>AI is analyzing your data...</span>
              </div>
            ) : insight && (
              <div className="flex items-start gap-3">
                <InsightIcon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{insight.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{insight.description}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* KPIs */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {kpis.map((kpi, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>{kpi.label}</p>
                <p className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {charts.map((ch, i) => (
            <SimpleBarChart key={i} data={ch.data} dim={ch.dim} met={ch.met} schema={schema} />
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(37,99,235,0.06))', border: '1px solid rgba(139,92,246,0.15)' }}>
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <h2 className="text-lg font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Want more insights?
          </h2>
          <p className="text-sm mb-4 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Sign up free to save this dashboard, get 5 AI insights, export PDF reports, and share with clients.
          </p>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-display font-semibold text-white" style={{ background: 'var(--accent)' }}>
            Sign up free <ArrowRight className="w-4 h-4" />
          </a>
          <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>No credit card required · Free tier includes 1 project</p>
        </div>
      </div>
    </div>
  )
}
