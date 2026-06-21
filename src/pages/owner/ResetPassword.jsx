import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useLanguage } from '../../context/LanguageContext'

export default function OwnerResetPassword() {
  const navigate = useNavigate()
  const { lang, isAr, toggleLang } = useLanguage()
  const [ready, setReady]       = useState(false)
  const [expired, setExpired]   = useState(false)
  const [stillWaiting, setStillWaiting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabaseOwner.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') setReady(true)
      }
    )
    const slowTimer = setTimeout(() => setStillWaiting(true), 6000)
    const timeout   = setTimeout(() => setExpired(true), 12000)
    return () => {
      subscription.unsubscribe()
      clearTimeout(slowTimer)
      clearTimeout(timeout)
    }
  }, [])

  const t = {
    en: {
      heading:     'Set new password',
      sub:         'Choose a strong password for your account.',
      passLabel:   'New password',
      confirmLabel:'Confirm password',
      passPh:      '••••••••',
      submit:      'Update password',
      submitting:  'Updating…',
      waiting:     'Verifying reset link…',
      stillWaiting:'Still loading — make sure you clicked the link from your email…',
      expiredHead: 'Link expired or invalid',
      expiredSub:  'This password reset link has expired or is invalid.',
      requestNew:  'Request a new link',
      backToLogin: '← Back to sign in',
      errShort:    'Password must be at least 6 characters.',
      errMatch:    "Passwords don't match.",
      errGeneric:  'Failed to update password. Please try again.',
    },
    ar: {
      heading:     'تعيين كلمة مرور جديدة',
      sub:         'اختر كلمة مرور قوية لحسابك.',
      passLabel:   'كلمة المرور الجديدة',
      confirmLabel:'تأكيد كلمة المرور',
      passPh:      '••••••••',
      submit:      'تحديث كلمة المرور',
      submitting:  'جارٍ التحديث…',
      waiting:     'جارٍ التحقق من الرابط…',
      stillWaiting:'لا يزال يحمّل — تأكد من أنك فتحت الرابط من بريدك الإلكتروني…',
      expiredHead: 'انتهت صلاحية الرابط أو غير صالح',
      expiredSub:  'انتهت صلاحية رابط إعادة تعيين كلمة المرور أو أنه غير صالح.',
      requestNew:  'طلب رابط جديد',
      backToLogin: 'العودة إلى تسجيل الدخول ←',
      errShort:    'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.',
      errMatch:    'كلمتا المرور غير متطابقتين.',
      errGeneric:  'فشل تحديث كلمة المرور. يرجى المحاولة مجدداً.',
    },
  }[lang]

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!password || password.length < 6) { setError(t.errShort); return }
    if (password !== confirm) { setError(t.errMatch); return }
    setLoading(true)
    try {
      const { error: err } = await supabaseOwner.auth.updateUser({ password })
      if (err) { setError(t.errGeneric) }
      else { navigate('/owner/dashboard') }
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
    transition:'border-color 0.15s', paddingRight:36,
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

          {/* waiting for PASSWORD_RECOVERY event */}
          {!ready && !expired && (
            <div style={{ textAlign:'center', padding:'8px 0' }}>
              <div style={{
                width:40, height:40, border:'3px solid #E5E7EB',
                borderTopColor:'#1B4332', borderRadius:'50%',
                animation:'spin 0.8s linear infinite',
                margin:'0 auto 16px',
              }} />
              <p style={{ fontSize:13, color:'#78716C' }}>{t.waiting}</p>
              {stillWaiting && (
                <p style={{ fontSize:12, color:'#F59E0B', marginTop:8, lineHeight:1.5 }}>{t.stillWaiting}</p>
              )}
            </div>
          )}

          {/* expired / invalid link */}
          {!ready && expired && (
            <div style={{ textAlign:'center' }}>
              <div style={{ width:48, height:48, background:'#FEF2F2', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#E24B4A" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize:18, fontWeight:500, color:'#1C1917', margin:'0 0 8px' }}>{t.expiredHead}</h2>
              <p style={{ fontSize:13, color:'#78716C', margin:'0 0 20px', lineHeight:1.5 }}>{t.expiredSub}</p>
              <Link to="/owner/forgot-password"
                style={{ display:'inline-block', background:'#1B4332', color:'#fff', padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:500, textDecoration:'none', marginBottom:12 }}>
                {t.requestNew}
              </Link>
              <br />
              <Link to="/owner/login" style={{ fontSize:12, color:'#78716C', textDecoration:'none' }}>{t.backToLogin}</Link>
            </div>
          )}

          {/* ready — show password form */}
          {ready && (
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
                <div style={{ marginBottom:14 }}>
                  <label style={labelStyle}>{t.passLabel}</label>
                  <div style={{ position:'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => { setPassword(e.target.value); setError('') }}
                      placeholder={t.passPh} autoComplete="new-password"
                      style={inputStyle}
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

                <div style={{ marginBottom:20 }}>
                  <label style={labelStyle}>{t.confirmLabel}</label>
                  <div style={{ position:'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'} value={confirm}
                      onChange={e => { setConfirm(e.target.value); setError('') }}
                      placeholder={t.passPh} autoComplete="new-password"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#1B4332'}
                      onBlur={e => e.target.style.borderColor = '#E8E4DC'}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  style={{
                    width:'100%', padding:'11px 20px',
                    background: loading ? '#6B9E83' : '#1B4332',
                    color:'#fff', border:'none', borderRadius:8,
                    fontSize:13, fontWeight:500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily:'inherit', display:'flex',
                    alignItems:'center', justifyContent:'center', gap:8,
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
