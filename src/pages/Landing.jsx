import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import ScopLogo from '../components/ScopLogo'

// ─── translations ─────────────────────────────────────────────────────────────

const NAV = {
  signin: { en: 'Sign in', ar: 'تسجيل الدخول' },
  trial:  { en: 'Start free trial', ar: 'ابدأ مجاناً' },
}

const HERO = {
  badge: { en: '14-day free trial · No credit card required', ar: 'تجربة مجانية 14 يوم · لا حاجة لبطاقة ائتمان' },
  h1a:   { en: 'Restaurant Operations,', ar: 'إدارة عمليات المطعم،' },
  h1b:   { en: 'Simplified.', ar: 'ببساطة.' },
  sub:   { en: 'One platform to manage tasks, food safety, and team performance across all your branches.', ar: 'منصة واحدة لإدارة المهام وسلامة الغذاء وأداء الفريق في جميع فروعك.' },
  cta1:  { en: 'Start free trial →', ar: 'ابدأ تجربتك المجانية ←' },
  cta2:  { en: 'See how it works', ar: 'كيف يعمل؟' },
  s1:    { en: '14 days free', ar: '14 يوم مجاناً' },
  s2:    { en: '3 panels', ar: '3 لوحات' },
  s3:    { en: '100% Arabic & English', ar: '100% عربي وإنجليزي' },
  s4:    { en: 'SAR pricing', ar: 'أسعار بالريال' },
}

const FEATURES = {
  tag:   { en: 'Features', ar: 'الميزات' },
  title: { en: 'Everything your restaurant needs', ar: 'كل ما يحتاجه مطعمك' },
  items: [
    {
      icon: 'check', bg: '#F0FDF4', color: '#166534',
      en: 'Daily task management', ar: 'إدارة المهام اليومية',
      descEn: 'Create tasks once. Managers complete them daily. Track progress in real-time across all branches.',
      descAr: 'أنشئ المهام مرة واحدة. يكملها المديرون يومياً. تابع التقدم في الوقت الفعلي عبر جميع الفروع.',
    },
    {
      icon: 'shield', bg: '#FFF7ED', color: '#C2410C',
      en: 'Food safety compliance', ar: 'الالتزام بسلامة الغذاء',
      descEn: 'Temperature logs, compliance checks, and pass/fail tracking — all documented automatically.',
      descAr: 'سجلات درجات الحرارة وفحوصات الامتثال وتتبع النجاح/الرسوب — كل شيء موثق تلقائياً.',
    },
    {
      icon: 'chart', bg: '#EFF6FF', color: '#1D4ED8',
      en: 'Real-time reports', ar: 'تقارير فورية',
      descEn: 'See which branches are performing and which need attention — before problems become bigger.',
      descAr: 'اعرف أي الفروع تعمل بشكل جيد وأيها يحتاج اهتمامًا — قبل أن تتفاقم المشكلات.',
    },
    {
      icon: 'building', bg: '#F0FDF4', color: '#166534',
      en: 'Multi-branch control', ar: 'التحكم في جميع الفروع',
      descEn: 'Manage all branches from one dashboard. Switch between branches instantly with one click.',
      descAr: 'أدر جميع فروعك من لوحة تحكم واحدة. انتقل بين الفروع فوراً بنقرة واحدة.',
    },
    {
      icon: 'users', bg: '#EDE9FE', color: '#5B21B6',
      en: 'Manager accounts', ar: 'حسابات المديرين',
      descEn: 'Each branch manager gets their own login. They see only their branch — nothing else.',
      descAr: 'يحصل كل مدير فرع على تسجيل دخول خاص به. يرون فرعهم فقط — لا شيء آخر.',
    },
    {
      icon: 'calendar', bg: '#FFFBEB', color: '#D97706',
      en: 'Schedule & events', ar: 'الجدول والفعاليات',
      descEn: 'Plan inspections, training, and maintenance. Managers see upcoming events on their dashboard.',
      descAr: 'خطط للتفتيش والتدريب والصيانة. يرى المديرون الأحداث القادمة في لوحتهم.',
    },
  ],
}

