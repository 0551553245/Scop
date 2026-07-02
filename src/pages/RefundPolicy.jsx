import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import ScopLogo from '../components/ScopLogo'

const h2s = { fontSize: 14, fontWeight: 700, color: '#1B4332', margin: '0 0 8px' }
const sec = { marginBottom: 22 }
const txt = { fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0 }
const uls = { fontSize: 13, color: '#374151', lineHeight: 1.8, margin: '4px 0 0', paddingInlineStart: 20 }

export default function RefundPolicy() {
  const { isAr } = useLanguage()

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E7EB', height: 52, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 20 }}>
        <Link to="/" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {isAr ? 'رجوع →' : '← Back'}
        </Link>
        <ScopLogo variant="sidebar" />
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>

        {/* ── Arabic ── */}
        <div dir="rtl" style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 16, padding: '28px 24px', marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B4332', margin: '0 0 4px' }}>سياسة الاسترجاع</h1>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 28px' }}>آخر تحديث: يوليو 2026</p>

          <div style={sec}>
            <h2 style={h2s}>١. التجربة المجانية</h2>
            <p style={txt}>تبدأ جميع الحسابات الجديدة بتجربة مجانية مدتها 14 يوماً. لا يُطلب أي دفع خلال فترة التجربة. يمكنك الإلغاء في أي وقت أثناء التجربة دون أي رسوم.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٢. مدفوعات الاشتراك</h2>
            <ul style={uls}>
              <li>تُحصَّل رسوم الاشتراك في بداية كل فترة فوترة</li>
              <li>تتم جميع المدفوعات بالريال السعودي (SAR) عبر شركة ميسر المالية</li>
              <li>جميع المدفوعات نهائية وغير قابلة للاسترداد بمجرد معالجتها</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٣. الاستثناءات — متى نُصدر المبالغ المستردة</h2>
            <ul style={uls}>
              <li>رسوم مزدوجة: إذا تم احتساب رسوم مرتين على نفس الفترة، تواصل معنا خلال 7 أيام للحصول على استرداد كامل للرسوم المكررة</li>
              <li>مبلغ خاطئ: إذا تم احتساب مبلغ غير صحيح، تواصل معنا خلال 7 أيام</li>
              <li>انقطاع مطوّل: إذا تجاوز الانقطاع 24 ساعة متواصلة، سيحصل العملاء المتأثرون على رصيد نسبي عن الفترة المتأثرة</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٤. كيفية طلب الاسترداد</h2>
            <p style={{ ...txt, marginBottom: 8 }}>أرسل بريداً إلكترونياً إلى noreply@scopsa.com مع:</p>
            <ul style={uls}>
              <li>عنوان البريد الإلكتروني لحسابك</li>
              <li>وصف للمشكلة</li>
              <li>تاريخ الرسوم المحتسبة</li>
            </ul>
            <p style={{ ...txt, marginTop: 8 }}>نرد خلال يومي عمل.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٥. الإلغاء</h2>
            <ul style={uls}>
              <li>يمكنك إلغاء اشتراكك في أي وقت من إعدادات حسابك</li>
              <li>يسري الإلغاء في نهاية فترة الفوترة الحالية</li>
              <li>تحتفظ بالوصول الكامل حتى نهاية الفترة المدفوعة</li>
              <li>لن تُحاسَب مرة أخرى بعد الإلغاء</li>
            </ul>
          </div>

          <div style={{ ...sec, marginBottom: 0 }}>
            <h2 style={h2s}>٦. تواصل معنا</h2>
            <p style={txt}>البريد الإلكتروني: noreply@scopsa.com<br />الموقع: scopsa.com</p>
          </div>
        </div>

        {/* ── English ── */}
        <div dir="ltr" style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 16, padding: '28px 24px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B4332', margin: '0 0 4px' }}>Refund Policy</h1>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 28px' }}>Last updated: July 2026</p>

          <div style={sec}>
            <h2 style={h2s}>1. Free Trial</h2>
            <p style={txt}>All new accounts start with a 14-day free trial. No payment is required during the trial period. You can cancel at any time during the trial with no charge.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>2. Subscription Payments</h2>
            <ul style={uls}>
              <li>Subscriptions are charged at the start of each billing period</li>
              <li>All payments are processed in Saudi Riyals (SAR) via Moyasar Financial Company</li>
              <li>All payments are final and non-refundable once processed</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>3. Exceptions — When We Issue Refunds</h2>
            <ul style={uls}>
              <li>Duplicate charge: if you were charged twice for the same period, contact us within 7 days for a full refund of the duplicate charge</li>
              <li>Wrong amount: if you were charged an incorrect amount, contact us within 7 days</li>
              <li>Extended downtime: if Scop experiences downtime exceeding 24 consecutive hours, affected customers will receive a pro-rated credit for the affected period</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>4. How to Request a Refund</h2>
            <p style={{ ...txt, marginBottom: 8 }}>Email noreply@scopsa.com with:</p>
            <ul style={uls}>
              <li>Your account email address</li>
              <li>Description of the issue</li>
              <li>Date of the charge</li>
            </ul>
            <p style={{ ...txt, marginTop: 8 }}>We respond within 2 business days.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>5. Cancellation</h2>
            <ul style={uls}>
              <li>You may cancel your subscription at any time from your account settings</li>
              <li>Cancellation takes effect at the end of the current billing period</li>
              <li>You retain full access until the end of the paid period</li>
              <li>You will not be charged again after cancellation</li>
            </ul>
          </div>

          <div style={{ ...sec, marginBottom: 0 }}>
            <h2 style={h2s}>6. Contact Us</h2>
            <p style={txt}>Email: noreply@scopsa.com<br />Website: scopsa.com</p>
          </div>
        </div>

      </div>
    </div>
  )
}
