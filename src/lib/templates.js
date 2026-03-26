/**
 * Pre-built dashboard templates for common use cases.
 * Each template defines:
 * - name, description, icon
 * - suggestedSchema: maps common column name patterns to types
 * - kpiColumns: which metrics to show as KPI cards
 * - chartConfigs: pre-configured chart arrangements
 * - insightFocus: what the AI should focus on when generating insights
 */

export const TEMPLATES = [
  {
    id: 'marketing',
    name: 'Marketing Campaign',
    description: 'Ad spend, impressions, clicks, conversions, ROAS',
    icon: '📊',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    suggestedSchema: {
      // Column name patterns → type mapping
      dimensions: ['campaign', 'ad_group', 'ad_set', 'channel', 'platform', 'source', 'medium', 'device', 'region', 'country', 'audience', 'creative', 'keyword'],
      metrics: ['spend', 'cost', 'impressions', 'clicks', 'conversions', 'revenue', 'ctr', 'cpc', 'cpa', 'roas', 'roi', 'budget', 'reach', 'frequency'],
      dates: ['date', 'day', 'week', 'month'],
    },
    kpiPriority: ['spend', 'cost', 'revenue', 'conversions', 'clicks', 'impressions', 'roas', 'ctr'],
    chartLayout: [
      { type: 'bar', dimHint: 'campaign', metHint: 'spend' },
      { type: 'line', dimHint: 'date', metHint: 'conversions' },
      { type: 'pie', dimHint: 'channel', metHint: 'spend' },
      { type: 'bar', dimHint: 'campaign', metHint: 'revenue' },
    ],
    insightFocus: 'Focus on campaign performance, cost efficiency, ROAS trends, and budget allocation opportunities.',
  },
  {
    id: 'sales',
    name: 'Sales Pipeline',
    description: 'Revenue, deals, close rates, rep performance',
    icon: '💰',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    suggestedSchema: {
      dimensions: ['rep', 'salesperson', 'agent', 'stage', 'pipeline', 'product', 'category', 'region', 'territory', 'source', 'lead_source', 'industry', 'company', 'account'],
      metrics: ['revenue', 'amount', 'deal_value', 'quantity', 'units', 'discount', 'commission', 'target', 'quota', 'probability', 'days_in_stage'],
      dates: ['date', 'close_date', 'created_date', 'expected_close'],
    },
    kpiPriority: ['revenue', 'amount', 'deal_value', 'quantity', 'units', 'commission'],
    chartLayout: [
      { type: 'bar', dimHint: 'rep', metHint: 'revenue' },
      { type: 'line', dimHint: 'date', metHint: 'revenue' },
      { type: 'pie', dimHint: 'stage', metHint: 'amount' },
      { type: 'bar', dimHint: 'product', metHint: 'quantity' },
    ],
    insightFocus: 'Focus on top performers, pipeline health, conversion rates by stage, and revenue forecasting.',
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Orders, AOV, products, customer segments',
    icon: '🛒',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    suggestedSchema: {
      dimensions: ['product', 'category', 'sku', 'brand', 'customer', 'segment', 'channel', 'region', 'country', 'city', 'payment_method', 'shipping', 'status'],
      metrics: ['revenue', 'sales', 'orders', 'quantity', 'price', 'aov', 'discount', 'profit', 'margin', 'shipping_cost', 'refunds', 'returns'],
      dates: ['date', 'order_date', 'ship_date'],
    },
    kpiPriority: ['revenue', 'sales', 'orders', 'quantity', 'profit', 'aov'],
    chartLayout: [
      { type: 'bar', dimHint: 'product', metHint: 'revenue' },
      { type: 'line', dimHint: 'date', metHint: 'orders' },
      { type: 'pie', dimHint: 'category', metHint: 'revenue' },
      { type: 'bar', dimHint: 'region', metHint: 'sales' },
    ],
    insightFocus: 'Focus on top-selling products, revenue trends, customer segments, and profit margins.',
  },
  {
    id: 'social',
    name: 'Social Media',
    description: 'Engagement, followers, reach, content performance',
    icon: '📱',
    color: 'bg-pink-50 text-pink-700 border-pink-200',
    suggestedSchema: {
      dimensions: ['platform', 'post_type', 'content_type', 'format', 'campaign', 'hashtag', 'account', 'page'],
      metrics: ['impressions', 'reach', 'engagement', 'likes', 'comments', 'shares', 'saves', 'clicks', 'followers', 'views', 'watch_time', 'engagement_rate'],
      dates: ['date', 'posted_date', 'published'],
    },
    kpiPriority: ['impressions', 'reach', 'engagement', 'likes', 'followers', 'clicks', 'shares'],
    chartLayout: [
      { type: 'line', dimHint: 'date', metHint: 'engagement' },
      { type: 'bar', dimHint: 'platform', metHint: 'impressions' },
      { type: 'pie', dimHint: 'post_type', metHint: 'engagement' },
      { type: 'bar', dimHint: 'content_type', metHint: 'reach' },
    ],
    insightFocus: 'Focus on engagement rates by platform, content performance, optimal posting patterns, and audience growth.',
  },
  {
    id: 'finance',
    name: 'Financial Overview',
    description: 'Income, expenses, budgets, P&L categories',
    icon: '📈',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    suggestedSchema: {
      dimensions: ['category', 'department', 'vendor', 'account', 'type', 'project', 'cost_center', 'gl_code'],
      metrics: ['amount', 'revenue', 'income', 'expense', 'budget', 'actual', 'variance', 'profit', 'cost', 'balance', 'tax'],
      dates: ['date', 'period', 'month', 'quarter', 'fiscal_year'],
    },
    kpiPriority: ['revenue', 'income', 'expense', 'profit', 'budget', 'amount'],
    chartLayout: [
      { type: 'bar', dimHint: 'category', metHint: 'amount' },
      { type: 'line', dimHint: 'date', metHint: 'revenue' },
      { type: 'pie', dimHint: 'department', metHint: 'expense' },
      { type: 'bar', dimHint: 'vendor', metHint: 'cost' },
    ],
    insightFocus: 'Focus on budget vs. actual variance, expense trends, revenue drivers, and cost optimization opportunities.',
  },
]

