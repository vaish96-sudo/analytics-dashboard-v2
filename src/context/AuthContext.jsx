const DEV_MODE = import.meta.env.DEV
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
      if (DEV_MODE) {
        const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single()
        if (existing) throw new Error('An account with this email already exists')

        const { data: newUser, error: createErr } = await supabase
          .from('users')
          .insert({ email: email.toLowerCase(), password_hash: 'dev-mode', name: name || null, email_verified: true })
          .select('id, email, name, company, avatar_url, email_verified')
          .single()
        if (createErr) throw new Error(createErr.message)

        const token = 'dev-token-' + Date.now()
        await supabase.from('sessions').insert({ user_id: newUser.id, token, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })

        setUser(newUser)
        setSessionToken(token)
        saveSession(token, newUser)
        return { user: newUser, token }
      }

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
      if (DEV_MODE) {
        const { data: userData, error: findErr } = await supabase
          .from('users')
          .select('id, email, name, company, avatar_url, email_verified')
          .eq('email', email.toLowerCase())
          .single()
        if (findErr || !userData) throw new Error('Invalid email or password')

const token = 'dev-token-' + Date.now()
        await supabase.from('sessions').insert({ user_id: userData.id, token, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
        setUser(userData)
        setSessionToken(token)
        saveSession(token, userData)
        return { user: userData, token }
      }

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
    }}>
      {children}
    </AuthContext.Provider>
  )
}
