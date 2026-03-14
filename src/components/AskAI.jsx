import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { useProject } from '../context/ProjectContext'
import { askAI } from '../utils/aiService'
import { exportToPDF, exportToWord } from '../utils/exportService'
import * as projectService from '../lib/projectService'
import {
  MessageSquare, Send, Loader2, Code, User, Sparkles,
  Plus, History, FileText, File, Trash2, MoreHorizontal
} from 'lucide-react'

function MarkdownText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let listBuffer = []
  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(<ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2 ml-1">{listBuffer.map((item, i) => <li key={i} className="text-sm text-slate-700 leading-relaxed">{renderInline(item)}</li>)}</ul>)
      listBuffer = []
    }
  }
  const renderInline = (str) => {
    const parts = []; let remaining = str; let key = 0
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*|__(.+?)__/)
      const codeMatch = remaining.match(/`(.+?)`/)
      let firstMatch = null; let firstIdx = Infinity
      if (boldMatch && boldMatch.index < firstIdx) { firstMatch = 'bold'; firstIdx = boldMatch.index }
      if (codeMatch && codeMatch.index < firstIdx) { firstMatch = 'code'; firstIdx = codeMatch.index }
      if (!firstMatch) { parts.push(<span key={key++}>{remaining}</span>); break }
      if (firstIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, firstIdx)}</span>)
      if (firstMatch === 'bold') { parts.push(<strong key={key++} className="font-semibold text-slate-900">{boldMatch[1] || boldMatch[2]}</strong>); remaining = remaining.slice(firstIdx + boldMatch[0].length) }
      else { parts.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono text-slate-700">{codeMatch[1]}</code>); remaining = remaining.slice(firstIdx + codeMatch[0].length) }
    }
    return parts
  }
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('### ')) { flushList(); elements.push(<h4 key={i} className="text-sm font-semibold text-slate-800 mt-3 mb-1">{renderInline(trimmed.slice(4))}</h4>) }
    else if (trimmed.startsWith('## ')) { flushList(); elements.push(<h3 key={i} className="text-sm font-bold text-slate-900 mt-4 mb-1.5">{renderInline(trimmed.slice(3))}</h3>) }
    else if (trimmed.startsWith('# ')) { flushList(); elements.push(<h2 key={i} className="text-base font-bold text-slate-900 mt-4 mb-2">{renderInline(trimmed.slice(2))}</h2>) }
    else if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) { listBuffer.push(trimmed.slice(2)) }
    else if (/^\d+\.\s/.test(trimmed)) { listBuffer.push(trimmed.replace(/^\d+\.\s/, '')) }
    else if (trimmed === '---' || trimmed === '***') { flushList(); elements.push(<hr key={i} className="my-3 border-slate-200" />) }
    else if (trimmed === '') { flushList() }
    else { flushList(); elements.push(<p key={i} className="text-sm text-slate-700 leading-relaxed my-1">{renderInline(trimmed)}</p>) }
  })
  flushList()
  return <div className="space-y-0.5">{elements}</div>
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-slide-up`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-50">
        {isUser ? <User className="w-4 h-4 text-accent" /> : <img src="/logo_mark.png" alt="NB" className="w-5 h-5 object-contain" />}
      </div>
      <div className={`max-w-[80%] rounded-xl p-4 ${isUser ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-slate-200'}`}>
        {message.content && (isUser ? <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{message.content}</div> : <MarkdownText text={message.content} />)}
        {(message.sql_plan || message.sql) && (
          <details className="mt-3">
            <summary className="text-xs text-slate-400 cursor-pointer flex items-center gap-1.5 hover:text-slate-600"><Code className="w-3 h-3" />View query plan</summary>
            <pre className="mt-2 p-3 rounded-lg bg-slate-50 text-xs font-mono text-slate-600 overflow-x-auto border border-slate-200">{message.sql_plan || message.sql}</pre>
          </details>
        )}
        {message.meta && <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span>~{(message.meta.tokensUsed?.input || 0) + (message.meta.tokensUsed?.output || 0)} tokens</span>
          <span>≈${(message.meta.estimatedCost || 0).toFixed(4)}</span>
        </div>}
      </div>
    </div>
  )
}

