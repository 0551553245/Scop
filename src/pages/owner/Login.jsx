import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useLanguage } from '../../context/LanguageContext'
import AuthShell, { AuthInput, AuthButton, AuthError, AuthLink } from '../../components/AuthShell'

export default function OwnerLogin() {
  const navigate = useNavigate()
  const { isAr } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError(isAr ? 'يرجى إدخال البريد وكلمة المرور.' : 'Please enter your email and password.')
      return
    }

    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabaseOwner.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(isAr ? 'البريد أو كلمة المرور غير صحيحة.' : 'Incorrect email or password.')
        setLoading(false)
        return
      }

      // BUG #002 pattern: never show wrong-password for unverified accounts
      if (!authData.user?.email_confirmed_at) {
        await supabaseOwner.auth.signOut()
        setError(isAr
          ? 'يرجى التحقق من بريدك قبل تسجيل الدخول.'
          : 'Please verify your email before signing in.')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabaseOwner
        .from('users')
        .select('id, role, is_active')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        await supabaseOwner.auth.signOut()
        setError(isAr ? 'لم يتم العثور على الملف الشخصي.' : 'Profile not found.')
        setLoading(false)
        return
      }

      if (profile.role !== 'owner') {
        await supabaseOwner.auth.signOut()
        setError(isAr ? 'هذا الحساب ليس حساب مالك.' : 'This account is not an owner account.')
        setLoading(false)
        return
      }

      if (!profile.is_active) {
        await supabaseOwner.auth.signOut()
        setError(isAr ? 'حسابك غير نشط.' : 'Your account is inactive.')
        setLoading(false)
        return
      }

      // Let auth context commit before navigate (BUG #142)
      await new Promise(r => setTimeout(r, 50))
      navigate('/owner/dashboard', { replace: true })
    } catch {
      setError(isAr ? 'حدث خطأ. حاول مجدداً.' : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <AuthShell
      portalLabel="Owner Portal"
      portalLabelAr="بوابة المالك"
      tagline={"Run every branch.\nFrom anywhere."}
      taglineAr={"أدِر كل فرع.\nمن أي مكان."}
      footer={
        <>
          {isAr ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
          <AuthLink to="/owner/register">{isAr ? 'إنشاء حساب' : 'Create one'}</AuthLink>
          <div style={{ marginTop: 10 }}>
            <AuthLink to="/branch-manager/login">
              {isAr ? 'تسجيل دخول مدير الفرع ←' : '→ Branch Manager login'}
            </AuthLink>
          </div>
        </>
      }
    >
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        {isAr ? 'مرحباً بعودتك' : 'Welcome back'}
      </h2>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 22 }}>
        {isAr ? 'سجّل دخولك إلى حساب المالك' : 'Sign in to your owner account'}
      </p>

      <form onSubmit={handleLogin}>
        <AuthError message={error} />
        <AuthInput
          label={isAr ? 'البريد الإلكتروني' : 'Email address'}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@restaurant.com"
          autoComplete="email"
          dir="ltr"
        />
        <AuthInput
          label={isAr ? 'كلمة المرور' : 'Password'}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <div style={{ textAlign: 'right', marginBottom: 12, marginTop: -6 }}>
          <AuthLink to="/owner/forgot-password">
            {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
          </AuthLink>
        </div>
        <AuthButton loading={loading}>
          {loading
            ? (isAr ? 'جارٍ تسجيل الدخول…' : 'Signing in…')
            : (isAr ? 'تسجيل الدخول' : 'Sign in')}
        </AuthButton>
      </form>
    </AuthShell>
  )
}
