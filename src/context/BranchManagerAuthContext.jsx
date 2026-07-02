import { createContext, useContext, useEffect, useState } from 'react'
import { supabaseBranchManager } from '../lib/supabase'

const BranchManagerAuthContext = createContext(null)

let _bmProfileCache = null
let _bmProfileCacheUserId = null

async function fetchOwnerSubscription(branchId) {
  if (!branchId) return null
  const { data: branchRow } = await supabaseBranchManager
    .from('branches')
    .select('owner_id')
    .eq('id', branchId)
    .single()
  if (!branchRow?.owner_id) return null

  const { data: subRow } = await supabaseBranchManager
    .from('subscriptions')
    .select('status, plan, expires_at, trial_ends_at')
    .eq('owner_id', branchRow.owner_id)
    .maybeSingle()
  return subRow || null
}

export function BranchManagerAuthProvider({ children }) {
  const [user,    setUser]    = useState(null)   // Supabase auth user
  const [profile, setProfile] = useState(null)   // public.users row
  const [loading, setLoading] = useState(true)
  const [ownerSubscription, setOwnerSubscription] = useState(undefined)

  async function fetchProfile(userId) {
    // Return cached profile if same user — avoids DB round trip on every navigation
    if (_bmProfileCacheUserId === userId && _bmProfileCache) {
      setProfile(_bmProfileCache)
      fetchOwnerSubscription(_bmProfileCache.branch_id).then(setOwnerSubscription)
      return _bmProfileCache
    }

    const { data, error } = await supabaseBranchManager
      .from('users')
      .select('id, name, name_ar, email, phone, role, branch_id, is_active')
      .eq('id', userId)
      .single()

    if (error || !data) {
      // Network error or profile missing — keep the auth session, just clear the profile
      setProfile(null)
      return null
    }

    // Security: sign out only when we have a confirmed profile with the wrong role
    if (data.role !== 'branch_manager' || !data.is_active) {
      await supabaseBranchManager.auth.signOut()
      setUser(null)
      setProfile(null)
      setOwnerSubscription(null)
      _bmProfileCache = null
      _bmProfileCacheUserId = null
      return null
    }

    _bmProfileCache = data
    _bmProfileCacheUserId = userId
    setProfile(data)
    fetchOwnerSubscription(data.branch_id).then(setOwnerSubscription)
    return data
  }

  useEffect(() => {
    const { data: { subscription } } = supabaseBranchManager.auth.onAuthStateChange(
      async (_event, session) => {
        if (_event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setOwnerSubscription(null)
          _bmProfileCache = null
          _bmProfileCacheUserId = null
          setLoading(false)
          return
        }
        if (_event === 'INITIAL_SESSION' || _event === 'SIGNED_IN') {
          setLoading(true)
          const sessionUser = session?.user ?? null
          setUser(sessionUser)
          if (sessionUser) {
            await fetchProfile(sessionUser.id)
          } else {
            setProfile(null)
          }
          setLoading(false)
          return
        }
        // TOKEN_REFRESHED / USER_UPDATED — silent update, no loading change
        const sessionUser = session?.user ?? null
        if (sessionUser) setUser(sessionUser)
      }
    )

    // Re-check profile when tab becomes active — catches deactivation while away
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session } } = await supabaseBranchManager.auth.getSession()
        if (session?.user) {
          _bmProfileCache = null
          _bmProfileCacheUserId = null
          await fetchProfile(session.user.id)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Safety-net: if INITIAL_SESSION never fires, unblock ProtectedRoute after 5 s
    const timer = setTimeout(() => setLoading(false), 5000)

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  async function signOut() {
    _bmProfileCache = null
    _bmProfileCacheUserId = null
    await supabaseBranchManager.auth.signOut()
    setUser(null)
    setProfile(null)
    setOwnerSubscription(null)
  }

  const ownerHasAccess = ownerSubscription === undefined
    ? null  // still fetching
    : ownerSubscription === null
    ? false  // no subscription row = no access (fail-closed)
    : (ownerSubscription.status === 'active' || ownerSubscription.status === 'trial')
    ? true
    : false

  return (
    <BranchManagerAuthContext.Provider value={{ user, profile, loading, signOut, ownerSubscription, ownerHasAccess }}>
      {children}
    </BranchManagerAuthContext.Provider>
  )
}

export function useBranchManagerAuth() {
  return useContext(BranchManagerAuthContext)
}
