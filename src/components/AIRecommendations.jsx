import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import { useTier } from '../context/TierContext'
import { Target, Loader2, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, Clock, FileText, File, Shield } from 'lucide-react'
import { exportToPDF, exportToWord } from '../utils/exportService'
import { BlurredPreview, UsageBadge } from './UpgradePrompt'

import { callClaudeAPI } from '../utils/claudeClient.js'
const PRIORITY_STYLES = {
  high: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'High Priority' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Medium' },
  low: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Low' },
}
const CONFIDENCE_STYLES = {
  high: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-slate-500 bg-slate-50 border-slate-200',
}

function detectIndustry(schema) {
  const cols = Object.keys(schema).map(c => c.toLowerCase()).join(' ')
  if (['impression', 'click', 'ctr', 'cpa', 'cpc', 'cpm', 'conv', 'campaign', 'creative', 'ad_group', 'adgroup', 'placement', 'ecpc', 'ecpm', 'vconv', 'cconv', 'advertiser'].some(k => cols.includes(k))) return 'advertising'
  if (['defect', 'units_produced', 'downtime', 'oee', 'machine', 'shift', 'production_line', 'yield'].some(k => cols.includes(k))) return 'manufacturing'
  if (['mrr', 'arr', 'churn', 'subscription', 'trial', 'plan_type', 'feature_usage', 'renewal'].some(k => cols.includes(k))) return 'saas'
  if (['patient', 'diagnosis', 'readmission', 'procedure', 'icd', 'drg', 'length_of_stay'].some(k => cols.includes(k))) return 'healthcare'
  if (['shipment', 'route', 'warehouse', 'carrier', 'freight', 'delivery_time', 'fulfillment'].some(k => cols.includes(k))) return 'logistics'
  if (['order', 'cart', 'product', 'sku', 'customer', 'delivered', 'shipping', 'category'].some(k => cols.includes(k))) return 'ecommerce'
  if (['portfolio', 'return', 'risk', 'asset', 'bond', 'equity', 'dividend', 'nav'].some(k => cols.includes(k))) return 'finance'
  return 'general'
}

function buildAdvertisingPrompt(cols) {
  return `You are a SENIOR PERFORMANCE MARKETING STRATEGIST with 20+ years of experience in media buying, campaign optimization, and digital advertising. You think like a VP of Media at a top agency.

The user has uploaded an advertising/media dataset with these columns:
${cols}

═══════════════════════════════════════════════════════
MASTER RULES — APPLY TO EVERY RECOMMENDATION
═══════════════════════════════════════════════════════

1. ALWAYS evaluate using BOTH efficiency (CPA, CVR, CTR, VCR) AND scale (volume, spend, impressions, conversions).
2. NEVER recommend optimizations based solely on efficiency when volume is low.
3. PRIORITIZE recommendations that balance cost-efficiency with total contribution to conversions.
4. AVOID over-indexing on statistically insignificant segments or low-volume outliers.
5. ALWAYS consider trade-offs between efficiency and scale.
6. Apply these rules across ALL levels: creative, device, geo, audience, tactic, publisher, placement.

═══════════════════════════════════════════════════════
GUARDRAILS FOR SMALL vs LARGE SEGMENTS
═══════════════════════════════════════════════════════

- Segments with <5% of total conversions OR below statistical threshold = DIRECTIONAL ONLY. Say so explicitly.
- Do NOT recommend budget shifts toward segments that cannot scale.
- Highlight high-volume segments even if CPA is slightly worse, IF they drive significant conversion contribution.
- Prioritize segments contributing to top 70-80% cumulative volume.

═══════════════════════════════════════════════════════
STATISTICAL CONFIDENCE
═══════════════════════════════════════════════════════

- Check if sample size is sufficient (clicks, conversions, impressions).
- Suppress or qualify insights from low-data segments.
- Label each recommendation's confidence: High / Medium / Low.
- Avoid strong recommendations from low-confidence data.

═══════════════════════════════════════════════════════
RECOMMENDATION FRAMING
═══════════════════════════════════════════════════════

Every recommendation MUST:
- Include trade-offs (efficiency vs scale, reach vs cost)
- Quantify expected impact CONSERVATIVELY
- Avoid aggressive budget shifts unless confidence is high
- Prefer INCREMENTAL optimization over drastic reallocation
- Explicitly mention risks (loss of volume, reduced reach)

═══════════════════════════════════════════════════════
DIMENSION-SPECIFIC LOGIC
═══════════════════════════════════════════════════════

FUNNEL STAGE:
- Do NOT reduce upper/mid funnel spend solely due to lower direct conversions
- Recognize the assistive value of awareness and engagement stages
- Recommend validating attribution before optimizing against it
- Do NOT assume view-through conversions are lower quality without validation
- Optimize WITHIN each stage before reallocating across stages

CREATIVE:
- Do NOT pause high-spend creatives with slightly lower CTR if they drive strong conversions
- High-CTR but low-conversion creatives = engagement drivers, not conversion drivers
- Optimize/iterate on high-volume creatives instead of replacing entirely
- Use low-volume high-performers as testing directions, not scaling levers
- Recommend creative refresh only after sufficient data threshold

DEVICE:
- Do NOT reduce spend on a device solely due to higher CPA if it contributes significant volume
- Consider cross-device behavior and indirect assists
- Recommend UX/funnel optimizations BEFORE reducing bids
- Only downscale if BOTH CPA is significantly worse AND volume contribution is low

AUDIENCE:
- Rank by both CPA AND total conversions
- Do NOT shift budget away from high-volume audiences unless CPA is >30-40% worse
- Treat small high-performing audiences as expansion signals, not primary scale drivers
- Recommend lookalike/adjacent audience testing instead of over-scaling small segments

GEO:
- Check if segment contributes >5-10% of total conversions before recommending action
- Default to optimize within before reallocating away

PLACEMENT / INVENTORY:
- Do NOT exclude high-volume placements with slightly worse CPA
- Recommend bid adjustments or frequency caps before full exclusion

TIME-BASED:
- Do NOT over-optimize toward low-volume high-performing time slots
- Recommend bid modifiers instead of strict dayparting cuts

CAMPAIGN / TACTIC:
- Identify campaigns driving majority of results (top 70-80% contribution)
- Recommend incremental budget shifts (10-20%), not aggressive reallocations
- Optimize within campaigns before shifting budgets across them`
}

