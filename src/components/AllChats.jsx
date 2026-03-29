import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { listAllConversations } from '../lib/projectService'
import { MessageSquare, ArrowLeft, Loader2, Search, ChevronRight } from 'lucide-react'
import { useToast } from './Toast'

function timeAgo(dateStr) {
  const toast = useToast()
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AllChats({ onBack, onOpenProject }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    listAllConversations(user.id)
      .then(data => setConversations(data))
      .catch(err => toast.error(err?.message || 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [user?.id])

  const filtered = search
    ? conversations.filter(c =>
        (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.projectName || '').toLowerCase().includes(search.toLowerCase())
      )
    : conversations

  // Group by project
  const grouped = {}
  filtered.forEach(c => {
    const key = c.project_id
    if (!grouped[key]) grouped[key] = { name: c.projectName, convos: [] }
    grouped[key].convos.push(c)
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>AI Chats</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} across all projects
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl nb-input"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No conversations yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Start a chat from the Ask AI tab in any project</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results for "{search}"</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([projectId, group]) => (
              <div key={projectId}>
                <p className="text-xs font-medium uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
                  {group.name}
                </p>
                <div className="space-y-1.5">
                  {group.convos.map(convo => (
                    <button
                      key={convo.id}
                      onClick={() => onOpenProject(convo.project_id, 'ask', convo.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all nb-card hover:shadow-sm group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                        <MessageSquare className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {convo.title || 'New conversation'}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {timeAgo(convo.updated_at)}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
