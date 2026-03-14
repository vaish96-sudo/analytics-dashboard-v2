import React, { useState, useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import { useProject } from '../context/ProjectContext'
import { useTheme } from '../context/ThemeContext'
import { exportDashboardReport } from '../utils/exportService'
import KPICards from './KPICards'
import AutoCharts from './AutoCharts'
import DataTable from './DataTable'
import ReportBuilder from './ReportBuilder'
import AskAI from './AskAI'
import AIInsights from './AIInsights'
import GlobalFilterBar from './GlobalFilterBar'
import UserProfile from './UserProfile'
import LogoMark from './LogoMark'
import {
  LayoutDashboard, BarChart3, Table2, Wand2, MessageSquare, Lightbulb,
  FileSpreadsheet, Upload, ChevronRight, Settings, Menu, X, ChevronDown,
  Plus, Trash2, LogOut, Home, Sun, Moon, Monitor, FileDown, Crown, Loader2
} from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'builder', label: 'Builder', icon: Wand2 },
  { id: 'data', label: 'Data', icon: Table2 },
  { id: 'ask', label: 'Ask AI', icon: MessageSquare },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function ThemeToggleSmall() {
  const { mode, setTheme } = useTheme()
  const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light'
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
  return (
    <button onClick={() => setTheme(next)} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }} title={`Theme: ${mode}`}>
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-wide"
      style={{ background: 'linear-gradient(135deg, #1c1917, #292524)', color: '#d4a574', border: '1px solid rgba(212, 165, 116, 0.2)', letterSpacing: '0.05em' }}>
      <Crown className="w-2.5 h-2.5" style={{ color: '#c9956b' }} />Pro
    </span>
  )
}