/**
 * Match uploaded columns against a template to score relevance.
 * Returns a score 0-100 — higher means the template fits better.
 */
export function scoreTemplate(template, columnNames) {
  const lower = columnNames.map(c => c.toLowerCase().replace(/[_\s-]+/g, ''))
  const allPatterns = [
    ...template.suggestedSchema.dimensions,
    ...template.suggestedSchema.metrics,
    ...template.suggestedSchema.dates,
  ].map(p => p.replace(/[_\s-]+/g, ''))

  let matches = 0
  lower.forEach(col => {
    if (allPatterns.some(p => col.includes(p) || p.includes(col))) matches++
  })

  return Math.round((matches / Math.max(columnNames.length, 1)) * 100)
}

/**
 * Auto-detect the best template for a dataset based on column names.
 * Returns the best matching template or null if no good match.
 */
export function detectTemplate(columnNames) {
  let best = null
  let bestScore = 0

  TEMPLATES.forEach(t => {
    const score = scoreTemplate(t, columnNames)
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  })

  // Only return if at least 20% of columns match
  return bestScore >= 20 ? { template: best, score: bestScore } : null
}

/**
 * Apply template suggestions to a schema — reorder KPI priority
 * and suggest chart configurations.
 */
export function applyTemplate(template, schema, columnsByType) {
  if (!template || !schema) return null

  // Reorder metrics by template priority
  const metricOrder = []
  const lowerMetrics = columnsByType.metrics.map(m => ({ col: m, lower: m.toLowerCase().replace(/[_\s-]+/g, '') }))

  template.kpiPriority.forEach(hint => {
    const hintLower = hint.replace(/[_\s-]+/g, '')
    const match = lowerMetrics.find(m => m.lower.includes(hintLower) || hintLower.includes(m.lower))
    if (match && !metricOrder.includes(match.col)) metricOrder.push(match.col)
  })

  // Add remaining metrics not in template priority
  columnsByType.metrics.forEach(m => {
    if (!metricOrder.includes(m)) metricOrder.push(m)
  })

  return {
    kpiOrder: metricOrder,
    insightFocus: template.insightFocus,
    templateId: template.id,
    templateName: template.name,
  }
}

