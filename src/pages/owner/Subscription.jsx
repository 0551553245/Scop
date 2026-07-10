import { useEffect, useState, useCallback } from 'react'
import { supabaseOwner } from '../../lib/supabase'
import { getCached, setCached } from '../../lib/cache'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useSubscription } from '../../hooks/useSubscription'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import { getPlatformSettings, getPerBranchPricing, DEFAULT_SETTINGS } from '../../lib/platformSettings'
import OwnerLayout from '../../components/OwnerLayout'
import ErrorBanner from '../../components/ErrorBanner'
import { useIsMobile } from '../../hooks/useIsMobile'

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

export default function OwnerSubscription() {
  const { profile }  = useOwnerAuth()
  const { lang, isAr } = useLanguage()
  const { subscription, loading: subLoading, isTrial, isExpired, expiringSoon, daysLeft } = useSubscription()

  // ── EXTRA DATA (usage counts + billing) ────────────────────
  const [branchCount,    setBranchCount]    = useState(0)
  const [managerCount,   setManagerCount]   = useState(0)
  const [billing,        setBilling]        = useState([])
  const [pricing,        setPricing]        = useState(getPerBranchPricing({}))
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_SETTINGS.support_whatsapp)
  const [loadingExtra,   setLoadingExtra]   = useState(true)
  const [error,          setError]          = useState('')

  // ── Upgrade-branches UI ──
  const [showUpgrade,   setShowUpgrade]   = useState(false)
  const [upgradeCount,  setUpgradeCount]  = useState(1)
  const [upgradeNotice, setUpgradeNotice] = useState('')

  const fetchExtra = useCallback(async () => {
    if (!profile) return
    setError('')

    const cacheKey = `owner-subscription-${profile.id}`
    const cached = getCached(cacheKey)
    if (cached) {
      setBranchCount(cached.branchCount)
      setManagerCount(cached.managerCount)
      setBilling(cached.billing)
      setPricing(cached.pricing)
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

      const branchIds     = (branchRes.data || []).map(b => b.id)
      const branchPricing = getPerBranchPricing(settings)
      const waNum         = settings.support_whatsapp || null

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
      setPricing(branchPricing)
      setWhatsappNumber(waNum)
      setCached(cacheKey, {
        branchCount: branchIds.length,
        managerCount: mgrCount,
        billing: billingRes.data || [],
        pricing: branchPricing,
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

  const status   = subscription?.status || 'trial'
  const badge    = STATUS_BADGE[status] || STATUS_BADGE.trial

  // Read straight off the subscription row (monthly_amount is set at
  // signup/upgrade time). Legacy rows created before per-branch pricing
  // have monthly_amount = null, so fall back to a live per-branch calc —
  // this way the display never needs to know about 'starter'/'growth'/'pro'.
  const subBranchesLimit = subscription?.branches_limit ?? 0
  const subManagersLimit = subscription?.managers_limit ?? 0
  const subMonthlyAmount = subscription?.monthly_amount ?? pricing.calculateMonthlyAmount(subBranchesLimit)

  const renewalText = !subscription ? '' : isExpired
    ? (isAr ? `انتهى في ${formatDate(subscription.expires_at, lang)}` : `Expired on ${formatDate(subscription.expires_at, lang)}`)
    : isTrial
      ? (isAr ? `تنتهي التجربة في ${formatDate(subscription.trial_ends_at || subscription.expires_at, lang)} · ${daysLeft} يوم متبقي` : `Trial ends on ${formatDate(subscription.trial_ends_at || subscription.expires_at, lang)} · ${daysLeft} days left`)
      : (isAr ? `يتجدد في ${formatDate(subscription.expires_at, lang)} · ${daysLeft} يوم متبقي` : `Renews on ${formatDate(subscription.expires_at, lang)} · ${daysLeft} days left`)

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

                {/* Left — subscription identity */}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>
                    {isAr ? 'اشتراكك الحالي' : 'Current Subscription'}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                    <span style={{ fontSize:20, fontWeight:700 }}>
                      {isAr
                        ? `${subBranchesLimit} فروع · ${subManagersLimit} مديرين · ${subMonthlyAmount} ريال/شهر`
                        : `${subBranchesLimit} branches · ${subManagersLimit} managers · ${subMonthlyAmount} SAR/month`}
                    </span>
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

            {/* ── UPGRADE BRANCHES ── */}
            <div style={{ background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:18, padding:22, marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: showUpgrade ? 16 : 0, flexWrap:'wrap', gap:10 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>
                  {isAr ? 'ترقية عدد الفروع' : 'Upgrade branches'}
                </div>
                <button
                  onClick={() => { setUpgradeNotice(''); setUpgradeCount(subBranchesLimit || 1); setShowUpgrade(p => !p) }}
                  style={{ padding:'8px 16px', background: showUpgrade ? '#fff' : '#1B4332', color: showUpgrade ? '#6B7280' : '#fff', border: showUpgrade ? '1.5px solid #E5E7EB' : 'none', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
                >
                  {showUpgrade ? (isAr ? 'إغلاق' : 'Close') : (isAr ? 'ترقية الفروع' : 'Upgrade branches')}
                </button>
              </div>

              {showUpgrade && (() => {
                const isUpgradeEnterprise = pricing.isEnterprise(upgradeCount)
                const newMonthly          = pricing.calculateMonthlyAmount(upgradeCount)
                const whatsappLink        = 'https://wa.me/966551553245'
                return (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8, marginBottom:8 }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button key={n} type="button" onClick={() => setUpgradeCount(n)}
                          style={{
                            padding:'10px 0', fontSize:14, fontWeight:600,
                            background: !isUpgradeEnterprise && upgradeCount === n ? '#1B4332' : '#F9FAFB',
                            color:      !isUpgradeEnterprise && upgradeCount === n ? '#fff'    : '#111827',
                            border: !isUpgradeEnterprise && upgradeCount === n ? '1.5px solid #1B4332' : '0.5px solid #E5E7EB',
                            borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                          }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setUpgradeCount(10)}
                      style={{
                        width:'100%', padding:'10px 16px', marginBottom:14,
                        background: isUpgradeEnterprise ? '#1B4332' : '#F9FAFB',
                        color:      isUpgradeEnterprise ? '#fff'    : '#111827',
                        border: isUpgradeEnterprise ? '1.5px solid #1B4332' : '0.5px solid #E5E7EB',
                        borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                      }}>
                      {isAr ? '١٠+ فروع (مؤسسات)' : '10+ branches (Enterprise)'}
                    </button>

                    {!isUpgradeEnterprise ? (
                      <>
                        <div style={{ textAlign:'center', fontSize:13, color:'#374151', marginBottom:14 }}>
                          {isAr
                            ? `${upgradeCount} فروع × ${pricing.pricePerBranch} ر.س = `
                            : `${upgradeCount} branches × ${pricing.pricePerBranch} SAR = `}
                          <strong style={{ color:'#1B4332' }}>{newMonthly} {isAr ? 'ر.س/شهر' : 'SAR/mo'}</strong>
                        </div>
                        <button
                          disabled={upgradeCount === subBranchesLimit}
                          onClick={() => setUpgradeNotice(isAr
                            ? 'تم استلام طلبك — الدفع عبر موياسر قريباً. سنتواصل معك لإتمام الترقية.'
                            : 'Request received — Moyasar payment coming soon. We will contact you to complete the upgrade.')}
                          style={{ width:'100%', padding:'10px', background: upgradeCount === subBranchesLimit ? '#9CA3AF' : '#1B4332', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor: upgradeCount === subBranchesLimit ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}
                        >
                          {isAr ? 'طلب الترقية' : 'Request upgrade'}
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#92400E', marginBottom:10 }}>
                          {isAr ? 'تواصل معنا لأسعار المؤسسات' : 'Contact us for enterprise pricing'}
                        </div>
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 16px', background:'#25D366', color:'#fff', borderRadius:10, fontSize:12, fontWeight:600, textDecoration:'none' }}>
                          {isAr ? 'واتساب: 966551553245+' : 'WhatsApp: +966551553245'}
                        </a>
                      </div>
                    )}

                    {upgradeNotice && (
                      <div style={{ marginTop:12, textAlign:'center', fontSize:12, color:'#166534', background:'#F0FDF4', border:'0.5px solid #BBF7D0', borderRadius:10, padding:'10px 12px' }}>
                        {upgradeNotice}
                      </div>
                    )}
                  </div>
                )
              })()}
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