const HOW = {
  tag:   { en: 'How it works', ar: 'كيف يعمل' },
  title: { en: 'Up and running in minutes', ar: 'جاهز للعمل في دقائق' },
  steps: [
    {
      en: 'Create your account', ar: 'أنشئ حسابك',
      descEn: 'Register, choose your plan, and set up your restaurant in under 5 minutes.',
      descAr: 'سجّل، اختر خطتك، وأعد مطعمك في أقل من 5 دقائق.',
    },
    {
      en: 'Add branches & managers', ar: 'أضف الفروع والمديرين',
      descEn: 'Create branch manager accounts. Each manager gets their own login and task list.',
      descAr: 'أنشئ حسابات مديري الفروع. كل مدير لديه تسجيل دخول وقائمة مهام خاصة.',
    },
    {
      en: 'Track everything', ar: 'تابع كل شيء',
      descEn: 'Managers complete tasks daily. You see real-time progress from your dashboard.',
      descAr: 'يكمل المديرون المهام يومياً. ترى التقدم في الوقت الفعلي من لوحتك.',
    },
  ],
}

const PRICING = {
  tag:            { en: 'Pricing', ar: 'الأسعار' },
  title:          { en: 'Simple, transparent pricing', ar: 'أسعار بسيطة وشفافة' },
  sub:            { en: 'Pay only for the branches you use — no tiers, no surprises.', ar: 'ادفع فقط مقابل الفروع التي تستخدمها — بدون خطط معقدة أو مفاجآت.' },
  perBranch:      { en: '50', ar: '50' },
  perBranchLabel: { en: 'SAR per branch, per month', ar: 'ريال لكل فرع شهرياً' },
  trial:          { en: '14-day free trial · No charge until trial ends', ar: '14 يوم تجربة مجانية · لا رسوم حتى انتهاء الفترة' },
  cta:            { en: 'Start free trial', ar: 'ابدأ تجربتك المجانية' },
  enterprise:     { en: '10+ branches? Contact us for enterprise pricing.', ar: '10+ فروع؟ تواصل معنا لأسعار المؤسسات.' },
  examples: [
    { branches: 1, price: 50 },
    { branches: 2, price: 100 },
    { branches: 3, price: 150 },
  ],
}

const CTA_SEC = {
  title: { en: 'Ready to simplify your operations?', ar: 'هل أنت مستعد لتبسيط عملياتك؟' },
  sub:   { en: 'Join restaurants across Saudi Arabia managing their operations with Scop.', ar: 'انضم إلى المطاعم في جميع أنحاء المملكة العربية السعودية التي تدير عملياتها مع سكوب.' },
  cta1:  { en: 'Start free trial →', ar: 'ابدأ تجربتك المجانية ←' },
  cta2:  { en: 'Contact us', ar: 'تواصل معنا' },
}

const CONTACT = {
  tag:      { en: 'Contact', ar: 'تواصل' },
  title:    { en: 'Contact Us', ar: 'تواصل معنا' },
  sub:      { en: "We're happy to help — reach out anytime.", ar: 'يسعدنا مساعدتك — تواصل معنا في أي وقت.' },
  whatsapp: { en: 'WhatsApp', ar: 'واتساب' },
  email:    { en: 'Email', ar: 'البريد الإلكتروني' },
}

const FOOTER = {
  copy:    { en: '© 2026 Scop · Restaurant Operations Platform · Saudi Arabia', ar: '© 2026 سكوب · منصة عمليات المطاعم · المملكة العربية السعودية' },
  privacy: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
  terms:   { en: 'Terms of Service', ar: 'شروط الخدمة' },
  refund:  { en: 'Refund Policy', ar: 'سياسة الاسترجاع' },
}

// ─── icon ─────────────────────────────────────────────────────────────────────

const ICON_PATHS = {
  check:    'M5 13l4 4L19 7',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chart:    'M18 20V10M12 20V4M6 20v-6',
  building: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  mail:     'M4 4h16v16H4V4zM4 4l8 8 8-8',
  chat:     'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
}

function Icon({ name, size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'users'
        ? ICON_PATHS[name].split('M').filter(Boolean).map((d, i) => (
            <path key={i} d={'M' + d} />
          ))
        : <path d={ICON_PATHS[name]} />
      }
    </svg>
  )
}

// ─── shared styles ─────────────────────────────────────────────────────────────

const sectionTag = {
  display: 'inline-block', background: '#DCFCE7', color: '#166534',
  fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12,
}

