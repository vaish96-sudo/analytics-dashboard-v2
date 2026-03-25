// ─── Tier Configuration ─────────────────────────────────────────
// 3 tiers: Free (get hooked) → Pro (power user) → Agency (multi-client)
// -1 = unlimited

export const TIER_CONFIG = {
  free: {
    label: 'Free',
    price: 0,
    maxProjects: 1,
    maxDatasets: 1,
    maxRowsPerDataset: 5000,
    askAiQueries: 5,
    insightsRuns: 1,
    recommendationsRuns: 0,
    aiSuggestRuns: 1,
    customMetrics: false,
    exportPdf: false,
    exportWord: false,
    exportExcel: true,
    scheduledReports: false,
    teamSeats: 0,
    whiteLabel: false,
    customPlaybook: false,
    connectors: false,
    clientPortal: false,
    showRecommendationsPreview: true,
  },
  pro: {
    label: 'Pro',
    price: 79,
    maxProjects: 15,
    maxDatasets: -1,
    maxRowsPerDataset: 500000,
    askAiQueries: -1,
    insightsRuns: -1,
    recommendationsRuns: 10,
    aiSuggestRuns: -1,
    customMetrics: true,
    exportPdf: true,
    exportWord: true,
    exportExcel: true,
    scheduledReports: false,
    teamSeats: 0,
    whiteLabel: false,
    customPlaybook: false,
    connectors: true,
    clientPortal: false,
    showRecommendationsPreview: false,
  },
  agency: {
    label: 'Agency',
    price: 199,
    maxProjects: -1,
    maxDatasets: -1,
    maxRowsPerDataset: 1000000,
    askAiQueries: -1,
    insightsRuns: -1,
    recommendationsRuns: -1,
    aiSuggestRuns: -1,
    customMetrics: true,
    exportPdf: true,
    exportWord: true,
    exportExcel: true,
    scheduledReports: true,
    teamSeats: 5,
    whiteLabel: true,
    customPlaybook: true,
    connectors: true,
    clientPortal: true,
    showRecommendationsPreview: false,
  },
}

/** Check if a boolean feature is enabled for a tier */
export function canUse(tier, feature) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.free
  return !!config[feature]
}

/** Get a numeric limit for a tier (-1 = unlimited) */
export function getLimit(tier, key) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.free
  return config[key] ?? 0
}

/** Check if current usage is within the tier limit */
export function withinLimit(tier, key, currentUsage) {
  const limit = getLimit(tier, key)
  if (limit === -1) return true
  return currentUsage < limit
}

/** Display string for a limit */
export function limitDisplay(tier, key) {
  const limit = getLimit(tier, key)
  if (limit === -1) return 'Unlimited'
  if (limit === 0) return '—'
  return String(limit)
}

/** Get the tier config object */
export function getTierConfig(tier) {
  return TIER_CONFIG[tier] || TIER_CONFIG.free
}

/** All tier keys in order */
export const TIER_ORDER = ['free', 'pro', 'agency']

/** Get the next tier up */
export function getNextTier(currentTier) {
  const idx = TIER_ORDER.indexOf(currentTier)
  if (idx === -1 || idx >= TIER_ORDER.length - 1) return null
  return TIER_ORDER[idx + 1]
}
