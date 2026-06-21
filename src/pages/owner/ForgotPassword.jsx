import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useLanguage } from '../../context/LanguageContext'

export default function OwnerForgotPassword() {
  const { lang, isAr, toggleLang } = useLanguage()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)

  const t = {
    en: {
      heading:     'Reset your password',
      sub:         'Enter your email and we\'ll send you a reset link.',
      emailLabel:  'Email address',
      emailPh:     'you@restaurant.com',
      submit:      'Send reset link',
      submitting:  'Sending…',
      successHead: 'Check your email',
      successSub:  'A password reset link has been sent to',
      backToLogin: '← Back to sign in',
      errEmpty:    'Please enter your email address.',
      errGeneric:  'Something went wrong. Please try again.',
      errRateLimit:'Too many requests. Please wait a few minutes before trying again.',
    },
    ar: {
      heading:     'إعادة تعيين كلمة المرور',
      sub:         'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.',
      emailLabel:  'البريد الإلكتروني',
      emailPh:     'you@restaurant.com',
      submit:      'إرسال رابط إعادة التعيين',
      submitting:  'جارٍ الإرسال…',
      successHead: 'تحقق من بريدك الإلكتروني',
      successSub:  'تم إرسال رابط إعادة التعيين إلى',
      backToLogin: 'العودة إلى تسجيل الدخول ←',
      errEmpty:    'يرجى إدخال بريدك الإلكتروني.',
      errGeneric:  'حدث خطأ. يرجى المحاولة مجدداً.',
      errRateLimit:'طلبات كثيرة. يرجى الانتظار بضع دقائق قبل المحاولة مجدداً.',
    },
  }[lang]

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError(t.errEmpty); return }
    setLoading(true)
    try {
      const { error: err } = await supabaseOwner.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/owner/reset-password',
      })
      if (err) {
        const msg = err.message || ''
        if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many') || msg.includes('security purposes') || msg.includes('after ')) {
          setError(t.errRateLimit)
        } else {
          setError(t.errGeneric)
        }
      } else { setSent(true) }
    } catch {
      setError(t.errGeneric)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width:'100%', padding:'10px 12px', fontSize:13,
    background:'#fff', border:'0.5px solid #E8E4DC',
    borderRadius:8, outline:'none', color:'#1C1917',
    boxSizing:'border-box', fontFamily:'inherit',
    transition:'border-color 0.15s', direction:'ltr',
  }
  const labelStyle = {
    display:'block', fontSize:11, fontWeight:500,
    color:'#6B6B6B', marginBottom:5,
    textTransform:'uppercase', letterSpacing:'0.5px',
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        background:'#F7F5F0', padding:24,
        fontFamily: isAr ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif",
        position:'relative',
      }}
    >
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

        {/* brand mark */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:20 }}>
            <div style={{ width:36, height:36, background:'#1B4332', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 22V12h6v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize:16, fontWeight:500, color:'#1C1917' }}>{isAr ? 'سكوب' : 'Scop'}</span>
          </div>
        </div>

        <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:16, padding:28 }}>
          {sent ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ width:48, height:48, background:'#F0FDF4', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize:18, fontWeight:500, color:'#1C1917', margin:'0 0 8px' }}>{t.successHead}</h2>
              <p style={{ fontSize:13, color:'#78716C', margin:'0 0 4px', lineHeight:1.5 }}>{t.successSub}</p>
              <p style={{ fontSize:13, color:'#1B4332', fontWeight:500, margin:'0 0 20px' }}>{email}</p>
              <Link to="/owner/login" style={{ fontSize:12, color:'#1B4332', fontWeight:500, textDecoration:'none' }}>{t.backToLogin}</Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize:20, fontWeight:500, color:'#1C1917', margin:'0 0 6px' }}>{t.heading}</h2>
              <p style={{ fontSize:13, color:'#78716C', margin:'0 0 22px', lineHeight:1.5 }}>{t.sub}</p>

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

              <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom:20 }}>
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
                <button type="submit" disabled={loading}
                  style={{
                    width:'100%', padding:'11px 20px',
                    background: loading ? '#6B9E83' : '#1B4332',
                    color:'#fff', border:'none', borderRadius:8,
                    fontSize:13, fontWeight:500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily:'inherit', display:'flex',
                    alignItems:'center', justifyContent:'center',
                    gap:8, marginBottom:16,
                  }}
                >
                  {loading && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation:'spin 0.8s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                      <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  )}
                  {loading ? t.submitting : t.submit}
                </button>
              </form>

              <div style={{ textAlign:'center' }}>
                <Link to="/owner/login" style={{ fontSize:12, color:'#78716C', textDecoration:'none' }}>{t.backToLogin}</Link>
              </div>
            </>
          )}
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
