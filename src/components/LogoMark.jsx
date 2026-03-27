import React from 'react'
import { useTheme } from '../context/ThemeContext'

export default function LogoMark({ className, size = 32, ...props }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const gradId = `mu-grad-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" className={className} {...props}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isDark ? '#5ba3e0' : '#3b8bd4'} />
          <stop offset="100%" stopColor={isDark ? '#3b8bd4' : '#0a1f3d'} />
        </linearGradient>
      </defs>
      <text x="28" y="46" textAnchor="middle" fontSize="58" fontWeight="800" fontStyle="italic" fontFamily="Georgia,serif" fill={`url(#${gradId})`}>µ</text>
    </svg>
  )
}
