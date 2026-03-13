import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, User, ArrowRight, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react'

function PasswordInput({ value, onChange, placeholder, disabled }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type={show ? 'text' : 'password'} value={value} onChange={onChange}
        placeholder={placeholder} disabled={disabled}
        className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function AuthScreen() {
  const { signup, login, forgotPassword, error, setError } = useAuth()
  const [mode, setMode] = useState('login') // login | signup | forgot | reset-sent
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  const displayError = localError || error

  const handleLogin = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setError(null)
    if (!email || !password) { setLocalError('Please fill in all fields'); return }
    setLoading(true)
    try {
      await login(email, password)
    } catch {} finally { setLoading(false) }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setError(null)
    if (!email || !password) { setLocalError('Please fill in all fields'); return }
    if (password.length < 8) { setLocalError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setLocalError('Passwords do not match'); return }
    setLoading(true)
    try {
      await signup(email, password, name)
    } catch {} finally { setLoading(false) }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setError(null)
    if (!email) { setLocalError('Please enter your email'); return }
    setLoading(true)
    try {
      await forgotPassword(email)
      setMode('reset-sent')
    } catch {} finally { setLoading(false) }
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setLocalError(null)
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-200">
              <img src="/logo_mark.png" alt="NB" className="w-8 h-8 sm:w-12 sm:h-12 object-contain" />
            </div>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-900">NORTHERN BIRD</h1>
              <p className="text-[9px] sm:text-[10px] font-display font-semibold tracking-[0.3em] text-accent uppercase -mt-0.5">Analytics</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {mode === 'login' && (
            <>
              <h2 className="text-lg font-display font-semibold text-slate-900 mb-1">Welcome back</h2>
              <p className="text-sm text-slate-500 mb-6">Sign in to your account</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address" disabled={loading}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50" />
                </div>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" disabled={loading} />
                <div className="flex justify-end">
                  <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-accent hover:text-accent-dark">
                    Forgot password?
                  </button>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold bg-accent hover:bg-accent-dark text-white transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign in</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
              <p className="text-sm text-slate-500 text-center mt-6">
                Don't have an account?{' '}
                <button onClick={() => switchMode('signup')} className="text-accent hover:text-accent-dark font-medium">
                  Create one
                </button>
              </p>
            </>
          )}

          {mode === 'signup' && (
            <>
              <h2 className="text-lg font-display font-semibold text-slate-900 mb-1">Create your account</h2>
              <p className="text-sm text-slate-500 mb-6">Start analyzing your data with AI</p>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Full name (optional)" disabled={loading}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address" disabled={loading}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50" />
                </div>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 characters)" disabled={loading} />
                <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" disabled={loading} />
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold bg-accent hover:bg-accent-dark text-white transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Create account</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
              <p className="text-sm text-slate-500 text-center mt-6">
                Already have an account?{' '}
                <button onClick={() => switchMode('login')} className="text-accent hover:text-accent-dark font-medium">
                  Sign in
                </button>
              </p>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <button onClick={() => switchMode('login')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
              <h2 className="text-lg font-display font-semibold text-slate-900 mb-1">Reset your password</h2>
              <p className="text-sm text-slate-500 mb-6">Enter your email and we'll send you a reset link</p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address" disabled={loading}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold bg-accent hover:bg-accent-dark text-white transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          {mode === 'reset-sent' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-lg font-display font-semibold text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 mb-6">
                If an account exists with <strong>{email}</strong>, we've sent a password reset link.
              </p>
              <button onClick={() => switchMode('login')}
                className="text-sm text-accent hover:text-accent-dark font-medium">
                Back to login
              </button>
            </div>
          )}

          {displayError && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 animate-slide-up">
              {displayError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
