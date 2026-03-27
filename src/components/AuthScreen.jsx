import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import LogoMark from './LogoMark'
import { Mail, Lock, User, ArrowRight, ArrowLeft, Loader2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'

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

// 6-digit code input with auto-focus and paste support
function CodeInput({ value, onChange, disabled }) {
  const inputsRef = useRef([])
  const digits = value.padEnd(6, '').split('').slice(0, 6)

  const focusInput = (i) => {
    if (inputsRef.current[i]) inputsRef.current[i].focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]
      next[i - 1] = ''
      onChange(next.join(''))
      focusInput(i - 1)
    }
  }

  const handleInput = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    if (!char) return
    const next = [...digits]
    next[i] = char
    const newVal = next.join('')
    onChange(newVal)
    if (i < 5) focusInput(i + 1)
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      onChange(pasted)
      focusInput(Math.min(pasted.length, 5))
    }
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          ref={el => inputsRef.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i] || ''}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-11 h-14 text-center text-xl font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
        />
      ))}
    </div>
  )
}

function CountdownTimer({ expiresIn, onExpired }) {
  const [seconds, setSeconds] = useState(expiresIn)

  useEffect(() => {
    if (seconds <= 0) { onExpired?.(); return }
    const t = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds, onExpired])

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return <span className="tabular-nums">{mins}:{secs.toString().padStart(2, '0')}</span>
}

export default function AuthScreen() {
  const { signup, login, forgotPassword, sendCode, verifyCode, error, setError } = useAuth()
  // Modes: email (enter email) | code (enter 6-digit code) | password-login | password-signup | forgot | reset-sent
  const [mode, setMode] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [codeExpiresIn, setCodeExpiresIn] = useState(0)
  const [codeExpired, setCodeExpired] = useState(false)

  const displayError = localError || error

  const clearErrors = () => { setLocalError(null); setError(null) }

  const switchMode = (newMode) => {
    setMode(newMode)
    clearErrors()
    setCode('')
  }

  // ─── Passwordless flow ─────────────────────────────────────────
  const handleSendCode = async (e) => {
    e.preventDefault()
    clearErrors()
    if (!email) { setLocalError('Please enter your email'); return }
    setLoading(true)
    try {
      const data = await sendCode(email)
      setCodeExpiresIn(data.expiresIn || 600)
      setCodeExpired(false)
      setCode('')
      setMode('code')
    } catch {} finally { setLoading(false) }
  }

  const handleVerifyCode = async (e) => {
    e?.preventDefault()
    clearErrors()
    if (code.length !== 6) { setLocalError('Please enter the full 6-digit code'); return }
    setLoading(true)
    try {
      await verifyCode(email, code, name)
    } catch {} finally { setLoading(false) }
  }

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (mode === 'code' && code.length === 6 && !loading) {
      handleVerifyCode()
    }
  }, [code])

  const handleResend = async () => {
    clearErrors()
    setLoading(true)
    try {
      const data = await sendCode(email)
      setCodeExpiresIn(data.expiresIn || 600)
      setCodeExpired(false)
      setCode('')
    } catch {} finally { setLoading(false) }
  }

  // ─── Password flow (fallback) ──────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    clearErrors()
    if (!email || !password) { setLocalError('Please fill in all fields'); return }
    setLoading(true)
    try {
      await login(email, password)
    } catch {} finally { setLoading(false) }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    clearErrors()
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
    clearErrors()
    if (!email) { setLocalError('Please enter your email'); return }
    setLoading(true)
    try {
      await forgotPassword(email)
      setMode('reset-sent')
    } catch {} finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-200">
              <LogoMark className="w-8 h-8 sm:w-12 sm:h-12 object-contain" />
            </div>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-900">Meuris</h1>
              <p className="text-[9px] sm:text-[10px] font-display font-semibold tracking-[0.3em] text-accent uppercase -mt-0.5">Analytics</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">

          {/* ═══ Step 1: Enter email ═══ */}
          {mode === 'email' && (
            <>
              <h2 className="text-lg font-display font-semibold text-slate-900 mb-1">Welcome</h2>
              <p className="text-sm text-slate-500 mb-6">Enter your email to sign in or create an account</p>
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address" disabled={loading} autoFocus
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold bg-accent hover:bg-accent-dark text-white transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4" /><span>Send me a login code</span></>}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">or sign in with password</span></div>
              </div>

              <button onClick={() => switchMode('password-login')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                <Lock className="w-4 h-4" /> Use password instead
              </button>
            </>
          )}

          {/* ═══ Step 2: Enter code ═══ */}
          {mode === 'code' && (
            <>
              <button onClick={() => switchMode('email')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" /> Change email
              </button>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-6 h-6 text-accent" />
                </div>
                <h2 className="text-lg font-display font-semibold text-slate-900 mb-1">Check your email</h2>
                <p className="text-sm text-slate-500">
                  We sent a 6-digit code to <strong className="text-slate-700">{email}</strong>
                </p>
              </div>
              <form onSubmit={handleVerifyCode} className="space-y-5">
                <CodeInput value={code} onChange={setCode} disabled={loading} />

                <div className="text-center text-xs text-slate-400">
                  {codeExpired ? (
                    <button type="button" onClick={handleResend} disabled={loading} className="text-accent hover:text-accent-dark font-medium">
                      Code expired — send a new one
                    </button>
                  ) : (
                    <span>
                      Code expires in{' '}
                      <CountdownTimer expiresIn={codeExpiresIn} onExpired={() => setCodeExpired(true)} />
                    </span>
                  )}
                </div>

                <button type="submit" disabled={loading || code.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold bg-accent hover:bg-accent-dark text-white transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Verify & sign in</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 mt-4">
                Didn't get the email?{' '}
                <button type="button" onClick={handleResend} disabled={loading} className="text-accent hover:text-accent-dark font-medium">
                  Resend code
                </button>
              </p>
            </>
          )}

          {/* ═══ Password login (fallback) ═══ */}
          {mode === 'password-login' && (
            <>
              <button onClick={() => switchMode('email')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h2 className="text-lg font-display font-semibold text-slate-900 mb-1">Sign in with password</h2>
              <p className="text-sm text-slate-500 mb-6">For accounts created with a password</p>
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
                Need an account with a password?{' '}
                <button onClick={() => switchMode('password-signup')} className="text-accent hover:text-accent-dark font-medium">
                  Create one
                </button>
              </p>
            </>
          )}

          {/* ═══ Password signup (fallback) ═══ */}
          {mode === 'password-signup' && (
            <>
              <button onClick={() => switchMode('email')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
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
                <button onClick={() => switchMode('password-login')} className="text-accent hover:text-accent-dark font-medium">
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* ═══ Forgot password ═══ */}
          {mode === 'forgot' && (
            <>
              <button onClick={() => switchMode('password-login')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
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

          {/* ═══ Reset email sent ═══ */}
          {mode === 'reset-sent' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-lg font-display font-semibold text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 mb-6">
                If an account exists with <strong>{email}</strong>, we've sent a password reset link.
              </p>
              <button onClick={() => switchMode('email')}
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