function buildGeneralPrompt(cols, industry) {
  const ctx = {
    ecommerce: 'You are a SENIOR ECOMMERCE STRATEGIST. Focus on AOV optimization, delivery fulfillment rates, customer segmentation (RFM), category performance, geographic expansion, acquisition cost vs lifetime value trade-offs.',
    manufacturing: 'You are a SENIOR MANUFACTURING OPERATIONS CONSULTANT. Focus on OEE, defect rates, throughput optimization, downtime patterns, cost per unit, capacity utilization, quality vs speed trade-offs.',
    saas: 'You are a SENIOR SAAS GROWTH STRATEGIST. Focus on MRR/ARR growth, churn reduction, expansion revenue, cohort retention, feature adoption, customer health scoring, growth vs profitability trade-offs.',
    healthcare: 'You are a SENIOR HEALTHCARE OPERATIONS CONSULTANT. Focus on patient outcomes, readmission rates, resource utilization, cost per procedure, wait times, cost vs quality of care trade-offs.',
    logistics: 'You are a SENIOR SUPPLY CHAIN STRATEGIST. Focus on delivery rates, fulfillment time, cost per shipment, route efficiency, inventory turnover, speed vs cost trade-offs.',
    finance: 'You are a SENIOR FINANCIAL STRATEGIST. Focus on risk-adjusted returns, portfolio concentration, default rates, cost of acquisition, cross-sell ratios, risk vs return trade-offs.',
    general: 'You are a SENIOR MANAGEMENT CONSULTANT with cross-industry expertise. First identify the specific industry from the data columns, then apply domain-specific knowledge.',
  }
  return `${ctx[industry] || ctx.general}

The user has a dataset with these columns:
${cols}

═══════════════════════════════════════════════════════
ANALYSIS FRAMEWORK
═══════════════════════════════════════════════════════

1. IDENTIFY the specific industry and business context from column names.
2. DISTINGUISH between efficiency metrics (rates, ratios) and scale metrics (volumes, totals).
3. NEVER recommend action on segments with <5% of total volume — flag as directional only.
4. ALWAYS include trade-offs: improving one metric often degrades another.
5. PREFER incremental improvements over drastic changes.
6. QUANTIFY impact conservatively with ranges.
7. IDENTIFY leading vs lagging indicators.
8. FIND the 80/20 pattern: which segments drive the majority of results?
9. Label confidence: High / Medium / Low based on data volume.
10. Consider what data is MISSING that would strengthen the analysis.`
}

