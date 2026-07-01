import { useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useNavigate, Link } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useLanguage } from '../../context/LanguageContext'

export default function OwnerLogin() {
  const navigate = useNavigate()
  const { lang, isAr, toggleLang } = useLanguage()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const isMobile = useIsMobile()

  const t = {
    en: {
      brand:       'Scop',
      brandSub:    'Restaurant Ops',
      portal:      'Owner Portal',
      tagline:     'Run every branch.\nFrom anywhere.',
      sub:         'The operations platform built for Saudi restaurants.',
      heading:     'Welcome back',
      subheading:  'Sign in to your owner account',
      emailLabel:  'Email address',
      emailPh:     'you@restaurant.com',
      passLabel:   'Password',
      passPh:      '••••••••',
      forgot:      'Forgot password?',
      signin:      'Sign in',
      signingIn:   'Signing in…',
      noAccount:   "Don't have an account?",
      register:    'Create one',
      bmLink:      '→ Branch Manager login',
      errEmpty:    'Please enter your email and password.',
      errInvalid:  'Incorrect email or password.',
      errRole:     'This account is not an owner account.',
      errInactive: 'Your account is inactive. Contact support.',
      errGeneric:  'Something went wrong. Please try again.',
      errUnverified: 'Please verify your email before signing in. Check your inbox for the confirmation link.',
      stats: [
        { num: '500+', label: 'Restaurants' },
        { num: '98%',  label: 'Satisfaction' },
        { num: '24/7', label: 'Support' },
      ],
    },
    ar: {
      brand:       'سكوب',
      brandSub:    'عمليات المطاعم',
      portal:      'بوابة المالك',
      tagline:     'أدِر كل فرع.\nمن أي مكان.',
      sub:         'منصة العمليات المصممة للمطاعم السعودية.',
      heading:     'مرحباً بعودتك',
      subheading:  'سجّل دخولك إلى حساب المالك',
      emailLabel:  'البريد الإلكتروني',
      emailPh:     'you@restaurant.com',
      passLabel:   'كلمة المرور',
      passPh:      '••••••••',
      forgot:      'نسيت كلمة المرور؟',
      signin:      'تسجيل الدخول',
      signingIn:   'جارٍ تسجيل الدخول…',
      noAccount:   'ليس لديك حساب؟',
      register:    'إنشاء حساب',
      bmLink:      'تسجيل دخول مدير الفرع ←',
      errEmpty:    'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
      errInvalid:  'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      errRole:     'هذا الحساب ليس حساب مالك.',
      errInactive: 'حسابك غير نشط. تواصل مع الدعم.',
      errGeneric:  'حدث خطأ ما. يرجى المحاولة مجدداً.',
      errUnverified: 'يرجى التحقق من بريدك الإلكتروني قبل تسجيل الدخول. تحقق من صندوق الوارد للحصول على رابط التأكيد.',
      stats: [
        { num: '+500', label: 'مطعم' },
        { num: '98%',  label: 'رضا العملاء' },
        { num: '24/7', label: 'دعم' },
      ],
    },
  }[lang]

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError(t.errEmpty)
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: authError } =
        await supabaseOwner.auth.signInWithPassword({
          email:    email.trim(),
          password,
        })

      if (authError) {
        setError(t.errInvalid)
        setLoading(false)
        return
      }

      if (!authData.user.email_confirmed_at) {
        await supabaseOwner.auth.signOut()
        setError(t.errUnverified)
        setLoading(false)
        return
      }

      const userId = authData.user.id

      const { data: profile, error: profileError } =
        await supabaseOwner
          .from('users')
          .select('id, role, is_active, name')
          .eq('id', userId)
          .single()

      if (profileError || !profile) {
        await supabaseOwner.auth.signOut()
        setError(t.errGeneric)
        setLoading(false)
        return
      }

      if (profile.role !== 'owner') {
        await supabaseOwner.auth.signOut()
        setError(t.errRole)
        setLoading(false)
        return
      }

      if (!profile.is_active) {
        await supabaseOwner.auth.signOut()
        setError(t.errInactive)
        setLoading(false)
        return
      }

      navigate('/owner/dashboard')

    } catch {
      setError(t.errGeneric)
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: 13,
    background: '#fff', border: '0.5px solid #E8E4DC',
    borderRadius: 8, outline: 'none', color: '#1C1917',
    boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.15s', direction: 'ltr',
  }

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 500,
    color: '#6B6B6B', marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        display: 'flex', minHeight: '100vh',
        fontFamily: isAr ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif",
        background: '#F7F5F0',
      }}
    >
      {/* LEFT — brand panel (hidden on mobile) */}
      {!isMobile && <div style={{
        width: '42%', background: '#1B4332',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 44px', position: 'relative',
        overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{ position:'absolute', top:-100, right:-100, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.03)' }} />
        <div style={{ position:'absolute', bottom:-80, left:-80, width:260, height:260, borderRadius:'50%', background:'rgba(255,255,255,0.03)' }} />

        {/* logo */}
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:36, height:36, background:'rgba(255,255,255,0.1)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 22V12h6v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:500, color:'#fff' }}>{t.brand}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{t.brandSub}</div>
            </div>
          </div>
        </div>

        {/* tagline */}
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:11, fontWeight:500, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>
            {t.portal}
          </div>
          <h1 style={{ fontSize: isAr ? 28 : 32, fontWeight:500, color:'#fff', lineHeight:1.3, margin:'0 0 14px', whiteSpace:'pre-line' }}>
            {t.tagline}
          </h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.6, margin:0, maxWidth:300 }}>
            {t.sub}
          </p>
        </div>

        {/* stats */}
        <div style={{ position:'relative', zIndex:1, display:'flex', gap:28 }}>
          {t.stats.map(({ num, label }) => (
            <div key={label}>
              <div style={{ fontSize:20, fontWeight:500, color:'#fff' }}>{num}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>}

      {/* RIGHT — form panel */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'40px', position:'relative',
      }}>

        {/* lang toggle */}
        <button
          onClick={toggleLang}
          style={{
            position:'absolute', top:20,
            [isAr ? 'left' : 'right']: 20,
            background:'#fff', border:'0.5px solid #E8E4DC',
            borderRadius:20, padding:'5px 12px',
            fontSize:11, fontWeight:500, color:'#1B4332',
            cursor:'pointer', fontFamily:'inherit',
          }}
        >
          {isAr ? 'EN' : 'ع'}
        </button>

        <div style={{ width:'100%', maxWidth:380 }}>

          <div style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:22, fontWeight:500, color:'#1C1917', margin:'0 0 4px' }}>{t.heading}</h2>
            <p style={{ fontSize:13, color:'#78716C', margin:0 }}>{t.subheading}</p>
          </div>

          {error && (
            <div style={{
              background:'#FEF2F2', border:'0.5px solid #FECACA',
              borderRadius:8, padding:'10px 12px', marginBottom:16,
              display:'flex', alignItems:'flex-start', gap:8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                <circle cx="12" cy="12" r="10" stroke="#E24B4A" strokeWidth="2"/>
                <path d="M12 8v4M12 16h.01" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize:12, color:'#DC2626', lineHeight:1.4 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate>

            <div style={{ marginBottom:12 }}>
              <label style={labelStyle}>{t.emailLabel}</label>
              <input
                type="email" value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder={t.emailPh} autoComplete="email"
                style={{ ...inputStyle, textAlign: isAr ? 'right' : 'left' }}
                onFocus={e => e.target.style.borderColor = '#1B4332'}
                onBlur={e => e.target.style.borderColor = '#E8E4DC'}
              />
            </div>

            <div style={{ marginBottom:10 }}>
              <label style={labelStyle}>{t.passLabel}</label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder={t.passPh} autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight:36 }}
                  onFocus={e => e.target.style.borderColor = '#1B4332'}
                  onBlur={e => e.target.style.borderColor = '#E8E4DC'}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position:'absolute', top:'50%', right:10, transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0, color:'#A8A29E', display:'flex', alignItems:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    {showPass
                      ? <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ textAlign: isAr ? 'left' : 'right', marginBottom:24 }}>
              <button type="button" onClick={() => navigate('/owner/forgot-password')}
                style={{ background:'none', border:'none', fontSize:11, color:'#1B4332', fontWeight:500, cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                {t.forgot}
              </button>
            </div>

            <button type="submit" disabled={loading}
              style={{
                width:'100%', padding:'11px 20px',
                background: loading ? '#6B9E83' : '#1B4332',
                color:'#fff', border:'none', borderRadius:8,
                fontSize:13, fontWeight:500,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily:'inherit', display:'flex',
                alignItems:'center', justifyContent:'center',
                gap:8, transition:'background 0.2s',
              }}
            >
              {loading && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation:'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                  <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              )}
              {loading ? t.signingIn : t.signin}
            </button>

          </form>

          <p style={{ textAlign:'center', fontSize:12, color:'#78716C', marginTop:20 }}>
            {t.noAccount}{' '}
            <Link to="/owner/register" style={{ color:'#1B4332', fontWeight:500, textDecoration:'none' }}>{t.register}</Link>
          </p>

          <p style={{ textAlign:'center', marginTop:10 }}>
            <Link to="/branch-manager/login" style={{ fontSize:11, color:'#A8A29E', textDecoration:'none' }}>{t.bmLink}</Link>
          </p>

        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Cairo:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #A8A29E; font-size: 12px; }
      `}</style>
    </div>
  )
}
