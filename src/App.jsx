import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProjectProvider, useProject } from './context/ProjectContext'
import { DataProvider, useData } from './context/DataContext'
import { ThemeProvider } from './context/ThemeContext'
import { TierProvider, useTier } from './context/TierContext'
import AuthScreen from './components/AuthScreen'
import LandingPage from './components/LandingPage'
import InstantDashboard from './components/InstantDashboard'
import HomeScreen from './components/HomeScreen'
import ProjectWizard from './components/ProjectWizard'
import FileUpload from './components/FileUpload'
import ColumnTagger from './components/ColumnTagger'
import Dashboard from './components/Dashboard'
import GoogleSheetsPicker from './components/GoogleSheetsPicker'
import AllChats from './components/AllChats'
import AllInsights from './components/AllInsights'
import UserProfile from './components/UserProfile'
import OnboardingOverlay from './components/OnboardingOverlay'
import { ToastProvider } from './components/Toast'
import { Loader2 } from 'lucide-react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const REDIRECT_URI = `${window.location.origin}/auth/callback`
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly'

function saveGoogleToken(token) { try { localStorage.setItem('nb_google_token', token) } catch {} }
function loadGoogleToken() { try { return localStorage.getItem('nb_google_token') } catch { return null } }
function clearGoogleToken() { try { localStorage.removeItem('nb_google_token') } catch {} }

