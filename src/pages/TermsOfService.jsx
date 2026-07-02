import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import ScopLogo from '../components/ScopLogo'

const h2s = { fontSize: 14, fontWeight: 700, color: '#1B4332', margin: '0 0 8px' }
const sec = { marginBottom: 22 }
const txt = { fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0 }
const uls = { fontSize: 13, color: '#374151', lineHeight: 1.8, margin: '4px 0 0', paddingInlineStart: 20 }

export default function TermsOfService() {
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B4332', margin: '0 0 4px' }}>شروط الخدمة</h1>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 28px' }}>آخر تحديث: يوليو 2026</p>

          <div style={sec}>
            <h2 style={h2s}>١. القبول</h2>
            <p style={txt}>بإنشاء حساب على سكوب، فإنك توافق على هذه الشروط. إن لم توافق عليها، يُرجى عدم استخدام الخدمة.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٢. الخدمة</h2>
            <p style={txt}>توفّر سكوب منصة سحابية لإدارة عمليات المطاعم، تشمل إدارة المهام وتتبّع سلامة الغذاء وأدوات الجدولة الزمنية لأصحاب المطاعم ومديري الفروع في المملكة العربية السعودية.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٣. حسابك</h2>
            <ul style={uls}>
              <li>يجب تقديم معلومات دقيقة وكاملة عند التسجيل</li>
              <li>أنت مسؤول عن الحفاظ على سرية كلمة مرورك</li>
              <li>أنت مسؤول عن جميع الأنشطة التي تتم تحت حسابك</li>
              <li>يجب أن يكون عمرك 18 عاماً على الأقل لإنشاء حساب</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٤. الاستخدام المقبول</h2>
            <p style={{ ...txt, marginBottom: 4 }}>توافق على عدم القيام بما يلي:</p>
            <ul style={uls}>
              <li>مشاركة بيانات اعتماد حسابك مع مستخدمين غير مصرّح لهم</li>
              <li>استخدام سكوب لتخزين بيانات تشغيلية كاذبة أو مضللة</li>
              <li>محاولة الوصول إلى بيانات مطاعم أخرى</li>
              <li>إجراء هندسة عكسية أو نسخ أي جزء من المنصة</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٥. توافر الخدمة</h2>
            <ul style={uls}>
              <li>نهدف إلى توفر 99% ولكن لا نضمن الخدمة دون انقطاع</li>
              <li>سيتم الإعلان عن أعمال الصيانة المجدولة مسبقاً كلما أمكن ذلك</li>
              <li>لسنا مسؤولين عن الخسائر الناجمة عن انقطاعات مؤقتة في الخدمة</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٦. الاشتراك والفوترة</h2>
            <ul style={uls}>
              <li>تُقيَّم الاشتراكات بالريال السعودي (SAR)</li>
              <li>تتم معالجة المدفوعات بأمان عبر شركة ميسر المالية</li>
              <li>رسوم الاشتراك غير قابلة للاسترداد إلا وفق ما هو موضّح في سياسة الاسترجاع</li>
              <li>نحتفظ بحق تغيير الأسعار مع إشعار مدته 30 يوماً</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٧. الإنهاء</h2>
            <ul style={uls}>
              <li>يمكنك إلغاء اشتراكك في أي وقت</li>
              <li>قد نوقف أو نُنهي الحسابات التي تنتهك هذه الشروط</li>
              <li>عند الإنهاء، ستُحذف بياناتك خلال 30 يوماً</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>٨. القانون الحاكم</h2>
            <p style={txt}>تخضع هذه الشروط لأنظمة المملكة العربية السعودية.</p>
          </div>

          <div style={{ ...sec, marginBottom: 0 }}>
            <h2 style={h2s}>٩. تواصل معنا</h2>
            <p style={txt}>البريد الإلكتروني: noreply@scopsa.com<br />الموقع: scopsa.com</p>
          </div>
        </div>

        {/* ── English ── */}
        <div dir="ltr" style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 16, padding: '28px 24px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B4332', margin: '0 0 4px' }}>Terms of Service</h1>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 28px' }}>Last updated: July 2026</p>

          <div style={sec}>
            <h2 style={h2s}>1. Acceptance</h2>
            <p style={txt}>By creating a Scop account, you agree to these terms. If you do not agree, do not use the service.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>2. The Service</h2>
            <p style={txt}>Scop provides a cloud-based restaurant operations management platform including task management, food safety tracking, and scheduling tools for restaurant owners and branch managers in Saudi Arabia.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>3. Your Account</h2>
            <ul style={uls}>
              <li>You must provide accurate and complete information when registering</li>
              <li>You are responsible for keeping your password secure</li>
              <li>You are responsible for all activity that occurs under your account</li>
              <li>You must be at least 18 years old to create an account</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>4. Acceptable Use</h2>
            <p style={{ ...txt, marginBottom: 4 }}>You agree not to:</p>
            <ul style={uls}>
              <li>Share your account credentials with unauthorized users</li>
              <li>Use Scop to store false or misleading operational data</li>
              <li>Attempt to access other restaurants' data</li>
              <li>Reverse engineer or copy any part of the platform</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>5. Service Availability</h2>
            <ul style={uls}>
              <li>We aim for 99% uptime but do not guarantee uninterrupted service</li>
              <li>Scheduled maintenance will be announced in advance when possible</li>
              <li>We are not liable for losses caused by temporary service interruptions</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>6. Subscription and Billing</h2>
            <ul style={uls}>
              <li>Subscriptions are billed in Saudi Riyals (SAR)</li>
              <li>Payments are processed securely by Moyasar Financial Company</li>
              <li>Subscription fees are non-refundable except as described in the Refund Policy</li>
              <li>We reserve the right to change pricing with 30 days notice</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>7. Termination</h2>
            <ul style={uls}>
              <li>You may cancel your subscription at any time</li>
              <li>We may suspend or terminate accounts that violate these terms</li>
              <li>Upon termination, your data will be deleted within 30 days</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>8. Governing Law</h2>
            <p style={txt}>These terms are governed by the laws of the Kingdom of Saudi Arabia.</p>
          </div>

          <div style={{ ...sec, marginBottom: 0 }}>
            <h2 style={h2s}>9. Contact Us</h2>
            <p style={txt}>Email: noreply@scopsa.com<br />Website: scopsa.com</p>
          </div>
        </div>

      </div>
    </div>
  )
}
