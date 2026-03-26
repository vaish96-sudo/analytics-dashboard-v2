import React, { useState, useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import { useProject } from '../context/ProjectContext'
import { useTheme } from '../context/ThemeContext'
import { exportDashboardReport } from '../utils/exportService'
import KPICards, { useKPIData, SingleKPICard } from './KPICards'
import AutoCharts, { ChartCard, useAutoChartData } from './AutoCharts'
import DataTable from './DataTable'
import ReportBuilder from './ReportBuilder'
import AIHub from './AIHub'
import AIChartBuilder from './AIChartBuilder'
import CustomMetrics from './CustomMetrics'
import GlobalFilterBar from './GlobalFilterBar'
import DraggableWidgets from './DraggableWidgets'
import UserProfile from './UserProfile'
import ScheduledReports from './ScheduledReports'
import TierBadge from './TierBadge'
import LogoMark from './LogoMark'
import InsightsPreview from './InsightsPreview'
import {
  LayoutDashboard, Table2, Wand2, Sparkles,
  FileSpreadsheet, Upload, ChevronRight, Settings, Menu, X, ChevronDown,
  Plus, Trash2, LogOut, Home, Sun, Moon, Monitor, FileDown, Crown, Loader2, FolderOpen, Users
} from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'builder', label: 'Builder', icon: Wand2 },
  { id: 'data', label: 'Data', icon: Table2 },
  { id: 'ai', label: 'AI', icon: Sparkles },
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

function ThemeToggleFull() {
  const { mode, setTheme } = useTheme()
  const opts = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]
  return (
    <div className="flex items-center rounded-lg p-0.5" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-light)' }}>
      {opts.map(o => (
        <button key={o.value} onClick={() => setTheme(o.value)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
          style={{
            background: mode === o.value ? 'var(--bg-surface)' : 'transparent',
            color: mode === o.value ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: mode === o.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}>
          <o.icon className="w-3 h-3" />{o.label}
        </button>
      ))}
    </div>
  )
}

