import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { useLanguage } from '../context/LanguageContext'
import ScopLogo from './ScopLogo'
import ErrorBoundary from './ErrorBoundary'

const DVH = typeof window !== 'undefined' && window.CSS?.supports?.('height', '100dvh')
  ? '100dvh'
  : '100vh'

/**
 * Shared panel chrome: sidebar + topbar + mobile hamburger.
 * Pass panel-specific nav + signOut. Never mix clients here.
 */
export default function PanelShell({
  brandSub,
  brandSubAr,
  navItems,
  sections,
  activePath,
  title,
  titleAr,
  profileName,
  onSignOut,
  topbarRight,
  children,
}) {
  const { isAr, toggleLang } = useLanguage()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const initials = (profileName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const sectionKeys = sections ? Object.keys(sections) : ['main']

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
    } : {}),
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        display: 'flex',
        height: DVH,
        overflow: 'hidden',
        background: 'var(--bg-page)',
        fontFamily: isAr ? 'var(--font-sans-ar)' : 'var(--font-sans-en)',
      }}
    >
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }}
        />
      )}

      <aside style={sidebarStyle}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <ScopLogo variant="sidebar" />
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {isAr ? brandSubAr : brandSub}
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {sectionKeys.map(section => (
            <div key={section} style={{ padding: '12px 12px 4px' }}>
              {sections?.[section] && (
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
                  letterSpacing: '1px', padding: '0 8px 8px',
                }}>
                  {isAr ? sections[section].ar : sections[section].en}
                </div>
              )}
              {navItems.filter(i => (i.section || 'main') === section).map(item => {
                const isActive = item.path === activePath
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => { if (isMobile) setSidebarOpen(false) }}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 10, fontSize: 13, marginBottom: 2,
                      background: isActive ? '#F0FDF4' : 'transparent',
                      color: isActive ? '#1B4332' : '#6B7280',
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {isAr ? item.labelAr : item.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: 14, borderTop: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', background: '#1B4332', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profileName || '—'}
              </div>
            </div>
          </div>
          <button
            onClick={async () => { await onSignOut(); navigate('/') }}
            style={{
              width: '100%', padding: '8px 10px', background: '#F9FAFB', border: '1px solid #E5E7EB',
              borderRadius: 10, fontSize: 12, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isAr ? 'تسجيل الخروج' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          height: 52, background: '#fff', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', gap: 12, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Menu"
                style={{
                  background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10,
                  width: 40, height: 40, cursor: 'pointer', fontSize: 18, fontFamily: 'inherit',
                }}
              >
                ☰
              </button>
            )}
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isAr ? (titleAr || title) : title}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={toggleLang}
              style={{
                fontSize: 12, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB',
                padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40,
              }}
            >
              {isAr ? 'EN' : 'ع'}
            </button>
            {topbarRight}
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: isMobile ? 14 : 20 }}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
