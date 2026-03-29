import React, { useState, useCallback, useMemo, useContext, createContext, useEffect } from 'react'
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = { error: AlertCircle, success: CheckCircle, info: Info }
const COLORS = {
  error: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: '#ef4444', text: '#dc2626' },
  success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '#10b981', text: '#059669' },
  info: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)', icon: '#0ea5e9', text: '#0284c7' },
}

function Toast({ toast, onDismiss }) {
  const { type = 'error', message } = toast
  const colors = COLORS[type] || COLORS.error
  const Icon = ICONS[type] || AlertCircle

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 5000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl mb-2 animate-slide-in max-w-sm"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: colors.icon }} />
      <p className="text-sm flex-1" style={{ color: colors.text }}>{message}</p>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 hover:opacity-60" style={{ color: colors.text }}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'error', duration = 5000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, duration }])
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useMemo(() => ({
    error: (msg, dur) => addToast(msg, 'error', dur),
    success: (msg, dur) => addToast(msg, 'success', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }), [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999]" style={{ pointerEvents: 'auto' }}>
          {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}
        </div>
      )}
    </ToastContext.Provider>
  )
}
