import React from 'react'
import { Crown, Zap, Sparkles } from 'lucide-react'
import { useTier } from '../context/TierContext'

const BADGE_STYLES = {
  free: {
    bg: 'linear-gradient(135deg, #64748b, #475569)',
    color: '#cbd5e1',
    border: 'rgba(203, 213, 225, 0.2)',
    icon: Zap,
  },
  pro: {
    bg: 'linear-gradient(135deg, #1c1917, #292524)',
    color: '#d4a574',
    border: 'rgba(212, 165, 116, 0.2)',
    icon: Crown,
  },
  agency: {
    bg: 'linear-gradient(135deg, #312e81, #4338ca)',
    color: '#c7d2fe',
    border: 'rgba(199, 210, 254, 0.3)',
    icon: Sparkles,
  },
}

export default function TierBadge({ compact }) {
  const { tier, config } = useTier()
  const style = BADGE_STYLES[tier] || BADGE_STYLES.free
  const Icon = style.icon

  if (compact) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold tracking-wide"
        style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
        <Icon className="w-2 h-2" />
        {config.label}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-wide"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}`, letterSpacing: '0.05em' }}>
      <Icon className="w-2.5 h-2.5" style={{ color: style.color }} />
      {config.label}
    </span>
  )
}
