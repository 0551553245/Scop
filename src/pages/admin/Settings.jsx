import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../../lib/supabase'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { invalidateSettingsCache } from '../../lib/platformSettings'
import { getCached, setCached, invalidateCache } from '../../lib/cache'
import AdminLayout from '../../components/AdminLayout'
import ErrorBanner from '../../components/ErrorBanner'

const inputStyle = {
  width:'100%', padding:'9px 12px', fontSize:13,
  border:'0.5px solid #E5E7EB', borderRadius:8, outline:'none',
  color:'#111827', fontFamily:'inherit', background:'#fff',
  boxSizing:'border-box',
}

const labelStyle = {
  display:'block', fontSize:11, fontWeight:600, color:'#6B7280',
  marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px',
}

export default function AdminSettings() {
  const navigate             = useNavigate()
  const { profile, signOut } = useAdminAuth()
  const { isAr, toggleLang } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [pricePerBranch,      setPricePerBranch]      = useState(50)
  const [managersPerBranch,   setManagersPerBranch]   = useState(2)
  const [enterpriseThreshold, setEnterpriseThreshold] = useState(10)
  const [trialDuration,       setTrialDuration]       = useState(14)
  const [supportWhatsapp,     setSupportWhatsapp]     = useState('')

  async function logAction(action, description, targetId, targetType, metadata) {
    await supabaseAdmin.from('activity_log').insert({
      action, description,
      actor_id: profile.id,
      target_id: targetId || null,
      target_type: targetType || null,
      metadata: metadata || null,
    })
  }

  const fetchSettings = useCallback(async () => {
    setError('')

    const cacheKey = `admin-settings-${profile.id}`
    const cached   = getCached(cacheKey)
    if (cached) {
      setPricePerBranch(cached.pricePerBranch)
      setManagersPerBranch(cached.managersPerBranch)
      setEnterpriseThreshold(cached.enterpriseThreshold)
      setTrialDuration(cached.trialDuration)
      setSupportWhatsapp(cached.supportWhatsapp)
      setLoading(false)
    }

    try {
      const { data, error: err } = await supabaseAdmin
        .from('platform_settings')
        .select('key, value')

      if (err) throw err

      const settings = Object.fromEntries((data || []).map(s => [s.key, s.value]))

      const resolved = {
        pricePerBranch:      settings.price_per_branch            !== undefined ? Number(settings.price_per_branch)            : pricePerBranch,
        managersPerBranch:   settings.managers_per_branch         !== undefined ? Number(settings.managers_per_branch)         : managersPerBranch,
        enterpriseThreshold: settings.enterprise_branch_threshold !== undefined ? Number(settings.enterprise_branch_threshold) : enterpriseThreshold,
        trialDuration:       settings.trial_duration_days         !== undefined ? Number(settings.trial_duration_days)         : trialDuration,
        supportWhatsapp:     settings.support_whatsapp            !== undefined ? settings.support_whatsapp                    : supportWhatsapp,
      }

      setPricePerBranch(resolved.pricePerBranch)
      setManagersPerBranch(resolved.managersPerBranch)
      setEnterpriseThreshold(resolved.enterpriseThreshold)
      setTrialDuration(resolved.trialDuration)
      setSupportWhatsapp(resolved.supportWhatsapp)
      setCached(cacheKey, resolved, 60000)

    } catch (err) {
      console.error('Settings fetch error:', err)
      setError(isAr ? 'فشل تحميل الإعدادات' : 'Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveMsg('')
    setSaving(true)
    try {
      const rows = [
        { key: 'price_per_branch',            value: String(pricePerBranch) },
        { key: 'managers_per_branch',         value: String(managersPerBranch) },
        { key: 'enterprise_branch_threshold', value: String(enterpriseThreshold) },
        { key: 'trial_duration_days',         value: String(trialDuration) },
        { key: 'support_whatsapp',            value: supportWhatsapp.trim() },
      ].map(r => ({ ...r, updated_at: new Date().toISOString() }))

      const { error: err } = await supabaseAdmin
        .from('platform_settings')
        .upsert(rows, { onConflict: 'key' })

      if (err) throw err

      invalidateSettingsCache()
      invalidateCache(`admin-settings-${profile.id}`)
      await logAction('settings_updated', 'Platform settings updated', null, 'platform_settings')

      setSaveMsg(isAr ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully.')

    } catch (err) {
      console.error('Save settings error:', err)
      setSaveMsg(isAr ? 'حدث خطأ أثناء الحفظ' : 'Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <AdminLayout currentPath="/admin/settings" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Settings" titleAr="الإعدادات">
      <div style={{ padding:'20px 24px' }}>
        <div className="skeleton" style={{ height:420 }} />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout currentPath="/admin/settings" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Settings" titleAr="الإعدادات" topbarRight={
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
    }>
      <div style={{ padding:'20px 24px' }}>

          <ErrorBanner message={error} isAr={isAr} />
          {saveMsg && (
            <div style={{ background: saveMsg.includes('error') || saveMsg.includes('خطأ') ? '#FFF1F2' : '#F0FDF4', border:'0.5px solid #BBF7D0', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#166534', fontSize:13 }}>{saveMsg}</div>
          )}

          <form onSubmit={handleSave}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

              {/* Per-branch pricing */}
              <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'التسعير لكل فرع' : 'Per-Branch Pricing'}</div>
                <div style={{ marginBottom:12 }}>
                  <label style={labelStyle}>{isAr ? 'السعر لكل فرع (ريال)' : 'Price per branch (SAR)'}</label>
                  <input type="number" min="0" value={pricePerBranch} onChange={e => setPricePerBranch(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={labelStyle}>{isAr ? 'المديرون لكل فرع' : 'Managers per branch'}</label>
                  <input type="number" min="1" value={managersPerBranch} onChange={e => setManagersPerBranch(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{isAr ? 'حد المؤسسات (فروع)' : 'Enterprise threshold (branches)'}</label>
                  <input type="number" min="1" value={enterpriseThreshold} onChange={e => setEnterpriseThreshold(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:12 }}>{isAr ? 'يُطبَّق تلقائياً على التسجيلات الجديدة.' : 'Applied automatically to new signups.'}</div>
              </div>

              {/* Trial settings */}
              <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'إعدادات التجربة' : 'Trial Settings'}</div>
                <label style={labelStyle}>{isAr ? 'مدة التجربة (أيام)' : 'Trial Duration (days)'}</label>
                <input type="number" min="1" value={trialDuration} onChange={e => setTrialDuration(e.target.value)} style={inputStyle} />
              </div>

              {/* Support contact */}
              <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'تواصل الدعم' : 'Support Contact'}</div>
                <label style={labelStyle}>{isAr ? 'رقم واتساب' : 'WhatsApp Number'}</label>
                <input type="text" value={supportWhatsapp} onChange={e => setSupportWhatsapp(e.target.value)} placeholder="+966 5x xxx xxxx" style={{ ...inputStyle, direction:'ltr' }} />
              </div>
            </div>

            <button type="submit" disabled={saving}
              style={{ padding:'10px 24px', borderRadius:10, fontSize:13, fontWeight:600, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#6B9E83' : '#1B4332', color:'#fff', border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 }}>
              {saving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
              {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </form>
        </div>
    </AdminLayout>
  )
}
