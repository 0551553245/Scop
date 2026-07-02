import { createContext, useContext, useEffect, useState } from 'react'
import { supabaseAdmin } from '../lib/supabase'

const AdminAuthContext = createContext(null)

let _adminCache = null
let _adminCacheUserId = null

export function AdminAuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // Supabase auth user
  const [profile, setProfile] = useState(null)   // public.users row
  const [loading, setLoading] = useState(true)

  // Fetch profile from public.users
  async function fetchProfile(userId) {
    // Return cached profile if same user — avoids DB round trip on every navigation
    if (_adminCacheUserId === userId && _adminCache) {
      setProfile(_adminCache)
      return _adminCache
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, name_ar, email, role, is_active')
      .eq('id', userId)
      .single()

    if (error || !data) {
      // Network error or profile missing — keep the auth session, just clear the profile
      setProfile(null)
      return null
    }

    // Security: sign out only when we have a confirmed profile with the wrong role
    if (data.role !== 'super_admin' || !data.is_active) {
      await supabaseAdmin.auth.signOut()
      setUser(null)
      setProfile(null)
      _adminCache = null
      _adminCacheUserId = null
      return null
    }

    _adminCache = data
    _adminCacheUserId = userId
    setProfile(data)
    return data
  }

  useEffect(() => {
    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange(
      async (_event, session) => {
        if (_event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          _adminCache = null
          _adminCacheUserId = null
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

    // Safety-net: if INITIAL_SESSION never fires, unblock ProtectedRoute after 8 s
    const timer = setTimeout(() => setLoading(false), 8000)

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    _adminCache = null
    _adminCacheUserId = null
    await supabaseAdmin.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AdminAuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminAuthContext)
}
