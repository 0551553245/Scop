import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../../lib/supabase'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { invalidateSettingsCache } from '../../lib/platformSettings'
import { AdminSidebar } from '../../components/AdminLayout'

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

  const [priceStarter,    setPriceStarter]    = useState(199)
  const [priceGrowth,     setPriceGrowth]     = useState(499)
  const [pricePro,        setPricePro]        = useState(999)
  const [trialDuration,   setTrialDuration]   = useState(14)
  const [supportWhatsapp, setSupportWhatsapp] = useState('')
  const [starterBranches, setStarterBranches] = useState(1)
  const [starterManagers, setStarterManagers] = useState(1)
  const [growthBranches,  setGrowthBranches]  = useState(5)
  const [growthManagers,  setGrowthManagers]  = useState(5)
  const [proBranches,     setProBranches]     = useState(15)
  const [proManagers,     setProManagers]     = useState(99)

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
    try {
      const { data, error: err } = await supabaseAdmin
        .from('platform_settings')
        .select('key, value')

      if (err) throw err

      const settings = Object.fromEntries((data || []).map(s => [s.key, s.value]))

      if (settings.price_starter      !== undefined) setPriceStarter(Number(settings.price_starter))
      if (settings.price_growth       !== undefined) setPriceGrowth(Number(settings.price_growth))
      if (settings.price_pro          !== undefined) setPricePro(Number(settings.price_pro))
      if (settings.trial_duration_days !== undefined) setTrialDuration(Number(settings.trial_duration_days))
      if (settings.support_whatsapp   !== undefined) setSupportWhatsapp(settings.support_whatsapp)
      if (settings.starter_branches   !== undefined) setStarterBranches(Number(settings.starter_branches))
      if (settings.starter_managers   !== undefined) setStarterManagers(Number(settings.starter_managers))
      if (settings.growth_branches    !== undefined) setGrowthBranches(Number(settings.growth_branches))
      if (settings.growth_managers    !== undefined) setGrowthManagers(Number(settings.growth_managers))
      if (settings.pro_branches       !== undefined) setProBranches(Number(settings.pro_branches))
      if (settings.pro_managers       !== undefined) setProManagers(Number(settings.pro_managers))

    } catch (err) {
      console.error('Settings fetch error:', err)
      setError(isAr ? 'فشل تحميل الإعدادات' : 'Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }, [])

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
        { key: 'price_starter',       value: String(priceStarter) },
        { key: 'price_growth',        value: String(priceGrowth) },
        { key: 'price_pro',           value: String(pricePro) },
        { key: 'trial_duration_days', value: String(trialDuration) },
        { key: 'support_whatsapp',    value: supportWhatsapp.trim() },
        { key: 'starter_branches',    value: String(starterBranches) },
        { key: 'starter_managers',    value: String(starterManagers) },
        { key: 'growth_branches',     value: String(growthBranches) },
        { key: 'growth_managers',     value: String(growthManagers) },
        { key: 'pro_branches',        value: String(proBranches) },
        { key: 'pro_managers',        value: String(proManagers) },
      ].map(r => ({ ...r, updated_at: new Date().toISOString() }))

      const { error: err } = await supabaseAdmin
        .from('platform_settings')
        .upsert(rows, { onConflict: 'key' })

      if (err) throw err

      invalidateSettingsCache()
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
    <div dir={isAr?'rtl':'ltr'} style={{ display:'flex', height:'100vh', background:'#F0FDF4', fontFamily:"'Inter',sans-serif" }}>
      <div style={{ width:200, background:'#fff', borderRight:'0.5px solid #E5E7EB', flexShrink:0 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ height:56, background:'#fff', borderBottom:'0.5px solid #E5E7EB', flexShrink:0 }} />
        <div style={{ flex:1, padding:'20px 24px', overflowY:'auto' }}>
          <div className="skeleton" style={{ height:420 }} />
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} .skeleton{background:#E5E7EB;border-radius:12px;animation:pulse 1.5s ease-in-out infinite}`}</style>
    </div>
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ display:'flex', height:'100vh', minHeight:700, overflow:'hidden', background:'#F0FDF4', fontFamily: isAr ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif" }}>

      <AdminSidebar currentPath="/admin/settings" profile={profile} isAr={isAr} handleSignOut={handleSignOut} />

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        <div style={{ background:'#fff', borderBottom:'0.5px solid #E5E7EB', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{isAr ? 'الإعدادات' : 'Settings'}</span>
          <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
            {isAr ? 'EN' : 'ع'}
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {error && (
            <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#9F1239', fontSize:13 }}>{error}</div>
          )}
          {saveMsg && (
            <div style={{ background: saveMsg.includes('error') || saveMsg.includes('خطأ') ? '#FFF1F2' : '#F0FDF4', border:'0.5px solid #BBF7D0', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#166534', fontSize:13 }}>{saveMsg}</div>
          )}

          <form onSubmit={handleSave}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

              {/* Plan pricing */}
              <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'تسعير الخطط' : 'Plan Pricing'}</div>
                <div style={{ marginBottom:12 }}>
                  <label style={labelStyle}>Starter (SAR)</label>
                  <input type="number" min="0" value={priceStarter} onChange={e => setPriceStarter(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={labelStyle}>Growth (SAR)</label>
                  <input type="number" min="0" value={priceGrowth} onChange={e => setPriceGrowth(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Pro (SAR)</label>
                  <input type="number" min="0" value={pricePro} onChange={e => setPricePro(e.target.value)} style={inputStyle} />
                </div>
              </div>

              {/* Plan limits */}
              <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'حدود الخطط' : 'Plan Limits'}</div>
                {[
                  { plan:'Starter', branches: starterBranches, setBranches: setStarterBranches, managers: starterManagers, setManagers: setStarterManagers },
                  { plan:'Growth',  branches: growthBranches,  setBranches: setGrowthBranches,  managers: growthManagers,  setManagers: setGrowthManagers  },
                  { plan:'Pro',     branches: proBranches,     setBranches: setProBranches,     managers: proManagers,     setManagers: setProManagers     },
                ].map(p => (
                  <div key={p.plan} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:6 }}>{p.plan}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize:10 }}>{isAr ? 'فروع' : 'Branches'}</label>
                        <input type="number" min="1" value={p.branches} onChange={e => p.setBranches(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize:10 }}>{isAr ? 'مديرون' : 'Managers'}</label>
                        <input type="number" min="1" value={p.managers} onChange={e => p.setManagers(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>{isAr ? 'الحدود مطبقة تلقائياً.' : 'Limits are enforced automatically.'}</div>
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
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        a { text-decoration: none; }
      `}</style>
    </div>
  )
}
