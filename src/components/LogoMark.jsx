import React from 'react'
import { useTheme } from '../context/ThemeContext'

export default function LogoMark({ className, alt = 'NB', ...props }) {
  const { resolvedTheme } = useTheme()
  const src = resolvedTheme === 'dark' ? '/logo_mark_white.png' : '/logo_mark.png'
  return <img src={src} alt={alt} className={className} {...props} />
}
