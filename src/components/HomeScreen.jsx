import React, { useState, useRef, useEffect, useMemo } from 'react'
import LogoMark from './LogoMark'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { useTheme } from '../context/ThemeContext'
import { useTier } from '../context/TierContext'
import {
  FolderOpen, FolderPlus, Upload, FileSpreadsheet, Globe, LogOut,
  ChevronRight, Loader2, Search, Database, MessageSquare, Lightbulb, Sun, Moon, Monitor,
  Crown, Menu, X, User, Settings, Trash2, ChevronDown, Plus, Users, Building2
} from 'lucide-react'

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
import ClientShareMenu from './ClientShareMenu'
import ProjectShareMenu from './ProjectShareMenu'

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
  const { projects, sharedProjects, loading, deleteProject, renameProject } = useProject()
  const { tier, profile } = useTier()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [chatCount, setChatCount] = useState(null)
  const [insightCount, setInsightCount] = useState(null)
  const [expandedProjects, setExpandedProjects] = useState({})
  const [expandedClients, setExpandedClients] = useState({})
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [editingClientOld, setEditingClientOld] = useState(null)
  const [editingClientName, setEditingClientName] = useState('')
  const [dragProjectId, setDragProjectId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [shareMenuClient, setShareMenuClient] = useState(null)
  const [shareMenuProject, setShareMenuProject] = useState(null)
  const projectsRef = useRef(null)
  const menuRef = useRef(null)
  const shareButtonRefs = useRef({})
  const projectShareButtonRefs = useRef({})

  const isAgency = tier === 'agency'
  const [ownedTeamId, setOwnedTeamId] = useState(profile?.team_id || null)

  // Find team this user owns (for share button)
  useEffect(() => {
    if (profile?.team_id) { setOwnedTeamId(profile.team_id); return }
    if (!isAgency || !user?.id) return
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('teams').select('id').eq('owner_id', user.id).single().then(({ data }) => {
        if (data) setOwnedTeamId(data.id)
      })
    })
  }, [user?.id, isAgency, profile?.team_id])

  const toggleProject = (id) => {
    setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleClient = (name) => {
    setExpandedClients(prev => ({ ...prev, [name]: !prev[name] }))
  }

  // Rename a project
  const handleRenameProject = async (projectId, newName) => {
    if (!newName.trim()) return
    try {
      await renameProject(projectId, newName.trim())
    } catch {}
    setEditingProjectId(null)
  }

  // Rename a client folder (updates client_name on all projects in that group)
  const handleRenameClient = async (oldName, newName) => {
    if (!newName.trim() || newName.trim() === oldName) { setEditingClientOld(null); return }
    try {
      const { supabase } = await import('../lib/supabase')
      if (oldName === 'Uncategorized') {
        await supabase.from('projects').update({ client_name: newName.trim() }).is('client_name', null).eq('user_id', user.id)
      } else {
        await supabase.from('projects').update({ client_name: newName.trim() }).eq('client_name', oldName).eq('user_id', user.id)
      }
      window.location.reload()
    } catch {}
    setEditingClientOld(null)
  }

  // Move project to a different client
  const handleMoveProject = async (projectId, newClientName) => {
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('projects').update({ client_name: newClientName || null }).eq('id', projectId)
      window.location.reload()
    } catch {}
  }

  // Delayed click — prevents single-click navigation when user double-clicks to rename
  const clickTimers = useRef({})
  const handleProjectClick = (projectId) => {
    if (clickTimers.current[projectId]) return
    clickTimers.current[projectId] = setTimeout(() => {
      clickTimers.current[projectId] = null
      onOpenProject(projectId)
    }, 250)
  }
  const handleProjectDoubleClick = (projectId, name) => {
    if (clickTimers.current[projectId]) {
      clearTimeout(clickTimers.current[projectId])
      clickTimers.current[projectId] = null
    }
    setEditingProjectId(projectId)
    setEditingProjectName(name)
  }

  // Drag and drop handlers
  const handleDragStart = (e, projectId) => {
    setDragProjectId(projectId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', projectId)
    // Make drag ghost semi-transparent
    if (e.target) e.target.style.opacity = '0.5'
  }

  const handleDragEnd = (e) => {
    setDragProjectId(null)
    setDropTarget(null)
    if (e.target) e.target.style.opacity = '1'
  }

  const handleDragOver = (e, clientName) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(clientName)
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDrop = (e, targetClientName) => {
    e.preventDefault()
    const projectId = e.dataTransfer.getData('text/plain') || dragProjectId
    if (projectId) {
      handleMoveProject(projectId, targetClientName === '__personal__' ? null : targetClientName)
    }
    setDragProjectId(null)
    setDropTarget(null)
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
              /* Agency view: projects grouped by client */
              Object.entries(clientGroups).map(([clientName, clientProjects]) => {
                const isClientExpanded = expandedClients[clientName] !== false
                const isEditingClient = editingClientOld === clientName
                return (
                  <div key={clientName} className="mb-1 group/client"
                    onDragOver={(e) => handleDragOver(e, clientName)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, clientName)}
                    style={{ borderRadius: '8px', outline: dropTarget === clientName ? '2px dashed #8b5cf6' : 'none', outlineOffset: '2px' }}>
                    {isEditingClient ? (
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#8b5cf6' }} />
                        <input type="text" value={editingClientName} onChange={(e) => setEditingClientName(e.target.value)}
                          autoFocus onBlur={() => handleRenameClient(clientName, editingClientName)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameClient(clientName, editingClientName); if (e.key === 'Escape') setEditingClientOld(null) }}
                          className="flex-1 text-xs font-semibold px-1 py-0.5 rounded nb-input" />
                      </div>
                    ) : (
                      <div className="relative flex items-center">
                        <button onClick={() => toggleClient(clientName)}
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingClientOld(clientName); setEditingClientName(clientName) }}
                          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${isClientExpanded ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                          <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#8b5cf6' }} />
                          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{clientName}</span>
                          <span className="text-[9px] ml-auto shrink-0" style={{ color: 'var(--text-muted)' }}>{clientProjects.length}</span>
                        </button>
                        {ownedTeamId && (
                          <button ref={el => { shareButtonRefs.current[clientName] = el }}
                            onClick={(e) => { e.stopPropagation(); setShareMenuClient(shareMenuClient === clientName ? null : clientName) }}
                            className="p-1 rounded opacity-40 hover:opacity-100 transition-opacity shrink-0 mr-1"
                            style={{ color: shareMenuClient === clientName ? '#8b5cf6' : 'var(--text-muted)' }}
                            title={`Share "${clientName}" with team members`}>
                            <Users className="w-3 h-3" />
                          </button>
                        )}
                        {shareMenuClient === clientName && ownedTeamId && (
                          <ClientShareMenu clientName={clientName} teamId={ownedTeamId} onClose={() => setShareMenuClient(null)}
                            anchorRef={{ current: shareButtonRefs.current[clientName] }} />
                        )}
                      </div>
                    )}
                    {isClientExpanded && (
                      <div className="ml-4 pl-2 space-y-0.5" style={{ borderLeft: '2px solid rgba(139, 92, 246, 0.2)' }}>
                        {clientProjects.map((p, i) => {
                          const ds = p.datasets || []
                          const isExpanded = expandedProjects[p.id]
                          const isEditingThis = editingProjectId === p.id
                          return (
                            <div key={p.id} draggable onDragStart={(e) => handleDragStart(e, p.id)} onDragEnd={handleDragEnd}>
                              <div className="group flex items-center gap-0.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing"
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <button onClick={() => toggleProject(p.id)}
                                  className="p-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  <ChevronRight className={`w-2.5 h-2.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                                {isEditingThis ? (
                                  <input type="text" value={editingProjectName} onChange={(e) => setEditingProjectName(e.target.value)}
                                    autoFocus onBlur={() => handleRenameProject(p.id, editingProjectName)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProject(p.id, editingProjectName); if (e.key === 'Escape') setEditingProjectId(null) }}
                                    className="flex-1 text-[11px] font-medium px-1 py-0.5 rounded nb-input" />
                                ) : (
                                  <button onClick={() => handleProjectClick(p.id)}
                                    onDoubleClick={() => handleProjectDoubleClick(p.id, p.name)}
                                    className="flex-1 flex items-center gap-2 py-1.5 pr-1 text-left min-w-0">
                                    <FolderOpen className="w-3 h-3 shrink-0" style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length] }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                      <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{ds.length} files · {timeAgo(p.updated_at)}</p>
                                    </div>
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this project?')) deleteProject(p.id) }}
                                  className="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                                {ownedTeamId && (
                                  <button ref={el => { projectShareButtonRefs.current[p.id] = el }}
                                    onClick={(e) => { e.stopPropagation(); setShareMenuProject(shareMenuProject === p.id ? null : p.id) }}
                                    className="p-1 mr-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    style={{ color: shareMenuProject === p.id ? '#8b5cf6' : 'var(--text-muted)' }}
                                    title={`Share "${p.name}" with team members`}>
                                    <Users className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {shareMenuProject === p.id && ownedTeamId && (
                                  <ProjectShareMenu projectId={p.id} projectName={p.name} teamId={ownedTeamId}
                                    onClose={() => setShareMenuProject(null)}
                                    anchorRef={{ current: projectShareButtonRefs.current[p.id] }} />
                                )}
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
              })
            ) : (
              /* Standard view: flat project list */
              projects.slice(0, 15).map((p, i) => {
                const ds = p.datasets || []
                const isExpanded = expandedProjects[p.id]
                const isEditingThis = editingProjectId === p.id
                return (
                  <div key={p.id}>
                    <div className="group flex items-center gap-0.5 rounded-lg transition-colors"
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <button onClick={() => toggleProject(p.id)}
                        className="p-1.5 pl-2 shrink-0 transition-transform" style={{ color: 'var(--text-muted)' }}>
                        <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      {isEditingThis ? (
                        <input type="text" value={editingProjectName} onChange={(e) => setEditingProjectName(e.target.value)}
                          autoFocus onBlur={() => handleRenameProject(p.id, editingProjectName)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProject(p.id, editingProjectName); if (e.key === 'Escape') setEditingProjectId(null) }}
                          className="flex-1 text-xs font-medium px-1 py-0.5 rounded nb-input" />
                      ) : (
                        <button onClick={() => handleProjectClick(p.id)}
                          onDoubleClick={() => handleProjectDoubleClick(p.id, p.name)}
                          className="flex-1 flex items-center gap-2 py-2 pr-1 text-left min-w-0">
                          <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length] }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ds.length} {ds.length === 1 ? 'file' : 'files'} · {timeAgo(p.updated_at)}</p>
                          </div>
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this project?')) deleteProject(p.id) }}
                        className="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 shrink-0" style={{ color: 'var(--text-muted)' }}>
                        <Trash2 className="w-3 h-3" />
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
    </div>
  )
}
