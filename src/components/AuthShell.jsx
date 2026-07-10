import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { useLanguage } from '../context/LanguageContext'
import ScopLogo from './ScopLogo'

/** Shared split-screen auth chrome for Owner / BM / Admin login pages. */
export default function AuthShell({
  portalLabel,
  portalLabelAr,
  tagline,
  taglineAr,
  children,
  footer,
}) {
  const { isAr, toggleLang } = useLanguage()
  const isMobile = useIsMobile()

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'var(--bg-page)',
        fontFamily: isAr ? 'var(--font-sans-ar)' : 'var(--font-sans-en)',
      }}
    >
      {!isMobile && (
        <div style={{
          flex: '0 0 42%',
          background: 'linear-gradient(160deg, #1B4332 0%, #142D22 100%)',
          color: '#fff',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <ScopLogo variant="full" />
            <div style={{
              marginTop: 12, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#BBF7D0',
            }}>
              {isAr ? portalLabelAr : portalLabel}
            </div>
          </div>
          <div>
            <h1 style={{
              fontSize: 36, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'pre-line', marginBottom: 12,
            }}>
              {isAr ? taglineAr : tagline}
            </h1>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            © {new Date().getFullYear()} Scop
          </div>
        </div>
      )}

      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '24px 18px' : '40px 32px', position: 'relative',
      }}>
        <button
          onClick={toggleLang}
          style={{
            position: 'absolute', top: 16, [isAr ? 'left' : 'right']: 16,
            fontSize: 12, color: '#6B7280', background: '#fff', border: '1px solid #E5E7EB',
            padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {isAr ? 'EN' : 'ع'}
        </button>

        <div style={{ width: '100%', maxWidth: 400 }}>
          {isMobile && (
            <div style={{ marginBottom: 28 }}>
              <ScopLogo variant="full" />
              <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
                {isAr ? portalLabelAr : portalLabel}
              </div>
            </div>
          )}
          {children}
          {footer && <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>{footer}</div>}
        </div>
      </div>
    </div>
  )
}

export function AuthInput({ label, type = 'text', value, onChange, placeholder, autoComplete, dir }) {
  const [show, setShow] = useState(false)
  const isPass = type === 'password'

  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <input
          type={isPass && show ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          dir={dir}
          style={{
            width: '100%', padding: isPass ? '11px 44px 11px 14px' : '11px 14px',
            border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 14,
            background: '#F9FAFB', fontFamily: 'inherit', color: '#111827', outline: 'none',
          }}
        />
        {isPass && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
              right: dir === 'rtl' ? undefined : 10, left: dir === 'rtl' ? 10 : undefined,
              background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 12,
            }}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </label>
  )
}

export function AuthButton({ loading, children, disabled }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      style={{
        width: '100%', padding: '12px 16px', marginTop: 4,
        background: loading || disabled ? '#9CA3AF' : '#1B4332',
        color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
        cursor: loading || disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

export function AuthError({ message }) {
  if (!message) return null
  return (
    <div style={{
      background: '#FFF1F2', border: '1px solid #FECACA', color: '#9F1239',
      borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14,
    }}>
      {message}
    </div>
  )
}

export function AuthLink({ to, children }) {
  return (
    <Link to={to} style={{ color: '#1B4332', fontWeight: 600, textDecoration: 'none' }}>
      {children}
    </Link>
  )
}
