import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

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
  tag:     { en: 'Pricing', ar: 'الأسعار' },
  title:   { en: 'Simple, transparent pricing', ar: 'أسعار بسيطة وشفافة' },
  popular: { en: 'Most popular', ar: 'الأكثر شيوعاً' },
  cta:     { en: 'Start free trial', ar: 'ابدأ تجربتك المجانية' },
  mo:      { en: '/mo', ar: '/شهر' },
  plans: [
    {
      name: { en: 'Starter', ar: 'المبتدئ' },
      price: 199,
      desc: { en: '1 branch · 1 manager', ar: 'فرع واحد · مدير واحد' },
      features: {
        en: ['Daily & weekly tasks', 'Food safety tracking', 'Basic reports'],
        ar: ['المهام اليومية والأسبوعية', 'تتبع سلامة الغذاء', 'تقارير أساسية'],
      },
      featured: false,
    },
    {
      name: { en: 'Growth', ar: 'النمو' },
      price: 499,
      desc: { en: '5 branches · 5 managers', ar: '5 فروع · 5 مديرين' },
      features: {
        en: ['Everything in Starter', 'Schedule & events', 'Advanced reports'],
        ar: ['كل ما في المبتدئ', 'الجدول والفعاليات', 'تقارير متقدمة'],
      },
      featured: true,
    },
    {
      name: { en: 'Pro', ar: 'الاحترافي' },
      price: 999,
      desc: { en: '15 branches · Unlimited managers', ar: '15 فرعاً · مديرون غير محدودون' },
      features: {
        en: ['Everything in Growth', 'Priority support', 'Custom integrations'],
        ar: ['كل ما في النمو', 'دعم ذو أولوية', 'تكاملات مخصصة'],
      },
      featured: false,
    },
  ],
}

const CTA_SEC = {
  title: { en: 'Ready to simplify your operations?', ar: 'هل أنت مستعد لتبسيط عملياتك؟' },
  sub:   { en: 'Join restaurants across Saudi Arabia managing their operations with Scop.', ar: 'انضم إلى المطاعم في جميع أنحاء المملكة العربية السعودية التي تدير عملياتها مع سكوب.' },
  cta1:  { en: 'Start free trial →', ar: 'ابدأ تجربتك المجانية ←' },
  cta2:  { en: 'Contact us', ar: 'تواصل معنا' },
}

const FOOTER = {
  copy:    { en: '© 2026 Scop · Restaurant Operations Platform · Saudi Arabia', ar: '© 2026 سكوب · منصة عمليات المطاعم · المملكة العربية السعودية' },
  privacy: { en: 'Privacy', ar: 'الخصوصية' },
  terms:   { en: 'Terms', ar: 'الشروط' },
}

// ─── icon ─────────────────────────────────────────────────────────────────────

const ICON_PATHS = {
  check:    'M5 13l4 4L19 7',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chart:    'M18 20V10M12 20V4M6 20v-6',
  building: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
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
    return () => { try { document.head.removeChild(link) } catch (_) {} }
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
        <span style={{ fontSize: 22, fontWeight: 500, color: '#1B4332', cursor: 'default', letterSpacing: '-0.3px' }}>
          Scop
        </span>
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
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
          maxWidth: 860, margin: '0 auto',
        }}>
          {PRICING.plans.map((plan, i) => (
            <div key={i} style={{
              background: '#fff',
              border: plan.featured ? '2px solid #1B4332' : '0.5px solid #E5E7EB',
              borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 0,
              position: 'relative',
            }}>
              {plan.featured && (
                <div style={{
                  position: 'absolute', top: -12,
                  left: '50%', transform: 'translateX(-50%)',
                  background: '#1B4332', color: '#fff',
                  fontSize: 10, fontWeight: 600, padding: '3px 12px', borderRadius: 20,
                  letterSpacing: '0.3px', whiteSpace: 'nowrap',
                }}>
                  {t(PRICING.popular)}
                </div>
              )}

              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                {t(plan.name)}
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                {t(plan.desc)}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>SAR</span>
                <span style={{ fontSize: 32, fontWeight: 600, color: '#111827', lineHeight: 1 }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>{t(PRICING.mo)}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {(isAr ? plan.features.ar : plan.features.en).map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#DCFCE7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width={9} height={9} viewBox="0 0 12 12" fill="none" stroke="#166534" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    </div>
                    <span style={{ fontSize: 13, color: '#374151' }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate('/owner/register')}
                style={{
                  marginTop: 'auto',
                  background: plan.featured ? '#1B4332' : '#fff',
                  border: plan.featured ? 'none' : '0.5px solid #E5E7EB',
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  color: plan.featured ? '#fff' : '#374151',
                  cursor: 'pointer', padding: '10px 0', width: '100%',
                  fontFamily: 'inherit',
                }}
              >
                {t(PRICING.cta)}
              </button>
            </div>
          ))}
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
            href="https://wa.me/966XXXXXXXXX"
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

      {/* ── FOOTER ── */}
      <footer style={{
        background: '#fff', borderTop: '0.5px solid #E5E7EB',
        padding: '20px 40px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <span style={{ fontSize: 16, fontWeight: 500, color: '#1B4332' }}>Scop</span>
        <span style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
          {t(FOOTER.copy)}
        </span>
        <div style={{ display: 'flex', gap: 16 }}>
          <a href="#" style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none' }}>{t(FOOTER.privacy)}</a>
          <a href="#" style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none' }}>{t(FOOTER.terms)}</a>
        </div>
      </footer>
    </div>
  )
}
