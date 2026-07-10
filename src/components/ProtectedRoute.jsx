import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

/** Timeout 8000ms. Never clear localStorage. Must check user AND profile. */
export default function ProtectedRoute({ useAuthHook, loginPath }) {
  const { user, profile, loading } = useAuthHook()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

  if (timedOut && loading) {
    return <Navigate to={loginPath} replace />
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: 'var(--bg-page)', flexDirection: 'column', gap: 12,
      }}>
        <div className="animate-spin" style={{
          width: 32, height: 32, border: '3px solid #E5E7EB',
          borderTopColor: '#1B4332', borderRadius: '50%',
        }} />
        <span style={{ color: '#6B7280', fontSize: 13 }}>Loading…</span>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to={loginPath} replace />
  }

  return <Outlet />
}
