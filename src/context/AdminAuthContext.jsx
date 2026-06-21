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
    // Initialize from existing session with an 8-second timeout
    const sessionPromise = supabaseAdmin.auth.getSession().then(r => ({ ...r, timedOut: false }))
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 8000))

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
    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange(
      async (_event, session) => {
        if (_event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          _adminCache = null
          _adminCacheUserId = null
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
