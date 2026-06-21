import { useEffect, useRef } from 'react'
import { useOwnerAuth } from '../context/OwnerAuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { useNotifications } from '../hooks/useNotifications'

export default function NotificationBell({ isAr }) {
  const { profile } = useOwnerAuth()
  const { subscription } = useSubscription()
  const { notifications, unreadCount, open, setOpen, markAllRead } = useNotifications()
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, setOpen])

  if (!profile?.id || !subscription) return <div style={{ width: 32, height: 32 }} />

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        onClick={() => { setOpen(p => !p); if (!open) markAllRead() }}
        style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: unreadCount > 0 ? '#1B4332' : '#F0FDF4',
          border: `1px solid ${unreadCount > 0 ? '#1B4332' : '#BBF7D0'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative',
          transition: 'all 0.2s',
        }}
      >
        <i
          className="ti ti-bell"
          style={{ fontSize: 17, color: unreadCount > 0 ? '#fff' : '#1B4332' }}
          aria-hidden="true"
        />
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            minWidth: 18, height: 18,
            background: '#E24B4A',
            borderRadius: 20,
            border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff',
            padding: '0 4px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 40,
          ...(isAr ? { left: 0 } : { right: 0 }),
          width: 300, background: '#fff',
          border: '0.5px solid #E5E7EB', borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '0.5px solid #E5E7EB',
            fontSize: 13, fontWeight: 500, color: '#111827',
          }}>
            {isAr ? 'الإشعارات' : 'Notifications'}
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                {isAr ? 'لا توجد إشعارات' : 'No notifications yet'}
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{ padding: '12px 16px', borderBottom: '0.5px solid #F3F4F6' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', marginBottom: 2 }}>
                    {isAr ? n.title_ar || n.title : n.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                    {isAr ? n.message_ar || n.message : n.message}
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                    {new Date(n.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
