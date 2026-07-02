import { useEffect, useState, useCallback } from 'react'
import { supabaseOwner } from '../../lib/supabase'
import { getCached, setCached } from '../../lib/cache'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useSubscription } from '../../hooks/useSubscription'
import { calcRate } from '../../lib/stats'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import { getPlatformSettings, getPlanLimits, DEFAULT_SETTINGS } from '../../lib/platformSettings'
import OwnerLayout from '../../components/OwnerLayout'

const PLAN_FEATURES = {
  trial:   { branches: 1,  managers: 1,  price: 0,   label: 'Free Trial', labelAr: 'تجربة مجانية' },
  starter: { branches: 1,  managers: 1,  price: 199, label: 'Starter',    labelAr: 'المبتدئ'      },
  growth:  { branches: 5,  managers: 5,  price: 499, label: 'Growth',     labelAr: 'النمو'         },
  pro:     { branches: 15, managers: 99, price: 999, label: 'Pro',        labelAr: 'الاحترافي'    },
}

const NEXT_PLAN = { trial: 'starter', starter: 'growth', growth: 'pro', pro: null }

const FEATURE_LIST = {
  trial: [
    { en: '1 branch',                ar: 'فرع واحد' },
    { en: '1 manager',                ar: 'مدير واحد' },
    { en: 'Daily tasks',              ar: 'المهام اليومية' },
    { en: 'Food safety tracking',     ar: 'تتبع سلامة الغذاء' },
    { en: 'Basic reports',            ar: 'تقارير أساسية' },
  ],
  starter: [
    { en: '1 branch',                ar: 'فرع واحد' },
    { en: '1 manager',                ar: 'مدير واحد' },
    { en: 'Daily tasks',              ar: 'المهام اليومية' },
    { en: 'Food safety tracking',     ar: 'تتبع سلامة الغذاء' },
    { en: 'Basic reports',            ar: 'تقارير أساسية' },
  ],
  growth: [
    { en: '5 branches',               ar: '5 فروع' },
    { en: '5 managers',                ar: '5 مديرين' },
    { en: 'Daily tasks',              ar: 'المهام اليومية' },
    { en: 'Food safety tracking',     ar: 'تتبع سلامة الغذاء' },
    { en: 'Advanced reports',         ar: 'تقارير متقدمة' },
    { en: 'Real-time dashboard',      ar: 'لوحة تحكم لحظية' },
  ],
  pro: [
    { en: '15 branches',              ar: '15 فرعاً' },
    { en: 'Unlimited managers',       ar: 'مديرون غير محدودين' },
    { en: 'Daily tasks',              ar: 'المهام اليومية' },
    { en: 'Food safety tracking',     ar: 'تتبع سلامة الغذاء' },
    { en: 'Advanced reports',         ar: 'تقارير متقدمة' },
    { en: 'Real-time dashboard',      ar: 'لوحة تحكم لحظية' },
    { en: 'WhatsApp support',         ar: 'دعم واتساب' },
    { en: 'Dedicated account manager', ar: 'مدير حساب مخصص' },
  ],
}

const STATUS_BADGE = {
  active:  { bg:'#F0FDF4', color:'#166534', en:'● Active',  ar:'● نشط'  },
  trial:   { bg:'#EFF6FF', color:'#1D4ED8', en:'● Trial',   ar:'● تجربة' },
  expired: { bg:'#FFF1F2', color:'#9F1239', en:'● Expired', ar:'● منتهي' },
  blocked: { bg:'#FFF1F2', color:'#9F1239', en:'● Blocked', ar:'● محظور' },
}

function formatDate(dateStr, lang) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year:'numeric', month:'short', day:'numeric' })
}

function usageColor(pct) {
  if (pct >= 90) return '#F43F5E'
  if (pct >= 70) return '#F59E0B'
  return '#1B4332'
}

