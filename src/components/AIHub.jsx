import React, { useState } from 'react'
import { MessageSquare, Lightbulb, Target } from 'lucide-react'
import AskAI from './AskAI'
import AIInsights from './AIInsights'
import AIRecommendations from './AIRecommendations'

const MODES = [
  {
    id: 'ask',
    label: 'Ask AI',
    desc: 'Chat with your data in plain English',
    icon: MessageSquare,
    color: 'var(--accent)',
    bgLight: 'rgba(37,99,235,0.06)',
    borderLight: 'rgba(37,99,235,0.15)',
  },
  {
    id: 'insights',
    label: 'Generate Insights',
    desc: 'Strategic analysis powered by Claude Opus',
    icon: Lightbulb,
    color: '#d97706',
    bgLight: 'rgba(217,119,6,0.06)',
    borderLight: 'rgba(217,119,6,0.15)',
  },
  {
    id: 'recommendations',
    label: 'Recommendations',
    desc: 'Actionable next steps for your business',
    icon: Target,
    color: '#7c3aed',
    bgLight: 'rgba(124,58,237,0.06)',
    borderLight: 'rgba(124,58,237,0.15)',
  },
]

export default function AIHub({ conversationId, onConversationChange }) {
  const [activeMode, setActiveMode] = useState('ask')

  return (
    <div className="space-y-4">
      {/* Mode Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {MODES.map(mode => {
          const Icon = mode.icon
          const isActive = activeMode === mode.id
          return (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl text-left transition-all"
              style={{
                background: isActive ? mode.bgLight : 'var(--bg-surface)',
                border: `1.5px solid ${isActive ? mode.color : 'var(--border)'}`,
                boxShadow: isActive ? `0 0 0 1px ${mode.borderLight}` : 'none',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: isActive ? `${mode.color}15` : 'var(--bg-overlay)',
                }}
              >
                <Icon
                  className="w-4.5 h-4.5"
                  style={{ color: isActive ? mode.color : 'var(--text-muted)', width: '18px', height: '18px' }}
                />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: isActive ? mode.color : 'var(--text-primary)' }}
                >
                  {mode.label}
                </p>
                <p className="text-[11px] leading-snug mt-0.5 hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                  {mode.desc}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Active Mode Content */}
      <div className="animate-fade-in" key={activeMode}>
        {activeMode === 'ask' && (
          <AskAI conversationId={conversationId} onConversationChange={onConversationChange} />
        )}
        {activeMode === 'insights' && <AIInsights />}
        {activeMode === 'recommendations' && <AIRecommendations />}
      </div>
    </div>
  )
}