const sectionTitle = {
  fontSize: 28, fontWeight: 500, color: '#111827', margin: '0 0 8px',
}

const sectionSub = {
  fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: 0,
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()
  const { isAr, toggleLang } = useLanguage()
  const t = (obj) => isAr ? obj.ar : obj.en

  useEffect(() => {
    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap'
    document.head.appendChild(link)
    return () => { try { document.head.removeChild(link) } catch {} }
  }, [])

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, system-ui, sans-serif',
        minHeight: '100vh', background: '#fff', color: '#111827',
      }}
    >
      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '0.5px solid #E5E7EB',
        height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 40px',
      }}>
        <ScopLogo variant="full" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleLang}
            style={{
              background: 'none', border: '0.5px solid #E5E7EB', borderRadius: 8,
              fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer',
              padding: '5px 10px', fontFamily: 'inherit',
            }}
          >
            {isAr ? 'EN' : 'ع'}
          </button>
          <button
            onClick={() => navigate('/owner/login')}
            style={{
              background: 'none', border: '0.5px solid #E5E7EB', borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer',
              padding: '6px 14px', fontFamily: 'inherit',
            }}
          >
            {t(NAV.signin)}
          </button>
          <button
            onClick={() => navigate('/owner/register')}
            style={{
              background: '#1B4332', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer',
              padding: '6px 14px', fontFamily: 'inherit',
            }}
          >
            {t(NAV.trial)}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: '#1B4332', padding: '72px 40px 64px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', background: 'rgba(255,255,255,0.12)', color: '#A7F3D0',
          fontSize: 12, fontWeight: 500, padding: '5px 14px', borderRadius: 20,
          marginBottom: 28, letterSpacing: '0.2px',
        }}>
          {t(HERO.badge)}
        </div>

        <h1 style={{
          fontSize: 48, fontWeight: 600, color: '#fff', lineHeight: 1.15,
          margin: '0 0 20px', letterSpacing: '-0.5px',
        }}>
          {t(HERO.h1a)}<br />
          <span style={{ color: '#4ADE80' }}>{t(HERO.h1b)}</span>
        </h1>

        <p style={{ fontSize: 16, color: '#A7F3D0', lineHeight: 1.65, maxWidth: 520, margin: '0 auto 36px' }}>
          {t(HERO.sub)}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <button
            onClick={() => navigate('/owner/register')}
            style={{
              background: '#4ADE80', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600, color: '#052e16', cursor: 'pointer',
              padding: '12px 24px', fontFamily: 'inherit',
            }}
          >
            {t(HERO.cta1)}
          </button>
          <button
            onClick={() => scrollTo('how')}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 10,
              fontSize: 14, fontWeight: 500, color: '#fff', cursor: 'pointer',
              padding: '12px 24px', fontFamily: 'inherit',
            }}
          >
            {t(HERO.cta2)}
          </button>
        </div>

        <div style={{
          display: 'flex', gap: 0, justifyContent: 'center', flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 32,
        }}>
          {[
            { label: t(HERO.s1) },
            { label: t(HERO.s2) },
            { label: t(HERO.s3) },
            { label: t(HERO.s4) },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 16px' }}>·</span>}
              <span style={{ fontSize: 13, color: '#D1FAE5', fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: '#F0FDF4', padding: '56px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={sectionTag}>{t(FEATURES.tag)}</div>
          <h2 style={sectionTitle}>{t(FEATURES.title)}</h2>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
          maxWidth: 960, margin: '0 auto',
        }}>
          {FEATURES.items.map((f, i) => (
            <div key={i} style={{
              background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 24,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: f.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
              }}>
                <Icon name={f.icon} size={18} color={f.color} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                {isAr ? f.ar : f.en}
              </div>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
                {isAr ? f.descAr : f.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ background: '#fff', padding: '56px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={sectionTag}>{t(HOW.tag)}</div>
          <h2 style={sectionTitle}>{t(HOW.title)}</h2>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32,
          maxWidth: 800, margin: '0 auto',
        }}>
          {HOW.steps.map((step, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#1B4332',
                color: '#fff', fontSize: 16, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                {isAr ? step.ar : step.en}
              </div>
              <p style={{ ...sectionSub, fontSize: 13 }}>
                {isAr ? step.descAr : step.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ background: '#F0FDF4', padding: '56px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={sectionTag}>{t(PRICING.tag)}</div>
          <h2 style={sectionTitle}>{t(PRICING.title)}</h2>
          <p style={{ ...sectionSub, maxWidth: 420, margin: '8px auto 0' }}>{t(PRICING.sub)}</p>
        </div>

        <div style={{
          background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 16,
          padding: 36, maxWidth: 440, margin: '0 auto', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 44, fontWeight: 600, color: '#111827', lineHeight: 1 }}>{t(PRICING.perBranch)}</span>
            <span style={{ fontSize: 14, color: '#6B7280' }}>SAR</span>
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 28 }}>
            {t(PRICING.perBranchLabel)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {PRICING.examples.map(ex => (
              <div key={ex.branches} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#F9FAFB', borderRadius: 10, padding: '10px 16px', fontSize: 13,
              }}>
                <span style={{ color: '#374151' }}>
                  {ex.branches} {isAr ? (ex.branches === 1 ? 'فرع' : 'فروع') : (ex.branches === 1 ? 'branch' : 'branches')}
                </span>
                <span style={{ fontWeight: 600, color: '#111827' }}>
                  {ex.price} {isAr ? 'ر.س/شهر' : 'SAR/mo'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
            {t(PRICING.trial)}
          </div>

          <button
            onClick={() => navigate('/owner/register')}
            style={{
              background: '#1B4332', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: '#fff',
              cursor: 'pointer', padding: '11px 0', width: '100%',
              fontFamily: 'inherit',
            }}
          >
            {t(PRICING.cta)}
          </button>

          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 16 }}>
            {t(PRICING.enterprise)}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: '#1B4332', padding: '56px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 500, color: '#fff', margin: '0 0 12px' }}>
          {t(CTA_SEC.title)}
        </h2>
        <p style={{ fontSize: 14, color: '#A7F3D0', lineHeight: 1.6, maxWidth: 480, margin: '0 auto 32px' }}>
          {t(CTA_SEC.sub)}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/owner/register')}
            style={{
              background: '#4ADE80', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600, color: '#052e16', cursor: 'pointer',
              padding: '12px 24px', fontFamily: 'inherit',
            }}
          >
            {t(CTA_SEC.cta1)}
          </button>
          <a
            href="https://wa.me/966551553245"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'none', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 10,
              fontSize: 14, fontWeight: 500, color: '#fff', cursor: 'pointer',
              padding: '12px 24px', textDecoration: 'none', fontFamily: 'inherit',
            }}
          >
            {t(CTA_SEC.cta2)}
          </a>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" style={{ background: '#F0FDF4', padding: '56px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={sectionTag}>{t(CONTACT.tag)}</div>
          <h2 style={sectionTitle}>{t(CONTACT.title)}</h2>
          <p style={sectionSub}>{t(CONTACT.sub)}</p>
        </div>

        <div style={{
          display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
          maxWidth: 600, margin: '0 auto',
        }}>
          <a
            href="https://wa.me/966551553245"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12,
              padding: '18px 22px', textDecoration: 'none',
              flex: '1 1 240px', maxWidth: 280,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: '#F0FDF4',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="chat" size={18} color="#166534" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 2 }}>{t(CONTACT.whatsapp)}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>+966 551 553 245</div>
            </div>
          </a>

          <a
            href="mailto:noreply@scopsa.com"
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12,
              padding: '18px 22px', textDecoration: 'none',
              flex: '1 1 240px', maxWidth: 280,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="mail" size={18} color="#1D4ED8" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 2 }}>{t(CONTACT.email)}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>noreply@scopsa.com</div>
            </div>
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: '#fff', borderTop: '0.5px solid #E5E7EB',
        padding: '20px 40px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <ScopLogo variant="sidebar" />
        <span style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
          {t(FOOTER.copy)}
        </span>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link to="/privacy-policy"   style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none' }}>{t(FOOTER.privacy)}</Link>
          <Link to="/terms-of-service" style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none' }}>{t(FOOTER.terms)}</Link>
          <Link to="/refund-policy"    style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none' }}>{t(FOOTER.refund)}</Link>
        </div>
      </footer>
    </div>
  )
}
