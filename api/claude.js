import { validateSession } from './lib/validateSession.js'

export const config = { maxDuration: 300 }

// --- Rate limiting (in-memory, per Vercel instance) ---
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20  // 20 requests per minute per user

function checkRateLimit(userId) {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { windowStart: now, count: 1 })
    return true
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) return false
  return true
}

// Prevent unbounded memory growth — clean old entries every 5 min
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(key)
  }
}, 300_000)

// --- Model enforcement: client sends feature name, server picks model ---
const FEATURE_MODEL_MAP = {
  ask_ai: 'claude-sonnet-4-20250514',
  query_plan: 'claude-sonnet-4-20250514',
  insights: 'claude-opus-4-20250514',
  recommendations: 'claude-opus-4-20250514',
  column_tagging: 'claude-sonnet-4-20250514',
  chart_builder: 'claude-sonnet-4-20250514',
  custom_metric: 'claude-sonnet-4-20250514',
  default: 'claude-sonnet-4-20250514',
}

const MAX_TOKENS_CAP = 4096

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // C1: Validate session
  const session = await validateSession(req)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized — valid session required' })
  }

  // M1: Rate limit per user
  if (!checkRateLimit(session.userId)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
    const { messages, system, max_tokens = 1024, feature } = req.body

    // FIX #10: Server-side tier enforcement — check usage limits before calling Anthropic API
    const featureToColumn = {
      ask_ai: 'ai_queries_used', query_plan: 'ai_queries_used',
      insights: 'insights_runs_used', recommendations: 'recommendations_runs_used',
      column_tagging: 'ai_suggest_runs_used', chart_builder: 'ai_suggest_runs_used',
      custom_metric: 'ai_suggest_runs_used',
    }
    const usageColumn = featureToColumn[feature]
    if (usageColumn) {
      const { data: profile } = await session.supabase
        .from('user_profiles').select('tier, ' + usageColumn).eq('id', session.userId).single()
      const tier = profile?.tier || 'free'
      const used = profile?.[usageColumn] || 0
      // Tier limits — must match tierConfig.js
      const LIMITS = {
        free: { ai_queries_used: 5, insights_runs_used: 1, recommendations_runs_used: 0, ai_suggest_runs_used: 1 },
        pro: { ai_queries_used: 100, insights_runs_used: 10, recommendations_runs_used: 5, ai_suggest_runs_used: -1 },
        agency: { ai_queries_used: -1, insights_runs_used: -1, recommendations_runs_used: -1, ai_suggest_runs_used: -1 },
      }
      const limit = (LIMITS[tier] || LIMITS.free)[usageColumn] ?? 0
      if (limit !== -1 && used >= limit) {
        return res.status(403).json({ error: `You've reached your ${tier} tier limit for this feature. Please upgrade for more usage.` })
      }
    }

    // M3: Server controls model based on feature name
    const useModel = FEATURE_MODEL_MAP[feature] || FEATURE_MODEL_MAP.default

    // M2: Cap max_tokens
    const safeMaxTokens = Math.min(Number(max_tokens) || 1024, MAX_TOKENS_CAP)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: useModel, max_tokens: safeMaxTokens, system, messages }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API request failed' })
    }

    // M6: Log usage for cost tracking (non-blocking)
    try {
      const inputTokens = data.usage?.input_tokens || 0
      const outputTokens = data.usage?.output_tokens || 0
      await session.supabase.from('ai_usage_log').insert({
        user_id: session.userId,
        feature: feature || 'unknown',
        model: useModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: estimateCost(useModel, inputTokens, outputTokens),
      })

      // FIX #10 continued: Increment usage counter server-side (authoritative source of truth)
      if (usageColumn) {
        await session.supabase.rpc('increment_usage', { p_user_id: session.userId, p_column: usageColumn })
          .then(() => {})
          .catch(async () => {
            // Fallback: manual increment if RPC doesn't exist
            const { data: currentProfile } = await session.supabase
              .from('user_profiles').select(usageColumn).eq('id', session.userId).single()
            if (currentProfile) {
              await session.supabase.from('user_profiles')
                .update({ [usageColumn]: (currentProfile[usageColumn] || 0) + 1 })
                .eq('id', session.userId)
            }
          })
      }
    } catch (_) {
      // Usage logging failure should never block the response
    }

    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
}

function estimateCost(model, inputTokens, outputTokens) {
  const isOpus = model.includes('opus')
  const inputRate = isOpus ? 15 : 3
  const outputRate = isOpus ? 75 : 15
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
}
