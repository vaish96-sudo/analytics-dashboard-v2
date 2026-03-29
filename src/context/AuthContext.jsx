import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

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
      setUser(saved.user)
      setSessionToken(saved.token)
      setLoading(false)
      validateSessionBackground(saved.token)
    } else {
      setLoading(false)
    }
  }, [])

  const validateSessionBackground = async (token) => {
    try {
      const res = await fetch('/api/data/validate-session', {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!res.ok) {
        // Session expired — log out silently
        setUser(null)
        setSessionToken(null)
        clearSession()
        return
      }

      const data = await res.json()
      if (data.user) {
        setUser(data.user)
        saveSession(token, data.user)
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

      // If server requires verification, don't log in yet
      if (data.requiresVerification) {
        return { requiresVerification: true, email }
      }

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
      try {
        await fetch('/api/data/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        })
      } catch {}
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
      const res = await fetch('/api/data/update-user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: updates.name, company: updates.company, avatar_url: updates.avatar_url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
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
