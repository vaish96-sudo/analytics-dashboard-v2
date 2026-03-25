import React, { useState } from 'react'
import { useTier } from '../context/TierContext'
import { Upload, Tag, BarChart3, Sparkles, ArrowRight, X, CheckCircle } from 'lucide-react'

const STEPS = [
  {
    icon: Upload,
    title: 'Upload your data',
    description: 'Start by uploading a CSV or Excel file. Your data stays private and secure.',
    tip: 'Try a sample dataset first to explore the features.',
  },
  {
    icon: Tag,
    title: 'Review your columns',
    description: 'AI will classify your columns as dimensions (categories) or metrics (numbers). You can adjust if needed.',
    tip: 'Dimensions are for grouping (like Country, Campaign). Metrics are for measuring (like Revenue, Clicks).',
  },
  {
    icon: BarChart3,
    title: 'Explore your dashboard',
    description: 'Your KPIs, charts, and data table are generated automatically. Use filters to drill into specific segments.',
    tip: 'Click on any chart bar to filter the entire dashboard by that value.',
  },
  {
    icon: Sparkles,
    title: 'Ask the AI',
    description: 'Go to the AI tab and ask questions about your data in plain English. Try "Which campaigns are underperforming?" or "Show me revenue by country."',
    tip: 'Generate Insights for a strategic analysis, or get Recommendations for actionable next steps.',
  },
]

export default function OnboardingOverlay({ onComplete }) {
  const { updateProfileField } = useTier()
  const [step, setStep] = useState(0)

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = async () => {
    await updateProfileField({ onboarding_completed: true })
    onComplete?.()
  }

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-fade-in" style={{ border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all" style={{
                width: i === step ? '24px' : '8px',
                background: i <= step ? 'var(--accent)' : 'var(--bg-overlay)',
              }} />
            ))}
          </div>
          <button onClick={handleComplete} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }} title="Skip onboarding">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>
            <Icon className="w-7 h-7" style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Step {step + 1} of {STEPS.length}</p>
          <h2 className="text-lg font-display font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{current.title}</h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>{current.description}</p>
          <div className="p-3 rounded-xl text-xs text-left" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Tip:</span> {current.tip}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 flex items-center justify-between border-t" style={{ borderColor: 'var(--border)' }}>
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="text-xs font-medium px-3 py-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
              Back
            </button>
          ) : (
            <button onClick={handleComplete} className="text-xs font-medium px-3 py-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
              Skip tour
            </button>
          )}
          <button onClick={handleNext} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white transition-all" style={{ background: 'var(--accent)' }}>
            {step === STEPS.length - 1 ? <><CheckCircle className="w-4 h-4" /> Get started</> : <>Next <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