export default function AskAI({ conversationId: externalConvId, onConversationChange }) {
  const { schema, rawData, aggregateUnfiltered, columnsByType, activeDatasetId } = useData()
  const { activeProjectId } = useProject()

  const [conversationId, setConversationId] = useState(externalConvId || null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState([])
  const scrollRef = useRef(null)

  useEffect(() => { if (externalConvId) loadConversation(externalConvId) }, [externalConvId])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages])
  useEffect(() => { if (activeProjectId) loadConversationList() }, [activeProjectId])

  const loadConversationList = async () => {
    try {
      const list = await projectService.listConversations(activeProjectId)
      setConversations(list)
    } catch {}
  }

  const loadConversation = async (id) => {
    try {
      const msgs = await projectService.getMessages(id)
      setMessages(msgs)
      setConversationId(id)
      onConversationChange?.(id)
    } catch (err) { console.error('Failed to load conversation:', err) }
  }

  const startNewChat = async () => {
    try {
      const conv = await projectService.createConversation(activeProjectId, activeDatasetId)
      setConversationId(conv.id)
      setMessages([])
      onConversationChange?.(conv.id)
      await loadConversationList()
    } catch (err) { console.error('Failed to create conversation:', err) }
  }

  const deleteConversation = async (id) => {
    try {
      await projectService.deleteConversation(id)
      if (conversationId === id) { setConversationId(null); setMessages([]) }
      await loadConversationList()
    } catch (err) { console.error('Failed to delete conversation:', err) }
  }

  const suggestions = useMemo(() => {
    const dims = columnsByType.dimensions; const mets = columnsByType.metrics; const result = []
    if (mets.length > 0) result.push('Give me a summary of all metrics')
    if (dims.length > 0 && mets.length > 0) result.push(`What are the top ${schema[dims[0]]?.label || dims[0]}s by ${schema[mets[0]]?.label || mets[0]}?`)
    if (dims.length > 1 && mets.length > 0) result.push(`Which ${schema[dims[1]]?.label || dims[1]}s are underperforming?`)
    if (mets.length >= 2) result.push(`Show me total ${schema[mets[0]]?.label || mets[0]} and ${schema[mets[1]]?.label || mets[1]}`)
    if (result.length < 3) result.push('What trends do you see in this data?')
    return result.slice(0, 4)
  }, [schema, columnsByType])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const q = input.trim()
    setInput('')

    let convId = conversationId
    if (!convId) {
      try {
        const conv = await projectService.createConversation(activeProjectId, activeDatasetId)
        convId = conv.id
        setConversationId(conv.id)
        onConversationChange?.(conv.id)
      } catch (err) { console.error('Failed to create conversation:', err); return }
    }

    const userMsg = { role: 'user', content: q }
    const withUserMsg = [...messages, userMsg]
    setMessages(withUserMsg)
    setLoading(true)

    try { await projectService.addMessage(convId, { role: 'user', content: q }) } catch {}

    try {
      const r = await askAI(q, schema, rawData, aggregateUnfiltered, withUserMsg)
      const assistantMsg = { role: 'assistant', content: r.answer, sql_plan: r.sql, meta: { tokensUsed: r.tokensUsed, estimatedCost: r.estimatedCost } }
      setMessages(prev => [...prev, assistantMsg])
      try {
        await projectService.addMessage(convId, { role: 'assistant', content: r.answer, sqlPlan: r.sql, meta: { tokensUsed: r.tokensUsed, estimatedCost: r.estimatedCost } })
      } catch {}

      // Auto-name conversation from first user question
      if (withUserMsg.filter(m => m.role === 'user').length === 1) {
        const title = q.length > 50 ? q.slice(0, 47) + '...' : q
        try { await projectService.updateConversation(convId, { title }) } catch {}
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
      await loadConversationList()
    }
  }

  return (
    <div className="flex gap-4">
      {/* Chat History Sidebar (desktop) */}
      <div className="hidden lg:block w-64 shrink-0 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden h-[600px]">
        <ChatHistoryPanel conversations={conversations} activeId={conversationId} onSelect={loadConversation} onNewChat={startNewChat} onDelete={deleteConversation} />
      </div>

      {/* Main Chat */}
      <div className="flex-1 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px] animate-fade-in">
        <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><img src="/logo_mark.png" alt="NB" className="w-5 h-5 object-contain" /></div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-display font-semibold text-slate-800">Ask AI</h3>
            <p className="text-xs text-slate-400 truncate">Ask about your data in plain English</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHistory(!showHistory)} className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="Chat history">
              <History className="w-4 h-4" />
            </button>
            {messages.length > 0 && (
              <>
                <button onClick={() => exportToPDF({ type: 'chat', messages }, 'AI_Conversation')} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Export as PDF">
                  <FileText className="w-4 h-4" />
                </button>
                <button onClick={() => exportToWord({ type: 'chat', messages }, 'AI_Conversation')} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Export as Word">
                  <File className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={startNewChat} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-accent" title="New conversation">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="lg:hidden border-b border-slate-100 max-h-48 overflow-y-auto bg-slate-50">
            <ChatHistoryPanel conversations={conversations} activeId={conversationId}
              onSelect={(id) => { loadConversation(id); setShowHistory(false) }}
              onNewChat={() => { startNewChat(); setShowHistory(false) }}
              onDelete={deleteConversation} compact />
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center"><Sparkles className="w-6 h-6 text-accent" /></div>
              <p className="text-sm text-slate-400 text-center">Ask anything about your data.<br /><span className="text-xs text-slate-300">AI runs real queries against your dataset.</span></p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {suggestions.map(s => (<button key={s} onClick={() => setInput(s)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">{s}</button>))}
              </div>
            </div>
          ) : messages.map((m, i) => <MessageBubble key={i} message={m} />)}
          {loading && <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Loader2 className="w-4 h-4 text-accent animate-spin" /></div><span className="text-sm text-slate-400">Analyzing your data…</span></div>}
        </div>
        <div className="p-3 sm:p-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question about your data…" disabled={loading}
              className="flex-1 px-3 sm:px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 disabled:opacity-50" />
            <button onClick={handleSend} disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatHistoryPanel({ conversations, activeId, onSelect, onNewChat, onDelete, compact }) {
  const [menuId, setMenuId] = useState(null)

  return (
    <div className={`flex flex-col ${compact ? '' : 'h-full'}`}>
      <div className={`${compact ? 'px-3 py-2' : 'p-3 border-b border-slate-100'}`}>
        <button onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> New conversation
        </button>
      </div>
      <div className={`${compact ? '' : 'flex-1'} overflow-y-auto p-1.5 space-y-0.5`}>
        {conversations.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No conversations yet</p>
        ) : conversations.map(c => (
          <div key={c.id} className="relative group">
            <button onClick={() => onSelect(c.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-xs
                ${activeId === c.id ? 'bg-blue-50 text-accent' : 'text-slate-600 hover:bg-slate-50'}`}>
              <MessageSquare className="w-3 h-3 shrink-0 opacity-50" />
              <span className="truncate flex-1">{c.title || 'New conversation'}</span>
              <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id) }}
                className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 rounded transition-opacity shrink-0">
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </button>
            {menuId === c.id && (
              <div className="absolute right-2 top-full mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-fade-in">
                <button onClick={() => { onDelete(c.id); setMenuId(null) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
