import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../../lib/supabase'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getCached, setCached, invalidateCache } from '../../lib/cache'
import { getPlatformSettings, getPlanLimits } from '../../lib/platformSettings'
import { AdminSidebar } from '../../components/AdminLayout'
import { formatDate, daysLeft, calculateExpiry } from '../../lib/adminHelpers'

const TABS = [
  { key:'all',     en:'All',     ar:'الكل'    },
  { key:'active',  en:'Active',  ar:'نشط'     },
  { key:'trials',  en:'Trials',  ar:'التجارب' },
  { key:'expired', en:'Expired', ar:'منتهي'   },
  { key:'blocked', en:'Blocked', ar:'محظور'   },
]

const PLAN_BADGE = {
  starter: { bg:'#EFF6FF', color:'#1D4ED8' },
  growth:  { bg:'#F0FDF4', color:'#166534' },
  pro:     { bg:'#F5F3FF', color:'#7C3AED' },
}

const STATUS_BADGE = {
  active:  { bg:'#DCFCE7', color:'#166534', en:'Active',  ar:'نشط'   },
  trial:   { bg:'#FEF3C7', color:'#D97706', en:'Trial',   ar:'تجربة' },
  expired: { bg:'#FEE2E2', color:'#DC2626', en:'Expired', ar:'منتهي' },
  blocked: { bg:'#F3F4F6', color:'#6B7280', en:'Blocked', ar:'محظور' },
}


function waLink(phone, name, days) {
  const digits = (phone || '').replace(/[^\d]/g, '')
  const msg = encodeURIComponent(`Hi ${name}! Your Scop trial expires in ${days} days. Ready to activate? Reply YES to continue.`)
  return `https://wa.me/${digits}?text=${msg}`
}

function daysBadge(d) {
  if (d === null || d === undefined) return { bg:'#F3F4F6', color:'#6B7280' }
  if (d <= 3) return { bg:'#FEE2E2', color:'#DC2626' }
  if (d <= 7) return { bg:'#FEF3C7', color:'#D97706' }
  return { bg:'#DCFCE7', color:'#166534' }
}

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

