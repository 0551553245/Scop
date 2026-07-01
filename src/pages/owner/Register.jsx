import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabaseOwner, supabaseTemp } from '../../lib/supabase'
import { useLanguage } from '../../context/LanguageContext'
import { getPlatformSettings, getPlanLimits } from '../../lib/platformSettings'

const CITIES = [
  { en: 'Jeddah',  ar: 'جدة' },
  { en: 'Riyadh',  ar: 'الرياض' },
  { en: 'Dammam',  ar: 'الدمام' },
  { en: 'Mecca',   ar: 'مكة' },
  { en: 'Medina',  ar: 'المدينة' },
  { en: 'Khobar',  ar: 'الخبر' },
  { en: 'Tabuk',   ar: 'تبوك' },
  { en: 'Abha',    ar: 'أبها' },
  { en: 'Other',   ar: 'أخرى' },
]

function LeftPanel({ isAr }) {
  return (
    <div style={{
      width: '42%', background: '#1B4332',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '40px 44px', position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12h6v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>{isAr ? 'سكوب' : 'Scop'}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isAr ? 'عمليات المطاعم' : 'Restaurant Ops'}</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
          {isAr ? 'بوابة المالك' : 'Owner Portal'}
        </div>
        <h1 style={{ fontSize: isAr ? 28 : 32, fontWeight: 500, color: '#fff', lineHeight: 1.3, margin: '0 0 14px', whiteSpace: 'pre-line' }}>
          {isAr ? 'أدِر كل فرع.\nمن أي مكان.' : 'Run every branch.\nFrom anywhere.'}
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0, maxWidth: 300 }}>
          {isAr ? 'منصة العمليات المصممة للمطاعم السعودية.' : 'The operations platform built for Saudi restaurants.'}
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 28 }}>
        {[
          { num: '500+', label: isAr ? 'مطعم' : 'Restaurants' },
          { num: '98%',  label: isAr ? 'رضا العملاء' : 'Satisfaction' },
          { num: '24/7', label: isAr ? 'دعم' : 'Support' },
        ].map(({ num, label }) => (
          <div key={label}>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>{num}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepDots({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
      {[1, 2, 3].map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: step >= s ? '#1B4332' : '#F3F4F6',
            border: step === s ? '3px solid #BBF7D0' : step > s ? '2px solid #1B4332' : '2px solid #E5E7EB',
            boxShadow: step === s ? '0 0 0 3px rgba(27,67,50,0.15)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
            {step > s ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: step >= s ? '#fff' : '#9CA3AF' }}>{s}</span>
            )}
          </div>
          {i < 2 && (
            <div style={{ width: 40, height: 2, background: step > s ? '#1B4332' : '#E5E7EB', transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 11px', fontSize: 13,
  background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8,
  outline: 'none', color: '#111827', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 500, color: '#6B7280', marginBottom: 4,
}
const sectionStyle = {
  background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '16px', marginBottom: 12,
}
const sectionHeadStyle = {
  fontSize: 11, fontWeight: 600, color: '#1B4332',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12,
}

function PageStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Cairo:wght@400;500;600&display=swap');
      * { box-sizing: border-box; }
      @keyframes spin { to { transform: rotate(360deg); } }
      input::placeholder { color: #9CA3AF; font-size: 12px; }
      select option { font-size: 13px; }
    `}</style>
  )
}

function ErrorBanner({ msg }) {
  if (!msg) return null
  return (
    <div style={{ background: '#FFF1F2', border: '0.5px solid #FECDD3', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
      <span style={{ fontSize: 12, color: '#9F1239' }}>{msg}</span>
    </div>
  )
}

export default function OwnerRegister() {
  const navigate = useNavigate()
  const { lang, isAr, toggleLang } = useLanguage()

  const [step, setStep] = useState(1)
  const [selectedPlan, setSelectedPlan] = useState('starter')
  const [planLimits, setPlanLimits] = useState(getPlanLimits({}))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [emailSent, setEmailSent] = useState('')

  useEffect(() => {
    getPlatformSettings(supabaseOwner).then(settings => {
      setPlanLimits(getPlanLimits(settings))
    }).catch(() => {})
  }, [])

  const [form, setForm] = useState({
    restaurantName: '',
    restaurantNameAr: '',
    city: '',
    ownerName: '',
    nameAr: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  function update(field, value) {
    setForm(p => ({ ...p, [field]: value }))
    setError('')
  }

  const pwLen = form.password.length
  const pwStrength = pwLen === 0 ? null
    : pwLen < 8  ? { pct: 30,  color: '#E24B4A' }
    : pwLen < 12 ? { pct: 65,  color: '#F59E0B' }
    :              { pct: 100, color: '#1B4332' }

  function handleStep1() {
    if (!form.restaurantName.trim()) return setError(isAr ? 'اسم المطعم مطلوب' : 'Restaurant name is required')
    if (!form.city)                  return setError(isAr ? 'المدينة مطلوبة'    : 'City is required')
    if (!form.ownerName.trim())      return setError(isAr ? 'الاسم مطلوب'        : 'Name is required')
    if (!form.phone.trim())          return setError(isAr ? 'الهاتف مطلوب'       : 'Phone is required')
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return setError(isAr ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address')
    if (form.password.length < 8)
      return setError(isAr ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters')
    if (form.password !== form.confirmPassword)
      return setError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
    setError('')
    setStep(2)
  }

  function translateAuthError(msg, ar) {
    if (!msg) return ar ? 'حدث خطأ غير معروف' : 'Unknown error occurred'
    if (msg.includes('already registered') || msg.includes('already been registered'))
      return ar ? 'هذا البريد الإلكتروني مسجل بالفعل. جرب تسجيل الدخول.' : 'This email is already registered. Try signing in instead.'
    if (msg.includes('Password should be at least') || msg.includes('password'))
      return ar ? 'كلمة المرور قصيرة جداً' : 'Password is too short'
    if (msg.includes('Invalid email') || msg.includes('valid email'))
      return ar ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address'
    if (msg.includes('Network') || msg.includes('fetch') || msg.includes('Failed to fetch'))
      return ar ? 'خطأ في الاتصال. تحقق من الإنترنت وحاول مجدداً.' : 'Connection error. Check your internet and try again.'
    if (msg === 'timeout')
      return ar ? 'انتهت مهلة الاتصال. يرجى المحاولة مجدداً.' : 'Connection timed out. Please try again.'
    return ar ? 'فشل إنشاء الحساب' : 'Account creation failed'
  }

  async function handleRegister() {
    setLoading(true)
    setError('')

    const registrationFlow = async () => {
      // Step 1: Create auth user with supabaseTemp
      const { data: authData, error: authErr } = await supabaseTemp.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data:            { name: form.ownerName },
          emailRedirectTo: 'https://scopsa.com/verify',
        },
      })
      if (authErr) {
        if (authErr.message?.includes('already registered') || authErr.message?.includes('already been registered')) {
          throw new Error('already_registered')
        }
        throw authErr
      }
      // Check for email confirmation FIRST — with PKCE flow Supabase returns
      // { user: null, session: null } when confirmation is required, so the
      // user-null guard below must not run before we detect this case.
      if (!authData?.session) {
        localStorage.setItem('scop-pending-registration', JSON.stringify({
          email:            form.email,
          ownerName:        form.ownerName,
          nameAr:           form.nameAr || null,
          phone:            form.phone,
          restaurantName:   form.restaurantName,
          restaurantNameAr: form.restaurantNameAr || form.restaurantName,
          city:             form.city,
          plan:             selectedPlan,
        }))
        setEmailSent(form.email)
        return
      }

      if (!authData?.user) throw new Error('No user returned')

      const userId = authData.user.id

      // Step 2: Sign in with supabaseOwner IMMEDIATELY
      // This gives supabaseOwner a valid session so RLS allows auth.uid() = id inserts
      const { error: signInErr } = await supabaseOwner.auth.signInWithPassword({
        email:    form.email,
        password: form.password,
      })
      if (signInErr) throw signInErr

      // Steps 3-5: DB inserts — supabaseOwner now has active session
      try {
        const { error: userErr } = await supabaseOwner.from('users').upsert({
          id:        userId,
          email:     form.email,
          name:      form.ownerName,
          name_ar:   form.nameAr || null,
          phone:     form.phone,
          role:      'owner',
          is_active: true,
        }, { onConflict: 'id' })
        if (userErr) throw userErr

        const { data: existingBranch } = await supabaseOwner
          .from('branches')
          .select('id')
          .eq('owner_id', userId)
          .eq('name', form.restaurantName)
          .maybeSingle()

        if (!existingBranch) {
          const { error: branchErr } = await supabaseOwner.from('branches').insert({
            name:      form.restaurantName,
            name_ar:   form.restaurantNameAr || form.restaurantName,
            city:      form.city,
            owner_id:  userId,
            is_active: true,
          })
          if (branchErr) throw branchErr
        }

        const trialExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

        const { data: existingSub } = await supabaseOwner
          .from('subscriptions')
          .select('id')
          .eq('owner_id', userId)
          .maybeSingle()

        if (!existingSub) {
          const { error: subErr } = await supabaseOwner.from('subscriptions').insert({
            owner_id:       userId,
            plan:           selectedPlan,
            status:         'trial',
            branches_limit: planLimits[selectedPlan]?.branches ?? 1,
            managers_limit: planLimits[selectedPlan]?.managers ?? 1,
            expires_at:     trialExpiry,
            trial_ends_at:  trialExpiry,
            started_at:     new Date().toISOString(),
          })
          if (subErr) throw subErr
        }

        setStep(3)
      } catch (innerErr) {
        console.error('Registration partial failure — orphaned auth user:', userId, innerErr)
        throw new Error(
          isAr
            ? 'تم إنشاء الحساب ولكن فشل الإعداد. جرب تسجيل الدخول، أو تواصل مع الدعم.'
            : 'Account was created but setup failed. Try signing in, or contact support.'
        )
      }
    }

    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      await Promise.race([registrationFlow(), timeout])
    } catch (err) {
      console.error('Registration error:', err)
      if (err.message === 'already_registered') {
        setError(isAr
          ? 'هذا البريد الإلكتروني مسجل بالفعل. جرب تسجيل الدخول.'
          : 'This email is already registered. Try signing in instead.')
      } else {
        setError(translateAuthError(err.message, isAr))
      }
    } finally {
      setLoading(false)
    }
  }

  const rootStyle = {
    display: 'flex', minHeight: '100vh',
    fontFamily: isAr ? "'Cairo', sans-serif" : "'Inter', sans-serif",
    background: '#F0FDF4',
  }

  const langBtnStyle = {
    position: 'absolute', top: 20,
    background: '#fff', border: '0.5px solid #E5E7EB',
    borderRadius: 20, padding: '5px 12px',
    fontSize: 11, fontWeight: 500, color: '#1B4332',
    cursor: 'pointer', fontFamily: 'inherit',
  }

  // ── EMAIL CONFIRMATION PENDING ────────────────────────────────
  if (emailSent) return (
    <div dir={isAr ? 'rtl' : 'ltr'}
      style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0FDF4', fontFamily: isAr ? "'Cairo', sans-serif" : "'Inter', sans-serif", padding: '40px 20px' }}>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 16, padding: '48px 40px', maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', border: '2px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#1B4332" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 6l-10 7L2 6" stroke="#1B4332" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
          {isAr ? 'تحقق من بريدك الإلكتروني' : 'Check your email'}
        </h2>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.6 }}>
          {isAr
            ? `أرسلنا رابط التحقق إلى`
            : `We sent a verification link to`}
        </p>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1B4332', marginBottom: 24, direction: 'ltr' }}>
          {emailSent}
        </div>
        <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 12, padding: '14px 16px', marginBottom: 24, textAlign: isAr ? 'right' : 'left' }}>
          {(isAr ? [
            'افتح بريدك الإلكتروني وانقر على رابط التحقق',
            'سيتم تفعيل حسابك تلقائياً',
            'بعد التحقق يمكنك تسجيل الدخول مباشرةً',
          ] : [
            'Open your email and click the verification link',
            'Your account will be activated automatically',
            'After verification you can sign in to your dashboard',
          ]).map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 12, color: '#374151' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M5 13l4 4L19 7" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {item}
            </div>
          ))}
        </div>
        <Link to="/owner/login" style={{ display: 'block', width: '100%', padding: '12px 20px', background: '#1B4332', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', boxSizing: 'border-box' }}>
          {isAr ? 'تسجيل الدخول →' : 'Go to sign in →'}
        </Link>
      </div>
      <PageStyles />
    </div>
  )

  // ── STEP 1 ─────────────────────────────────────────────────────
  if (step === 1) return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={rootStyle}>
      <LeftPanel isAr={isAr} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative', overflowY: 'auto' }}>
        <button onClick={toggleLang} style={{ ...langBtnStyle, [isAr ? 'left' : 'right']: 20 }}>
          {isAr ? 'EN' : 'ع'}
        </button>

        <div style={{ width: '100%', maxWidth: 440 }}>
          <StepDots step={step} />

          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>
              {isAr ? 'معلومات الحساب' : 'Account Info'}
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
              {isAr ? 'أدخل بيانات مطعمك وحسابك' : 'Enter your restaurant and account details'}
            </p>
          </div>

          <ErrorBanner msg={error} />

          {/* Restaurant */}
          <div style={sectionStyle}>
            <div style={sectionHeadStyle}>{isAr ? 'المطعم' : 'Restaurant'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>
                  {isAr ? 'الاسم (إنجليزي)' : 'Name EN'} <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <input
                  type="text" value={form.restaurantName}
                  onChange={e => update('restaurantName', e.target.value)}
                  placeholder="Al Baik" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#1B4332'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
              <div>
                <label style={labelStyle}>{isAr ? 'الاسم (عربي)' : 'Name AR'}</label>
                <input
                  type="text" value={form.restaurantNameAr}
                  onChange={e => update('restaurantNameAr', e.target.value)}
                  placeholder="البيك" dir="rtl" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#1B4332'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>
                {isAr ? 'المدينة' : 'City'} <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <select
                value={form.city} onChange={e => update('city', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={e => e.target.style.borderColor = '#1B4332'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
              >
                <option value="">{isAr ? 'اختر المدينة' : 'Select city'}</option>
                {CITIES.map(c => (
                  <option key={c.en} value={c.en}>{c.en} · {c.ar}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Owner */}
          <div style={sectionStyle}>
            <div style={sectionHeadStyle}>{isAr ? 'المالك' : 'Owner'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>
                  {isAr ? 'الاسم الكامل' : 'Full name'} <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <input
                  type="text" value={form.ownerName}
                  onChange={e => update('ownerName', e.target.value)}
                  placeholder={isAr ? 'محمد الراشد' : 'Mohammed Al-Rashid'}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#1B4332'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
              <div>
                <label style={labelStyle}>{isAr ? 'الاسم بالعربية' : 'Arabic name (optional)'}</label>
                <input
                  type="text" value={form.nameAr}
                  onChange={e => update('nameAr', e.target.value)}
                  placeholder="محمد الراشد" dir="rtl"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#1B4332'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>
                {isAr ? 'رقم الهاتف' : 'Phone'} <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <input
                type="tel" value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="+966 5X XXX XXXX" dir="ltr"
                style={{ ...inputStyle, textAlign: isAr ? 'right' : 'left' }}
                onFocus={e => e.target.style.borderColor = '#1B4332'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>
                {isAr ? 'البريد الإلكتروني' : 'Email'} <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <input
                type="email" value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="you@restaurant.com" dir="ltr"
                style={{ ...inputStyle, textAlign: isAr ? 'right' : 'left' }}
                onFocus={e => e.target.style.borderColor = '#1B4332'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>
                  {isAr ? 'كلمة المرور' : 'Password'} <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => update('password', e.target.value)}
                    placeholder={isAr ? '٨ أحرف على الأقل' : 'Min. 8 characters'}
                    style={{ ...inputStyle, paddingRight: 32 }}
                    onFocus={e => e.target.style.borderColor = '#1B4332'}
                    onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', display: 'flex' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      {showPass
                        ? <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></>
                      }
                    </svg>
                  </button>
                </div>
                {pwStrength && (
                  <div style={{ height: 3, borderRadius: 2, background: '#E5E7EB', marginTop: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pwStrength.pct}%`, background: pwStrength.color, borderRadius: 2, transition: 'all 0.3s' }} />
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>
                  {isAr ? 'تأكيد كلمة المرور' : 'Confirm password'} <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <input
                  type={showPass ? 'text' : 'password'} value={form.confirmPassword}
                  onChange={e => update('confirmPassword', e.target.value)}
                  placeholder={isAr ? 'أعد الإدخال' : 'Re-enter password'}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#1B4332'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
            </div>
          </div>

          <button onClick={handleStep1}
            style={{ width: '100%', padding: '11px 20px', background: '#1B4332', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
            {isAr ? 'التالي ←' : 'Continue →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#6B7280', margin: 0 }}>
            {isAr ? 'لديك حساب؟ ' : 'Already have an account? '}
            <Link to="/owner/login" style={{ color: '#1B4332', fontWeight: 500, textDecoration: 'none' }}>
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
            </Link>
          </p>
        </div>
      </div>
      <PageStyles />
    </div>
  )

  // ── STEP 2 ─────────────────────────────────────────────────────
  if (step === 2) {
    const plans = [
      { key: 'starter', nameEn: 'Starter', nameAr: 'المبتدئ', descEn: '1 branch · 1 manager',              descAr: '١ فرع · ١ مدير',                   price: planLimits.starter?.price ?? 199, badge: null },
      { key: 'growth',  nameEn: 'Growth',  nameAr: 'النمو',    descEn: 'Up to 5 branches · 5 managers',      descAr: 'حتى ٥ فروع · ٥ مدراء',             price: planLimits.growth?.price  ?? 499, badge: { en: 'Most popular', ar: 'الأكثر شيوعاً' } },
      { key: 'pro',     nameEn: 'Pro',     nameAr: 'المتقدم',  descEn: 'Up to 15 branches · Unlimited mgrs', descAr: 'حتى ١٥ فرعاً · مدراء غير محدودين', price: planLimits.pro?.price     ?? 999, badge: null },
    ]
    const features = isAr ? [
      'مهام يومية وأسبوعية وشهرية',
      'فحوصات سلامة الغذاء وسجلات الحرارة',
      'إدارة الجدول والفعاليات',
      'تقارير وتحليلات',
      'دعم العربية والإنجليزية',
    ] : [
      'Daily, weekly & monthly tasks',
      'Food safety checks & temperature logs',
      'Schedule & event management',
      'Reports & analytics',
      'Arabic & English support',
    ]

    return (
      <div dir={isAr ? 'rtl' : 'ltr'} style={rootStyle}>
        <LeftPanel isAr={isAr} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative', overflowY: 'auto' }}>
          <button onClick={toggleLang} style={{ ...langBtnStyle, [isAr ? 'left' : 'right']: 20 }}>
            {isAr ? 'EN' : 'ع'}
          </button>

          <div style={{ width: '100%', maxWidth: 440 }}>
            <StepDots step={step} />

            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>
                {isAr ? 'اختر خطتك' : 'Choose Your Plan'}
              </h2>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                {isAr ? 'جميع الخطط تشمل نفس المميزات' : 'All plans include the same features'}
              </p>
            </div>

            {/* Features box */}
            <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
              {features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, color: '#1B4332' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M5 13l4 4L19 7" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </div>
              ))}
            </div>

            {/* Plan cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {plans.map(plan => (
                <div key={plan.key} onClick={() => setSelectedPlan(plan.key)}
                  style={{
                    background: '#fff',
                    border: selectedPlan === plan.key ? '1.5px solid #1B4332' : '0.5px solid #E5E7EB',
                    borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      border: selectedPlan === plan.key ? '5px solid #1B4332' : '2px solid #D1D5DB',
                      transition: 'border 0.15s',
                    }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {isAr ? plan.nameAr : plan.nameEn}
                        </span>
                        {plan.badge && (
                          <span style={{ fontSize: 9, fontWeight: 600, background: '#1B4332', color: '#fff', borderRadius: 20, padding: '1px 7px' }}>
                            {isAr ? plan.badge.ar : plan.badge.en}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                        {isAr ? plan.descAr : plan.descEn}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: isAr ? 'left' : 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{plan.price}</span>
                    <span style={{ fontSize: 10, color: '#6B7280' }}> {isAr ? 'ر.س/شهر' : 'SAR/mo'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: '#6B7280', marginBottom: 14 }}>
              {isAr ? '١٤ يوم مجاناً · لا رسوم حتى انتهاء الفترة · إلغاء في أي وقت' : '14-day free trial · No charge until trial ends · Cancel anytime'}
            </div>

            <ErrorBanner msg={error} />

            <button onClick={handleRegister} disabled={loading}
              style={{ width: '100%', padding: '11px 20px', background: loading ? '#6B9E83' : '#1B4332', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
              {loading && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                  <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              )}
              {loading
                ? (isAr ? 'جارٍ الإنشاء...' : 'Creating account...')
                : (isAr ? 'ابدأ التجربة المجانية ←' : 'Start free trial →')}
            </button>

            <button onClick={() => { setStep(1); setError('') }}
              style={{ width: '100%', padding: '10px', background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E7EB', borderRadius: 10, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {isAr ? '→ رجوع' : '← Back'}
            </button>
          </div>
        </div>
        <PageStyles />
      </div>
    )
  }

  // ── STEP 3 ─────────────────────────────────────────────────────
  return (
    <div dir={isAr ? 'rtl' : 'ltr'}
      style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0FDF4', fontFamily: isAr ? "'Cairo', sans-serif" : "'Inter', sans-serif", padding: '40px 20px' }}>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 16, padding: '48px 40px', maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', border: '2px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
          {isAr ? 'تم بنجاح!' : "You're all set!"}
        </h2>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
          {isAr
            ? `مرحباً ${form.ownerName}، تم إنشاء حسابك بنجاح.`
            : `Welcome ${form.ownerName}, your account is ready.`}
        </p>

        <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 12, padding: '16px', marginBottom: 24, textAlign: isAr ? 'right' : 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1B4332', marginBottom: 10 }}>
            {isAr ? 'ما الذي يحدث الآن:' : 'What happens next:'}
          </div>
          {(isAr ? [
            'تجربة مجانية لمدة ١٤ يوماً — لا رسوم الآن',
            'أضف فروعك ومدراءك',
            'ابدأ بتتبع المهام ومعايير سلامة الغذاء',
          ] : [
            '14-day free trial starts now — no charge',
            'Add your branches and managers',
            'Start tracking tasks and food safety',
          ]).map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, fontSize: 12, color: '#374151' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M5 13l4 4L19 7" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {item}
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/owner/dashboard')}
          style={{ width: '100%', padding: '12px 20px', background: '#1B4332', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          {isAr ? 'الذهاب إلى لوحة التحكم ←' : 'Go to dashboard →'}
        </button>
      </div>
      <PageStyles />
    </div>
  )
}