const RESPONSE_FORMAT = `

Respond with ONLY a JSON array (no markdown, no backticks):
[{
  "title": "Actionable title starting with a verb",
  "description": "2-4 sentences with specific numbers. Include the trade-off and risk.",
  "steps": ["Specific step 1", "Specific step 2", "Specific step 3", "Specific step 4"],
  "timeline": "e.g. 1-2 weeks to implement, 4 weeks to measure",
  "expected_impact": "Conservative quantified impact with range",
  "priority": "high|medium|low",
  "confidence": "high|medium|low"
}]

Provide 5-6 recommendations. Think like a 30-year industry veteran presenting to the CEO — not a generic analyst listing optimizations.`

export default function AIRecommendations() {
  const { schema, rawData, aggregateUnfiltered, activeDatasetId, updateDatasetState, recommendations } = useData()
  const { hasRemaining, remaining, incrementUsage, can, tier, profile } = useTier()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usedModel, setUsedModel] = useState(null)
  const [detectedIndustry, setDetectedIndustry] = useState(null)

  // Blurred preview for tiers without recommendations access
  const showPreview = !hasRemaining('recommendationsRuns') && (recommendations?.length || 0) === 0
  const isLocked = tier === 'free' && !hasRemaining('recommendationsRuns')

  const fetchRecommendations = async () => {
    if (!schema || !rawData) return
    if (!hasRemaining('recommendationsRuns')) { setError('You\'ve used all your Recommendations runs for this month. Upgrade to get more.'); return }
    setLoading(true)
    setError(null)

    try {
      const metrics = Object.entries(schema).filter(([, d]) => d.type === 'metric' && !d.isCustom).map(([col, d]) => ({ col, label: d.label }))
      const dimensions = Object.entries(schema).filter(([, d]) => d.type === 'dimension').map(([col, d]) => ({ col, label: d.label }))

      const cols = Object.entries(schema)
        .filter(([, def]) => def.type !== 'ignore' && !def.isCustom)
        .map(([col, def]) => `- ${col} (${def.type}): "${def.label}"`)
        .join('\n')

      const summaryParts = []
      metrics.slice(0, 10).forEach(m => {
        const vals = rawData.map(r => parseFloat(String(r[m.col] ?? 0).replace(/[,$%]/g, ''))).filter(v => !isNaN(v))
        const total = vals.reduce((a, b) => a + b, 0)
        const avg = vals.length > 0 ? total / vals.length : 0
        summaryParts.push(`${m.label}: total=${total.toLocaleString()}, avg=${avg.toFixed(2)}, rows=${vals.length}`)
      })

      dimensions.slice(0, 4).forEach(dim => {
        metrics.slice(0, 2).forEach(met => {
          const agg = aggregateUnfiltered([dim.col], [met.col])
            .sort((a, b) => (b[met.col] || 0) - (a[met.col] || 0))
          const total = agg.reduce((s, r) => s + (r[met.col] || 0), 0)
          const top = agg.slice(0, 7)
          const topContrib = top.reduce((s, r) => s + (r[met.col] || 0), 0)
          summaryParts.push(`\n${dim.label} by ${met.label} (${agg.length} values, top 7 = ${total > 0 ? ((topContrib/total)*100).toFixed(0) : 0}% of ${total.toLocaleString()}):`)
          top.forEach(r => {
            const pct = total > 0 ? ((r[met.col] || 0) / total * 100).toFixed(1) : '0'
            summaryParts.push(`  ${r[dim.col]}: ${(r[met.col] || 0).toLocaleString()} (${pct}%)`)
          })
          if (agg.length > 7) {
            const rest = agg.slice(7).reduce((s, r) => s + (r[met.col] || 0), 0)
            summaryParts.push(`  [${agg.length - 7} others]: ${rest.toLocaleString()} (${total > 0 ? ((rest/total)*100).toFixed(1) : '0'}%)`)
          }
        })
      })

      const industry = detectIndustry(schema)
      setDetectedIndustry(industry)

      let systemPrompt
      if (industry === 'advertising') {
        systemPrompt = buildAdvertisingPrompt(cols) + RESPONSE_FORMAT
      } else {
        systemPrompt = buildGeneralPrompt(cols, industry) + RESPONSE_FORMAT
      }

      // Feature 1: Append custom AI playbook if user has one (Agency+ tier)
      if (profile?.custom_ai_playbook && can('customPlaybook')) {
        systemPrompt += `\n\nADDITIONAL CLIENT RULES (follow these carefully):\n${profile.custom_ai_playbook}`
      }

      const { text } = await callClaudeAPI({
        system: systemPrompt,
        messages: [{ role: 'user', content: `Dataset: ${rawData.length} rows, ${metrics.length} metrics, ${dimensions.length} dimensions.\n\nData Summary:\n${summaryParts.join('\n')}\n\nProvide 5-6 actionable recommendations.` }],
        max_tokens: 3000,
        feature: 'recommendations',
      })

      await incrementUsage('recommendationsRuns')

      try {
        const cleaned = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        updateDatasetState('recommendations', parsed)
      } catch {
        updateDatasetState('recommendations', [{ title: 'Analysis', description: text, steps: [], timeline: '', expected_impact: '', priority: 'medium', confidence: 'medium' }])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    const items = recommendations.map(r => ({
      type: 'recommendation', title: r.title,
      description: `${r.description}\n\nSteps: ${(r.steps || []).join(', ')}\nTimeline: ${r.timeline}\nExpected Impact: ${r.expected_impact}\nConfidence: ${r.confidence || 'N/A'}`,
      impact: r.priority,
    }))
    exportToPDF({ type: 'insights', items }, 'AI_Recommendations')
  }

  const handleExportWord = () => {
    const items = recommendations.map(r => ({
      type: 'recommendation', title: r.title,
      description: `${r.description}\n\nSteps: ${(r.steps || []).join(', ')}\nTimeline: ${r.timeline}\nExpected Impact: ${r.expected_impact}\nConfidence: ${r.confidence || 'N/A'}`,
      impact: r.priority,
    }))
    exportToWord({ type: 'insights', items }, 'AI_Recommendations')
  }

  const industryLabel = { advertising: 'Advertising & Media', ecommerce: 'E-Commerce & Retail', manufacturing: 'Manufacturing', saas: 'SaaS & Subscription', healthcare: 'Healthcare', logistics: 'Logistics & Supply Chain', finance: 'Finance', general: 'Business Analysis' }

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-semibold text-slate-800">Recommendations</h3>
            <p className="text-xs text-slate-400 truncate">
              Actionable next steps
              {usedModel && <span> · <span className="text-slate-500 font-medium">{usedModel}</span></span>}
              {detectedIndustry && <span> · <span className="text-purple-500 font-medium">{industryLabel[detectedIndustry] || detectedIndustry}</span></span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {recommendations.length > 0 && (
            <>
              <button onClick={handleExportPDF} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Export as PDF"><FileText className="w-3.5 h-3.5" /></button>
              <button onClick={handleExportWord} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Export as Word"><File className="w-3.5 h-3.5" /></button>
            </>
          )}
          <button onClick={fetchRecommendations} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg text-white hover:opacity-90 disabled:opacity-50 transition-colors shrink-0"
            style={{ background: '#7c3aed' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{recommendations.length > 0 ? 'Regenerate' : 'Get Recommendations'}</span>
            <span className="sm:hidden">{recommendations.length > 0 ? 'Refresh' : 'Generate'}</span>
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
            <span className="text-sm text-slate-400">Analyzing with industry expertise…</span>
            <span className="text-xs text-slate-300">Deep analysis may take 30-60 seconds</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchRecommendations} className="mt-3 text-xs text-purple-600 hover:underline">Try again</button>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Click "Get Recommendations" for actionable next steps</p>
            <p className="text-xs text-slate-300 mt-1">AI detects your industry and applies expert-level analysis frameworks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              const pStyle = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium
              const cStyle = CONFIDENCE_STYLES[rec.confidence] || CONFIDENCE_STYLES.medium
              return (
                <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-purple-400 hover:shadow-sm transition-all animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h4 className="text-sm font-display font-semibold text-slate-800">{rec.title}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wider ${pStyle.color} ${pStyle.bg} ${pStyle.border}`}>{pStyle.label}</span>
                        {rec.confidence && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium tracking-wider flex items-center gap-1 ${cStyle}`}>
                            <Shield className="w-2.5 h-2.5" />{rec.confidence} confidence
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed mb-2">{rec.description}</p>
                      {rec.steps && rec.steps.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {rec.steps.map((step, si) => (
                            <div key={si} className="flex items-start gap-2 text-xs text-slate-500">
                              <ArrowRight className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-[11px] text-slate-400">
                        {rec.timeline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{rec.timeline}</span>}
                        {rec.expected_impact && <span className="flex items-center gap-1"><Target className="w-3 h-3" />{rec.expected_impact}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
