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
  return formatNumber(value, { prefix: '$', decimals: compact ? 0 : 2, compact })
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

export function smartFormat(value, colName) {
  if (value === null || value === undefined) return '–'
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,$%]/g, ''))
  if (isNaN(num)) return String(value)

  if (looksLikeCurrency(colName)) return formatCurrency(num)
  if (looksLikeRate(colName)) return formatPercent(num)
  if (num > 10000) return formatNumber(num, { compact: true })
  if (Number.isInteger(num)) return formatNumber(num)
  return formatNumber(num, { decimals: 2 })
}

export function truncate(str, len = 30) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}