/**
 * Use template suggestedSchema to improve heuristic column classification.
 * If the template says "spend" is a metric and we have a column named "ad_spend",
 * trust the template over the heuristic.
 */
export function applyTemplateToSchema(template, heuristicSchema) {
  if (!template || !heuristicSchema) return heuristicSchema

  const updated = { ...heuristicSchema }
  const colNames = Object.keys(updated)

  colNames.forEach(col => {
    const lower = col.toLowerCase().replace(/[_\s-]+/g, '')

    // Check if template has a strong opinion about this column
    const isDim = template.suggestedSchema.dimensions.some(p => {
      const pl = p.replace(/[_\s-]+/g, '')
      return lower.includes(pl) || pl.includes(lower)
    })
    const isMet = template.suggestedSchema.metrics.some(p => {
      const pl = p.replace(/[_\s-]+/g, '')
      return lower.includes(pl) || pl.includes(lower)
    })
    const isDate = template.suggestedSchema.dates.some(p => {
      const pl = p.replace(/[_\s-]+/g, '')
      return lower.includes(pl) || pl.includes(lower)
    })

    // Only override if exactly one type matches (avoid ambiguity)
    const matchCount = (isDim ? 1 : 0) + (isMet ? 1 : 0) + (isDate ? 1 : 0)
    if (matchCount === 1) {
      if (isMet) updated[col] = { ...updated[col], type: 'metric' }
      else if (isDim) updated[col] = { ...updated[col], type: 'dimension' }
      else if (isDate) updated[col] = { ...updated[col], type: 'date' }
    }
  })

  return updated
}

/**
 * Resolve template chartLayout hints to actual column names from the dataset.
 * Returns an array of { type, dim, met } with real column names, or null if
 * the hint can't be matched.
 */
export function resolveChartLayout(template, columnsByType, dimCardinalities) {
  if (!template?.chartLayout || !columnsByType) return null

  const allDims = [...columnsByType.dimensions, ...columnsByType.dates]

  function findColumn(hint, candidates) {
    if (!hint) return null
    const hintLower = hint.replace(/[_\s-]+/g, '').toLowerCase()
    // Exact-ish match first
    const exact = candidates.find(c => {
      const cl = c.toLowerCase().replace(/[_\s-]+/g, '')
      return cl === hintLower || cl.includes(hintLower) || hintLower.includes(cl)
    })
    return exact || null
  }

  const resolved = []
  const usedCombos = new Set()

  template.chartLayout.forEach(hint => {
    const dimCandidates = hint.dimHint === 'date' ? columnsByType.dates : allDims
    let dim = findColumn(hint.dimHint, dimCandidates)
    let met = findColumn(hint.metHint, columnsByType.metrics)

    // Fallback: if dim hint is 'date' but no date columns, skip
    if (!dim && hint.dimHint === 'date' && columnsByType.dates.length > 0) {
      dim = columnsByType.dates[0]
    }
    // Fallback to first available dim/met if hint doesn't match
    if (!dim && allDims.length > 0) dim = allDims[0]
    if (!met && columnsByType.metrics.length > 0) met = columnsByType.metrics[0]

    if (!dim || !met) return

    // Validate cardinality for pie charts
    const card = dimCardinalities?.[dim] || 0
    let type = hint.type
    if (type === 'pie' && (card < 2 || card > 8)) {
      type = 'bar' // Degrade pie to bar if cardinality doesn't fit
    }
    if (card < 2) return // Skip useless single-value dimensions

    const key = `${type}-${dim}-${met}`
    if (usedCombos.has(key)) return
    usedCombos.add(key)

    resolved.push({ type, dim, met })
  })

  return resolved.length >= 2 ? resolved.slice(0, 4) : null
}
