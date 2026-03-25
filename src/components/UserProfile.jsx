import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTier } from '../context/TierContext'
import { supabase } from '../lib/supabase'
import { TIER_CONFIG, TIER_ORDER } from '../lib/tierConfig'
import { User, Mail, Building2, Camera, Save, Loader2, CheckCircle, Sun, Moon, Monitor, Crown, Shield, Zap, Lock, Upload, Trash2, FileText, Sparkles } from 'lucide-react'
import TeamManager from './TeamManager'

export default function UserProfile() {
  const { user, updateProfile, logout } = useAuth()
  const { mode, setTheme } = useTheme()
  const { tier, config, profile, can, remaining, limitLabel, updateProfileField } = useTier()

  const [name, setName] = useState(user?.name || '')
  const [company, setCompany] = useState(user?.company || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  // White-label fields
  const [customLogo, setCustomLogo] = useState(profile?.custom_logo_url || '')
  const [customCompany, setCustomCompany] = useState(profile?.custom_company_name || '')

  // Playbook
  const [playbook, setPlaybook] = useState(profile?.custom_ai_playbook || '')
  const [playbookSaving, setPlaybookSaving] = useState(false)
  const [playbookSaved, setPlaybookSaved] = useState(false)

  useEffect(() => {
    if (user) { setName(user.name || ''); setCompany(user.company || ''); setAvatarUrl(user.avatar_url || '') }
  }, [user])

  useEffect(() => {
    if (profile) {
      setCustomLogo(profile.custom_logo_url || '')
      setCustomCompany(profile.custom_company_name || '')
      setPlaybook(profile.custom_ai_playbook || '')
    }
  }, [profile])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null); setSaved(false)
    try {
      await updateProfile({ name, company, avatar_url: avatarUrl || null })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleSaveWhiteLabel = async () => {
    setSaving(true); setError(null)
    try {
      await updateProfileField({ custom_logo_url: customLogo || null, custom_company_name: customCompany || null })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Logo must be under 5MB'); return }

    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/logo.${ext}`
      const { error: uploadErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      setCustomLogo(publicUrl)
      await updateProfileField({ custom_logo_url: publicUrl })
    } catch (err) { setError(err.message || 'Failed to upload logo') }
  }

  const handleSavePlaybook = async () => {
    setPlaybookSaving(true)
    try {
      await updateProfileField({ custom_ai_playbook: playbook || null })
      setPlaybookSaved(true); setTimeout(() => setPlaybookSaved(false), 3000)
    } catch (err) { setError(err.message) } finally { setPlaybookSaving(false) }
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
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" style={{ border: '2px solid var(--border)' }} />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-display font-bold text-white" style={{ background: 'var(--accent)' }}>{initials}</div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <Camera className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
            <div className="flex-1">
              <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar URL (optional)" className="w-full px-3 py-2 text-sm rounded-lg nb-input" />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Paste a URL to your profile picture</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}><User className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> Full name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2.5 text-sm rounded-xl nb-input" />
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}><Mail className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> Email</label>
            <div className="flex items-center gap-2">
              <input type="email" value={user?.email || ''} disabled className="flex-1 px-3 py-2.5 text-sm rounded-xl cursor-not-allowed" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-muted)' }} />
              {user?.email_verified && <span className="flex items-center gap-1 text-xs text-emerald-500 shrink-0"><CheckCircle className="w-3.5 h-3.5" /> Verified</span>}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}><Building2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> Company</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company name" className="w-full px-3 py-2.5 text-sm rounded-xl nb-input" />
          </div>
          <div className="flex items-center justify-end pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><CheckCircle className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save changes</>}
            </button>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}
        </form>
      </div>

      {/* Appearance */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="text-base font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</h3>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(opt => (
              <button key={opt.value} onClick={() => setTheme(opt.value)} className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                style={{ background: mode === opt.value ? 'var(--border-accent)' : 'var(--bg-overlay)', border: mode === opt.value ? '2px solid var(--accent)' : '2px solid transparent' }}>
                <opt.icon className="w-5 h-5" style={{ color: mode === opt.value ? 'var(--accent)' : 'var(--text-muted)' }} />
                <span className="text-xs font-medium" style={{ color: mode === opt.value ? 'var(--accent)' : 'var(--text-secondary)' }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plan & Usage */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="text-base font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Plan & Usage</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your subscription and usage this month</p>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          {/* Current plan badge */}
          <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1c1917, #292524)' }}>
                <Crown className="w-5 h-5" style={{ color: '#c9956b' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{config.label} Plan</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{config.price > 0 ? `$${config.price}/month` : 'Free'}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'linear-gradient(135deg, #1c1917, #292524)', color: '#d4a574' }}>Active</span>
          </div>

          {/* Usage meters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Ask AI', used: profile?.ai_queries_used || 0, limit: limitLabel('askAiQueries') },
              { label: 'Insights', used: profile?.insights_runs_used || 0, limit: limitLabel('insightsRuns') },
              { label: 'Recommendations', used: profile?.recommendations_runs_used || 0, limit: limitLabel('recommendationsRuns') },
              { label: 'Projects', used: '—', limit: limitLabel('maxProjects') },
            ].map(m => (
              <div key={m.label} className="p-3 rounded-xl text-center" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{m.used}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>of {m.limit}</p>
              </div>
            ))}
          </div>

          {/* Upgrade prompt for non-agency */}
          {tier !== 'agency' && (
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, rgba(28,25,23,0.03), rgba(41,37,36,0.06))', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Need more? Upgrade your plan for higher limits and premium features.</p>
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-semibold text-white" style={{ background: 'var(--accent)' }}>
                <Zap className="w-3 h-3" /> View Plans
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feature 2: White-Label (Agency+) */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-display font-semibold" style={{ color: 'var(--text-primary)' }}>White Label</h3>
            {!can('whiteLabel') && <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: 'linear-gradient(135deg, #1c1917, #292524)', color: '#d4a574' }}><Lock className="w-2.5 h-2.5" /> Agency+</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your branding on exported reports</p>
        </div>
        <div className={`p-4 sm:p-6 space-y-4 ${!can('whiteLabel') ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Logo upload */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Upload className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> Company logo
            </label>
            <div className="flex items-center gap-3">
              {customLogo ? (
                <div className="relative">
                  <img src={customLogo} alt="Logo" className="h-12 max-w-[160px] object-contain rounded-lg" style={{ border: '1px solid var(--border)' }} />
                  <button onClick={() => { setCustomLogo(''); updateProfileField({ custom_logo_url: null }) }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer text-xs font-medium transition-all hover:opacity-80" style={{ background: 'var(--bg-overlay)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  <Upload className="w-4 h-4" /> Upload logo (PNG, JPG, max 5MB)
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
          {/* Company name override */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> Brand name on reports
            </label>
            <input type="text" value={customCompany} onChange={(e) => setCustomCompany(e.target.value)} placeholder="Your Agency Name (replaces Northern Bird on exports)"
              className="w-full px-3 py-2.5 text-sm rounded-xl nb-input" />
          </div>
          <div className="flex justify-end">
            <button onClick={handleSaveWhiteLabel} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              <Save className="w-4 h-4" /> Save branding
            </button>
          </div>
        </div>
      </div>

      {/* Feature 1: Custom AI Playbook (Agency+) */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-display font-semibold" style={{ color: 'var(--text-primary)' }}>AI Playbook</h3>
            {!can('customPlaybook') && <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: 'linear-gradient(135deg, #1c1917, #292524)', color: '#d4a574' }}><Lock className="w-2.5 h-2.5" /> Agency+</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Custom rules that guide how AI generates recommendations for your data</p>
        </div>
        <div className={`p-4 sm:p-6 space-y-4 ${!can('customPlaybook') ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <textarea value={playbook} onChange={(e) => setPlaybook(e.target.value)} rows={8}
              placeholder={"Paste your recommendation framework here. For example:\n\n- Always recommend budget reallocation when CPA exceeds $50\n- Flag any campaign with CTR below 1% as underperforming\n- Prioritize recommendations for campaigns with highest spend\n- Use our agency's 80/20 rule: focus 80% of recommendations on the top 20% of spend"}
              className="w-full px-3 py-2.5 text-sm rounded-xl nb-input resize-y font-mono"
              style={{ minHeight: '160px' }} />
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              <Sparkles className="w-3 h-3 inline -mt-0.5 mr-0.5" /> These rules are appended to the AI's instructions when generating Recommendations. The more specific, the better.
            </p>
          </div>
          <div className="flex justify-end">
            <button onClick={handleSavePlaybook} disabled={playbookSaving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {playbookSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : playbookSaved ? <><CheckCircle className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save playbook</>}
            </button>
          </div>
        </div>
      </div>

      {/* Feature 4: Team Management */}
      {config.teamSeats > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100">
            <h3 className="text-base font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Team</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Invite team members to collaborate on projects</p>
          </div>
          <div className="p-4 sm:p-6">
            <TeamManager />
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-600 font-medium">Sign out of your account</button>
        </div>
      </div>
    </div>
  )
}
