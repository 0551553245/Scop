import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useOwnerAuth } from '../context/OwnerAuthContext'
import { useLanguage } from '../context/LanguageContext'
import { prefetchOwnerTasks } from '../lib/prefetch'
import NotificationBell from './NotificationBell'

const DVH = window.CSS?.supports('height', '100dvh') ? '100dvh' : '100vh'

const NAV_ITEMS = [
  { icon:'⊞', label:'Dashboard',       labelAr:'لوحة التحكم',  path:'/owner/dashboard',    section:'main' },
  { icon:'🏪', label:'Branches',        labelAr:'الفروع',        path:'/owner/branches',     section:'main' },
  { icon:'👥', label:'Managers',        labelAr:'المديرون',      path:'/owner/managers',     section:'main' },
  { icon:'✓',  label:'Task Management', labelAr:'إدارة المهام',  path:'/owner/tasks',        section:'ops'  },
  { icon:'🛡', label:'Food Safety',     labelAr:'سلامة الغذاء', path:'/owner/food-safety',  section:'ops'  },
  { icon:'📅', label:'Schedule',        labelAr:'الجدول',        path:'/owner/schedule',     section:'ops'  },
  { icon:'📊', label:'Reports',         labelAr:'التقارير',      path:'/owner/reports',      section:'rep'  },
  { icon:'💳', label:'Subscription',    labelAr:'الاشتراك',      path:'/owner/subscription', section:'rep'  },
]

const SECTIONS = {
  main: { en:'Main',       ar:'الرئيسية' },
  ops:  { en:'Operations', ar:'العمليات' },
  rep:  { en:'Reports',    ar:'التقارير' },
}

export default function OwnerLayout({ activePath, title, titleAr, topbarLeft, topbarRight, branches = [], children }) {
  const navigate = useNavigate()
  const { profile, signOut } = useOwnerAuth()
  const { isAr, toggleLang } = useLanguage()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const name     = isAr ? profile?.name_ar || profile?.name : profile?.name || '—'
  const initials = (profile?.name || 'O').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()


  const defaultTopbarRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={toggleLang} style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, display: 'flex', alignItems: 'center' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
      <NotificationBell isAr={isAr} />
    </div>
  )

  const sidebarStyle = {
    width: 220,
    background: '#fff',
    borderRight: isAr ? 'none' : '1px solid #E5E7EB',
    borderLeft: isAr ? '1px solid #E5E7EB' : 'none',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    ...(isMobile ? {
      position: 'fixed',
      top: 0,
      [isAr ? 'right' : 'left']: 0,
      height: DVH,
      zIndex: 1000,
      transform: `translateX(${isAr ? (sidebarOpen ? 0 : 220) : (sidebarOpen ? 0 : -220)}px)`,
      transition: 'transform 0.3s ease',
      boxShadow: sidebarOpen ? (isAr ? '-4px 0 20px rgba(0,0,0,0.15)' : '4px 0 20px rgba(0,0,0,0.15)') : 'none',
    } : {}),
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F0FDF4', fontFamily: isAr ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif" }}>

      {/* Overlay — closes sidebar on tap outside */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999 }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div style={sidebarStyle}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1B4332', letterSpacing: '-0.5px' }}>Scop</div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {isAr ? 'عمليات المطاعم' : 'Restaurant Operations'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {['main', 'ops', 'rep'].map(section => (
            <div key={section} style={{ padding: '12px 12px 4px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 8px 8px' }}>
                {isAr ? SECTIONS[section].ar : SECTIONS[section].en}
              </div>
              {NAV_ITEMS.filter(i => i.section === section).map(item => {
                const isActive = item.path === activePath
                return (
                  <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }}
                    onClick={() => { if (isMobile) setSidebarOpen(false) }}
                    onMouseEnter={item.path === '/owner/tasks' && branches.length > 0
                      ? () => prefetchOwnerTasks(profile?.id, branches.map(b => b.id))
                      : undefined}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 10,
                      fontSize: 13, marginBottom: 2, cursor: 'pointer',
                      background: isActive ? '#F0FDF4' : 'transparent',
                      color:      isActive ? '#1B4332' : '#6B7280',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                      {isAr ? item.labelAr : item.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1B4332', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{isAr ? 'مالك المطعم' : 'Restaurant Owner'}</div>
            </div>
            <button onClick={async () => { await signOut(); navigate('/owner/login') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Sign out">↪</button>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: isMobile ? '0 8px' : '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(p => !p)}
                style={{ background:'none', border:'none', cursor:'pointer', padding:'8px', fontSize:20, color:'#111827', display:'flex', alignItems:'center', minWidth:44, minHeight:44, justifyContent:'center' }}
              >
                ☰
              </button>
            )}
            {topbarLeft || <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{isAr ? titleAr || title : title}</div>}
          </div>
          <div style={{ flexShrink: 1, minWidth: 0 }}>{topbarRight || defaultTopbarRight}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap');
        a { text-decoration: none; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .skeleton { background:#E5E7EB; border-radius:12px; animation:pulse 1.5s ease-in-out infinite }
      `}</style>
    </div>
  )
}
