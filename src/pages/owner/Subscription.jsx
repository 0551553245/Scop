import { useEffect, useState, useCallback } from 'react'
import { supabaseOwner } from '../../lib/supabase'
import { getCached, setCached } from '../../lib/cache'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useSubscription } from '../../hooks/useSubscription'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import { getPlatformSettings, getPlanLimits, DEFAULT_SETTINGS } from '../../lib/platformSettings'
import OwnerLayout from '../../components/OwnerLayout'
import ErrorBanner from '../../components/ErrorBanner'
import { useIsMobile } from '../../hooks/useIsMobile'

const PLAN_FEATURES = {
  trial:   { branches: 1,  managers: 1,  price: 0,   label: 'Free Trial', labelAr: 'تجربة مجانية' },
  starter: { branches: 1,  managers: 1,  price: 99,  label: 'Starter',    labelAr: 'المبتدئ'      },
  growth:  { branches: 5,  managers: 5,  price: 199, label: 'Growth',     labelAr: 'النمو'         },
  pro:     { branches: 15, managers: 99, price: 399, label: 'Pro',        labelAr: 'الاحترافي'    },
}

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

function billingStatusStyle(status) {
  if (status === 'paid' || status === 'success' || status === 'completed') return { bg:'#F0FDF4', color:'#166534' }
  if (status === 'failed' || status === 'declined')                        return { bg:'#FFF1F2', color:'#9F1239' }
  return { bg:'#FFFBEB', color:'#92400E' }
}

const PLAN_RANK = { trial:0, starter:1, growth:2, pro:3 }

