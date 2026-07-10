import { useEffect, useState } from 'react'
import { getPlatformSettings, getPerBranchPricing } from '../lib/platformSettings'
import { supabaseOwner } from '../lib/supabase'
import { useOwnerAuth } from '../context/OwnerAuthContext'

/**
 * Owner subscription hook. Recovers missing subscription rows with per_branch trial
 * limits derived from platform_settings — never hardcoded (BUG #163/#164).
 */
export function useSubscription() {
  const { profile } = useOwnerAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) {
      setSubscription(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabaseOwner
        .from('subscriptions')
        .select('*')
        .eq('owner_id', profile.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setSubscription(null)
        setLoading(false)
        return
      }

      if (!data) {
        // Recovery insert — missing row after registration edge cases (BUG #067)
        try {
          const settings = await getPlatformSettings(supabaseOwner)
          const pricing = getPerBranchPricing(settings)
          const trialDays = parseInt(settings.trial_duration_days ?? '14', 10)
          const branchCount = 1
          const trialEnds = new Date()
          trialEnds.setDate(trialEnds.getDate() + trialDays)

          const { data: created } = await supabaseOwner
            .from('subscriptions')
            .insert({
              owner_id: profile.id,
              plan: 'per_branch',
              status: 'trial',
              branches_limit: branchCount,
              managers_limit: pricing.calculateManagersLimit(branchCount),
              monthly_amount: pricing.calculateMonthlyAmount(branchCount),
              trial_ends_at: trialEnds.toISOString(),
            })
            .select('*')
            .maybeSingle()

          if (!cancelled) setSubscription(created)
        } catch {
          if (!cancelled) setSubscription(null)
        }
        setLoading(false)
        return
      }

      setSubscription(data)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [profile?.id])

  const isExpired = subscription
    ? subscription.status === 'expired' || subscription.status === 'blocked'
    : false

  const isTrial = subscription?.status === 'trial'
  const isActive = subscription?.status === 'active' || isTrial

  return { subscription, loading, isExpired, isTrial, isActive, setSubscription }
}
