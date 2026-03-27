// Meuris Analytics — Executive PDF Export
// Consulting-grade report: KPIs, Insights, Builder Table, Dimension Analysis

const GOLD = [176, 141, 87]
const DARK = [26, 26, 26]
const BODY = [82, 82, 82]
const MUTED = [148, 148, 148]
const WHITE = [255, 255, 255]
const CREAM = [250, 249, 247]
const BORDER = [229, 229, 224]
const RED = [200, 50, 50]
const AMBER = [190, 120, 30]
const SLATE = [100, 116, 139]

export async function exportToPDF(content, title = 'Meuris Analytics Report', branding = {}) {
  const brandName = branding.companyName || 'Meuris'
  const brandSuffix = branding.companyName ? '' : 'ANALYTICS'
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()   // 210
  const ph = doc.internal.pageSize.getHeight()   // 297
  const m = 16  // margin
  const mw = pw - m * 2  // max width

  let y = 0

  // === Helpers ===
  const newPage = () => { doc.addPage(); y = m + 4 }
  const need = (h) => { if (y + h > ph - 18) newPage() }

  const text = (str, x, yy, size, style, color, opts) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', style || 'normal')
    doc.setTextColor(...(color || DARK))
    doc.text(String(str || ''), x, yy, opts || {})
  }

  const wrappedText = (str, size, style, color, indent = 0) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', style || 'normal')
    doc.setTextColor(...(color || BODY))
    const lines = doc.splitTextToSize(String(str || ''), mw - indent)
    lines.forEach(line => {
      need(size * 0.42)
      doc.text(line, m + indent, y)
      y += size * 0.42
    })
  }

  const sectionHead = (label) => {
    y += 6
    need(16)
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.7)
    doc.line(m, y, m + 22, y)
    y += 5
    text(label, m, y, 13, 'bold', DARK)
    y += 7
  }

  const thinLine = () => {
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.15)
    doc.line(m, y, pw - m, y)
    y += 3
  }

  // === PAGE HEADER (gold bar + logo + title) ===
  doc.setFillColor(...GOLD)
  doc.rect(0, 0, pw, 2.5, 'F')

  y = 13
  text(brandName.toUpperCase(), m, y, 9, 'bold', GOLD)
  if (brandSuffix) text(brandSuffix, m + 28, y, 7, 'normal', MUTED)
  y += 10

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(title, m, y)
  y += 7

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  text(`Generated ${dateStr}`, m, y, 8, 'normal', MUTED)
  y += 6
  thinLine()

  // === RENDER BASED ON CONTENT TYPE ===
  if (content.type === 'dashboard_report') {
    const { projectName, fileName, rowCount, filters, kpis, insights,
            dataOverview, topBreakdowns, builderSummary, builderData } = content

    // Project info block
    doc.setFillColor(...CREAM)
    doc.roundedRect(m, y, mw, 12, 1.5, 1.5, 'F')
    text(projectName || 'Untitled', m + 4, y + 5, 9, 'bold', DARK)
    text(`${fileName || ''}  ·  ${(rowCount || 0).toLocaleString()} rows`, m + 4, y + 9.5, 7.5, 'normal', MUTED)
    y += 16

    // Active filters
    if (filters && Object.keys(filters).some(k => filters[k]?.length > 0)) {
      const parts = Object.entries(filters).filter(([,v]) => v?.length > 0).map(([k,v]) => `${k}: ${v.join(', ')}`)
      text(`Filters: ${parts.join('  |  ')}`, m, y, 7, 'italic', MUTED)
      y += 5
    }

    // ─── EXECUTIVE SUMMARY ───
    if (insights?.length > 0) {
      // Build structured summary
      const highImpact = insights.filter(i => i.impact === 'high')
      const medImpact = insights.filter(i => i.impact === 'medium')
      const topItems = (highImpact.length > 0 ? highImpact : insights).slice(0, 3)

      const overviewLine = `This report analyzes ${(rowCount || 0).toLocaleString()} records across ${dataOverview?.dimCount || 0} dimensions and ${dataOverview?.metCount || 0} metrics.`
      const findingsLine = `AI analysis identified ${insights.length} findings: ${highImpact.length} high priority${medImpact.length > 0 ? `, ${medImpact.length} medium priority` : ''}.`
      const keyPoints = topItems.map((ins, i) => `${i + 1}. ${ins.title} — ${ins.description.split('.')[0]}.`)

      doc.setFontSize(8)
      const allText = [overviewLine, findingsLine, '', 'Key findings:', ...keyPoints].join('\n')
      const summaryLines = doc.splitTextToSize(allText, mw - 12)
      const summaryH = Math.max(24, summaryLines.length * 3.5 + 16)

      need(summaryH + 6)

      // Card background
      doc.setFillColor(252, 251, 249)
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.25)
      doc.roundedRect(m, y, mw, summaryH, 2, 2, 'FD')

      // Gold top accent line
      doc.setFillColor(...GOLD)
      doc.rect(m + 0.5, y + 0.5, mw - 1, 1.2, 'F')

      // Header
      text('EXECUTIVE SUMMARY', m + 6, y + 7, 8, 'bold', GOLD)

      // Horizontal rule under header
      doc.setDrawColor(230, 225, 215)
      doc.setLineWidth(0.15)
      doc.line(m + 6, y + 9, m + mw - 6, y + 9)

      // Body text
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...BODY)
      let sy = y + 13
      summaryLines.forEach(line => {
        if (line.startsWith('Key findings:')) {
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(...DARK)
          doc.text(line, m + 6, sy)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...BODY)
        } else if (/^\d\./.test(line)) {
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...DARK)
          doc.text(line, m + 6, sy)
          doc.setTextColor(...BODY)
        } else {
          doc.text(line, m + 6, sy)
        }
        sy += 3.5
      })

      y += summaryH + 5
    }

    // ─── KPI CARDS ───
    if (kpis?.length > 0) {
      sectionHead('Key performance metrics')
      const cols = Math.min(kpis.length, 3)
      const gap = 4
      const bw = (mw - (cols - 1) * gap) / cols
      const bh = 20

      for (let i = 0; i < kpis.length; i++) {
        const col = i % cols
        if (col === 0 && i > 0) y += bh + gap
        need(bh + 6)

        const bx = m + col * (bw + gap)
        const by = y

        doc.setDrawColor(...BORDER)
        doc.setLineWidth(0.25)
        doc.roundedRect(bx, by, bw, bh, 1.5, 1.5, 'D')
        // Gold left accent
        doc.setFillColor(...GOLD)
        doc.rect(bx + 0.5, by + 3, 0.8, bh - 6, 'F')
        // Label
        text(String(kpis[i].label || '').toUpperCase(), bx + 5, by + 6.5, 6.5, 'bold', MUTED)
        // Value
        text(String(kpis[i].value || '-'), bx + 5, by + 15, 15, 'bold', DARK)
      }
      y += bh + 6
    }

    // ─── AI INSIGHTS ───
    if (insights?.length > 0) {
      sectionHead('Strategic insights')

      insights.forEach((ins, i) => {
        // Calculate space needed for this insight card
        doc.setFontSize(8.5)
        const descLines = doc.splitTextToSize(String(ins.description || ''), mw - 10)
        const cardH = 8 + 5 + (descLines.length * 3.5) + 4
        need(cardH + 6)

        // Card background
        const cardColor = ins.impact === 'high' ? [254, 242, 242] : ins.impact === 'medium' ? [255, 251, 235] : [248, 250, 252]
        doc.setFillColor(...cardColor)
        doc.roundedRect(m, y, mw, cardH, 1.5, 1.5, 'F')

        // Left accent bar
        const accentColor = ins.impact === 'high' ? RED : ins.impact === 'medium' ? AMBER : SLATE
        doc.setFillColor(...accentColor)
        doc.rect(m + 0.5, y + 3, 1, cardH - 6, 'F')

        // Impact badge + Type — on first line
        const impact = (ins.impact || 'medium').toUpperCase()
        const pillW = doc.getStringUnitWidth(impact) * 5.5 * 0.352 + 5
        doc.setFillColor(...accentColor)
        doc.roundedRect(m + 5, y + 2, pillW, 4.5, 1.2, 1.2, 'F')
        text(impact, m + 7.5, y + 5.2, 5.5, 'bold', WHITE)

        const typeLabel = (ins.type || '').toUpperCase()
        if (typeLabel) text(typeLabel, m + 5 + pillW + 3, y + 5.2, 5.5, 'normal', MUTED)

        // Title — on second line
        let ty = y + 10
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...DARK)
        const titleLines = doc.splitTextToSize(String(ins.title || ''), mw - 10)
        titleLines.forEach(line => {
          doc.text(line, m + 5, ty)
          ty += 4
        })
        ty += 1

        // Description
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...BODY)
        descLines.forEach(line => {
          doc.text(line, m + 5, ty)
          ty += 3.5
        })

        y += cardH + 3
      })
    } else {
      y += 4
      wrappedText('AI insights have not been generated for this dataset yet.', 8.5, 'italic', MUTED)
    }

    // ─── BUILDER TABLE ───
    if (builderData?.headers?.length > 0 && builderData?.rows?.length > 0) {
      sectionHead('Report builder')

      if (builderSummary) {
        text(`Dimensions: ${builderSummary.dimensions || 'None'}   |   Metrics: ${builderSummary.metrics || 'None'}`, m, y, 7.5, 'italic', MUTED)
        y += 5
      }

      const hdrs = builderData.headers
      const rows = builderData.rows.slice(0, 30)
      const colCount = hdrs.length

      // Calculate column widths — dimensions get more space
      const dimCols = hdrs.filter(h => h.type === 'dimension').length
      const metCols = hdrs.filter(h => h.type === 'metric').length
      const dimW = dimCols > 0 ? Math.min(45, (mw * 0.6) / dimCols) : 0
      const metW = metCols > 0 ? Math.max(20, (mw - dimW * dimCols) / metCols) : 0
      const colWidths = hdrs.map(h => h.type === 'dimension' ? dimW : metW)
      // Adjust to fit
      const totalW = colWidths.reduce((a, b) => a + b, 0)
      const scale = mw / totalW
      const finalW = colWidths.map(w => w * scale)

      const rh = 5.5

      need(rh * Math.min(rows.length + 1, 8) + 10)

      // Header row
      doc.setFillColor(...GOLD)
      let hx = m
      doc.rect(m, y, mw, rh + 1, 'F')
      hdrs.forEach((h, ci) => {
        text(String(h.label || '').toUpperCase().substring(0, 20), hx + 2, y + 4, 6, 'bold', WHITE)
        hx += finalW[ci]
      })
      y += rh + 1

      // Data rows
      rows.forEach((row, ri) => {
        need(rh + 1)
        if (ri % 2 === 0) {
          doc.setFillColor(...CREAM)
          doc.rect(m, y - 0.5, mw, rh, 'F')
        }
        let rx = m
        hdrs.forEach((h, ci) => {
          const val = row[h.key]
          const display = val === null || val === undefined ? '-' : String(val).substring(0, 22)
          const isMetric = h.type === 'metric'
          text(display, isMetric ? rx + finalW[ci] - 2 : rx + 2, y + 3.5, 7, isMetric ? 'bold' : 'normal', isMetric ? DARK : BODY, isMetric ? { align: 'right' } : {})
          rx += finalW[ci]
        })
        y += rh
      })

      // Row count note
      if (builderData.rows.length > 30) {
        y += 3
        text(`Showing 30 of ${builderData.rows.length} rows`, m, y, 6.5, 'italic', MUTED)
        y += 4
      }

      // Bottom border
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.2)
      doc.line(m, y, pw - m, y)
      y += 4
    }

    // ─── DIMENSION ANALYSIS ───
    if (topBreakdowns?.length > 0) {
      sectionHead('Dimension analysis')

      topBreakdowns.forEach(bd => {
        need(30)
        text(`${bd.dimension} by ${bd.metric}`, m, y, 9, 'bold', DARK)
        y += 5

        // Mini bar-style rows
        const maxVal = Math.max(...bd.items.map(i => i.value), 1)
        bd.items.forEach((item, idx) => {
          need(6)
          const barMax = mw * 0.45
          const barW = (item.value / maxVal) * barMax

          // Bar background
          doc.setFillColor(240, 238, 233)
          doc.rect(m + 30, y - 1.5, barMax, 4, 'F')
          // Bar fill
          doc.setFillColor(...GOLD)
          doc.rect(m + 30, y - 1.5, barW, 4, 'F')

          // Label
          text(`${idx + 1}. ${String(item.name).substring(0, 20)}`, m, y + 1, 7.5, 'normal', BODY)

          // Value
          const fmt = item.value >= 1e6 ? `${(item.value / 1e6).toFixed(1)}M` : item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}K` : item.value.toLocaleString()
          text(fmt, m + 32 + barMax, y + 1, 7.5, 'bold', DARK)
          y += 5.5
        })
        y += 5
      })
    }

    // ─── DATA SCHEMA (small, at bottom) ───
    if (dataOverview) {
      y += 2
      need(16)
      thinLine()
      text('DATA SCHEMA', m, y, 7, 'bold', MUTED)
      y += 4
      text(`${dataOverview.totalColumns} columns: ${dataOverview.dimCount} dimensions, ${dataOverview.metCount} metrics${dataOverview.dateCount ? ', ' + dataOverview.dateCount + ' dates' : ''}`, m, y, 7, 'normal', MUTED)
      y += 3
      if (dataOverview.metrics) {
        text(`Metrics: ${dataOverview.metrics}`, m, y, 6.5, 'normal', MUTED)
        y += 3
      }
    }

  } else if (content.type === 'insights') {
    for (const ins of content.items) {
      wrappedText(`[${(ins.impact || 'medium').toUpperCase()}] ${ins.title}`, 11, 'bold', DARK)
      y += 2
      wrappedText(ins.description, 9, 'normal', BODY)
      y += 6
    }
  } else if (content.type === 'chat') {
    for (const msg of content.messages) {
      const label = msg.role === 'user' ? 'You' : 'AI'
      wrappedText(`${label}:`, 9.5, 'bold', msg.role === 'user' ? GOLD : DARK)
      y += 1
      const clean = (msg.content || '').replace(/\*\*/g, '').replace(/#{1,3}\s/g, '').replace(/`/g, '')
      wrappedText(clean, 9, 'normal', BODY)
      y += 5
    }
  }

  // === FOOTER ON ALL PAGES ===
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    // Bottom bar
    doc.setFillColor(...CREAM)
    doc.rect(0, ph - 10, pw, 10, 'F')
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.15)
    doc.line(0, ph - 10, pw, ph - 10)
    // Gold accent dot
    doc.setFillColor(...GOLD)
    doc.circle(m + 1.5, ph - 5, 0.8, 'F')
    text(`${branding.companyName || 'Meuris Analytics'}  |  Confidential`, m + 5, ph - 3.5, 6.5, 'normal', MUTED)
    text(`Page ${i} of ${pages}`, pw - m, ph - 3.5, 6.5, 'normal', MUTED, { align: 'right' })
  }

  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.pdf`)
}


// === MAIN EXPORT FUNCTION ===
export async function exportDashboardReport({ projectName, fileName, rowCount, schema, rawData, globalFilters, insights, columnsByType, reportBuilderState }) {
  // Build KPIs
  const kpis = []
  if (schema && rawData) {
    Object.entries(schema).filter(([, d]) => d.type === 'metric').slice(0, 6).forEach(([col, def]) => {
      const vals = rawData.map(r => typeof r[col] === 'number' ? r[col] : parseFloat(String(r[col] ?? '').replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
      const total = vals.reduce((a, b) => a + b, 0)
      let fmt
      if (/cost|spend|revenue|price|amount|budget|profit|sale|earning|income/i.test(col))
        fmt = total >= 1e6 ? `$${(total/1e6).toFixed(1)}M` : total >= 1000 ? `$${(total/1000).toFixed(1)}K` : `$${total.toFixed(0)}`
      else if (/rate|percent|ctr|cvr|roas|roi|margin/i.test(col))
        fmt = `${total.toFixed(2)}%`
      else
        fmt = total >= 1e6 ? `${(total/1e6).toFixed(1)}M` : total >= 1e4 ? `${(total/1000).toFixed(1)}K` : Number.isInteger(total) ? total.toLocaleString() : total.toFixed(2)
      kpis.push({ label: def.label, value: fmt })
    })
  }

  // Data overview
  const dataOverview = schema ? (() => {
    const dims = Object.entries(schema).filter(([,d]) => d.type === 'dimension')
    const mets = Object.entries(schema).filter(([,d]) => d.type === 'metric')
    const dates = Object.entries(schema).filter(([,d]) => d.type === 'date')
    return { totalColumns: Object.keys(schema).length, dimensions: dims.map(([,d]) => d.label).join(', '), metrics: mets.map(([,d]) => d.label).join(', '), dimCount: dims.length, metCount: mets.length, dateCount: dates.length }
  })() : null

  // Top breakdowns
  const topBreakdowns = []
  if (schema && rawData && columnsByType?.dimensions?.length > 0 && columnsByType?.metrics?.length > 0) {
    columnsByType.dimensions.slice(0, 2).forEach(dim => {
      const groups = {}
      rawData.forEach(row => {
        const k = String(row[dim] || '(empty)')
        if (!groups[k]) groups[k] = 0
        const v = parseFloat(String(row[columnsByType.metrics[0]] ?? 0).replace(/[,$%]/g, ''))
        if (!isNaN(v)) groups[k] += v
      })
      topBreakdowns.push({
        dimension: schema[dim]?.label || dim,
        metric: schema[columnsByType.metrics[0]]?.label || columnsByType.metrics[0],
        items: Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
      })
    })
  }

  // Builder table data
  let builderSummary = null, builderData = null
  if (reportBuilderState) {
    const selDims = reportBuilderState.selectedDims || []
    const selMets = reportBuilderState.selectedMetrics || []
    if (selDims.length > 0 || selMets.length > 0) {
      builderSummary = {
        dimensions: selDims.map(d => schema?.[d]?.label || d).join(', '),
        metrics: selMets.map(m => schema?.[m]?.label || m).join(', '),
        chartType: reportBuilderState.chartType || 'bar',
      }

      if (rawData && selMets.length > 0) {
        // Aggregate
        let d = [...rawData]
        ;(reportBuilderState.filters || []).forEach(f => { if (f.values?.length > 0) d = d.filter(row => f.values.includes(String(row[f.col]))) })

        let results
        if (selDims.length === 0) {
          const totals = {}
          selMets.forEach(met => { totals[met] = d.reduce((s, r) => { const v = parseFloat(String(r[met] ?? 0).replace(/[,$%]/g, '')); return s + (isNaN(v) ? 0 : v) }, 0) })
          results = [totals]
        } else {
          const groups = {}
          d.forEach(row => {
            const key = selDims.map(dim => String(row[dim] ?? '(empty)')).join('|||')
            if (!groups[key]) { groups[key] = { _rows: [] }; selDims.forEach(dim => { groups[key][dim] = row[dim] ?? '(empty)' }) }
            groups[key]._rows.push(row)
          })
          results = Object.values(groups).map(g => {
            const r = {}
            selDims.forEach(dim => { r[dim] = g[dim] })
            selMets.forEach(met => { r[met] = g._rows.reduce((s, row) => { const v = parseFloat(String(row[met] ?? 0).replace(/[,$%]/g, '')); return s + (isNaN(v) ? 0 : v) }, 0) })
            return r
          })
        }
        results.sort((a, b) => (b[selMets[0]] || 0) - (a[selMets[0]] || 0))

        builderData = {
          headers: [...selDims.map(d => ({ key: d, label: schema?.[d]?.label || d, type: 'dimension' })),
                   ...selMets.map(m => ({ key: m, label: schema?.[m]?.label || m, type: 'metric' }))],
          rows: results.slice(0, 50),
        }
      }
    }
  }

  await exportToPDF({
    type: 'dashboard_report', projectName, fileName, rowCount,
    filters: globalFilters, kpis, insights: insights || [],
    dataOverview, topBreakdowns, builderSummary, builderData,
  }, `${projectName || 'Dashboard'} Report`)
}


// === WORD EXPORT ===
export async function exportToWord(content, title = 'Meuris Analytics Report', branding = {}) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import('docx')
  const children = []
  const brandName = branding.companyName || 'MEURIS ANALYTICS'

  children.push(new Paragraph({ text: brandName.toUpperCase(), heading: HeadingLevel.HEADING_1, spacing: { after: 100 } }))
  children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }))
  children.push(new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 18, color: '94A3B8' })], spacing: { after: 300 } }))
  children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' } }, spacing: { after: 300 } }))

  if (content.type === 'insights') {
    for (const ins of content.items) {
      children.push(new Paragraph({ children: [
        new TextRun({ text: `[${(ins.impact || 'medium').toUpperCase()}] `, bold: true, size: 22, color: ins.impact === 'high' ? 'DC2626' : ins.impact === 'medium' ? 'D97706' : '64748B' }),
        new TextRun({ text: ins.title, bold: true, size: 22 }),
      ], spacing: { after: 100 } }))
      children.push(new Paragraph({ text: ins.description, spacing: { after: 250 } }))
    }
  } else if (content.type === 'chat') {
    for (const msg of content.messages) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${msg.role === 'user' ? 'You' : 'AI'}: `, bold: true, size: 22, color: msg.role === 'user' ? 'B08D57' : '1A1A1A' })], spacing: { after: 50 } }))
      children.push(new Paragraph({ text: (msg.content || '').replace(/\*\*/g, '').replace(/#{1,3}\s/g, '').replace(/`/g, ''), spacing: { after: 200 } }))
    }
  }

  const docx = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(docx)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/\s+/g, '_').toLowerCase()}.docx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}
