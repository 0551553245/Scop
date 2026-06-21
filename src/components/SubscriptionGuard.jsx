import { useState } from 'react'

export default function SubscriptionGuard({ children, isExpired, isAr }) {
  const [showWarn, setShowWarn] = useState(false)

  if (!isExpired) return children

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    setShowWarn(true)
    setTimeout(() => setShowWarn(false), 3000)
  }

  return (
    <>
      {showWarn && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#9F1239', color: '#fff', padding: '10px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
        }}>
          {isAr
            ? 'انتهت صلاحية اشتراكك. تواصل معنا لتجديد الاشتراك.'
            : 'Your subscription has expired. Contact us to renew.'}
        </div>
      )}
      <div style={{ position: 'relative', display: 'inline-block' }}
        title={isAr ? 'يتطلب اشتراكاً نشطاً' : 'Requires active subscription'}
        onClick={handleClick}
      >
        <div style={{ opacity: 0.4, pointerEvents: 'none' }}>{children}</div>
        <div style={{ position: 'absolute', inset: 0, cursor: 'not-allowed' }} />
      </div>
    </>
  )
}
