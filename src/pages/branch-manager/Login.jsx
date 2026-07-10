import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseBranchManager } from '../../lib/supabase'
import { useLanguage } from '../../context/LanguageContext'
import AuthShell, { AuthInput, AuthButton, AuthError, AuthLink } from '../../components/AuthShell'

export default function BranchManagerLogin() {
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
      const { data: authData, error: authError } = await supabaseBranchManager.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(isAr ? 'البريد أو كلمة المرور غير صحيحة.' : 'Incorrect email or password.')
        setLoading(false)
        return
      }

      if (!authData.user?.email_confirmed_at) {
        await supabaseBranchManager.auth.signOut()
        setError(isAr
          ? 'يرجى التحقق من بريدك قبل تسجيل الدخول.'
          : 'Please verify your email before signing in.')
        setLoading(false)
        return
      }

      const { data: profile } = await supabaseBranchManager
        .from('users')
        .select('id, role, is_active')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (!profile || profile.role !== 'branch_manager') {
        await supabaseBranchManager.auth.signOut()
        setError(isAr ? 'هذا الحساب ليس حساب مدير فرع.' : 'This is not a branch manager account.')
        setLoading(false)
        return
      }

      if (!profile.is_active) {
        await supabaseBranchManager.auth.signOut()
        setError(isAr ? 'حسابك غير نشط.' : 'Your account is inactive.')
        setLoading(false)
        return
      }

      await new Promise(r => setTimeout(r, 50))
      navigate('/branch-manager/dashboard', { replace: true })
    } catch {
      setError(isAr ? 'حدث خطأ. حاول مجدداً.' : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <AuthShell
      portalLabel="Branch Manager"
      portalLabelAr="مدير الفرع"
      tagline={"Complete today's work.\nStay on track."}
      taglineAr={"أنجز مهام اليوم.\nابقَ على المسار."}
      footer={
        <AuthLink to="/owner/login">
          {isAr ? 'تسجيل دخول المالك ←' : '→ Owner login'}
        </AuthLink>
      }
    >
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        {isAr ? 'مرحباً بعودتك' : 'Welcome back'}
      </h2>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 22 }}>
        {isAr ? 'سجّل دخولك كمدير فرع' : 'Sign in as branch manager'}
      </p>

      <form onSubmit={handleLogin}>
        <AuthError message={error} />
        <AuthInput
          label={isAr ? 'البريد الإلكتروني' : 'Email address'}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="manager@restaurant.com"
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
        <AuthButton loading={loading}>
          {loading
            ? (isAr ? 'جارٍ تسجيل الدخول…' : 'Signing in…')
            : (isAr ? 'تسجيل الدخول' : 'Sign in')}
        </AuthButton>
      </form>
    </AuthShell>
  )
}
