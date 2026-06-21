import { createContext, useContext, useEffect, useState } from 'react'
import { supabaseOwner } from '../lib/supabase'

const OwnerAuthContext = createContext(null)

let _profileCache = null
let _profileCacheUserId = null

export function OwnerAuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // Supabase auth user
  const [profile, setProfile] = useState(null)   // public.users row
  const [loading, setLoading] = useState(true)

  // Fetch profile from public.users
  async function fetchProfile(userId) {
    // Return cached profile if same user — avoids DB round trip on every navigation
    if (_profileCacheUserId === userId && _profileCache) {
      setProfile(_profileCache)
      return _profileCache
    }

    const { data, error } = await supabaseOwner
      .from('users')
      .select('id, name, name_ar, email, phone, role, branch_id, is_active, created_at')
      .eq('id', userId)
      .single()

    if (error || !data) {
      // Network error or profile missing — keep the auth session, just clear the profile
      setProfile(null)
      return null
    }

    // Security: sign out only when we have a confirmed profile with the wrong role
    if (data.role !== 'owner' || !data.is_active) {
      await supabaseOwner.auth.signOut()
      setUser(null)
      setProfile(null)
      _profileCache = null
      _profileCacheUserId = null
      return null
    }

    _profileCache = data
    _profileCacheUserId = userId
    setProfile(data)
    return data
  }

  useEffect(() => {
    // Initialize from existing session with a 5-second timeout
    const sessionPromise = supabaseOwner.auth.getSession().then(r => ({ ...r, timedOut: false }))
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 5000))

    Promise.race([sessionPromise, timeoutPromise]).then(async (result) => {
      if (result.timedOut) {
        setLoading(false)
        return
      }

      const sessionUser = result.data?.session?.user ?? null
      setUser(sessionUser)

      if (sessionUser) {
        await fetchProfile(sessionUser.id)
      }

      setLoading(false)
    })

    // Subscribe to auth state changes
    const { data: { subscription } } = supabaseOwner.auth.onAuthStateChange(
      async (_event, session) => {
        if (_event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          _profileCache = null
          _profileCacheUserId = null
          return
        }
        const sessionUser = session?.user ?? null
        setUser(sessionUser)
        if (sessionUser) {
          await fetchProfile(sessionUser.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    _profileCache = null
    _profileCacheUserId = null
    await supabaseOwner.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <OwnerAuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </OwnerAuthContext.Provider>
  )
}

export function useOwnerAuth() {
  return useContext(OwnerAuthContext)
}
