import { useState, useEffect, useCallback } from 'react'
import { supabaseOwner } from '../lib/supabase'
import { useOwnerAuth } from '../context/OwnerAuthContext'
import { getPlatformSettings, getPerBranchPricing } from '../lib/platformSettings'

export function useSubscription() {
  const { profile } = useOwnerAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchSubscription = useCallback(async () => {
    if (!profile?.id) return
    try {
      const { data, error } = await supabaseOwner
        .from('subscriptions')
        .select('id, plan, status, branches_limit, managers_limit, expires_at, trial_ends_at, started_at')
        .eq('owner_id', profile.id)
        .maybeSingle()
      if (error) throw error

      if (!data) {
        // Subscription row missing — registration insert failed silently. Recover now.
        // No branch-count context available here, so recover with the minimal
        // 1-branch entitlement (matches Register.jsx's pricing.calculateX(1))
        // instead of a separate hardcoded literal that could drift from it.
        const trialExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        const settings = await getPlatformSettings(supabaseOwner)
        const pricing  = getPerBranchPricing(settings)
        const { error: insertErr } = await supabaseOwner.from('subscriptions').insert({
          owner_id:       profile.id,
          plan:           'per_branch',
          status:         'trial',
          branches_limit: 1,
          managers_limit: pricing.calculateManagersLimit(1),
          monthly_amount: pricing.calculateMonthlyAmount(1),
          expires_at:     trialExpiry,
          trial_ends_at:  trialExpiry,
          started_at:     new Date().toISOString(),
        })
        if (insertErr) {
          console.error('Subscription recovery insert failed:', insertErr)
        } else {
          fetchSubscription()
        }
        return
      }

      setSubscription(data)
    } catch (err) {
      console.error('Subscription fetch error:', err)
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchSubscription() }, [fetchSubscription])

  // Real-time: reflect admin block/activate or plan changes immediately
  useEffect(() => {
    if (!profile?.id) return

    fetchSubscription()

    const channelName = `owner-subscription-${profile.id}`
    supabaseOwner.removeChannel(supabaseOwner.channel(channelName))

    const ch = supabaseOwner
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        filter: `owner_id=eq.${profile.id}`,
      }, () => fetchSubscription())
      .subscribe()

    return () => supabaseOwner.removeChannel(ch)
  }, [profile?.id])

  // Computed values
  const isActive  = subscription?.status === 'active'
  const isTrial   = subscription?.status === 'trial'
  const isExpired = subscription?.status === 'expired' || subscription?.status === 'blocked'
  const hasAccess = isActive || isTrial

  // Days remaining
  const daysLeft = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at) - new Date()) / 86400000))
    : 0

  // Warning: expiring soon (within 5 days)
  const expiringSoon = hasAccess && daysLeft <= 5 && daysLeft > 0

  return {
    subscription,
    loading,
    isActive,
    isTrial,
    isExpired,
    hasAccess,
    daysLeft,
    expiringSoon,
    refetch: fetchSubscription,
  }
}
