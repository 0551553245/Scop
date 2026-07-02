import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import ScopLogo from '../components/ScopLogo'

const h2s = { fontSize: 14, fontWeight: 700, color: '#1B4332', margin: '0 0 8px' }
const sec = { marginBottom: 22 }
const txt = { fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0 }
const uls = { fontSize: 13, color: '#374151', lineHeight: 1.8, margin: '4px 0 0', paddingInlineStart: 20 }

export default function PrivacyPolicy() {
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B4332', margin: '0 0 4px' }}>سياسة الخصوصية</h1>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 28px' }}>آخر تحديث: يوليو 2026 · سكوب — يشغّلها محمد العيدروس، المملكة العربية السعودية · noreply@scopsa.com</p>

          <div style={sec}>
            <h2 style={h2s}>من نحن</h2>
            <p style={txt}>سكوب (Scop) هي منصة لإدارة عمليات المطاعم، يشغّلها محمد العيدروس، ومقرها في المملكة العربية السعودية.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>البيانات التي نجمعها</h2>
            <ul style={uls}>
              <li>معلومات الحساب: الاسم الكامل، البريد الإلكتروني، رقم الهاتف</li>
              <li>معلومات النشاط التجاري: اسم المطعم، أسماء الفروع، المواقع</li>
              <li>البيانات التشغيلية: المهام، قراءات سلامة الغذاء، الجداول الزمنية</li>
              <li>معلومات الدفع: تتولى معالجتها شركة ميسر المالية بالكامل — لا نخزّن أرقام البطاقات أبداً</li>
              <li>معلومات الجهاز: نوع المتصفح، عنوان IP، أوقات الوصول لأغراض أمنية</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>كيف نستخدم بياناتك</h2>
            <ul style={uls}>
              <li>لتوفير منصة سكوب وتشغيلها</li>
              <li>لإرسال رسائل تحقق الحساب وإعادة تعيين كلمة المرور</li>
              <li>لإرسال إيصالات الفوترة وإشعارات الاشتراك</li>
              <li>لتحسين المنصة بناءً على أنماط الاستخدام</li>
              <li>لن نبيع أو نؤجر أو نشارك بياناتك الشخصية مع أطراف ثالثة لأغراض تسويقية</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>أمان البيانات</h2>
            <ul style={uls}>
              <li>جميع البيانات مشفّرة أثناء النقل باستخدام TLS 1.2 أو أعلى</li>
              <li>كلمات المرور مجزّأة ولا تُخزَّن بنص عادي</li>
              <li>الوصول إلى قاعدة البيانات محمي بسياسات أمان على مستوى الصف — كل مالك مطعم يرى بياناته فقط</li>
              <li>البنية التحتية مستضافة على خوادم آمنة مدعومة بـ AWS</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>حقوقك</h2>
            <ul style={uls}>
              <li>الوصول إلى بياناتك في أي وقت من إعدادات حسابك</li>
              <li>حذف حسابك وجميع البيانات المرتبطة به بالتواصل معنا</li>
              <li>طلب نسخة من بياناتك عبر مراسلتنا على noreply@scopsa.com</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>الاحتفاظ بالبيانات</h2>
            <p style={txt}>يتم الاحتفاظ ببيانات الحساب النشط طالما حسابك نشط. بعد حذف الحساب، تُحذف البيانات نهائياً خلال 30 يوماً.</p>
          </div>

          <div style={{ ...sec, marginBottom: 0 }}>
            <h2 style={h2s}>تواصل معنا</h2>
            <p style={txt}>البريد الإلكتروني: noreply@scopsa.com<br />الموقع: scopsa.com</p>
          </div>
        </div>

        {/* ── English ── */}
        <div dir="ltr" style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 16, padding: '28px 24px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B4332', margin: '0 0 4px' }}>Privacy Policy</h1>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 28px' }}>Last updated: July 2026 · Scop — operated by Mohammed Alaydaroos, Saudi Arabia · noreply@scopsa.com · scopsa.com</p>

          <div style={sec}>
            <h2 style={h2s}>1. Who We Are</h2>
            <p style={txt}>Scop (سكوب) is a restaurant operations management platform operated by Mohammed Alaydaroos, based in Saudi Arabia.</p>
          </div>

          <div style={sec}>
            <h2 style={h2s}>2. What Data We Collect</h2>
            <ul style={uls}>
              <li>Account information: full name, email address, phone number</li>
              <li>Business information: restaurant name, branch names, locations</li>
              <li>Operational data: tasks, food safety readings, schedules</li>
              <li>Payment information: handled entirely by Moyasar Financial Company — we never store card numbers</li>
              <li>Device information: browser type, IP address, access times for security purposes</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>3. How We Use Your Data</h2>
            <ul style={uls}>
              <li>To provide and operate the Scop platform</li>
              <li>To send account verification and password reset emails</li>
              <li>To send billing receipts and subscription notifications</li>
              <li>To improve the platform based on usage patterns</li>
              <li>We will never sell, rent, or share your personal data with third parties for marketing purposes</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>4. Data Security</h2>
            <ul style={uls}>
              <li>All data is encrypted in transit using TLS 1.2+</li>
              <li>Passwords are hashed and never stored in plain text</li>
              <li>Database access is protected by Row Level Security — each restaurant owner can only access their own data</li>
              <li>Infrastructure is hosted on secure AWS-backed servers</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>5. Your Rights</h2>
            <ul style={uls}>
              <li>Access your data at any time from your account settings</li>
              <li>Delete your account and all associated data by contacting us</li>
              <li>Request a copy of your data by emailing noreply@scopsa.com</li>
            </ul>
          </div>

          <div style={sec}>
            <h2 style={h2s}>6. Data Retention</h2>
            <p style={txt}>Active account data is retained as long as your account is active. After account deletion, data is permanently removed within 30 days.</p>
          </div>

          <div style={{ ...sec, marginBottom: 0 }}>
            <h2 style={h2s}>7. Contact Us</h2>
            <p style={txt}>Email: noreply@scopsa.com<br />Website: scopsa.com</p>
          </div>
        </div>

      </div>
    </div>
  )
}
