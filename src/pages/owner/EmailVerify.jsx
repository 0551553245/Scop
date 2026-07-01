import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useLanguage } from '../../context/LanguageContext'
import { getPlatformSettings, getPlanLimits } from '../../lib/platformSettings'

export default function EmailVerify() {
  const { isAr } = useLanguage()
  const [status, setStatus] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let settled = false

    async function completeSetup(session) {
      if (settled) return
      settled = true

      const userId = session.user.id
      const email  = session.user.email

      const raw = localStorage.getItem('scop-pending-registration')
      if (!raw) {
        setStatus('success')
        return
      }

      let pending
      try { pending = JSON.parse(raw) } catch { setStatus('success'); return }

      setStatus('completing')

      try {
        let pl = getPlanLimits({})
        try {
          const settings = await getPlatformSettings(supabaseOwner)
          pl = getPlanLimits(settings)
        } catch {}

        const { error: userErr } = await supabaseOwner.from('users').upsert({
          id:        userId,
          email:     email,
          name:      pending.ownerName,
          name_ar:   pending.nameAr || null,
          phone:     pending.phone,
          role:      'owner',
          is_active: true,
        }, { onConflict: 'id' })
        if (userErr) throw userErr

        const { data: existingBranch } = await supabaseOwner
          .from('branches').select('id')
          .eq('owner_id', userId).eq('name', pending.restaurantName).maybeSingle()

        if (!existingBranch) {
          const { error: branchErr } = await supabaseOwner.from('branches').insert({
            name:      pending.restaurantName,
            name_ar:   pending.restaurantNameAr || pending.restaurantName,
            city:      pending.city,
            owner_id:  userId,
            is_active: true,
          })
          if (branchErr) throw branchErr
        }

        const { data: existingSub } = await supabaseOwner
          .from('subscriptions').select('id').eq('owner_id', userId).maybeSingle()

        if (!existingSub) {
          const plan        = pending.plan || 'starter'
          const trialExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          const { error: subErr } = await supabaseOwner.from('subscriptions').insert({
            owner_id:       userId,
            plan:           plan,
            status:         'trial',
            branches_limit: pl[plan]?.branches ?? 1,
            managers_limit: pl[plan]?.managers ?? 1,
            expires_at:     trialExpiry,
            trial_ends_at:  trialExpiry,
            started_at:     new Date().toISOString(),
          })
          if (subErr) throw subErr
        }

        localStorage.removeItem('scop-pending-registration')
        setStatus('success')
      } catch (err) {
        console.error('Email verify setup error:', err)
        setErrorMsg(err.message || '')
        setStatus('error')
      }
    }

    async function tryVerify() {
      // 1. Parse token_hash and type from the URL (PKCE flow appends these as query params)
      const params     = new URLSearchParams(window.location.search)
      const tokenHash  = params.get('token_hash')
      const type       = params.get('type')   // 'signup' | 'email' | 'recovery' etc.

      if (tokenHash) {
        const { data, error } = await supabaseOwner.auth.verifyOtp({
          token_hash: tokenHash,
          type:       type === 'signup' ? 'signup' : 'email',
        })
        if (error) {
          if (!settled) { settled = true; setStatus('expired') }
          return
        }
        if (data?.session) { completeSetup(data.session); return }
      }

      // 2. Fallback: check if supabaseOwner already has a session
      //    (handles implicit-flow hash tokens the client auto-processes)
      const { data: { session } } = await supabaseOwner.auth.getSession()
      if (session) { completeSetup(session); return }

      // 3. Listen for SIGNED_IN fired by the client when it processes URL tokens
      const { data: { subscription } } = supabaseOwner.auth.onAuthStateChange((event, sess) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && sess) {
          completeSetup(sess)
        }
      })

      // 4. Give up after 12 s if nothing fires
      const timer = setTimeout(() => {
        if (!settled) { settled = true; setStatus('expired') }
      }, 12000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timer)
      }
    }

    // tryVerify is async; capture its cleanup return value
    let cleanup = () => {}
    tryVerify().then(fn => { if (fn) cleanup = fn })

    return () => cleanup()
  }, [])

  const fontFamily = isAr ? "'Cairo', sans-serif" : "'Inter', sans-serif"

  const cardStyle = {
    background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 16,
    padding: '48px 40px', maxWidth: 440, width: '100%', textAlign: 'center',
  }

  const iconCircle = (
    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', border: '2px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )

  const spinnerCircle = (
    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
        <circle cx="12" cy="12" r="10" stroke="#E5E7EB" strokeWidth="3"/>
        <path d="M12 2a10 10 0 0110 10" stroke="#1B4332" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  )

  const loginBtn = (
    <Link to="/owner/login" style={{ display: 'block', padding: '12px 20px', background: '#1B4332', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily, boxSizing: 'border-box' }}>
      {isAr ? 'تسجيل الدخول →' : 'Sign in to your account →'}
    </Link>
  )

  const root = (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0FDF4', fontFamily, padding: '40px 20px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1B4332', marginBottom: 28, letterSpacing: '-0.5px' }}>Scop</div>
      <div style={cardStyle}>
        {(status === 'loading' || status === 'completing') && (
          <>
            {spinnerCircle}
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
              {status === 'completing'
                ? (isAr ? 'جارٍ إعداد حسابك...' : 'Setting up your account...')
                : (isAr ? 'جارٍ التحقق...' : 'Verifying your email...')}
            </h2>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              {isAr ? 'يرجى الانتظار لحظة' : 'Please wait a moment'}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            {iconCircle}
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
              {isAr ? 'تم التحقق من بريدك الإلكتروني!' : 'Email verified!'}
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 28px', lineHeight: 1.6 }}>
              {isAr
                ? 'يمكنك الآن تسجيل الدخول إلى حسابك'
                : 'You can now sign in to your account'}
            </p>
            {loginBtn}
          </>
        )}

        {status === 'expired' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFF1F2', border: '2px solid #FECDD3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#E24B4A" strokeWidth="2"/>
                <path d="M12 8v4m0 4h.01" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
              {isAr ? 'رابط التحقق منتهي الصلاحية' : 'Verification link expired'}
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
              {isAr
                ? 'يرجى التسجيل مجدداً أو التواصل مع الدعم إذا استمرت المشكلة'
                : 'Please register again or contact support if the problem persists'}
            </p>
            <Link to="/owner/register" style={{ display: 'block', padding: '12px 20px', background: '#1B4332', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily, boxSizing: 'border-box', marginBottom: 10 }}>
              {isAr ? 'تسجيل جديد →' : 'Register again →'}
            </Link>
            <Link to="/owner/login" style={{ display: 'block', padding: '10px 20px', background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E7EB', borderRadius: 10, fontSize: 12, textDecoration: 'none', fontFamily }}>
              {isAr ? 'تسجيل الدخول' : 'Sign in instead'}
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFF1F2', border: '2px solid #FECDD3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#E24B4A" strokeWidth="2"/>
                <path d="M12 8v4m0 4h.01" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
              {isAr ? 'حدث خطأ أثناء الإعداد' : 'Setup error'}
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 8px', lineHeight: 1.6 }}>
              {isAr
                ? 'تم التحقق من بريدك الإلكتروني، لكن فشل إعداد الحساب.'
                : 'Your email was verified but account setup failed.'}
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 24px' }}>
              {isAr ? 'جرّب تسجيل الدخول — قد يكتمل الإعداد تلقائياً' : 'Try signing in — setup may complete automatically'}
            </p>
            {loginBtn}
          </>
        )}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Cairo:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )

  return root
}
