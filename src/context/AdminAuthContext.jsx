import { createContext, useContext, useEffect, useState } from 'react'
import { supabaseAdmin } from '../lib/supabase'

const AdminAuthContext = createContext(null)

let _adminCache = null
let _adminCacheUserId = null

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
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
      await supabaseAdmin.auth.signOut()
      setUser(null)
      setProfile(null)
      _adminCache = null
      _adminCacheUserId = null
      setLoading(false)
      return null
    }

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
          if (sessionUser) await fetchProfile(sessionUser.id)
          else setProfile(null)
          setLoading(false)
          return
        }
        const sessionUser = session?.user ?? null
        if (sessionUser) setUser(sessionUser)
      }
    )

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