function GoogleAuthCallback({ onToken, onError }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    if (error) { onError(error === 'access_denied' ? 'Access was denied.' : error); window.history.replaceState({}, '', '/'); return }
    if (code) {
      fetch('/api/google-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }) })
        .then(r => r.json()).then(d => {
          if (d.error) onError(d.error)
          else {
            // Store refresh token for auto-refresh
            if (d.refresh_token) {
              try { localStorage.setItem('nb_google_refresh_token', d.refresh_token) } catch {}
            }
            onToken(d.access_token)
          }
        }).catch(e => onError(e.message))
    }
    window.history.replaceState({}, '', '/')
  }, [])
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse" style={{ background: 'var(--border-accent)' }}>
          <span style={{ fontSize: 28, fontWeight: 800, fontStyle: "italic", fontFamily: "Georgia,serif", background: "linear-gradient(135deg,#38bdf8,#0c1425)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>µ</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Connecting to Google Sheets...</p>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, logout, loading: authLoading } = useAuth()
  const { activeProject, activeProjectId, loading: projectsLoading, projectLoading, selectProject } = useProject()
  const { step, setStep, activeTab, setActiveTab, confirmTagging, clearAll, goHome, openProject } = useData()
  const { profile, loading: tierLoading } = useTier()

  const [googleToken, setGoogleToken] = useState(loadGoogleToken)
  const [showSheetsPicker, setShowSheetsPicker] = useState(false)
  const [showProjectWizard, setShowProjectWizard] = useState(false)
  const [showAllChats, setShowAllChats] = useState(false)
  const [showAllInsights, setShowAllInsights] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingConversationId, setPendingConversationId] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Show onboarding for new users
  useEffect(() => {
    if (user && profile && !profile.onboarding_completed && !tierLoading) {
      setShowOnboarding(true)
    }
  }, [user, profile, tierLoading])

  const isGoogleCallback = window.location.pathname === '/auth/callback'

  // On refresh: if step is dashboard but no project loaded, restore last project
  useEffect(() => {
    if (user && !projectsLoading && step === 'dashboard' && !activeProjectId) {
      const savedProjectId = localStorage.getItem('nb_active_project')
      if (savedProjectId) {
        selectProject(savedProjectId)
        setActiveTab('overview')
      } else {
        goHome()
      }
    }
  }, [user, projectsLoading, step, activeProjectId])

  useEffect(() => {
    const handler = () => {
      if (googleToken) { setShowSheetsPicker(true); setShowProjectWizard(false) }
      else if (GOOGLE_CLIENT_ID) {
        localStorage.setItem('nb_pending_sheets', '1')
        const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: SCOPES, access_type: 'offline', prompt: 'consent' })
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
      }
    }
    window.addEventListener('nb-open-sheets', handler)
    return () => window.removeEventListener('nb-open-sheets', handler)
  }, [googleToken])

  // After Google OAuth callback sets the token, auto-show the sheets picker
  useEffect(() => {
    if (googleToken && !showSheetsPicker) {
      // Check if we just came back from OAuth (token freshly set)
      const pending = localStorage.getItem('nb_pending_sheets')
      if (pending) {
        localStorage.removeItem('nb_pending_sheets')
        setShowSheetsPicker(true)
        setShowProjectWizard(false)
      }
    }
  }, [googleToken])

  const handleGoogleToken = (token) => {
    setGoogleToken(token)
    saveGoogleToken(token)
    // Auto-open sheets picker after OAuth completes
    setShowSheetsPicker(true)
    setShowProjectWizard(false)
  }

  const handleLogout = () => { clearAll(); clearGoogleToken(); selectProject(null); logout() }

  const handleOpenProject = async (projectId, tab, conversationId) => {
    await selectProject(projectId)
    setShowProjectWizard(false)
    setShowAllChats(false)
    setShowAllInsights(false)
    // Map old tab IDs to new unified tabs
    const tabMap = { ask: 'ai', insights: 'ai', charts: 'overview' }
    // Default to overview unless a specific tab was requested (e.g. from All Chats/Insights)
    setActiveTab(tab ? (tabMap[tab] || tab) : 'overview')
    setPendingConversationId(conversationId || null)
    openProject()
  }

  const handleNewProject = () => { setShowProjectWizard(true) }

  // Listen for hash changes (login/signup links from landing page) — must be above early returns
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (isGoogleCallback) return <GoogleAuthCallback onToken={handleGoogleToken} onError={e => console.error('Google auth error:', e)} />

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse" style={{ background: 'var(--border-accent)' }}>
          <span style={{ fontSize: 22, fontWeight: 800, fontStyle: "italic", fontFamily: "Georgia,serif", background: "linear-gradient(135deg,#38bdf8,#0c1425)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>µ</span>
        </div>
      </div>
    )
  }

  if (!user) {
    if (hash === '#login' || hash === '#signup') return <AuthScreen />
    return <LandingPage />
  }

  // Onboarding overlay for new users
  const onboardingOverlay = showOnboarding ? <OnboardingOverlay onComplete={() => setShowOnboarding(false)} /> : null

  if (projectsLoading || (step === 'dashboard' && !activeProject && projectLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading your projects...</p>
        </div>
      </div>
    )
  }

  if (showProjectWizard) {
    return <ProjectWizard onComplete={() => setShowProjectWizard(false)} onCancel={() => setShowProjectWizard(false)} />
  }

  if (showSheetsPicker && googleToken) {
    return <GoogleSheetsPicker accessToken={googleToken} onBack={() => setShowSheetsPicker(false)} onDone={() => setShowSheetsPicker(false)} />
  }

  // All Chats page
  if (showAllChats) {
    return <AllChats onBack={() => setShowAllChats(false)} onOpenProject={handleOpenProject} />
  }

  // All Insights page
  if (showAllInsights) {
    return <AllInsights onBack={() => setShowAllInsights(false)} onOpenProject={handleOpenProject} />
  }

  // Settings page (standalone from home)
  if (showSettings) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setShowSettings(false)} className="p-2 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
          </div>
          <UserProfile />
        </div>
      </div>
    )
  }

  // Home screen
  if (step === 'home') {
    return (
      <>
        {onboardingOverlay}
        <HomeScreen
          onOpenProject={handleOpenProject}
          onNewProject={handleNewProject}
          onShowChats={() => setShowAllChats(true)}
          onShowInsights={() => setShowAllInsights(true)}
          onSettings={() => setShowSettings(true)}
        />
      </>
    )
  }

  if (step === 'tag') return <ColumnTagger onConfirm={confirmTagging} />
  if (step === 'upload') return <FileUpload />
  
  // Building step — auto-classifying and saving dataset
  if (step === 'building') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(37,99,235,0.15))' }}>
            <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"/></svg>
          </div>
          <h2 className="text-lg font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Building your dashboard</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>AI is classifying your columns and setting up charts...</p>
        </div>
      </div>
    )
  }

  // Dashboard
  if (step === 'dashboard' && activeProject) {
    return (
      <Dashboard
        user={user}
        onLogout={handleLogout}
        onNewProject={handleNewProject}
        onGoHome={goHome}
        initialConversationId={pendingConversationId}
        onConversationConsumed={() => setPendingConversationId(null)}
      />
    )
  }

  // Fallback
  return (
    <HomeScreen
      onOpenProject={handleOpenProject}
      onNewProject={handleNewProject}
      onShowChats={() => setShowAllChats(true)}
      onShowInsights={() => setShowAllInsights(true)}
      onSettings={() => setShowSettings(true)}
    />
  )
}

export default function App() {
  // Instant tool — no login required, standalone page
  if (window.location.pathname === '/instant') {
    return <ThemeProvider><InstantDashboard /></ThemeProvider>
  }

  return (
    <ThemeProvider>
      <ToastProvider>
      <AuthProvider>
        <TierProvider>
        <ProjectProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </ProjectProvider>
        </TierProvider>
      </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
