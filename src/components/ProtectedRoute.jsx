import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute({ useAuthHook, loginPath }) {
  const { user, loading } = useAuthHook()
  const [timedOut, setTimedOut] = useState(false)

  // If loading takes more than 8 seconds, force redirect to login
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

  // Timed out — DO NOT clear localStorage or sessionStorage
  if (timedOut && loading) {
    return <Navigate to={loginPath} replace />
  }

  if (loading) {
    return (
      <div style={{
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'center',
        height:         '100vh',
        background:     '#F7F5F0',
        flexDirection:  'column',
        gap:            12,
      }}>
        <div style={{
          width:           32,
          height:          32,
          border:          '3px solid #E5E7EB',
          borderTopColor:  '#1B4332',
          borderRadius:    '50%',
          animation:       'spin 0.8s linear infinite',
        }} />
        <span style={{ color: '#6B7280', fontSize: 13 }}>Loading…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={loginPath} replace />
  }

  return <Outlet />
}
