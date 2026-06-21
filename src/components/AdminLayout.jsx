import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export const NAV = [
  { icon: 'ti-layout-dashboard', label: 'Dashboard',     labelAr: 'لوحة التحكم',  path: '/admin/dashboard'     },
  { icon: 'ti-building-store',   label: 'Restaurants',   labelAr: 'المطاعم',      path: '/admin/restaurants'   },
  { icon: 'ti-credit-card',      label: 'Subscriptions', labelAr: 'الاشتراكات',   path: '/admin/subscriptions' },
  { icon: 'ti-chart-bar',        label: 'Analytics',     labelAr: 'التحليلات',    path: '/admin/analytics'     },
  { icon: 'ti-bell',             label: 'Notifications', labelAr: 'الإشعارات',    path: '/admin/notifications' },
  { icon: 'ti-settings',         label: 'Settings',      labelAr: 'الإعدادات',    path: '/admin/settings'      },
  { icon: 'ti-list',             label: 'Activity Log',  labelAr: 'سجل النشاط',   path: '/admin/activity-log'  },
]

export function AdminSidebar({ currentPath, profile, isAr, handleSignOut, isMobile, isOpen, onClose }) {
  const initials  = (profile?.name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const adminName = isAr ? profile?.name_ar || profile?.name : profile?.name || '—'

  const sidebarStyle = {
    width: 200,
    background: '#fff',
    borderRight: isAr ? 'none' : '0.5px solid #E5E7EB',
    borderLeft: isAr ? '0.5px solid #E5E7EB' : 'none',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    ...(isMobile ? {
      position: 'fixed',
      top: 0,
      [isAr ? 'right' : 'left']: 0,
      height: '100vh',
      zIndex: 1000,
      transform: `translateX(${isAr ? (isOpen ? 0 : 200) : (isOpen ? 0 : -200)}px)`,
      transition: 'transform 0.3s ease',
      boxShadow: isOpen ? (isAr ? '-4px 0 20px rgba(0,0,0,0.15)' : '4px 0 20px rgba(0,0,0,0.15)') : 'none',
    } : {}),
  }

  return (
    <div style={sidebarStyle}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid #E5E7EB' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1B4332' }}>Scop</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {isAr ? 'إدارة المنصة' : 'Platform Admin'}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px 4px' }}>
        {NAV.map(item => {
          const isActive = item.path === currentPath
          return (
            <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }}
              onClick={() => { if (isMobile && onClose) onClose() }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 10, fontSize: 13, marginBottom: 2,
                background: isActive ? '#F0FDF4' : 'transparent',
                color:      isActive ? '#1B4332' : '#6B7280',
                fontWeight: isActive ? 600 : 400,
                borderLeft:  isActive && !isAr ? '3px solid #1B4332' : '3px solid transparent',
                borderRight: isActive &&  isAr ? '3px solid #1B4332' : '3px solid transparent',
              }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 16, width: 20, textAlign: 'center' }} />
                {isAr ? item.labelAr : item.label}
              </div>
            </Link>
          )
        })}
      </div>
      <div style={{ padding: 16, borderTop: '0.5px solid #E5E7EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1B4332', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{isAr ? 'مشرف عام' : 'Super Admin'}</div>
          </div>
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Sign out">
            <i className="ti ti-logout" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout({ currentPath, profile, isAr, handleSignOut, title, titleAr, topbarRight, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F0FDF4', fontFamily: isAr ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif" }}>

      {/* Overlay — closes sidebar on tap outside */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999 }}
        />
      )}

      <AdminSidebar
        currentPath={currentPath}
        profile={profile}
        isAr={isAr}
        handleSignOut={handleSignOut}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E7EB', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(p => !p)}
                style={{ background:'none', border:'none', cursor:'pointer', padding:'8px', fontSize:20, color:'#111827', display:'flex', alignItems:'center', minWidth:44, minHeight:44, justifyContent:'center' }}
              >
                ☰
              </button>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              {isAr ? titleAr : title}
            </div>
          </div>
          {topbarRight && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {topbarRight}
            </div>
          )}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .skeleton { background: #E5E7EB; border-radius: 12px; animation: pulse 1.5s ease-in-out infinite; }
        a { text-decoration: none; }
      `}</style>
    </div>
  )
}
