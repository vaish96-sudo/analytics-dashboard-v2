import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
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

  // Load user profile on login
  useEffect(() => {
    if (!user?.id) { setProfile(null); setLoading(false); return }
    loadProfile(user.id)
  }, [user?.id])

  const loadProfile = async (userId) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        // Profile doesn't exist yet — use free defaults
        setProfile({ id: userId, tier: 'free', ai_queries_used: 0, insights_runs_used: 0, recommendations_runs_used: 0, ai_suggest_runs_used: 0 })
      } else {
        // Check if usage needs monthly reset
        if (data.usage_reset_at && new Date(data.usage_reset_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
          data.ai_queries_used = 0
          data.insights_runs_used = 0
          data.recommendations_runs_used = 0
          data.ai_suggest_runs_used = 0
        }
        setProfile(data)
      }
    } catch {
      setProfile({ id: userId, tier: 'free', ai_queries_used: 0, insights_runs_used: 0, recommendations_runs_used: 0, ai_suggest_runs_used: 0 })
    } finally {
      setLoading(false)
    }
  }

  const tier = profile?.tier || 'free'
  const config = getTierConfig(tier)

  // Check if a boolean feature is available
  const can = useCallback((feature) => canUse(tier, feature), [tier])

  // Check if a counted feature has remaining uses
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

  // Get remaining count for a feature
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

  // Increment usage counter (call after successful AI request)
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
      await supabase.from('user_profiles').update({ [column]: newVal }).eq('id', profile.id)
    } catch { /* non-blocking */ }
  }, [profile])

  // Update profile fields (for settings: playbook, logo, company name, onboarding)
  const updateProfileField = useCallback(async (updates) => {
    if (!profile?.id) return
    setProfile(prev => prev ? { ...prev, ...updates } : prev)
    try {
      await supabase.from('user_profiles').update(updates).eq('id', profile.id)
    } catch { /* non-blocking */ }
  }, [profile])

  // Get the display label for a limit
  const limitLabel = useCallback((key) => limitDisplay(tier, key), [tier])

  // Get upgrade tier info
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
      reloadProfile: () => user?.id && loadProfile(user.id),
    }}>
      {children}
    </TierContext.Provider>
  )
}
