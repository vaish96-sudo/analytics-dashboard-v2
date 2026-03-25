import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'
import { canUse, getLimit, withinLimit, limitDisplay, getTierConfig, getNextTier, TIER_CONFIG } from '../lib/tierConfig'

const TierContext = createContext(null)

export function useTier() {
  const ctx = useContext(TierContext)
  if (!ctx) throw new Error('useTier must be used within TierProvider')
  return ctx
}

export function TierProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) { setProfile(null); setLoading(false); return }
    loadProfile()
  }, [user?.id])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/data/user-profile')
      setProfile(data)
    } catch {
      setProfile({ id: user?.id, tier: 'free', ai_queries_used: 0, insights_runs_used: 0, recommendations_runs_used: 0, ai_suggest_runs_used: 0 })
    } finally {
      setLoading(false)
    }
  }

  const tier = profile?.tier || 'free'
  const config = getTierConfig(tier)

  const can = useCallback((feature) => canUse(tier, feature), [tier])

  const hasRemaining = useCallback((feature) => {
    const usageMap = {
      askAiQueries: profile?.ai_queries_used || 0,
      insightsRuns: profile?.insights_runs_used || 0,
      recommendationsRuns: profile?.recommendations_runs_used || 0,
      aiSuggestRuns: profile?.ai_suggest_runs_used || 0,
    }
    const used = usageMap[feature]
    if (used === undefined) return canUse(tier, feature)
    return withinLimit(tier, feature, used)
  }, [tier, profile])

  const remaining = useCallback((feature) => {
    const limit = getLimit(tier, feature)
    if (limit === -1) return Infinity
    const usageMap = {
      askAiQueries: profile?.ai_queries_used || 0,
      insightsRuns: profile?.insights_runs_used || 0,
      recommendationsRuns: profile?.recommendations_runs_used || 0,
      aiSuggestRuns: profile?.ai_suggest_runs_used || 0,
    }
    const used = usageMap[feature] || 0
    return Math.max(0, limit - used)
  }, [tier, profile])

  const incrementUsage = useCallback(async (feature) => {
    if (!profile?.id) return
    const columnMap = {
      askAiQueries: 'ai_queries_used',
      insightsRuns: 'insights_runs_used',
      recommendationsRuns: 'recommendations_runs_used',
      aiSuggestRuns: 'ai_suggest_runs_used',
    }
    const column = columnMap[feature]
    if (!column) return

    const newVal = (profile[column] || 0) + 1
    setProfile(prev => prev ? { ...prev, [column]: newVal } : prev)

    try {
      await api.patch('/api/data/user-profile', { [column]: newVal })
    } catch { /* non-blocking */ }
  }, [profile])

  const updateProfileField = useCallback(async (updates) => {
    if (!profile?.id) return
    setProfile(prev => prev ? { ...prev, ...updates } : prev)
    try {
      await api.patch('/api/data/user-profile', updates)
    } catch { /* non-blocking */ }
  }, [profile])

  const limitLabel = useCallback((key) => limitDisplay(tier, key), [tier])

  const nextTier = getNextTier(tier)
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null

  return (
    <TierContext.Provider value={{
      tier,
      config,
      profile,
      loading,
      can,
      hasRemaining,
      remaining,
      incrementUsage,
      updateProfileField,
      limitLabel,
      nextTier,
      nextTierConfig,
      reloadProfile: loadProfile,
    }}>
      {children}
    </TierContext.Provider>
  )
}
