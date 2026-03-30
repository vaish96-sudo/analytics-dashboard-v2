import { useEffect } from 'react'

/**
 * Runs `handler` when a mousedown occurs outside of `ref.current`.
 * Optionally pass `enabled` to control when the listener is active.
 */
export function useClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const listener = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler(e)
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler, enabled])
}
