import { useNavigate } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../lib/platformSettings'

function waLink(num) {
  const resolved = num || DEFAULT_SETTINGS.support_whatsapp
  if (!resolved) return null
  const digits = resolved.replace(/[^\d]/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}`
}

export default function SubscriptionBanner({ subscription, daysLeft, isTrial, isExpired, expiringSoon, isAr, supportWhatsapp }) {
  const navigate = useNavigate()
  if (!subscription) return null
  if (!isTrial && !isExpired && !expiringSoon) return null

  // Expired/blocked banner
  if (isExpired) return (
    <div style={{
      background: '#FFF1F2', border: '0.5px solid #FECDD3',
      borderRadius: 12, padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#9F1239' }}>
            {isAr ? 'انتهت صلاحية اشتراكك' : 'Your subscription has expired'}
          </div>
          <div style={{ fontSize: 11, color: '#F43F5E', marginTop: 2 }}>
            {isAr
              ? 'لا يستطيع مديرو الفروع إرسال المهام. تواصل معنا لتجديد الاشتراك.'
              : 'Branch managers cannot submit tasks. Contact us to renew your plan.'}
          </div>
        </div>
      </div>
      {waLink(supportWhatsapp) && (
        <a href={waLink(supportWhatsapp)} target="_blank" rel="noopener noreferrer"
          style={{ padding: '8px 16px', background: '#F43F5E', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
          {isAr ? 'تجديد الآن' : 'Renew Now'}
        </a>
      )}
    </div>
  )

  // Expiring soon banner (within 5 days)
  if (expiringSoon) return (
    <div style={{
      background: '#FFF7ED', border: '0.5px solid #FDE68A',
      borderRadius: 12, padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#92400E' }}>
            {isAr ? `ينتهي اشتراكك خلال ${daysLeft} أيام` : `Your plan expires in ${daysLeft} days`}
          </div>
          <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
            {isAr ? 'جدد الآن لتجنب انقطاع الخدمة' : 'Renew now to avoid service interruption'}
          </div>
        </div>
      </div>
      {waLink(supportWhatsapp) && (
        <a href={waLink(supportWhatsapp)} target="_blank" rel="noopener noreferrer"
          style={{ padding: '8px 16px', background: '#F59E0B', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
          {isAr ? 'تجديد الآن' : 'Renew Now'}
        </a>
      )}
    </div>
  )

  // Trial banner
  if (isTrial) return (
    <div style={{
      background: '#F0FDF4', border: '0.5px solid #BBF7D0',
      borderRadius: 12, padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#166534' }}>
            {isAr ? `أنت في فترة التجربة المجانية · ${daysLeft} يوم متبقي` : `Free trial · ${daysLeft} days remaining`}
          </div>
          <div style={{ fontSize: 11, color: '#166534', marginTop: 2, opacity: 0.7 }}>
            {isAr ? 'وصول كامل لجميع الميزات خلال فترة التجربة' : 'Full access to all features during trial'}
          </div>
        </div>
      </div>
      <button
        onClick={() => {
          const el = document.getElementById('upgrade-section')
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' })
          } else {
            navigate('/owner/subscription')
          }
        }}
        style={{ padding: '8px 16px', background: '#1B4332', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {isAr ? 'عرض الخطط' : 'View Plans'}
      </button>
    </div>
  )

  return null
}
