import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import LogoMark from './LogoMark'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { useTheme } from '../context/ThemeContext'
import { useTier } from '../context/TierContext'
import {
  FolderOpen, FolderPlus, Upload, FileSpreadsheet, Globe, LogOut,
  ChevronRight, Loader2, Search, Database, MessageSquare, Lightbulb, Sun, Moon, Monitor,
  Crown, Menu, X, User, Settings, Trash2, ChevronDown, Plus, Users, Building2,
  MoreHorizontal, Pencil, ArrowRightLeft, GripVertical
} from 'lucide-react'

// ─── Context Menu ───────────────────────────────────────────────
function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  // Adjust position to stay in viewport

  return (
    <div ref={ref} className="min-w-[160px] py-1 rounded-xl shadow-lg border animate-fade-in"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999, background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      {items.map((item, i) => item.separator ? (
        <div key={i} className="my-1" style={{ borderTop: '1px solid var(--border-light)' }} />
      ) : (
        <button key={i} onClick={() => { item.action(); onClose() }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors text-left ${item.danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : ''}`}
          style={item.danger ? {} : { color: 'var(--text-secondary)' }}
          onMouseEnter={e => { if (!item.danger) e.currentTarget.style.background = 'var(--bg-overlay)' }}
          onMouseLeave={e => { if (!item.danger) e.currentTarget.style.background = 'transparent' }}>
          {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0" />}
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── Inline Rename Input ────────────────────────────────────────
function InlineRename({ value, onSave, onCancel }) {
  const [text, setText] = useState(value)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  const save = () => { if (text.trim() && text.trim() !== value) onSave(text.trim()); else onCancel() }
  return (
    <input ref={ref} value={text} onChange={e => setText(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
      className="text-[11px] font-medium px-1 py-0.5 rounded border w-full"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)', color: 'var(--text-primary)', outline: 'none' }}
      onClick={e => e.stopPropagation()} />
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

const PROJECT_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500']
const FOLDER_COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6']

import TierBadge from './TierBadge'
import PendingInvites from './PendingInvites'

function ThemeToggle() {
  const { mode, setTheme } = useTheme()
  const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-overlay)' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => setTheme(opt.value)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all
            ${mode === opt.value ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:opacity-80'}`}
          style={{ color: mode === opt.value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <opt.icon className="w-3 h-3" />{opt.label}
        </button>
      ))}
    </div>
  )
}

export default function HomeScreen({ onOpenProject, onNewProject, onSettings, onShowChats, onShowInsights }) {
  const { user, logout } = useAuth()
  const { projects, sharedProjects, loading, deleteProject, renameProject, updateProjectClient, renameClient } = useProject()
  const { tier } = useTier()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [chatCount, setChatCount] = useState(null)
  const [insightCount, setInsightCount] = useState(null)
  const [expandedProjects, setExpandedProjects] = useState({})
  const [expandedClients, setExpandedClients] = useState({})
  const projectsRef = useRef(null)
  const menuRef = useRef(null)

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, items }
  // Inline rename state
  const [renamingProject, setRenamingProject] = useState(null) // project id
  const [renamingClient, setRenamingClient] = useState(null) // client name
  // Drag-and-drop state
  const [dragProjectId, setDragProjectId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // client name or '__personal__'

  const isAgency = tier === 'agency'

  const toggleProject = (id) => {
    setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleClient = (name) => {
    setExpandedClients(prev => ({ ...prev, [name]: !prev[name] }))
  }

  // Group projects by client_name for Agency tier
  const clientGroups = useMemo(() => {
    if (!isAgency) return null
    const groups = {}
    projects.forEach(p => {
      const client = p.client_name || 'Uncategorized'
      if (!groups[client]) groups[client] = []
      groups[client].push(p)
    })
    return groups
  }, [projects, isAgency])

  // Group shared projects by client_name
  const sharedClientGroups = useMemo(() => {
    if (!sharedProjects || sharedProjects.length === 0) return null
    const groups = {}
    sharedProjects.forEach(p => {
      const client = p.client_name || 'Uncategorized'
      if (!groups[client]) groups[client] = []
      groups[client].push(p)
    })
    return groups
  }, [sharedProjects])

  const userName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const initials = (user?.name || user?.email || '?')[0].toUpperCase()
  const totalDatasets = projects.reduce((sum, p) => sum + (p.datasets?.length || 0), 0)

  // Load chat and insight counts
  useEffect(() => {
    if (!user?.id) return
    import('../lib/projectService').then(ps => {
      ps.listAllConversations(user.id).then(c => setChatCount(c.length)).catch(() => setChatCount(0))
      ps.listAllInsights(user.id).then(data => {
        // Count projects that have insights, not individual insights
        setInsightCount(data.length)
      }).catch(() => setInsightCount(0))
    })
  }, [user?.id, projects])

  const filteredProjects = searchQuery
    ? projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects

  const allDatasets = projects.flatMap(p =>
    (p.datasets || []).map(ds => ({ ...ds, projectName: p.name, projectId: p.id }))
  )

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMobileMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [mobileMenuOpen])

  const scrollToProjects = () => {
    projectsRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCardClick = (type) => {
    if (type === 'projects') { setActiveView('projects'); scrollToProjects() }
    else if (type === 'datasets') { setActiveView('datasets'); scrollToProjects() }
    else if (type === 'chats' && typeof onShowChats === 'function') { onShowChats() }
    else if (type === 'insights' && typeof onShowInsights === 'function') { onShowInsights() }
  }

  const handleLogout = () => { setMobileMenuOpen(false); logout() }

  // ─── Context Menu Handlers ─────────────────────────────────
  const showProjectMenu = useCallback((e, project) => {
    e.preventDefault(); e.stopPropagation()
    const clientNames = [...new Set(projects.filter(p => p.client_name).map(p => p.client_name))]
    const items = [
      { icon: Pencil, label: 'Rename', action: () => setRenamingProject(project.id) },
      ...(isAgency ? [{
        icon: ArrowRightLeft, label: 'Move to client…', action: () => {
          // Show a sub-menu by setting a special ctx
          const moveItems = [
            { icon: User, label: 'Personal (no client)', action: () => updateProjectClient(project.id, null) },
            ...clientNames.filter(n => n !== project.client_name).map(name => ({
              icon: Building2, label: name, action: () => updateProjectClient(project.id, name),
            })),
          ]
          setCtxMenu({ x: e.clientX, y: e.clientY, items: moveItems })
        }
      }] : []),
      { separator: true },
      { icon: Trash2, label: 'Delete project', danger: true, action: () => { if (confirm('Delete this project and all its data?')) deleteProject(project.id) } },
    ]
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }, [projects, isAgency, deleteProject, updateProjectClient])

  const showClientMenu = useCallback((e, clientName) => {
    e.preventDefault(); e.stopPropagation()
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: Pencil, label: 'Rename client', action: () => setRenamingClient(clientName) },
      ],
    })
  }, [])

  // ─── Drag & Drop Handlers ─────────────────────────────────
  const handleDragStart = useCallback((e, projectId) => {
    setDragProjectId(projectId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', projectId)
  }, [])

  const handleDragOver = useCallback((e, targetClient) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(targetClient)
  }, [])

  const handleDragLeave = useCallback(() => { setDropTarget(null) }, [])

  const handleDrop = useCallback((e, targetClient) => {
    e.preventDefault()
    setDropTarget(null)
    if (!dragProjectId) return
    const newClient = targetClient === '__personal__' ? null : targetClient
    updateProjectClient(dragProjectId, newClient)
    setDragProjectId(null)
  }, [dragProjectId, updateProjectClient])

  const handleDragEnd = useCallback(() => { setDragProjectId(null); setDropTarget(null) }, [])

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col fixed h-full z-40 nb-sidebar">
        <div className="p-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-9 h-9 object-contain" alt="Northern Bird" />
            <div className="flex-1">
              <span className="text-sm font-display font-bold block leading-none" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-display font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--accent)' }}>Analytics</span>
                <TierBadge />
              </div>
            </div>
          </div>
        </div>

        <div className="p-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <button onClick={onNewProject}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors"
            style={{ background: 'var(--border-accent)', color: 'var(--accent)' }}>
            <FolderPlus className="w-3.5 h-3.5" /> New project
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider px-2 mb-2" style={{ color: 'var(--text-muted)' }}>
            {isAgency ? 'Clients & Projects' : 'Projects'}
          </p>
          <div className="space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : projects.length === 0 ? (
              <p className="text-xs px-2 py-4" style={{ color: 'var(--text-muted)' }}>No projects yet</p>
            ) : isAgency && clientGroups ? (
              /* Agency view: projects grouped by client with DnD + context menu */
              <>
              {Object.entries(clientGroups).map(([cName, clientProjects]) => {
                const isClientExpanded = expandedClients[cName] !== false
                const isDragOver = dropTarget === cName
                return (
                  <div key={cName} className="mb-1"
                    onDragOver={(e) => handleDragOver(e, cName)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, cName)}>
                    <div className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-all ${isDragOver ? 'ring-2 ring-purple-400 bg-purple-50 dark:bg-purple-900/20' : ''}`}
                      onMouseEnter={e => { if (!isDragOver) e.currentTarget.style.background = 'var(--bg-overlay)' }}
                      onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.background = 'transparent' }}>
                      <button onClick={() => toggleClient(cName)} className="shrink-0">
                        <ChevronRight className={`w-3 h-3 transition-transform ${isClientExpanded ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                      </button>
                      <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#8b5cf6' }} />
                      {renamingClient === cName ? (
                        <InlineRename value={cName} onSave={(newName) => { renameClient(cName, newName); setRenamingClient(null) }} onCancel={() => setRenamingClient(null)} />
                      ) : (
                        <button onClick={() => toggleClient(cName)} className="flex-1 min-w-0 text-left">
                          <span className="text-xs font-semibold truncate block" style={{ color: 'var(--text-primary)' }}>{cName}</span>
                        </button>
                      )}
                      <span className="text-[9px] shrink-0" style={{ color: 'var(--text-muted)' }}>{clientProjects.length}</span>
                      <button onClick={(e) => showClientMenu(e, cName)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:opacity-100 shrink-0" style={{ color: 'var(--text-muted)' }}>
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                    {isClientExpanded && (
                      <div className="ml-4 pl-2 space-y-0.5" style={{ borderLeft: '2px solid rgba(139, 92, 246, 0.2)' }}>
                        {clientProjects.map((p, i) => {
                          const ds = p.datasets || []
                          const isExpanded = expandedProjects[p.id]
                          const isDragging = dragProjectId === p.id
                          return (
                            <div key={p.id} draggable onDragStart={(e) => handleDragStart(e, p.id)} onDragEnd={handleDragEnd}
                              style={{ opacity: isDragging ? 0.4 : 1 }}>
                              <div className="group flex items-center gap-0.5 rounded-lg transition-colors"
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                onContextMenu={(e) => showProjectMenu(e, p)}>
                                <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-40 cursor-grab" style={{ color: 'var(--text-muted)' }} />
                                <button onClick={() => toggleProject(p.id)} className="p-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  <ChevronRight className={`w-2.5 h-2.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                                <button onClick={() => onOpenProject(p.id)} className="flex-1 flex items-center gap-2 py-1.5 pr-1 text-left min-w-0">
                                  <FolderOpen className="w-3 h-3 shrink-0" style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length] }} />
                                  <div className="flex-1 min-w-0">
                                    {renamingProject === p.id ? (
                                      <InlineRename value={p.name} onSave={(name) => { renameProject(p.id, name); setRenamingProject(null) }} onCancel={() => setRenamingProject(null)} />
                                    ) : (
                                      <>
                                        <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{ds.length} files · {timeAgo(p.updated_at)}</p>
                                      </>
                                    )}
                                  </div>
                                </button>
                                <button onClick={(e) => showProjectMenu(e, p)}
                                  className="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  <MoreHorizontal className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              {isExpanded && (
                                <div className="ml-4 pl-2 space-y-0.5" style={{ borderLeft: '1px solid var(--border-light)' }}>
                                  {ds.map(d => (
                                    <button key={d.id} onClick={() => onOpenProject(p.id)}
                                      className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left transition-colors"
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      <FileSpreadsheet className="w-2.5 h-2.5 shrink-0" style={{ color: '#10b981' }} />
                                      <span className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{d.file_name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Uncategorized drop target */}
              {clientGroups['Uncategorized'] && (
                <div className={`mt-1 p-2 rounded-lg transition-all ${dropTarget === '__personal__' ? 'ring-2 ring-slate-400 bg-slate-50 dark:bg-slate-800' : ''}`}
                  onDragOver={(e) => handleDragOver(e, '__personal__')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, '__personal__')}>
                </div>
              )}
              </>
            ) : (
              /* Standard view: flat project list with context menu */
              projects.slice(0, 15).map((p, i) => {
                const ds = p.datasets || []
                const isExpanded = expandedProjects[p.id]
                return (
                  <div key={p.id}>
                    <div className="group flex items-center gap-0.5 rounded-lg transition-colors"
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onContextMenu={(e) => showProjectMenu(e, p)}>
                      <button onClick={() => toggleProject(p.id)}
                        className="p-1.5 pl-2 shrink-0 transition-transform" style={{ color: 'var(--text-muted)' }}>
                        <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <button onClick={() => onOpenProject(p.id)}
                        className="flex-1 flex items-center gap-2 py-2 pr-1 text-left min-w-0">
                        <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          {renamingProject === p.id ? (
                            <InlineRename value={p.name} onSave={(name) => { renameProject(p.id, name); setRenamingProject(null) }} onCancel={() => setRenamingProject(null)} />
                          ) : (
                            <>
                              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ds.length} {ds.length === 1 ? 'file' : 'files'} · {timeAgo(p.updated_at)}</p>
                            </>
                          )}
                        </div>
                      </button>
                      <button onClick={(e) => showProjectMenu(e, p)}
                        className="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }}>
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="ml-5 pl-2 space-y-0.5" style={{ borderLeft: '1px solid var(--border-light)' }}>
                        {ds.map(d => (
                          <button key={d.id} onClick={() => onOpenProject(p.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors"
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <FileSpreadsheet className="w-3 h-3 shrink-0" style={{ color: '#10b981' }} />
                            <span className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{d.file_name}</span>
                          </button>
                        ))}
                        <button onClick={() => onOpenProject(p.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Plus className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} />
                          <span className="text-[11px]" style={{ color: 'var(--accent)' }}>Add dataset</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Shared with me section */}
        {sharedProjects && sharedProjects.length > 0 && (
          <div className="px-3 pb-3">
            <div className="pt-2 mb-2" style={{ borderTop: '1px solid var(--border-light)' }}>
              <p className="text-[10px] font-medium uppercase tracking-wider px-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Users className="w-3 h-3" /> Shared with me
              </p>
            </div>
            <div className="space-y-0.5">
              {sharedClientGroups ? (
                Object.entries(sharedClientGroups).map(([clientName, clientProjects]) => {
                  const isClientExp = expandedClients[`shared_${clientName}`] !== false
                  return (
                    <div key={`shared_${clientName}`} className="mb-1">
                      <button onClick={() => toggleClient(`shared_${clientName}`)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors"
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${isClientExp ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                        <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#8b5cf6' }} />
                        <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{clientName}</span>
                        <span className="text-[9px] ml-auto shrink-0" style={{ color: 'var(--text-muted)' }}>{clientProjects.length}</span>
                      </button>
                      {isClientExp && (
                        <div className="ml-4 pl-2 space-y-0.5" style={{ borderLeft: '2px solid rgba(139, 92, 246, 0.2)' }}>
                          {clientProjects.map((p, i) => (
                            <button key={p.id} onClick={() => onOpenProject(p.id)}
                              className="w-full flex items-center gap-2 py-1.5 px-1 rounded-lg text-left transition-colors"
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <FolderOpen className="w-3 h-3 shrink-0" style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length] }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{(p.datasets || []).length} files</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                sharedProjects.map((p, i) => (
                  <button key={p.id} onClick={() => onOpenProject(p.id)}
                    className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p._teamName || 'Shared'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={() => { if (typeof onSettings === 'function') onSettings(); }} className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80 mb-2" style={{ color: 'var(--text-secondary)' }}>
            <Settings className="w-3.5 h-3.5" /> Settings
          </button>
          <ThemeToggle />
          <div className="flex items-center gap-2.5 mt-3 px-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'var(--accent)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name || 'User'}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            </div>
            <button onClick={logout} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== MOBILE HEADER ===== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 nb-sidebar" ref={menuRef}
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark className="w-7 h-7 object-contain" />
            <span className="text-sm font-display font-bold" style={{ color: 'var(--text-primary)' }}>NORTHERN BIRD</span>
            <TierBadge />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onNewProject} className="p-2 rounded-lg" style={{ color: 'var(--accent)' }}>
              <FolderPlus className="w-5 h-5" />
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 shadow-lg animate-fade-in z-50 nb-card"
            style={{ borderTop: '1px solid var(--border)' }}>
            {/* User info */}
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'var(--accent)' }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name || 'User'}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
            </div>

            {/* Recent projects */}
            {projects.length > 0 && (
              <div className="px-2 py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider px-2 mb-1.5" style={{ color: 'var(--text-muted)' }}>Recent projects</p>
                {projects.slice(0, 5).map((p, i) => (
                  <button key={p.id} onClick={() => { setMobileMenuOpen(false); onOpenProject(p.id) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left"
                    style={{ color: 'var(--text-secondary)' }}>
                    <div className={`w-2 h-2 rounded-full ${PROJECT_COLORS[i % PROJECT_COLORS.length]} shrink-0`} />
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Theme toggle */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Appearance</p>
              <ThemeToggle />
            </div>

            {/* Sign out */}
            <div className="px-2 py-2">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 lg:ml-60 overflow-y-auto pt-16 lg:pt-0">
        <div className="p-6 lg:p-8 max-w-[900px] mx-auto">
          {/* Greeting */}
          <div className="mb-8 animate-fade-in">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: "'Lora', 'Georgia', 'Times New Roman', serif" }}>
              {getGreeting()}, {userName}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Here's your analytics overview.
            </p>
          </div>

          {/* Pending team invites */}
          <PendingInvites />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 animate-slide-up">
            <button className="rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md nb-card group"
              onClick={() => handleCardClick('projects')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Projects</span>
                <FolderOpen className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{projects.length}</p>
              <p className="text-[10px] mt-1 group-hover:underline" style={{ color: 'var(--accent)' }}>View all →</p>
            </button>
            <button className="rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md nb-card group"
              onClick={() => handleCardClick('datasets')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Datasets</span>
                <Database className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" style={{ color: '#10b981' }} />
              </div>
              <p className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{totalDatasets}</p>
              <p className="text-[10px] mt-1 group-hover:underline" style={{ color: '#10b981' }}>Browse →</p>
            </button>
            <button className="rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md nb-card group"
              onClick={() => handleCardClick('chats')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>AI chats</span>
                <MessageSquare className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" style={{ color: '#8b5cf6' }} />
              </div>
              <p className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{chatCount === null ? '...' : chatCount}</p>
              <p className="text-[10px] mt-1 group-hover:underline" style={{ color: '#8b5cf6' }}>{chatCount > 0 ? 'View all →' : 'Start chatting →'}</p>
            </button>
            <button className="rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md nb-card group"
              onClick={() => handleCardClick('insights')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Insights</span>
                <Lightbulb className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" style={{ color: '#f59e0b' }} />
              </div>
              <p className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{insightCount === null ? '...' : insightCount}</p>
              <p className="text-[10px] mt-1 group-hover:underline" style={{ color: '#f59e0b' }}>{insightCount > 0 ? 'View all →' : 'Generate insights →'}</p>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="mb-8 animate-slide-up" style={{ animationDelay: '80ms' }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Quick actions</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={onNewProject} className="flex items-center gap-3 p-4 rounded-xl transition-all hover:shadow-sm nb-card group">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Upload file</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>CSV, Excel, TSV</p>
                </div>
              </button>
              <button onClick={onNewProject} className="flex items-center gap-3 p-4 rounded-xl transition-all hover:shadow-sm nb-card group">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Google Sheets</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Connect spreadsheet</p>
                </div>
              </button>
              <button onClick={onNewProject} className="flex items-center gap-3 p-4 rounded-xl transition-all hover:shadow-sm nb-card group">
                <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>API</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Connect to any API</p>
                </div>
              </button>
            </div>
          </div>

          {/* Project / Dataset List */}
          <div ref={projectsRef} className="animate-slide-up" style={{ animationDelay: '160ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-overlay)' }}>
                <button onClick={() => setActiveView('projects')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView !== 'datasets' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:opacity-80'}`}
                  style={{ color: activeView !== 'datasets' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  Projects ({projects.length})
                </button>
                <button onClick={() => setActiveView('datasets')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === 'datasets' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:opacity-80'}`}
                  style={{ color: activeView === 'datasets' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  Datasets ({totalDatasets})
                </button>
              </div>
              {projects.length > 3 && (
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search…" className="pl-7 pr-3 py-1.5 text-xs rounded-lg nb-input w-40" />
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : activeView === 'datasets' ? (
              allDatasets.length === 0 ? (
                <div className="text-center py-12 nb-card rounded-xl">
                  <Database className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No datasets yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allDatasets.map((ds, i) => (
                    <button key={ds.id} onClick={() => onOpenProject(ds.projectId)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-sm nb-card text-left group animate-slide-up"
                      style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ds.file_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {ds.projectName} · {(ds.row_count || 0).toLocaleString()} rows
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  ))}
                </div>
              )
            ) : (
              filteredProjects.length === 0 ? (
                <div className="text-center py-12 nb-card rounded-xl">
                  <FolderOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {searchQuery ? 'No projects match your search' : 'No projects yet. Create one to get started.'}
                  </p>
                  {!searchQuery && (
                    <button onClick={onNewProject}
                      className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
                      style={{ background: 'var(--accent)' }}>
                      Create your first project
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProjects.map((p, i) => {
                    const ds = p.datasets || []
                    const totalRows = ds.reduce((sum, d) => sum + (d.row_count || 0), 0)
                    return (
                      <div key={p.id} className="rounded-xl overflow-hidden nb-card animate-slide-up"
                        style={{ animationDelay: `${(i + 3) * 60}ms` }}>
                        {/* Project header row */}
                        <div className="flex items-center gap-4 p-4 group cursor-pointer"
                          onClick={() => onOpenProject(p.id)}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div className={`w-2.5 h-2.5 rounded-full ${PROJECT_COLORS[i % PROJECT_COLORS.length]} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {ds.length} {ds.length === 1 ? 'dataset' : 'datasets'} · {totalRows.toLocaleString()} rows · {timeAgo(p.updated_at)}
                            </p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this project and all its data?')) deleteProject(p.id) }}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 shrink-0" style={{ color: 'var(--text-muted)' }} title="Delete project">
                            <Trash2 className="w-3.5 h-3.5 hover:text-red-500" />
                          </button>
                          <ChevronRight className="w-4 h-4 shrink-0 transition-colors" style={{ color: 'var(--text-muted)' }} />
                        </div>
                        {/* Nested datasets */}
                        {ds.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border-light)' }}>
                            {ds.map(d => (
                              <button key={d.id} onClick={() => onOpenProject(p.id)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 pl-11 text-left transition-colors"
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
                                <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{d.file_name}</span>
                                <span className="text-[10px] ml-auto shrink-0" style={{ color: 'var(--text-muted)' }}>{(d.row_count || 0).toLocaleString()} rows</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {ds.length === 0 && (
                          <div className="px-4 py-2.5 pl-11" style={{ borderTop: '1px solid var(--border-light)' }}>
                            <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>No datasets — click to upload</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </main>

      {/* Context Menu Portal */}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}
    </div>
  )
}