function billingStatusStyle(status) {
  if (status === 'paid' || status === 'success' || status === 'completed') return { bg:'#F0FDF4', color:'#166534' }
  if (status === 'failed' || status === 'declined')                        return { bg:'#FFF1F2', color:'#9F1239' }
  return { bg:'#FFFBEB', color:'#92400E' }
}

export default function OwnerSubscription() {
  const { profile }  = useOwnerAuth()
  const { lang, isAr, toggleLang } = useLanguage()
  const { subscription, loading: subLoading, isTrial, isExpired, expiringSoon, daysLeft } = useSubscription()

  // ── EXTRA DATA (usage counts + billing) ────────────────────
  const [branchCount,    setBranchCount]    = useState(0)
  const [managerCount,   setManagerCount]   = useState(0)
  const [billing,        setBilling]        = useState([])
  const [planLimits,     setPlanLimits]     = useState(getPlanLimits({}))
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_SETTINGS.support_whatsapp)
  const [loadingExtra,   setLoadingExtra]   = useState(true)
  const [error,          setError]          = useState('')

  const fetchExtra = useCallback(async () => {
    if (!profile) return
    setError('')

    const cacheKey = `owner-subscription-${profile.id}`
    const cached = getCached(cacheKey)
    if (cached) {
      setBranchCount(cached.branchCount)
      setManagerCount(cached.managerCount)
      setBilling(cached.billing)
      setPlanLimits(cached.planLimits)
      setWhatsappNumber(cached.whatsappNumber)
      setLoadingExtra(false)
    }

    try {
      // Round 1: settings + branches + billing all in parallel
      const [settings, branchRes, billingRes] = await Promise.all([
        getPlatformSettings(supabaseOwner),
        supabaseOwner.from('branches').select('id').eq('owner_id', profile.id).eq('is_active', true),
        supabaseOwner.from('billing_history').select('*').eq('owner_id', profile.id).order('paid_at', { ascending: false }).limit(10),
      ])
      if (branchRes.error)  throw branchRes.error
      if (billingRes.error) throw billingRes.error

      const branchIds = (branchRes.data || []).map(b => b.id)
      const limits    = getPlanLimits(settings)
      const waNum     = settings.support_whatsapp || null

      // Round 2: manager count (needs branchIds from round 1)
      let mgrCount = 0
      if (branchIds.length > 0) {
        const managerRes = await supabaseOwner
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'branch_manager')
          .in('branch_id', branchIds)
        mgrCount = managerRes.count || 0
      }

      setBranchCount(branchIds.length)
      setManagerCount(mgrCount)
      setBilling(billingRes.data || [])
      setPlanLimits(limits)
      setWhatsappNumber(waNum)
      setCached(cacheKey, {
        branchCount: branchIds.length,
        managerCount: mgrCount,
        billing: billingRes.data || [],
        planLimits: limits,
        whatsappNumber: waNum,
      }, 120000)
    } catch (err) {
      console.error('Subscription fetch error:', err)
      if (!cached) setError(isAr ? 'فشل تحميل بيانات الاشتراك' : 'Failed to load subscription data.')
    } finally {
      if (!cached) setLoadingExtra(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchExtra() }, [fetchExtra])

  const loading   = subLoading || loadingExtra

  if (loading) return (
    <OwnerLayout activePath="/owner/subscription" title="Subscription" titleAr="الاشتراك">
      <div style={{ padding:'20px 24px' }}>
        <div className="skeleton" style={{ height:220, marginBottom:16 }} />
        <div className="skeleton" style={{ height:180, marginBottom:16 }} />
        <div className="skeleton" style={{ height:180 }} />
      </div>
    </OwnerLayout>
  )

  const planFeature = subscription ? PLAN_FEATURES[subscription.plan] || PLAN_FEATURES.starter : null
  const livePlan    = subscription ? planLimits[subscription.plan]  || planLimits.starter    : null
  const plan        = planFeature && livePlan ? { ...planFeature, price: livePlan.price, branches: livePlan.branches, managers: livePlan.managers } : planFeature
  const status   = subscription?.status || 'trial'
  const badge    = STATUS_BADGE[status] || STATUS_BADGE.trial
  const features = subscription ? FEATURE_LIST[subscription.plan] || FEATURE_LIST.starter : []
  const nextPlanKey = subscription ? NEXT_PLAN[subscription.plan] : null
  const nextPlanFeature = nextPlanKey ? PLAN_FEATURES[nextPlanKey] : null
  const nextPlanLive    = nextPlanKey ? planLimits[nextPlanKey] : null
  const nextPlan        = nextPlanFeature && nextPlanLive ? { ...nextPlanFeature, price: nextPlanLive.price, branches: nextPlanLive.branches, managers: nextPlanLive.managers } : nextPlanFeature

  const branchPct  = subscription ? calcRate(branchCount, subscription.branches_limit) : 0
  const managerPct = subscription ? calcRate(managerCount, subscription.managers_limit) : 0

  const priceLabel = !plan ? '—' : plan.price === 0
    ? (isAr ? 'مجاني' : 'Free')
    : isAr ? `${plan.price} ريال/شهر` : `${plan.price} SAR/mo`

  const renewalText = !subscription ? '' : isExpired
    ? (isAr ? `انتهى في ${formatDate(subscription.expires_at, lang)}` : `Expired on ${formatDate(subscription.expires_at, lang)}`)
    : isTrial
      ? (isAr ? `تنتهي التجربة في ${formatDate(subscription.trial_ends_at || subscription.expires_at, lang)} · ${daysLeft} يوم متبقي` : `Trial ends on ${formatDate(subscription.trial_ends_at || subscription.expires_at, lang)} · ${daysLeft} days left`)
      : (isAr ? `يتجدد في ${formatDate(subscription.expires_at, lang)} · ${daysLeft} يوم متبقي` : `Renews on ${formatDate(subscription.expires_at, lang)} · ${daysLeft} days left`)

  return (
    <OwnerLayout activePath="/owner/subscription" title="Subscription" titleAr="الاشتراك">

      {/* Content */}
      <div style={{ padding:'20px 24px' }}>

          <SubscriptionBanner
            subscription={subscription}
            daysLeft={daysLeft}
            isTrial={isTrial}
            isExpired={isExpired}
            expiringSoon={expiringSoon}
            isAr={isAr}
            supportWhatsapp={whatsappNumber}
          />

          {error && (
            <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#9F1239', fontSize:13, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <span>{error}</span>
              <button onClick={fetchExtra} style={{ background:'none', border:'1px solid #FECDD3', borderRadius:8, padding:'4px 12px', color:'#9F1239', fontSize:12, fontWeight:500, cursor:'pointer', flexShrink:0, fontFamily:'inherit' }}>
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}

          {!subscription ? (
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:40, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>💳</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:6 }}>{isAr?'لا توجد بيانات اشتراك':'No subscription found'}</div>
              <div style={{ fontSize:13, color:'#6B7280' }}>{isAr?'تواصل معنا لتفعيل اشتراكك':'Contact us to activate your subscription'}</div>
            </div>
          ) : (
            <>
              {/* ── PLAN HERO CARD ── */}
              <div style={{ background:'#1B4332', borderRadius:20, padding:24, color:'#fff', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <span style={{ fontSize:18, fontWeight:800 }}>{isAr ? plan.labelAr : plan.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:badge.bg, color:badge.color }}>
                        {isAr ? badge.ar : badge.en}
                      </span>
                    </div>
                    <div style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px' }}>{priceLabel}</div>
                  </div>
                  <div style={{ textAlign: isAr ? 'left' : 'right', fontSize:12, color:'rgba(255,255,255,0.75)' }}>
                    {renewalText}
                  </div>
                </div>

                {/* Usage bars */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:20 }}>
                  <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:14, padding:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                      <span style={{ color:'rgba(255,255,255,0.7)' }}>{isAr?'الفروع':'Branches'}</span>
                      <span style={{ fontWeight:700 }}>{branchCount} / {subscription.branches_limit}</span>
                    </div>
                    <div style={{ height:6, background:'rgba(255,255,255,0.15)', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${branchPct}%`, background:'#4ADE80', borderRadius:20, transition:'width 0.5s ease' }} />
                    </div>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:14, padding:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                      <span style={{ color:'rgba(255,255,255,0.7)' }}>{isAr?'المديرون':'Managers'}</span>
                      <span style={{ fontWeight:700 }}>{managerCount} / {subscription.managers_limit}</span>
                    </div>
                    <div style={{ height:6, background:'rgba(255,255,255,0.15)', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${managerPct}%`, background: usageColor(managerPct), borderRadius:20, transition:'width 0.5s ease' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── WHAT'S INCLUDED ── */}
              <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:22, marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>{isAr?"ما يشمله اشتراكك":"What's included"}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {features.map((f, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151' }}>
                      <span style={{ color:'#1B4332', fontWeight:700 }}>✓</span>
                      {isAr ? f.ar : f.en}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── UPGRADE SECTION ── */}
              {nextPlan && (
                <div id="upgrade-section" style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:18, padding:22, marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#166534', marginBottom:4 }}>
                      {isAr ? `الترقية إلى ${nextPlan.labelAr}` : `Upgrade to ${nextPlan.label}`}
                    </div>
                    <div style={{ fontSize:12, color:'#166534', opacity:0.8 }}>
                      {isAr
                        ? `${nextPlan.branches} فروع · ${nextPlan.managers >= 99 ? 'مديرون غير محدودين' : `${nextPlan.managers} مديرين`} · ${nextPlan.price} ريال/شهر`
                        : `${nextPlan.branches} branches · ${nextPlan.managers >= 99 ? 'unlimited managers' : `${nextPlan.managers} managers`} · ${nextPlan.price} SAR/mo`}
                    </div>
                  </div>
                  {whatsappNumber && (
                    <a href={`https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer"
                      style={{ padding:'10px 20px', background:'#1B4332', color:'#fff', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
                      {isAr ? 'تواصل معنا للترقية' : 'Contact us to upgrade'}
                    </a>
                  )}
                </div>
              )}

              {/* ── BILLING HISTORY ── */}
              <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:22 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>{isAr?'سجل الفواتير':'Billing History'}</div>

                {billing.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'24px 0', color:'#9CA3AF', fontSize:13 }}>
                    {isAr ? 'لا يوجد سجل فواتير بعد' : 'No billing history yet'}
                  </div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ borderBottom:'1px solid #F3F4F6' }}>
                          <th style={{ textAlign: isAr?'right':'left', padding:'8px 6px', color:'#9CA3AF', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>{isAr?'التاريخ':'Date'}</th>
                          <th style={{ textAlign: isAr?'right':'left', padding:'8px 6px', color:'#9CA3AF', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>{isAr?'الخطة':'Plan'}</th>
                          <th style={{ textAlign: isAr?'right':'left', padding:'8px 6px', color:'#9CA3AF', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>{isAr?'المبلغ':'Amount'}</th>
                          <th style={{ textAlign: isAr?'right':'left', padding:'8px 6px', color:'#9CA3AF', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>{isAr?'الحالة':'Status'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billing.map(row => {
                          const bs = billingStatusStyle(row.status)
                          return (
                            <tr key={row.id} style={{ borderBottom:'1px solid #F9FAFB' }}>
                              <td style={{ padding:'10px 6px', color:'#374151' }}>{formatDate(row.paid_at, lang)}</td>
                              <td style={{ padding:'10px 6px', color:'#374151', textTransform:'capitalize' }}>{row.plan}</td>
                              <td style={{ padding:'10px 6px', color:'#111827', fontWeight:600 }}>{row.amount} {row.currency}</td>
                              <td style={{ padding:'10px 6px' }}>
                                <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:bs.bg, color:bs.color, textTransform:'capitalize' }}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
    </OwnerLayout>
  )
}
