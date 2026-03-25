import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

const TOKEN_KEY = 'nb_session_token'
const USER_KEY = 'nb_user'

function saveSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {}
}

function loadSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    return token && user ? { token, user } : null
  } catch {
    return null
  }
}

function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [sessionToken, setSessionToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Restore session on mount — use cached user first, validate in background
  useEffect(() => {
    const saved = loadSession()
    if (saved && saved.user) {
      // Immediately restore from cache (no flash to login)
      setUser(saved.user)
      setSessionToken(saved.token)
      setLoading(false)
      // Then validate in background
      validateSessionBackground(saved.token)
    } else {
      setLoading(false)
    }
  }, [])

  const validateSessionBackground = async (token) => {
    try {
      const { data, error: err } = await supabase
        .from('sessions')
        .select('user_id, expires_at')
        .eq('token', token)
        .single()

      if (err || !data || new Date(data.expires_at) < new Date()) {
        // Session expired — log out silently
        setUser(null)
        setSessionToken(null)
        clearSession()
        return
      }

      // Refresh user data
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('id, email, name, company, avatar_url, email_verified')
        .eq('id', data.user_id)
        .single()

      if (!userErr && userData) {
        setUser(userData)
        saveSession(token, userData)
      }
    } catch {
      // Network error — keep cached session, don't log out
    }
  }

  const signup = useCallback(async (email, password, name) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      setUser(data.user)
      setSessionToken(data.token)
      saveSession(data.token, data.user)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setUser(data.user)
      setSessionToken(data.token)
      saveSession(data.token, data.user)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    if (sessionToken) {
      try { await supabase.from('sessions').delete().eq('token', sessionToken) } catch {}
    }
    setUser(null)
    setSessionToken(null)
    clearSession()
  }, [sessionToken])

  const forgotPassword = useCallback(async (email) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send reset email')
      return data
    } catch (err) { setError(err.message); throw err }
  }, [])

  const sendCode = useCallback(async (email) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      return data
    } catch (err) { setError(err.message); throw err }
  }, [])

  const verifyCode = useCallback(async (email, code, name) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, name }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setUser(data.user)
      setSessionToken(data.token)
      saveSession(data.token, data.user)
      return data
    } catch (err) { setError(err.message); throw err }
  }, [])

  const resetPassword = useCallback(async (token, newPassword) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: newPassword }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')
      return data
    } catch (err) { setError(err.message); throw err }
  }, [])

  const updateProfile = useCallback(async (updates) => {
    if (!user) return
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('users')
        .update({ name: updates.name, company: updates.company, avatar_url: updates.avatar_url })
        .eq('id', user.id)
        .select('id, email, name, company, avatar_url, email_verified')
        .single()
      if (err) throw new Error(err.message)
      setUser(data)
      saveSession(sessionToken, data)
      return data
    } catch (err) { setError(err.message); throw err }
  }, [user, sessionToken])

  return (
    <AuthContext.Provider value={{
      user, sessionToken, loading, error, isAuthenticated: !!user,
      signup, login, logout, forgotPassword, resetPassword, updateProfile, setError,
      sendCode, verifyCode,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
