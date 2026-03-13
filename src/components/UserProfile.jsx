import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Mail, Building2, Camera, Save, Loader2, CheckCircle, Lock } from 'lucide-react'

export default function UserProfile() {
  const { user, updateProfile, logout } = useAuth()
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

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="p-4 sm:p-6 border-b border-slate-100">
        <h3 className="text-base font-display font-semibold text-slate-800">Your Profile</h3>
        <p className="text-xs text-slate-400 mt-0.5">Manage your account details</p>
      </div>

      <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-xl font-display font-bold border-2 border-accent/30">
                {initials}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center">
              <Camera className="w-3 h-3 text-slate-400" />
            </div>
          </div>
          <div className="flex-1">
            <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="Avatar URL (optional)"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20" />
            <p className="text-[10px] text-slate-400 mt-1">Paste a URL to your profile picture</p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" /> Full name
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
          </label>
          <div className="flex items-center gap-2">
            <input type="email" value={user?.email || ''} disabled
              className="flex-1 px-3 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed" />
            {user?.email_verified && (
              <span className="flex items-center gap-1 text-xs text-emerald-500 shrink-0">
                <CheckCircle className="w-3.5 h-3.5" /> Verified
              </span>
            )}
          </div>
        </div>

        {/* Company */}
        <div>
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" /> Company (optional)
          </label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
            placeholder="Your company name"
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={logout}
            className="text-sm text-red-500 hover:text-red-600 font-medium">
            Sign out
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold bg-accent hover:bg-accent-dark text-white transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><CheckCircle className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save changes</>}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}
      </form>
    </div>
  )
}
