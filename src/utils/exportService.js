// Export AI insights, chat conversations, and full dashboard reports as PDF or Word

export async function exportToPDF(content, title = 'Northern Bird Report') {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const maxWidth = pageWidth - margin * 2
  let y = margin

  const checkPageBreak = (needed = 15) => {
    if (y + needed > pageHeight - 20) { doc.addPage(); y = margin }
  }

  const addText = (text, fontSize, fontStyle = 'normal', color = [15, 23, 42]) => {
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', fontStyle)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(String(text || ''), maxWidth)
    for (const line of lines) {
      checkPageBreak()
      doc.text(line, margin, y)
      y += fontSize * 0.5
    }
  }

  const addSpacer = (height = 4) => { y += height }

  const addSectionHeader = (text) => {
    addSpacer(4)
    checkPageBreak(20)
    doc.setDrawColor(37, 99, 235)
    doc.setLineWidth(0.5)
    doc.line(margin, y, margin + 30, y)
    y += 4
    addText(text, 13, 'bold', [37, 99, 235])
    addSpacer(3)
  }

  // ========== HEADER ==========
  // Blue accent bar at top
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageWidth, 3, 'F')

  y = 12
  addText('NORTHERN BIRD ANALYTICS', 18, 'bold', [37, 99, 235])
  addSpacer(1)
  addText(title, 13, 'normal', [71, 85, 105])
  addSpacer(1)

  // Date and meta
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  addText(`Generated: ${dateStr} at ${timeStr}`, 9, 'normal', [148, 163, 184])
  addSpacer(4)

  // Separator
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ========== RENDER CONTENT ==========

  if (content.type === 'dashboard_report') {
    const { projectName, fileName, rowCount, filters, kpis, insights } = content

    // Project info box
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(margin, y, maxWidth, 18, 3, 3, 'F')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text(`Project: ${projectName || 'Untitled'}`, margin + 5, y + 6)
    doc.text(`Dataset: ${fileName || 'N/A'}  ·  ${(rowCount || 0).toLocaleString()} rows`, margin + 5, y + 12)
    y += 24

    // Active filters
    if (filters && Object.keys(filters).length > 0) {
      addSectionHeader('Active filters')
      Object.entries(filters).forEach(([col, vals]) => {
        if (vals && vals.length > 0) {
          addText(`${col}: ${vals.join(', ')}`, 9, 'normal', [71, 85, 105])
          addSpacer(1)
        }
      })
    }

    // KPI Summary
    if (kpis && kpis.length > 0) {
      addSectionHeader('Key metrics summary')

      // Draw KPI boxes in a grid
      const boxWidth = (maxWidth - 10) / 3
      const boxHeight = 18
      let kpiX = margin
      let kpiRow = 0

      kpis.forEach((kpi, i) => {
        if (i > 0 && i % 3 === 0) {
          kpiRow++
          kpiX = margin
          y += boxHeight + 4
        }
        checkPageBreak(boxHeight + 10)

        const bx = kpiX
        const by = y

        // Box background
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(bx, by, boxWidth - 3, boxHeight, 2, 2, 'F')

        // Border accent
        const colors = [[37, 99, 235], [14, 165, 233], [249, 115, 22], [16, 185, 129], [139, 92, 246], [236, 72, 153]]
        doc.setDrawColor(...(colors[i % colors.length]))
        doc.setLineWidth(0.8)
        doc.line(bx, by, bx, by + boxHeight)

        // Label
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.setFont('helvetica', 'bold')
        doc.text(String(kpi.label || '').toUpperCase(), bx + 4, by + 6)

        // Value
        doc.setFontSize(13)
        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        doc.text(String(kpi.value || '–'), bx + 4, by + 14)

        kpiX += boxWidth + 2
      })
      y += boxHeight + 8
    }

    // AI Insights
    if (insights && insights.length > 0) {
      addSectionHeader('AI strategic insights')

      const impactColors = {
        high: [220, 38, 38],
        medium: [217, 119, 6],
        low: [100, 116, 139],
      }
      const typeLabels = {
        opportunity: 'OPPORTUNITY',
        trend: 'TREND',
        alert: 'ALERT',
        recommendation: 'RECOMMENDATION',
      }

      insights.forEach((insight, i) => {
        checkPageBreak(25)

        // Impact badge
        const badgeColor = impactColors[insight.impact] || impactColors.medium
        doc.setFillColor(...badgeColor)
        const badgeText = (insight.impact || 'medium').toUpperCase()
        const badgeWidth = doc.getStringUnitWidth(badgeText) * 7 * 0.35 + 6
        doc.roundedRect(margin, y, badgeWidth, 5, 1.5, 1.5, 'F')
        doc.setFontSize(6)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text(badgeText, margin + 3, y + 3.5)

        // Type label
        const typeText = typeLabels[insight.type] || ''
        if (typeText) {
          doc.setFontSize(6)
          doc.setTextColor(148, 163, 184)
          doc.text(typeText, margin + badgeWidth + 3, y + 3.5)
        }
        y += 8

        // Title
        addText(insight.title, 11, 'bold', [15, 23, 42])
        addSpacer(1)

        // Description
        addText(insight.description, 9, 'normal', [71, 85, 105])
        addSpacer(5)

        // Divider between insights
        if (i < insights.length - 1) {
          doc.setDrawColor(241, 245, 249)
          doc.setLineWidth(0.2)
          doc.line(margin, y, pageWidth - margin, y)
          y += 4
        }
      })
    }

    // No insights message
    if (!insights || insights.length === 0) {
      addSpacer(4)
      addText('AI insights have not been generated for this dataset yet.', 9, 'italic', [148, 163, 184])
    }

  } else if (content.type === 'insights') {
    for (const insight of content.items) {
      addText(`[${(insight.impact || 'medium').toUpperCase()}] ${insight.title}`, 11, 'bold')
      addSpacer(2)
      addText(insight.description, 10, 'normal', [71, 85, 105])
      addSpacer(6)
    }
  } else if (content.type === 'chat') {
    for (const msg of content.messages) {
      const label = msg.role === 'user' ? 'You' : 'AI'
      addText(`${label}:`, 10, 'bold', msg.role === 'user' ? [37, 99, 235] : [15, 23, 42])
      addSpacer(1)
      const cleanText = (msg.content || '').replace(/\*\*/g, '').replace(/#{1,3}\s/g, '').replace(/`/g, '')
      addText(cleanText, 10, 'normal', [71, 85, 105])
      addSpacer(5)
    }
  }

  // ========== FOOTER ==========
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    // Bottom accent bar
    doc.setFillColor(248, 250, 252)
    doc.rect(0, pageHeight - 14, pageWidth, 14, 'F')

    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.text(`Northern Bird Analytics  ·  Confidential`, margin, pageHeight - 7)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 7)
  }

  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.pdf`)
}

export async function exportDashboardReport({ projectName, fileName, rowCount, schema, rawData, globalFilters, insights }) {
  // Build KPI data from raw data + schema
  const kpis = []
  if (schema && rawData) {
    const metrics = Object.entries(schema).filter(([, def]) => def.type === 'metric').slice(0, 6)
    metrics.forEach(([col, def]) => {
      const values = rawData.map(r => {
        const v = r[col]
        return typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[,$%]/g, ''))
      }).filter(v => !isNaN(v))
      const total = values.reduce((a, b) => a + b, 0)

      // Smart format
      let formatted
      if (/cost|spend|revenue|price|amount|budget|profit|sale|earning|income/i.test(col)) {
        formatted = total >= 1000000 ? `$${(total / 1000000).toFixed(1)}M` : total >= 1000 ? `$${(total / 1000).toFixed(1)}K` : `$${total.toFixed(0)}`
      } else if (/rate|percent|ctr|cvr|roas|roi|margin/i.test(col)) {
        formatted = `${total.toFixed(2)}%`
      } else if (total >= 10000) {
        formatted = total >= 1000000 ? `${(total / 1000000).toFixed(1)}M` : `${(total / 1000).toFixed(1)}K`
      } else {
        formatted = Number.isInteger(total) ? total.toLocaleString() : total.toFixed(2)
      }

      kpis.push({ label: def.label, value: formatted })
    })
  }

  await exportToPDF({
    type: 'dashboard_report',
    projectName,
    fileName,
    rowCount,
    filters: globalFilters,
    kpis,
    insights: insights || [],
  }, `${projectName || 'Dashboard'} Report`)
}

export async function exportToWord(content, title = 'Northern Bird Report') {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import('docx')

  const children = []

  children.push(new Paragraph({
    text: 'NORTHERN BIRD ANALYTICS',
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 100 },
  }))

  children.push(new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_2,
    spacing: { after: 100 },
  }))

  children.push(new Paragraph({
    children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 18, color: '94A3B8' })],
    spacing: { after: 300 },
  }))

  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' } },
    spacing: { after: 300 },
  }))

  if (content.type === 'insights') {
    for (const insight of content.items) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `[${(insight.impact || 'medium').toUpperCase()}] `, bold: true, size: 22, color: insight.impact === 'high' ? 'DC2626' : insight.impact === 'medium' ? 'D97706' : '64748B' }),
          new TextRun({ text: insight.title, bold: true, size: 22 }),
        ],
        spacing: { after: 100 },
      }))
      children.push(new Paragraph({
        text: insight.description,
        spacing: { after: 250 },
      }))
    }
  } else if (content.type === 'chat') {
    for (const msg of content.messages) {
      const label = msg.role === 'user' ? 'You' : 'AI'
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 22, color: msg.role === 'user' ? '2563EB' : '0F172A' }),
        ],
        spacing: { after: 50 },
      }))
      const cleanText = (msg.content || '').replace(/\*\*/g, '').replace(/#{1,3}\s/g, '').replace(/`/g, '')
      children.push(new Paragraph({
        text: cleanText,
        spacing: { after: 200 },
      }))
    }
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\s+/g, '_').toLowerCase()}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
