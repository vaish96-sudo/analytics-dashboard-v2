import React from 'react'
import { useTheme } from '../context/ThemeContext'

export default function LogoMark({ size = 32, className = '', ...props }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const r = Math.round(size * 0.22)
  return (
    <div className={className} style={{
      width: size, height: size, borderRadius: r,
      background: isDark
        ? 'linear-gradient(135deg, #162236, #1e2d42)'
        : 'linear-gradient(135deg, #0c1425, #162236)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }} {...props}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 56 56">
        <defs>
          <linearGradient id={`mu-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor={isDark ? '#0ea5e9' : '#ffffff'} />
          </linearGradient>
        </defs>
        <text x="28" y="46" textAnchor="middle" fontSize="58" fontWeight="800"
          fontStyle="italic" fontFamily="Georgia,serif" fill={`url(#mu-${size})`}>µ</text>
      </svg>
    </div>
  )
}
