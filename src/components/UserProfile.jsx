import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { User, Mail, Building2, Camera, Save, Loader2, CheckCircle, Sun, Moon, Monitor, Crown, Shield, Zap } from 'lucide-react'

export default function UserProfile() {
  const { user, updateProfile, logout } = useAuth()
  const { mode, setTheme } = useTheme()
  const [name, setName] = useState(user?.name || '')
  const [company, setCompany] = useState(user?.company || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setCompany(user.company || '')
      setAvatarUrl(user.avatar_url || '')
    }
  }, [user])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateProfile({ name, company, avatar_url: avatarUrl || null })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const initials = (user?.name || user?.email || '?')[0].toUpperCase()

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Profile Section */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="text-base font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Profile</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage your account details</p>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" style={{ border: '2px solid var(--border)' }} />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-display font-bold text-white" style={{ background: 'var(--accent)' }}>
                  {initials}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <Camera className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
            <div className="flex-1">
              <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Avatar URL (optional)"
                className="w-full px-3 py-2 text-sm rounded-lg nb-input" />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Paste a URL to your profile picture</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <User className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> Full name
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2.5 text-sm rounded-xl nb-input" />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Mail className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> Email
            </label>
            <div className="flex items-center gap-2">
              <input type="email" value={user?.email || ''} disabled
                className="flex-1 px-3 py-2.5 text-sm rounded-xl cursor-not-allowed"
                style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-muted)' }} />
              {user?.email_verified && (
                <span className="flex items-center gap-1 text-xs text-emerald-500 shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" /> Verified
                </span>
              )}
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> Company
            </label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
              placeholder="Your company name"
              className="w-full px-3 py-2.5 text-sm rounded-xl nb-input" />
          </div>

          {/* Save */}
          <div className="flex items-center justify-end pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><CheckCircle className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save changes</>}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
          )}
        </form>
      </div>

      {/* Appearance Section */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="text-base font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Choose your preferred color mode</p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(opt => (
              <button key={opt.value} onClick={() => setTheme(opt.value)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                style={{
                  background: mode === opt.value ? 'var(--border-accent)' : 'var(--bg-overlay)',
                  border: mode === opt.value ? '2px solid var(--accent)' : '2px solid transparent',
                }}>
                <opt.icon className="w-5 h-5" style={{ color: mode === opt.value ? 'var(--accent)' : 'var(--text-muted)' }} />
                <span className="text-xs font-medium" style={{ color: mode === opt.value ? 'var(--accent)' : 'var(--text-secondary)' }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Section */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="text-base font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Plan & AI</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your subscription and AI model details</p>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #1c1917, #292524)' }}>
                <Crown className="w-5 h-5" style={{ color: '#c9956b' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Pro Plan</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Full access to all features</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'linear-gradient(135deg, #1c1917, #292524)', color: '#d4a574' }}>
              Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>AI Models</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Claude Opus 4.6</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Strategic insights & deep analysis</p>
              <p className="text-sm font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>Claude Sonnet 4.6</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Ask AI queries & fast responses</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Features</span>
              </div>
              <ul className="space-y-1.5">
                <li className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <CheckCircle className="w-3 h-3" style={{ color: 'var(--accent)' }} /> Unlimited projects
                </li>
                <li className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <CheckCircle className="w-3 h-3" style={{ color: 'var(--accent)' }} /> AI-powered insights
                </li>
                <li className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <CheckCircle className="w-3 h-3" style={{ color: 'var(--accent)' }} /> PDF report export
                </li>
                <li className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <CheckCircle className="w-3 h-3" style={{ color: 'var(--accent)' }} /> API data connectors
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-600 font-medium">
            Sign out of your account
          </button>
        </div>
      </div>
    </div>
  )
}