export default function OwnerSubscription() {
  const { profile }  = useOwnerAuth()
  const { lang, isAr } = useLanguage()
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

  const isMobile = useIsMobile()
  const loading   = subLoading || loadingExtra

  if (loading) return (
    <OwnerLayout activePath="/owner/subscription" title="Subscription" titleAr="الاشتراك">
      <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>
        <div className="skeleton" style={{ height:220, marginBottom:16 }} />
        <div className="skeleton" style={{ height:320, marginBottom:16 }} />
        <div className="skeleton" style={{ height:200 }} />
      </div>
    </OwnerLayout>
  )

  const planFeature = subscription ? PLAN_FEATURES[subscription.plan] || PLAN_FEATURES.starter : null
  const livePlan    = subscription ? planLimits[subscription.plan]  || planLimits.starter    : null
  const plan        = planFeature && livePlan ? { ...planFeature, price: livePlan.price, branches: livePlan.branches, managers: livePlan.managers } : planFeature
  const status   = subscription?.status || 'trial'
  const badge    = STATUS_BADGE[status] || STATUS_BADGE.trial

  const renewalText = !subscription ? '' : isExpired
    ? (isAr ? `انتهى في ${formatDate(subscription.expires_at, lang)}` : `Expired on ${formatDate(subscription.expires_at, lang)}`)
    : isTrial
      ? (isAr ? `تنتهي التجربة في ${formatDate(subscription.trial_ends_at || subscription.expires_at, lang)} · ${daysLeft} يوم متبقي` : `Trial ends on ${formatDate(subscription.trial_ends_at || subscription.expires_at, lang)} · ${daysLeft} days left`)
      : (isAr ? `يتجدد في ${formatDate(subscription.expires_at, lang)} · ${daysLeft} يوم متبقي` : `Renews on ${formatDate(subscription.expires_at, lang)} · ${daysLeft} days left`)

  const curRank = PLAN_RANK[subscription?.plan ?? 'trial'] ?? 0

  return (
    <OwnerLayout activePath="/owner/subscription" title="Subscription" titleAr="الاشتراك">
      <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>

        <SubscriptionBanner
          subscription={subscription}
          daysLeft={daysLeft}
          isTrial={isTrial}
          isExpired={isExpired}
          expiringSoon={expiringSoon}
          isAr={isAr}
          supportWhatsapp={whatsappNumber}
        />

        <ErrorBanner message={error} isAr={isAr} onRetry={fetchExtra} />

        {!subscription ? (
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:40, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>💳</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:6 }}>{isAr?'لا توجد بيانات اشتراك':'No subscription found'}</div>
            <div style={{ fontSize:13, color:'#6B7280' }}>{isAr?'تواصل معنا لتفعيل اشتراكك':'Contact us to activate your subscription'}</div>
          </div>
        ) : (
          <>
            {/* ── HERO CARD ── */}
            <div style={{ background:'#1B4332', borderRadius:20, padding: isMobile ? 20 : 28, color:'#fff', marginBottom:20 }}>
              <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent:'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap:20 }}>

                {/* Left — plan identity */}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>
                    {isAr ? 'خطتك الحالية' : 'Current Plan'}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                    <span style={{ fontSize:22, fontWeight:700 }}>{isAr ? plan?.labelAr : plan?.label}</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:badge.bg, color:badge.color }}>
                      {isAr ? badge.ar : badge.en}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', lineHeight:1.6 }}>{renewalText}</div>
                </div>

                {/* Right — 3 stat boxes */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, flexShrink:0 }}>
                  {[
                    { num: branchCount,          limit: subscription.branches_limit, labelEn:'Branches',  labelAr:'الفروع'      },
                    { num: managerCount,          limit: subscription.managers_limit, labelEn:'Managers',  labelAr:'المديرون'    },
                    { num: Math.max(0, daysLeft), limit: null,                        labelEn:'Days Left', labelAr:'أيام متبقية' },
                  ].map(({ num, limit, labelEn, labelAr: lAr }) => (
                    <div key={labelEn} style={{ background:'rgba(255,255,255,0.08)', borderRadius:14, padding:'14px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:800, color:'#4ADE80', lineHeight:1 }}>{num}</div>
                      {limit !== null && <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginTop:2 }}>/ {limit}</div>}
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:4 }}>{isAr ? lAr : labelEn}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── SECTION LABEL ── */}
            <div style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>
              {isAr ? 'اختر خطة' : 'Choose a plan'}
            </div>

            {/* ── PLAN CARDS ── */}
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap:14, marginBottom:20 }}>
              {[
                {
                  key: 'starter',
                  icon: (
                    <div style={{ width:40, height:40, background:'#F0FDF4', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#1B4332" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 22V12h6v10" stroke="#1B4332" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ),
                },
                {
                  key: 'growth',
                  icon: (
                    <div style={{ width:40, height:40, background:'#EFF6FF', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M18 20V10M12 20V4M6 20v-6" stroke="#378ADD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ),
                },
                {
                  key: 'pro',
                  icon: (
                    <div style={{ width:40, height:40, background:'#F5F3FF', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 15l-3-3a22 22 0 002-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ),
                },
              ].map(({ key, icon }) => {
                const pf       = PLAN_FEATURES[key]
                const pl       = planLimits[key] || {}
                const cardRank = PLAN_RANK[key] ?? 1
                const isCurr   = subscription.plan === key
                const isBelow  = curRank > cardRank
                const cardPrice = pl.price === 0
                  ? (isAr ? 'مجاني' : 'Free')
                  : isAr ? `${pl.price} ريال/شهر` : `${pl.price} SAR/mo`
                const featList = FEATURE_LIST[key] || []
                return (
                  <div key={key} style={{ background:'#fff', border: isCurr ? '2px solid #1B4332' : '1.5px solid #E5E7EB', borderRadius:18, padding:22, position:'relative', display:'flex', flexDirection:'column' }}>
                    {isCurr && (
                      <div style={{ position:'absolute', top:-12, [isAr ? 'right' : 'left']: 18, background:'#1B4332', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 12px', borderRadius:20 }}>
                        {isAr ? 'خطتك' : 'Your plan'}
                      </div>
                    )}
                    {icon}
                    <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:4 }}>{isAr ? pf.labelAr : pf.label}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:'#111827', marginBottom:16 }}>{cardPrice}</div>
                    <div style={{ flex:1, marginBottom:20 }}>
                      {featList.map((f, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#374151', marginBottom:8 }}>
                          <span style={{ color:'#1B4332', fontWeight:700, fontSize:13 }}>✓</span>
                          {isAr ? f.ar : f.en}
                        </div>
                      ))}
                    </div>
                    {isCurr ? (
                      <button disabled style={{ width:'100%', padding:'10px', background:'#F0FDF4', color:'#166534', border:'1.5px solid #BBF7D0', borderRadius:10, fontSize:13, fontWeight:600, cursor:'default', fontFamily:'inherit' }}>
                        {isAr ? 'خطتك الحالية' : 'Your plan'}
                      </button>
                    ) : isBelow ? (
                      <button onClick={() => alert(isAr ? 'التخفيض للخطة الأدنى قريباً' : 'Downgrade coming soon')} style={{ width:'100%', padding:'10px', background:'#fff', color:'#6B7280', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                        {isAr ? `الرجوع إلى ${pf.labelAr}` : `Downgrade to ${pf.label}`}
                      </button>
                    ) : (
                      <button onClick={() => alert(isAr ? 'الدفع عبر موياسر قريباً' : 'Moyasar payment coming soon')} style={{ width:'100%', padding:'10px', background:'#1B4332', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                        {isAr ? `الترقية إلى ${pf.labelAr} ←` : `Upgrade to ${pf.label} →`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── BOTTOM GRID ── */}
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:14 }}>

              {/* Billing History */}
              <div style={{ background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:18, padding:22 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:16 }}>
                  {isAr ? 'سجل الفواتير' : 'Billing History'}
                </div>
                {billing.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'24px 0', color:'#9CA3AF', fontSize:13 }}>
                    {isAr ? 'لا يوجد سجل فواتير بعد' : 'No billing history yet'}
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {billing.map(row => {
                      const bs = billingStatusStyle(row.status)
                      const statusLabel = (row.status === 'paid' || row.status === 'success' || row.status === 'completed')
                        ? (isAr ? 'مدفوع' : 'Paid')
                        : (row.status === 'failed' || row.status === 'declined')
                          ? (isAr ? 'فشل' : 'Failed')
                          : (isAr ? 'معلق' : 'Pending')
                      return (
                        <div key={row.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'#F9FAFB', borderRadius:12 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:'#111827', textTransform:'capitalize' }}>
                              {row.plan || (isAr ? 'اشتراك' : 'Subscription')}
                            </div>
                            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{formatDate(row.paid_at, lang)}</div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{row.amount} {row.currency}</span>
                            <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, background:bs.bg, color:bs.color }}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div style={{ background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:18, padding:22 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:16 }}>
                  {isAr ? 'طريقة الدفع' : 'Payment Method'}
                </div>
                <div style={{ background:'#F9FAFB', border:'1.5px solid #E5E7EB', borderRadius:12, padding:'20px 16px', marginBottom:16, textAlign:'center' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>💳</div>
                  <div style={{ fontSize:13, color:'#6B7280' }}>
                    {isAr ? 'لم تُضَف طريقة دفع بعد' : 'No payment method added yet'}
                  </div>
                </div>
                <button
                  onClick={() => alert(isAr ? 'الدفع عبر موياسر قريباً' : 'Moyasar payment coming soon')}
                  style={{ width:'100%', padding:'11px', background:'#1B4332', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
                >
                  {isAr ? 'إضافة بطاقة عبر موياسر' : 'Add card via Moyasar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </OwnerLayout>
  )
}