export default function AdminSubscriptions() {
  const navigate             = useNavigate()
  const { profile, signOut } = useAdminAuth()
  const { isAr, toggleLang } = useLanguage()

  const [subscriptions, setSubscriptions] = useState([])
  const [planLimits,    setPlanLimits]    = useState(getPlanLimits({}))
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState('all')

  const [actModal,  setActModal]  = useState(null)
  const [actPlan,   setActPlan]   = useState('starter')
  const [actAmount, setActAmount] = useState(0)
  const [actSaving, setActSaving] = useState(false)
  const [actErr,    setActErr]    = useState('')

  const [busyId, setBusyId] = useState(null)

  const cacheKey = `admin-subscriptions-${profile?.id}`

  async function logAction(action, description, targetId, targetType, metadata) {
    await supabaseAdmin.from('activity_log').insert({
      action, description,
      actor_id:    profile.id,
      target_id:   targetId   || null,
      target_type: targetType || null,
      metadata:    metadata   || null,
    })
  }

  const fetchData = useCallback(async () => {
    setError('')
    const cached = getCached(cacheKey)
    if (cached) {
      setSubscriptions(cached.subscriptions)
      setPlanLimits(cached.planLimits)
      setLoading(false)
      return
    }

    try {
      const [settings, subsRes, ownersRes] = await Promise.all([
        getPlatformSettings(supabaseAdmin),
        supabaseAdmin
          .from('subscriptions')
          .select('id, owner_id, plan, status, branches_limit, managers_limit, expires_at, trial_ends_at, started_at')
          .order('started_at', { ascending: false }),
        supabaseAdmin
          .from('users')
          .select('id, name, name_ar, email, phone')
          .eq('role', 'owner'),
      ])

      if (subsRes.error)   throw subsRes.error
      if (ownersRes.error) throw ownersRes.error

      const limits = getPlanLimits(settings)
      setPlanLimits(limits)

      const ownerMap = {}
      ;(ownersRes.data || []).forEach(o => { ownerMap[o.id] = o })

      const subs = (subsRes.data || []).map(s => ({ ...s, owner: ownerMap[s.owner_id] || null }))

      setSubscriptions(subs)
      setCached(cacheKey, { subscriptions: subs, planLimits: limits })

    } catch (err) {
      console.error('Subscriptions fetch error:', err)
      setError(isAr ? 'فشل تحميل بيانات الاشتراكات' : 'Failed to load subscriptions.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!profile?.id) return
    const ch = supabaseAdmin
      .channel(`admin-subscriptions-${profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'subscriptions' }, () => { invalidateCache(cacheKey); fetchData() })
      .subscribe()
    return () => supabaseAdmin.removeChannel(ch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, fetchData])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  // ── DERIVED ────────────────────────────────────────────────────
  const now        = new Date()
  const activeSubs = subscriptions.filter(s => s.status === 'active')
  const trialSubs  = subscriptions.filter(s => s.status === 'trial' && new Date(s.expires_at) > now)

  const mrr = activeSubs.reduce((sum, s) => sum + (planLimits[s.plan]?.price || 0), 0)
  const arr = mrr * 12

  const trialsExpiringWeek = trialSubs.filter(s => {
    const d = daysLeft(s.expires_at)
    return d !== null && d >= 0 && d <= 7
  }).length

  const starterCount   = activeSubs.filter(s => s.plan === 'starter').length
  const growthCount    = activeSubs.filter(s => s.plan === 'growth').length
  const proCount       = activeSubs.filter(s => s.plan === 'pro').length
  const starterRevenue = starterCount * (planLimits.starter?.price || 199)
  const growthRevenue  = growthCount  * (planLimits.growth?.price  || 499)
  const proRevenue     = proCount     * (planLimits.pro?.price     || 999)
  const totalMrr       = starterRevenue + growthRevenue + proRevenue

  const filteredSubs = subscriptions.filter(s => {
    if (tab === 'all')     return true
    if (tab === 'active')  return s.status === 'active'
    if (tab === 'trials')  return s.status === 'trial' && new Date(s.expires_at) > now
    if (tab === 'expired') return s.status === 'expired' || (s.status === 'trial' && new Date(s.expires_at) <= now)
    if (tab === 'blocked') return s.status === 'blocked'
    return true
  })

  // ── ACTIONS ────────────────────────────────────────────────────
  function openActivate(sub) {
    setActModal(sub)
    setActPlan('starter')
    setActAmount(planLimits.starter?.price ?? 0)
    setActErr('')
  }

  function handlePlanChange(plan) {
    setActPlan(plan)
    setActAmount(planLimits[plan]?.price ?? 0)
  }

  async function handleActivate(e) {
    e.preventDefault()
    setActErr('')
    setActSaving(true)
    try {
      const expiresAt = calculateExpiry(1)
      const { error: subErr } = await supabaseAdmin
        .from('subscriptions')
        .update({
          plan:           actPlan,
          status:         'active',
          branches_limit: planLimits[actPlan].branches,
          managers_limit: planLimits[actPlan].managers,
          expires_at:     expiresAt,
        })
        .eq('owner_id', actModal.owner_id)
      if (subErr) throw subErr

      const { error: billErr } = await supabaseAdmin
        .from('billing_history')
        .insert({
          owner_id: actModal.owner_id,
          plan:     actPlan,
          amount:   Number(actAmount),
          currency: 'SAR',
          status:   'paid',
          paid_at:  new Date().toISOString(),
        })
      if (billErr) throw billErr

      await logAction('subscription_activated', `Activated ${actPlan} plan for ${actModal.owner?.name}`, actModal.owner_id, 'subscription', { plan: actPlan, amount: Number(actAmount) })
      setActModal(null)
      invalidateCache(cacheKey)
      await fetchData()

    } catch (err) {
      console.error('Activate error:', err)
      setActErr(isAr ? 'حدث خطأ أثناء الحفظ' : 'Something went wrong.')
    } finally {
      setActSaving(false)
    }
  }

  async function handleExtend(sub) {
    setBusyId(sub.id)
    try {
      const base      = sub.expires_at ? new Date(sub.expires_at) : new Date()
      const newExpiry = new Date(Math.max(base.getTime(), Date.now()) + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error: err } = await supabaseAdmin
        .from('subscriptions')
        .update({ expires_at: newExpiry, trial_ends_at: newExpiry })
        .eq('id', sub.id)
      if (err) throw err
      await logAction('trial_extended', `Extended trial by 7 days for ${sub.owner?.name}`, sub.owner_id, 'subscription')
      invalidateCache(cacheKey)
      await fetchData()
    } catch (err) {
      console.error('Extend error:', err)
      setError(isAr ? 'فشل التمديد' : 'Failed to extend trial.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleBlock(sub) {
    setBusyId(sub.id)
    try {
      await Promise.all([
        supabaseAdmin.from('subscriptions').update({ status: 'blocked' }).eq('id', sub.id),
        supabaseAdmin.from('users').update({ is_active: false }).eq('id', sub.owner_id),
      ])
      await logAction('owner_blocked', `Blocked ${sub.owner?.name}`, sub.owner_id, 'subscription')
      invalidateCache(cacheKey)
      await fetchData()
    } catch (err) {
      console.error('Block error:', err)
      setError(isAr ? 'فشل الحظر' : 'Failed to block.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnblock(sub) {
    setBusyId(sub.id)
    try {
      await Promise.all([
        supabaseAdmin.from('subscriptions').update({ status: 'active' }).eq('id', sub.id),
        supabaseAdmin.from('users').update({ is_active: true }).eq('id', sub.owner_id),
      ])
      await logAction('owner_unblocked', `Unblocked ${sub.owner?.name}`, sub.owner_id, 'subscription')
      invalidateCache(cacheKey)
      await fetchData()
    } catch (err) {
      console.error('Unblock error:', err)
      setError(isAr ? 'فشل إلغاء الحظر' : 'Failed to unblock.')
    } finally {
      setBusyId(null)
    }
  }

  // ── LOADING ────────────────────────────────────────────────────
  if (loading) return (
    <div dir={isAr?'rtl':'ltr'} style={{ display:'flex', height:'100vh', background:'#F0FDF4', fontFamily:"'Inter',sans-serif" }}>
      <div style={{ width:200, background:'#fff', borderRight:'0.5px solid #E5E7EB', flexShrink:0 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ height:56, background:'#fff', borderBottom:'0.5px solid #E5E7EB', flexShrink:0 }} />
        <div style={{ flex:1, padding:'20px 24px', overflowY:'auto' }}>
          <div className="skeleton" style={{ height:400 }} />
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} .skeleton{background:#E5E7EB;border-radius:12px;animation:pulse 1.5s ease-in-out infinite}`}</style>
    </div>
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ display:'flex', height:'100vh', minHeight:700, overflow:'hidden', background:'#F0FDF4', fontFamily: isAr ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif" }}>

      <AdminSidebar currentPath="/admin/subscriptions" profile={profile} isAr={isAr} handleSignOut={handleSignOut} />

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ background:'#fff', borderBottom:'0.5px solid #E5E7EB', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{isAr ? 'الاشتراكات' : 'Subscriptions'}</span>
          <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
            {isAr ? 'EN' : 'ع'}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {error && (
            <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#9F1239', fontSize:13 }}>{error}</div>
          )}

          {/* ── 3 STAT CARDS ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>

            {/* MRR — dark green */}
            <div style={{ background:'#1B4332', borderRadius:16, padding:20 }}>
              <div style={{ fontSize:11, color:'#BBF7D0', fontWeight:600, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {isAr ? 'الإيراد الشهري' : 'MRR'}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:'#fff' }}>{mrr.toLocaleString()} SAR</div>
              <div style={{ fontSize:12, color:'#BBF7D0', marginTop:6 }}>
                {isAr ? `ARR: ${arr.toLocaleString()} ريال` : `ARR: ${arr.toLocaleString()} SAR`}
              </div>
            </div>

            {/* Active paying — green */}
            <div style={{ background:'#F0FDF4', border:'0.5px solid #BBF7D0', borderRadius:16, padding:20 }}>
              <div style={{ fontSize:11, color:'#166534', fontWeight:600, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {isAr ? 'نشط' : 'Active'}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:'#166534' }}>{activeSubs.length}</div>
              <div style={{ fontSize:12, color:'#4ADE80', marginTop:6 }}>
                {isAr ? 'عملاء يدفعون' : 'paying customers'}
              </div>
            </div>

            {/* Trials — amber */}
            <div style={{ background:'#FFFBEB', border:'0.5px solid #FDE68A', borderRadius:16, padding:20 }}>
              <div style={{ fontSize:11, color:'#D97706', fontWeight:600, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {isAr ? 'تجارب' : 'Trials'}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:'#D97706' }}>{trialSubs.length}</div>
              <div style={{ fontSize:12, color:'#B45309', marginTop:6 }}>
                {trialsExpiringWeek} {isAr ? 'تنتهي هذا الأسبوع' : 'expiring this week'}
              </div>
            </div>
          </div>

          {/* ── REVENUE BY PLAN CHART ── */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:16, padding:20, marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:4 }}>
              {isAr ? 'الإيراد حسب الخطة' : 'Revenue by Plan'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, margin:'16px 0' }}>

              {/* Starter */}
              <div style={{ background:'#EFF6FF', borderRadius:12, padding:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#3B82F6', flexShrink:0 }} />
                  <div style={{ fontSize:13, fontWeight:500, color:'#1D4ED8' }}>Starter</div>
                </div>
                <div style={{ fontSize:28, fontWeight:500, color:'#1D4ED8', marginBottom:4 }}>
                  {starterRevenue.toLocaleString()} SAR
                </div>
                <div style={{ fontSize:11, color:'#3B82F6' }}>
                  {starterCount} × {(planLimits.starter?.price || 199).toLocaleString()} SAR/mo
                </div>
                <div style={{ marginTop:10, height:4, background:'rgba(59,130,246,0.2)', borderRadius:20, overflow:'hidden' }}>
                  <div style={{ height:'100%', width: totalMrr > 0 ? `${Math.round(starterRevenue / totalMrr * 100)}%` : '0%', background:'#3B82F6', borderRadius:20, transition:'width 0.4s ease' }} />
                </div>
              </div>

              {/* Growth */}
              <div style={{ background:'#F0FDF4', borderRadius:12, padding:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#1B4332', flexShrink:0 }} />
                  <div style={{ fontSize:13, fontWeight:500, color:'#166534' }}>Growth</div>
                </div>
                <div style={{ fontSize:28, fontWeight:500, color:'#1B4332', marginBottom:4 }}>
                  {growthRevenue.toLocaleString()} SAR
                </div>
                <div style={{ fontSize:11, color:'#166534' }}>
                  {growthCount} × {(planLimits.growth?.price || 499).toLocaleString()} SAR/mo
                </div>
                <div style={{ marginTop:10, height:4, background:'rgba(27,67,50,0.15)', borderRadius:20, overflow:'hidden' }}>
                  <div style={{ height:'100%', width: totalMrr > 0 ? `${Math.round(growthRevenue / totalMrr * 100)}%` : '0%', background:'#1B4332', borderRadius:20, transition:'width 0.4s ease' }} />
                </div>
              </div>

              {/* Pro */}
              <div style={{ background:'#F5F3FF', borderRadius:12, padding:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#7C3AED', flexShrink:0 }} />
                  <div style={{ fontSize:13, fontWeight:500, color:'#6D28D9' }}>Pro</div>
                </div>
                <div style={{ fontSize:28, fontWeight:500, color:'#7C3AED', marginBottom:4 }}>
                  {proRevenue.toLocaleString()} SAR
                </div>
                <div style={{ fontSize:11, color:'#7C3AED' }}>
                  {proCount} × {(planLimits.pro?.price || 999).toLocaleString()} SAR/mo
                </div>
                <div style={{ marginTop:10, height:4, background:'rgba(124,58,237,0.15)', borderRadius:20, overflow:'hidden' }}>
                  <div style={{ height:'100%', width: totalMrr > 0 ? `${Math.round(proRevenue / totalMrr * 100)}%` : '0%', background:'#7C3AED', borderRadius:20, transition:'width 0.4s ease' }} />
                </div>
              </div>

            </div>
          </div>

          {/* ── TABS ── */}
          <div style={{ display:'flex', gap:0, borderBottom:'0.5px solid #E5E7EB', marginBottom:16 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                fontSize:13, padding:'10px 18px', cursor:'pointer', fontFamily:'inherit',
                border:'none', background:'none',
                color:        tab === t.key ? '#1B4332' : '#6B7280',
                fontWeight:   tab === t.key ? 500       : 400,
                borderBottom: tab === t.key ? '2px solid #1B4332' : '2px solid transparent',
                marginBottom: '-0.5px',
              }}>
                {isAr ? t.ar : t.en}
              </button>
            ))}
          </div>

          {/* ── SUBSCRIPTION TABLE ── */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:16, overflow:'hidden' }}>
            {filteredSubs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 0', color:'#9CA3AF' }}>
                <i className="ti ti-credit-card" style={{ fontSize:40, marginBottom:12, display:'block' }} />
                <div style={{ fontSize:14 }}>{isAr ? 'لا توجد اشتراكات' : 'No subscriptions found'}</div>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#F9FAFB', borderBottom:'0.5px solid #E5E7EB' }}>
                      {[
                        isAr?'المطعم':'Restaurant',
                        isAr?'الخطة':'Plan',
                        isAr?'الحالة':'Status',
                        isAr?'تاريخ الانتهاء':'Expires',
                        isAr?'الأيام المتبقية':'Days Left',
                        isAr?'إجراءات':'Actions',
                      ].map(h => (
                        <th key={h} style={{ textAlign: isAr?'right':'left', padding:'10px 14px', color:'#9CA3AF', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map(s => {
                      const planBadge   = PLAN_BADGE[s.plan]
                      const statusBadge = STATUS_BADGE[s.status]
                      const d           = daysLeft(s.expires_at)
                      const dBadge      = daysBadge(d)
                      const isActive    = s.status === 'active'
                      const isTrial     = s.status === 'trial'
                      const isBlocked   = s.status === 'blocked'
                      const isExpiredStatus = s.status === 'expired' || (s.status === 'trial' && new Date(s.expires_at) <= now)
                      const showWA      = isTrial && d !== null && d >= 0 && d <= 7 && s.owner?.phone
                      const busy        = busyId === s.id

                      return (
                        <tr key={s.id} style={{ borderBottom:'0.5px solid #F3F4F6' }}>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ color:'#111827', fontWeight:600 }}>{s.owner?.name || '—'}</div>
                            <div style={{ color:'#9CA3AF', fontSize:11, marginTop:2 }}>{s.owner?.email || ''}</div>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            {planBadge ? (
                              <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:planBadge.bg, color:planBadge.color, textTransform:'capitalize' }}>
                                {s.plan}
                              </span>
                            ) : (
                              <span style={{ fontSize:12, color:'#6B7280', textTransform:'capitalize' }}>{s.plan || '—'}</span>
                            )}
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            {statusBadge && (
                              <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:statusBadge.bg, color:statusBadge.color }}>
                                {isAr ? statusBadge.ar : statusBadge.en}
                              </span>
                            )}
                          </td>
                          <td style={{ padding:'12px 14px', color:'#6B7280', fontSize:12, whiteSpace:'nowrap' }}>
                            {formatDate(s.expires_at, isAr)}
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            {isActive ? (
                              <span style={{ fontSize:11, fontWeight:600, color:'#166534', background:'#DCFCE7', padding:'3px 10px', borderRadius:20 }}>
                                {isAr ? 'نشط' : 'Active'}
                              </span>
                            ) : d !== null && d >= 0 ? (
                              <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:dBadge.bg, color:dBadge.color }}>
                                {d}{isAr ? ' يوم' : 'd'}
                              </span>
                            ) : (
                              <span style={{ fontSize:11, color:'#9CA3AF' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                              {(isTrial || isExpiredStatus) && (
                                <button onClick={() => openActivate(s)} style={{ fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:8, background:'#1B4332', color:'#fff', border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                                  {isAr ? 'تفعيل' : 'Activate'}
                                </button>
                              )}
                              {isTrial && !isExpiredStatus && (
                                <button onClick={() => handleExtend(s)} disabled={busy} style={{ fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:8, background:'#EFF6FF', color:'#1D4ED8', border:'0.5px solid #BFDBFE', cursor: busy ? 'not-allowed' : 'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                                  {isAr ? '+7 أيام' : '+7 Days'}
                                </button>
                              )}
                              {isActive && (
                                <button onClick={() => handleBlock(s)} disabled={busy} style={{ fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:8, background:'#FFF1F2', color:'#9F1239', border:'0.5px solid #FECDD3', cursor: busy ? 'not-allowed' : 'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                                  {isAr ? 'حظر' : 'Block'}
                                </button>
                              )}
                              {isBlocked && (
                                <button onClick={() => handleUnblock(s)} disabled={busy} style={{ fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:8, background:'#F0FDF4', color:'#166534', border:'0.5px solid #BBF7D0', cursor: busy ? 'not-allowed' : 'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                                  {isAr ? 'إلغاء الحظر' : 'Unblock'}
                                </button>
                              )}
                              {showWA && (
                                <a href={waLink(s.owner.phone, s.owner.name, d)} target="_blank" rel="noreferrer"
                                  style={{ fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:8, background:'#F0FDF4', color:'#166534', border:'0.5px solid #BBF7D0', whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                                  <i className="ti ti-brand-whatsapp" /> WhatsApp
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ACTIVATE MODAL ── */}
      {actModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) setActModal(null) }}>
          <div style={{ background:'#fff', borderRadius:12, padding:24, width:'100%', maxWidth:360 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{isAr ? 'تفعيل الاشتراك' : 'Activate Subscription'}</div>
              <button onClick={() => setActModal(null)} style={{ background:'none', border:'none', fontSize:18, color:'#9CA3AF', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>{actModal.owner?.name}</div>

            {actErr && (
              <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:12, color:'#9F1239' }}>{actErr}</div>
            )}

            <form onSubmit={handleActivate} noValidate>
              <div style={{ marginBottom:12 }}>
                <label style={labelStyle}>{isAr ? 'الخطة' : 'Plan'}</label>
                <select value={actPlan} onChange={e => handlePlanChange(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={labelStyle}>{isAr ? 'المبلغ (ريال)' : 'Amount (SAR)'}</label>
                <input type="number" min="0" value={actAmount} onChange={e => setActAmount(e.target.value)} style={inputStyle} />
              </div>
              <button type="submit" disabled={actSaving} style={{ width:'100%', padding:'10px', borderRadius:10, fontSize:13, fontWeight:600, cursor: actSaving ? 'not-allowed' : 'pointer', background: actSaving ? '#6B9E83' : '#1B4332', color:'#fff', border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {actSaving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                {actSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        a { text-decoration: none; }
      `}</style>
    </div>
  )
}
