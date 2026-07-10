import { createContext, useContext, useEffect, useState } from 'react'
import { supabaseOwner } from '../lib/supabase'

const OwnerAuthContext = createContext(null)

let _profileCache = null
let _profileCacheUserId = null

export function OwnerAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    if (_profileCacheUserId === userId && _profileCache) {
      setProfile(_profileCache)
      return _profileCache
    }

    const { data, error } = await supabaseOwner
      .from('users')
      .select('id, name, name_ar, email, phone, role, branch_id, is_active, created_at')
      .eq('id', userId)
      .single()

    // Path B: missing profile → signOut (BUG #148 / #144)
    if (error || !data) {
      await supabaseOwner.auth.signOut()
      setUser(null)
      setProfile(null)
      _profileCache = null
      _profileCacheUserId = null
      setLoading(false)
      return null
    }

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
    const { data: { subscription } } = supabaseOwner.auth.onAuthStateChange(
      async (_event, session) => {
        if (_event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          _profileCache = null
          _profileCacheUserId = null
          setLoading(false)
          return
        }
        if (_event === 'INITIAL_SESSION' || _event === 'SIGNED_IN') {
          setLoading(true)
          const sessionUser = session?.user ?? null
          setUser(sessionUser)
          if (sessionUser) await fetchProfile(sessionUser.id)
          else setProfile(null)
          setLoading(false)
          return
        }
        const sessionUser = session?.user ?? null
        if (sessionUser) setUser(sessionUser)
      }
    )

    const timer = setTimeout(() => setLoading(false), 5000)
    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    _profileCache = null
    _profileCacheUserId = null
    await supabaseOwner.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <OwnerAuthContext.Provider value={{ user, profile, loading, signOut, setUser, setProfile }}>
      {children}
    </OwnerAuthContext.Provider>
  )
}

export function useOwnerAuth() {
  return useContext(OwnerAuthContext)
}