function ProjectSwitcher({ onGoHome }) {
  const { datasets, activeDatasetId, switchDataset, removeDataset, setStep } = useData()
  const { projects, activeProject, selectProject, canEdit } = useProject()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const active = datasets.find(d => d.id === activeDatasetId)

  const handleSelectProject = async (projectId) => {
    setOpen(false)
    if (projectId === activeProject?.id) return
    await selectProject(projectId)
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left nb-input">
        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{active?.fileName || 'Select dataset'}</span>
        <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-lg z-50 overflow-hidden nb-card" style={{ width: '240px' }}>
          <div className="max-h-64 overflow-y-auto">
            {/* Current project datasets */}
            {datasets.length > 0 && (
              <div style={{ borderBottom: '1px solid var(--border-light)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider px-3 pt-2 pb-1" style={{ color: 'var(--text-muted)' }}>
                  {activeProject?.name || 'Current project'}
                </p>
                {datasets.map(ds => (
                  <div key={ds.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer" style={{ color: ds.id === activeDatasetId ? 'var(--accent)' : 'var(--text-secondary)', background: ds.id === activeDatasetId ? 'var(--border-accent)' : 'transparent' }}>
                    <button onClick={() => { switchDataset(ds.id); setOpen(false) }} className="flex-1 text-left truncate">{ds.fileName}</button>
                    {canEdit && datasets.length > 1 && <button onClick={(e) => { e.stopPropagation(); removeDataset(ds.id) }} className="p-1 shrink-0 hover:text-red-500" style={{ color: 'var(--text-muted)' }}><Trash2 className="w-3 h-3" /></button>}
                  </div>
                ))}
              </div>
            )}
            {/* Other projects */}
            {projects.filter(p => p.id !== activeProject?.id).length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider px-3 pt-2 pb-1" style={{ color: 'var(--text-muted)' }}>
                  Switch project
                </p>
                {projects.filter(p => p.id !== activeProject?.id).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <FolderOpen className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] shrink-0 ml-auto" style={{ color: 'var(--text-muted)' }}>{p.datasets?.length || 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setStep('upload'); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs" style={{ color: 'var(--accent)', borderTop: '1px solid var(--border)' }}>
            <Plus className="w-3 h-3" /> Add new dataset
          </button>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ user, onLogout, onNewProject, onGoHome, initialConversationId, onConversationConsumed }) {
  const { rowCount, columnsByType, setStep, editSchema, datasets, activeTab, setActiveTab, rawData, schema, fileName, globalFilters, insights, reportBuilderState } = useData()
  const { activeProject, projects, selectProject, canEdit, isSharedView } = useProject()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const menuRef = useRef(null)

  // When navigating from AllChats with a specific conversation
  useEffect(() => {
    if (initialConversationId) {
      setActiveConversationId(initialConversationId)
      if (onConversationConsumed) onConversationConsumed()
    }
  }, [initialConversationId])

  useEffect(() => { window.scrollTo(0, 0) }, [])
  useEffect(() => { setMobileMenuOpen(false) }, [activeTab])
  useEffect(() => {
    if (!mobileMenuOpen) return
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMobileMenuOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [mobileMenuOpen])

  const showFilterBar = activeTab === 'overview'

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
        columnsByType,
        reportBuilderState,
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
                <TierBadge />
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

        {datasets.length > 0 && <div className="p-3" style={{ borderBottom: '1px solid var(--border-light)' }}><ProjectSwitcher onGoHome={onGoHome} /></div>}

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
          <ThemeToggleFull />
          <div className="flex items-center gap-3 text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            <span>{rowCount.toLocaleString()} rows</span><span>·</span>
            <span>{columnsByType.metrics.length}M {columnsByType.dimensions.length}D</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={editSchema} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
              <Settings className="w-3 h-3" />Adjust columns
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
              <button onClick={onLogout} className="flex items-center gap-1.5 p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[10px]">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 px-4 py-3 nb-sidebar" ref={menuRef}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark className="w-7 h-7 object-contain" />
            <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
            <TierBadge />
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
            {datasets.length > 1 && <div className="p-3" style={{ borderBottom: '1px solid var(--border-light)' }}><ProjectSwitcher onGoHome={onGoHome} /></div>}
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
        <div className={`p-4 lg:p-6 mx-auto ${activeTab === 'ai' ? 'max-w-[1800px]' : 'max-w-[1400px]'}`}>
          <div className="mb-4 lg:mb-6">
            <div className="hidden lg:flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              <button onClick={onGoHome} className="hover:underline">Home</button>
              <ChevronRight className="w-3 h-3" />
              <span style={{ color: 'var(--text-secondary)' }}>{activeProject?.name}</span>
              <ChevronRight className="w-3 h-3" />
              <span style={{ color: 'var(--text-secondary)' }}>{TABS.find(t => t.id === activeTab)?.label}</span>
            </div>
            {activeTab === 'ai' ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(37,99,235,0.15))' }}>
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>AI Assistant</h1>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Chat, analyze, and get recommendations powered by Claude</p>
                </div>
              </div>
            ) : (
              <h1 className="text-xl lg:text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                {TABS.find(t => t.id === activeTab)?.label}
              </h1>
            )}
          </div>
          {isSharedView && (
            <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg text-xs"
              style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}>
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Shared project{!canEdit ? ' — view only' : ''}</span>
            </div>
          )}
          {showFilterBar && <GlobalFilterBar />}
          <div className="space-y-4 lg:space-y-6">
            {activeTab === 'overview' && <OverviewGrid />}
            {activeTab === 'builder' && <><CustomMetrics /><ReportBuilder /></>}
            {activeTab === 'data' && <DataTable />}
            {activeTab === 'ai' && <AIHub conversationId={activeConversationId} onConversationChange={setActiveConversationId} />}
            {activeTab === 'settings' && <><UserProfile /><ScheduledReports /></>}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Tabs */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 nb-sidebar" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center justify-around px-1 py-1.5">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-0 flex-1 transition-colors"
              style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)' }}>
              <tab.icon className="w-5 h-5" /><span className="text-[10px] font-medium truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Overview tab: individual KPI cards + individual charts in one draggable grid */
function OverviewGrid() {
  const kpis = useKPIData()
  const chartData = useAutoChartData()
  const { widgetOrder, updateDatasetState } = useData()
  const hiddenWidgets = Array.isArray(widgetOrder) ? [] : (widgetOrder?.hidden || [])

  const toggleHide = (widgetId) => {
    const current = hiddenWidgets || []
    const next = current.includes(widgetId) ? current.filter(id => id !== widgetId) : [...current, widgetId]
    const orderArr = Array.isArray(widgetOrder) ? widgetOrder : (widgetOrder?.order || null)
    updateDatasetState('widget_order', { order: orderArr, hidden: next })
  }

  const isHidden = (id) => hiddenWidgets.includes(id)

  // Build friendly label for hidden widget restore buttons
  const friendlyName = (id) => {
    if (id.startsWith('kpi-')) return id.replace('kpi-', '')
    if (id.startsWith('chart-')) return `Chart ${parseInt(id.replace('chart-', '')) + 1}`
    if (id === 'ai-chart-builder') return 'AI Visual Builder'
    return id
  }

  return (
    <>
      <InsightsPreview />
      {hiddenWidgets.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>Hidden:</span>
          {hiddenWidgets.map(id => (
            <button key={id} onClick={() => toggleHide(id)}
              className="text-[10px] px-2 py-1 rounded-lg transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              + {friendlyName(id)}
            </button>
          ))}
        </div>
      )}
      <DraggableWidgets storageKey="widget_order" onHide={toggleHide}>
        {/* Individual KPI cards */}
        {kpis.map((kpi, i) => (
          !isHidden(`kpi-${kpi.col}`) && (
            <div key={`kpi-${kpi.col}`} data-widget-id={`kpi-${kpi.col}`} data-widget-size="small">
              <SingleKPICard kpi={kpi} index={i} />
            </div>
          )
        )).filter(Boolean)}

        {/* AI Chart Builder */}
        {!isHidden('ai-chart-builder') && (
          <div data-widget-id="ai-chart-builder" data-widget-size="large"><AIChartBuilder /></div>
        )}

        {/* Individual auto-generated charts */}
        {chartData.charts.map((ch, i) => (
          !isHidden(`chart-${i}`) && (
            <div key={`chart-${chartData.activeDatasetId}-${i}`} data-widget-id={`chart-${i}`} data-widget-size="medium">
              <ChartCard
                index={i}
                defaultType={ch.type}
                defaultDim={ch.dim}
                defaultMet={ch.met}
                savedState={chartData.chartsState[i]}
                onStateChange={chartData.handleChartStateChange}
                onBarClick={chartData.handleBarClick}
                globalFilters={chartData.globalFilters}
                schema={chartData.schema}
                columnsByType={chartData.columnsByType}
                aggregate={chartData.aggregate}
              />
            </div>
          )
        )).filter(Boolean)}
      </DraggableWidgets>
    </>
  )
}
