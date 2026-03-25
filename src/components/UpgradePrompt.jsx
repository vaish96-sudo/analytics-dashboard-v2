import React from 'react'
import { Lock, ArrowRight, Sparkles } from 'lucide-react'
import { TIER_CONFIG } from '../lib/tierConfig'

/**
 * Inline upgrade prompt shown when a feature is locked.
 * Props:
 *   feature — display name of the locked feature ("AI Recommendations", "PDF Export")
 *   currentTier — user's current tier key
 *   requiredTier — minimum tier needed (optional, auto-detected if not given)
 *   compact — smaller version for inline use
 *   onUpgrade — callback (for future Stripe integration)
 */
export default function UpgradePrompt({ feature, currentTier = 'free', requiredTier, compact, onUpgrade }) {
  const targetTier = requiredTier || findRequiredTier(feature)
  const targetConfig = TIER_CONFIG[targetTier] || TIER_CONFIG.pro
  const currentConfig = TIER_CONFIG[currentTier] || TIER_CONFIG.free

  if (compact) {
    return (
      <button
        onClick={onUpgrade}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #1c1917, #292524)', color: '#d4a574' }}
      >
        <Lock className="w-3 h-3" />
        <span>Upgrade to {targetConfig.label}</span>
        <ArrowRight className="w-3 h-3" />
      </button>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="p-6 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(28,25,23,0.03), rgba(41,37,36,0.06))' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
          style={{ background: 'linear-gradient(135deg, #1c1917, #292524)' }}>
          <Sparkles className="w-6 h-6" style={{ color: '#d4a574' }} />
        </div>
        <h3 className="text-sm font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {feature}
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Available on the {targetConfig.label} plan{targetConfig.price > 0 ? ` ($${targetConfig.price}/mo)` : ''}
        </p>
        <button
          onClick={onUpgrade}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white transition-all hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          Upgrade to {targetConfig.label}
          <ArrowRight className="w-4 h-4" />
        </button>
        {currentConfig.price === 0 && (
          <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
            You're on the Free plan
          </p>
        )}
      </div>
    </div>
  )
}

/** Blurred overlay for preview-gated content (e.g. Recommendations on free tier) */
export function BlurredPreview({ children, feature, currentTier, requiredTier, onUpgrade }) {
  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-black/20 backdrop-blur-[2px] rounded-xl">
        <UpgradePrompt feature={feature} currentTier={currentTier} requiredTier={requiredTier} onUpgrade={onUpgrade} />
      </div>
    </div>
  )
}

/** Usage counter badge — shows remaining uses */
export function UsageBadge({ remaining, label }) {
  if (remaining === Infinity) return null
  const isLow = remaining <= 2
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${isLow ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
      {remaining} {label || 'remaining'}
    </span>
  )
}

// Find the first tier that enables a boolean feature
function findRequiredTier(featureName) {
  const booleanMap = {
    'AI Recommendations': 'recommendationsRuns',
    'Custom Metrics': 'customMetrics',
    'PDF Export': 'exportPdf',
    'Word Export': 'exportWord',
    'Scheduled Reports': 'scheduledReports',
    'White Label': 'whiteLabel',
    'Custom AI Playbook': 'customPlaybook',
    'Team Seats': 'teamSeats',
    'Client Portal': 'clientPortal',
    'API Connectors': 'connectors',
  }
  const key = booleanMap[featureName]
  if (!key) return 'pro'
  for (const [tierKey, config] of Object.entries(TIER_CONFIG)) {
    const val = config[key]
    if (val === true || (typeof val === 'number' && val !== 0)) return tierKey
  }
  return 'pro'
}
