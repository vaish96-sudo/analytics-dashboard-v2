export function formatNumber(value, opts = {}) {
  if (value === null || value === undefined || isNaN(value)) return '–'
  const num = typeof value === 'string' ? parseFloat(value.replace(/[,$%]/g, '')) : value
  if (isNaN(num)) return '–'

  const { decimals = 0, prefix = '', suffix = '', compact = false } = opts

  if (compact) {
    if (Math.abs(num) >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(1)}M${suffix}`
    if (Math.abs(num) >= 1_000) return `${prefix}${(num / 1_000).toFixed(1)}K${suffix}`
  }

  return `${prefix}${num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`
}

export function formatCurrency(value, compact = true) {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,$%]/g, ''))
  if (isNaN(num)) return '–'
  // Small values (under 10) always show 2 decimals — "$1.27" not "$1"
  // Medium values (10-999) show 0 decimals — "$342" not "$342.00"
  // Large values use compact notation — "$14.2K"
  if (compact && Math.abs(num) >= 1000) {
    return formatNumber(num, { prefix: '$', decimals: 0, compact: true })
  }
  if (Math.abs(num) < 10) {
    return formatNumber(num, { prefix: '$', decimals: 2 })
  }
  return formatNumber(num, { prefix: '$', decimals: 0 })
}

export function formatPercent(value) {
  return formatNumber(value, { decimals: 2, suffix: '%' })
}

export const CHART_COLORS = [
  '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4',
]

export function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function looksLikeCurrency(colName) {
  return /cost|spend|revenue|price|amount|budget|profit|sale|earning|income|fee|payment/i.test(colName)
}

export function looksLikeRate(colName) {
  return /rate|ratio|percent|ctr|cvr|roas|roi|margin|share|bounce|conversion/i.test(colName)
}

export function looksLikePerUnit(colName) {
  return /per\s*(unit|item|order|click|impression|user|customer|visitor|session|day|month|hour)/i.test(colName)
}

export function smartFormat(value, colName) {
  if (value === null || value === undefined) return '–'
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,$%]/g, ''))
  if (isNaN(num)) return String(value)

  // Per-unit metrics: always show 2 decimals with currency prefix if it looks like money
  if (looksLikePerUnit(colName)) {
    if (looksLikeCurrency(colName)) return formatNumber(num, { prefix: '$', decimals: 2 })
    return formatNumber(num, { decimals: 2 })
  }
  if (looksLikeCurrency(colName)) return formatCurrency(num)
  if (looksLikeRate(colName)) return formatPercent(num)
  // Small decimals: show precision
  if (!Number.isInteger(num) && Math.abs(num) < 100) return formatNumber(num, { decimals: 2 })
  if (num > 10000) return formatNumber(num, { compact: true })
  if (Number.isInteger(num)) return formatNumber(num)
  return formatNumber(num, { decimals: 2 })
}

export function truncate(str, len = 30) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}
