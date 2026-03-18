import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProjectProvider, useProject } from './context/ProjectContext'
import { DataProvider, useData } from './context/DataContext'
import { ThemeProvider } from './context/ThemeContext'
import AuthScreen from './components/AuthScreen'
import HomeScreen from './components/HomeScreen'
import ProjectWizard from './components/ProjectWizard'
import FileUpload from './components/FileUpload'
import ColumnTagger from './components/ColumnTagger'
import Dashboard from './components/Dashboard'
import GoogleSheetsPicker from './components/GoogleSheetsPicker'
import AllChats from './components/AllChats'
import AllInsights from './components/AllInsights'
import UserProfile from './components/UserProfile'
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
        .then(r => r.json()).then(d => { if (d.error) onError(d.error); else onToken(d.access_token) }).catch(e => onError(e.message))
    }
    window.history.replaceState({}, '', '/')
  }, [])
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse" style={{ background: 'var(--border-accent)' }}>
          <img src="/logo_mark.png" alt="NB" className="w-8 h-8 object-contain" />
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

  const [googleToken, setGoogleToken] = useState(loadGoogleToken)
  const [showSheetsPicker, setShowSheetsPicker] = useState(false)
  const [showProjectWizard, setShowProjectWizard] = useState(false)
  const [showAllChats, setShowAllChats] = useState(false)
  const [showAllInsights, setShowAllInsights] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingConversationId, setPendingConversationId] = useState(null)

  const isGoogleCallback = window.location.pathname === '/auth/callback'

  // On refresh: if step is dashboard but no project loaded, restore last project
  useEffect(() => {
    if (user && !projectsLoading && step === 'dashboard' && !activeProjectId) {
      const savedProjectId = localStorage.getItem('nb_active_project')
      if (savedProjectId) {
        selectProject(savedProjectId)
      } else {
        goHome()
      }
    }
  }, [user, projectsLoading, step, activeProjectId])

  useEffect(() => {
    const handler = () => {
      if (googleToken) { setShowSheetsPicker(true) }
      else if (GOOGLE_CLIENT_ID) {
        const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: SCOPES, access_type: 'offline', prompt: 'consent' })
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
      }
    }
    window.addEventListener('nb-open-sheets', handler)
    return () => window.removeEventListener('nb-open-sheets', handler)
  }, [googleToken])

  useEffect(() => {
    if (showSheetsPicker && step !== 'upload' && step !== 'tag') setShowSheetsPicker(false)
  }, [step, showSheetsPicker])

  const handleGoogleToken = (token) => { setGoogleToken(token); saveGoogleToken(token) }

  const handleLogout = () => { clearAll(); clearGoogleToken(); selectProject(null); logout() }

  const handleOpenProject = async (projectId, tab, conversationId) => {
    await selectProject(projectId)
    setShowProjectWizard(false)
    setShowAllChats(false)
    setShowAllInsights(false)
    // Map old tab IDs to new unified tabs
    const tabMap = { ask: 'ai', insights: 'ai', charts: 'overview' }
    if (tab) setActiveTab(tabMap[tab] || tab)
    setPendingConversationId(conversationId || null)
    openProject()
  }

  const handleNewProject = () => { setShowProjectWizard(true) }

  if (isGoogleCallback) return <GoogleAuthCallback onToken={handleGoogleToken} onError={e => console.error('Google auth error:', e)} />

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse" style={{ background: 'var(--border-accent)' }}>
          <img src="/logo_mark.png" alt="NB" className="w-6 h-6 object-contain" />
        </div>
      </div>
    )
  }

  if (!user) return <AuthScreen />

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
    return <GoogleSheetsPicker accessToken={googleToken} onBack={() => setShowSheetsPicker(false)} />
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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
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
      <HomeScreen
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
        onShowChats={() => setShowAllChats(true)}
        onShowInsights={() => setShowAllInsights(true)}
        onSettings={() => setShowSettings(true)}
      />
    )
  }

  if (step === 'tag') return <ColumnTagger onConfirm={confirmTagging} />
  if (step === 'upload') return <FileUpload />

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
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
