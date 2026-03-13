import React, { useState, useEffect, useRef } from 'react'
import { useProject } from '../context/ProjectContext'
import * as projectService from '../lib/projectService'
import {
  MessageSquare, Plus, Trash2, Pencil, Check, X, Loader2, MoreHorizontal
} from 'lucide-react'

export default function ChatHistory({ activeConversationId, onSelect, onNewChat }) {
  const { activeProjectId } = useProject()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [menuId, setMenuId] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (activeProjectId) loadConversations()
  }, [activeProjectId])

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const loadConversations = async () => {
    if (!activeProjectId) return
    setLoading(true)
    try {
      const list = await projectService.listConversations(activeProjectId)
      setConversations(list)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNewChat = async () => {
    onNewChat?.()
    // Reload after creation
    setTimeout(loadConversations, 500)
  }

  const handleRename = async (id) => {
    if (!editTitle.trim()) { setEditingId(null); return }
    try {
      await projectService.updateConversation(id, { title: editTitle.trim() })
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editTitle.trim() } : c))
    } catch (err) {
      console.error('Failed to rename:', err)
    }
    setEditingId(null)
  }

  const handleDelete = async (id) => {
    try {
      await projectService.deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConversationId === id) onNewChat?.()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
    setMenuId(null)
  }

  const formatDate = (dateStr) => {
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-100">
        <button onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> New conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No conversations yet</p>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5" ref={menuRef}>
            {conversations.map(conv => (
              <div key={conv.id} className="relative group">
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleRename(conv.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="flex-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-accent" />
                    <button onClick={() => handleRename(conv.id)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => onSelect?.(conv.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-xs
                      ${activeConversationId === conv.id
                        ? 'bg-blue-50 text-accent border border-blue-200'
                        : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{conv.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(conv.updated_at)}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === conv.id ? null : conv.id) }}
                      className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 rounded transition-opacity">
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                  </button>
                )}

                {/* Context menu */}
                {menuId === conv.id && (
                  <div className="absolute right-2 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-fade-in">
                    <button onClick={() => { setEditingId(conv.id); setEditTitle(conv.title); setMenuId(null) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-t-lg">
                      <Pencil className="w-3 h-3" /> Rename
                    </button>
                    <button onClick={() => handleDelete(conv.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-b-lg">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