function DatasetSwitcher() {
  const { datasets, activeDatasetId, switchDataset, removeDataset, setStep } = useData()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const active = datasets.find(d => d.id === activeDatasetId)
  if (datasets.length === 0) return null
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left nb-input">
        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{active?.fileName || 'Select dataset'}</span>
        <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-lg z-50 overflow-hidden nb-card">
          <div className="max-h-48 overflow-y-auto">
            {datasets.map(ds => (
              <div key={ds.id} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer" style={{ color: ds.id === activeDatasetId ? 'var(--accent)' : 'var(--text-secondary)', background: ds.id === activeDatasetId ? 'var(--border-accent)' : 'transparent' }}>
                <button onClick={() => { switchDataset(ds.id); setOpen(false) }} className="flex-1 text-left truncate">{ds.fileName}</button>
                {datasets.length > 1 && <button onClick={(e) => { e.stopPropagation(); removeDataset(ds.id) }} className="p-1 shrink-0 hover:text-red-500" style={{ color: 'var(--text-muted)' }}><Trash2 className="w-3 h-3" /></button>}
              </div>
            ))}
          </div>
          <button onClick={() => { setStep('upload'); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs" style={{ color: 'var(--accent)', borderTop: '1px solid var(--border)' }}>
            <Plus className="w-3 h-3" /> Add new dataset
          </button>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ user, onLogout, onNewProject, onGoHome }) {
  const { rowCount, columnsByType, setStep, datasets, activeTab, setActiveTab, rawData, schema, fileName, globalFilters, insights } = useData()
  const { activeProject } = useProject()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => { window.scrollTo(0, 0) }, [])
  useEffect(() => { setMobileMenuOpen(false) }, [activeTab])
  useEffect(() => {
    if (!mobileMenuOpen) return
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMobileMenuOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [mobileMenuOpen])

  const showFilterBar = activeTab === 'overview' || activeTab === 'charts'

  const handleExportReport = async () => {
    setExporting(true)
    try {
      await exportDashboardReport({
        projectName: activeProject?.name,
        fileName,
        rowCount,
        schema,
        rawData,
        globalFilters,
        insights,
      })
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--bg-primary)' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col fixed h-full z-40 nb-sidebar">
        <div className="p-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-9 h-9 object-contain" alt="Northern Bird" />
            <div>
              <span className="text-sm font-display font-bold block leading-none" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-display font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--accent)' }}>Analytics</span>
                <PremiumBadge />
              </div>
            </div>
          </div>
        </div>

        {/* Home button */}
        <div className="p-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <button onClick={onGoHome}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Home className="w-3.5 h-3.5" /> Home
          </button>
          {activeProject && (
            <p className="text-[10px] font-medium mt-2 px-3 truncate" style={{ color: 'var(--accent)' }}>{activeProject.name}</p>
          )}
        </div>

        {datasets.length > 0 && <div className="p-3" style={{ borderBottom: '1px solid var(--border-light)' }}><DatasetSwitcher /></div>}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                background: activeTab === tab.id ? 'var(--border-accent)' : 'transparent',
                border: activeTab === tab.id ? '1px solid var(--border-accent)' : '1px solid transparent',
              }}>
              <tab.icon className="w-4 h-4 shrink-0" /><span>{tab.label}</span>
            </button>
          ))}

          {/* Export Report Button */}
          <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
            <button onClick={handleExportReport} disabled={exporting}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-sm disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(139,92,246,0.08))',
                color: 'var(--accent)',
                border: '1px solid var(--border-accent)',
              }}>
              {exporting ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <FileDown className="w-4 h-4 shrink-0" />}
              <span>{exporting ? 'Exporting…' : 'Export report'}</span>
            </button>
          </div>
        </nav>

        <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{rowCount.toLocaleString()} rows</span><span>·</span>
            <span>{columnsByType.metrics.length}M {columnsByType.dimensions.length}D</span>
            <ThemeToggleSmall />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => setStep('tag')} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
              <Settings className="w-3 h-3" />Edit schema
            </button>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <button onClick={() => setStep('upload')} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
              <Upload className="w-3 h-3" />New file
            </button>
          </div>
          {user && (
            <div className="flex items-center gap-2.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'var(--accent)' }}>
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user.name || 'User'}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
              </div>
              <button onClick={onLogout} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 px-4 py-3 nb-sidebar" ref={menuRef}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark className="w-7 h-7 object-contain" alt="NB" />
            <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
            <PremiumBadge />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleExportReport} disabled={exporting} className="p-2" style={{ color: 'var(--accent)' }} title="Export report">
              {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
            </button>
            <button onClick={onGoHome} className="p-2" style={{ color: 'var(--text-muted)' }}><Home className="w-5 h-5" /></button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2" style={{ color: 'var(--text-muted)' }}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 shadow-lg animate-fade-in z-50 nb-card" style={{ borderTop: '1px solid var(--border)' }}>
            {user && (
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs" style={{ background: 'var(--accent)' }}>
                    {(user.name || user.email || '?')[0].toUpperCase()}
                  </div>
                  <span className="text-xs truncate max-w-[150px]" style={{ color: 'var(--text-secondary)' }}>{user.name || user.email}</span>
                </div>
                {onLogout && <button onClick={() => { setMobileMenuOpen(false); onLogout() }} className="flex items-center gap-1 text-xs text-red-500"><LogOut className="w-3 h-3" /> Sign out</button>}
              </div>
            )}
            {datasets.length > 1 && <div className="p-3" style={{ borderBottom: '1px solid var(--border-light)' }}><DatasetSwitcher /></div>}
            <div className="p-2">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <tab.icon className="w-4 h-4 shrink-0" /><span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto lg:ml-60 pb-20 lg:pb-0">
        <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
          <div className="mb-4 lg:mb-6">
            <div className="hidden lg:flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              <button onClick={onGoHome} className="hover:underline">Home</button>
              <ChevronRight className="w-3 h-3" />
              <span style={{ color: 'var(--text-secondary)' }}>{activeProject?.name}</span>
              <ChevronRight className="w-3 h-3" />
              <span style={{ color: 'var(--text-secondary)' }}>{TABS.find(t => t.id === activeTab)?.label}</span>
            </div>
            <h1 className="text-xl lg:text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </h1>
          </div>
          {showFilterBar && <GlobalFilterBar />}
          <div className="space-y-4 lg:space-y-6">
            {activeTab === 'overview' && <><KPICards /><AutoCharts /></>}
            {activeTab === 'charts' && <AutoCharts />}
            {activeTab === 'builder' && <ReportBuilder />}
            {activeTab === 'data' && <DataTable />}
            {activeTab === 'ask' && <AskAI conversationId={activeConversationId} onConversationChange={setActiveConversationId} />}
            {activeTab === 'insights' && <AIInsights />}
            {activeTab === 'settings' && <UserProfile />}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Tabs */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 nb-sidebar" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center justify-around px-1 py-1.5">
          {TABS.slice(0, 5).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-0 flex-1 transition-colors"
              style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)' }}>
              <tab.icon className="w-5 h-5" /><span className="text-[10px] font-medium truncate">{tab.label}</span>
            </button>
          ))}
          <button onClick={() => setActiveTab('insights')}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-0 flex-1 transition-colors"
            style={{ color: activeTab === 'insights' ? 'var(--accent)' : 'var(--text-muted)' }}>
            <Lightbulb className="w-5 h-5" /><span className="text-[10px] font-medium">Insights</span>
          </button>
        </div>
      </div>
    </div>
  )
}
