import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../../lib/supabase'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getCached, setCached, invalidateCache } from '../../lib/cache'
import { calcRate } from '../../lib/stats'
import { getPlanLimits } from '../../lib/platformSettings'
import AdminLayout from '../../components/AdminLayout'
import ErrorBanner from '../../components/ErrorBanner'
import { daysLeft } from '../../lib/adminHelpers'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtSAR(n) {
  return n.toLocaleString('en-US')
}

// ─── svg line chart ─────────────────────────────────────────────────────────

function LineChart({ data, isAr }) {
  const VW = 420, VH = 130
  const pad = { top: 14, right: 14, bottom: 30, left: 46 }
  const cw  = VW - pad.left - pad.right
  const ch  = VH - pad.top  - pad.bottom

  const allZero = data.every(d => d.revenue === 0)
  const maxVal  = Math.max(...data.map(d => d.revenue), 1)

  const pts = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * cw,
    y: allZero ? pad.top + ch : pad.top + ch - (d.revenue / maxVal) * ch,
  }))

  function smoothLinePath(points) {
    if (points.length === 0) return ''
    let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
    for (let i = 1; i < points.length; i++) {
      const cpx = ((points[i - 1].x + points[i].x) / 2).toFixed(1)
      d += ` C${cpx},${points[i-1].y.toFixed(1)} ${cpx},${points[i].y.toFixed(1)} ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`
    }
    return d
  }

  const linePath = smoothLinePath(pts)
  const areaPath = pts.length > 1
    ? `${linePath} L${pts[pts.length-1].x.toFixed(1)},${(pad.top+ch).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.top+ch).toFixed(1)} Z`
    : ''

  const yTicks = allZero
    ? [{ y: pad.top + ch, label: '0' }]
    : [
        { y: pad.top + ch, label: '0' },
        { y: pad.top + ch/2, label: maxVal >= 2000 ? `${Math.round(maxVal/2000)}k` : String(Math.round(maxVal/2)) },
        { y: pad.top,       label: maxVal >= 1000  ? `${Math.round(maxVal/1000)}k`  : String(maxVal) },
      ]

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width:'100%', height:100, display:'block' }}>
      {yTicks.map((t, i) => (
        <line key={i} x1={pad.left} y1={t.y} x2={VW - pad.right} y2={t.y}
          stroke="#F3F4F6" strokeWidth={1} />
      ))}
      {areaPath && <path d={areaPath} fill="rgba(27,67,50,0.08)" />}
      {linePath  && (
        <path d={linePath} fill="none" stroke="#1B4332" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
          r={4} fill="#1B4332" stroke="white" strokeWidth={2} />
      ))}
      {data.map((d, i) => (
        <text key={i} x={pts[i]?.x.toFixed(1)} y={VH - 7}
          textAnchor="middle" fontSize={10} fill="#9CA3AF" fontFamily="Inter,sans-serif">
          {d.label}
        </text>
      ))}
      {yTicks.map((t, i) => (
        <text key={i} x={pad.left - 4} y={t.y + 4}
          textAnchor="end" fontSize={8} fill="#9CA3AF" fontFamily="Inter,sans-serif">
          {t.label}
        </text>
      ))}
      {allZero && (
        <text x={VW / 2} y={VH / 2 + 4} textAnchor="middle"
          fontSize={11} fill="#9CA3AF" fontFamily="Inter,sans-serif">
          {isAr ? 'ستظهر الإيرادات بعد أول دفعة' : 'Revenue will appear after first payment'}
        </text>
      )}
    </svg>
  )
}

// ─── svg donut chart ─────────────────────────────────────────────────────────

function DonutChart({ active, trial, expired, blocked }) {
  const total = active + trial + expired + blocked
  const SEGS  = [
    { value: active,  color: '#1B4332' },
    { value: trial,   color: '#378ADD' },
    { value: expired, color: '#E24B4A' },
    { value: blocked, color: '#F59E0B' },
  ]

  const cx = 55, cy = 55, R = 42, ri = 26
  let angle = -Math.PI / 2

  function buildArc(value) {
    if (!total || !value) return null
    const sweep = (value / total) * 2 * Math.PI
    const start = angle
    angle += sweep
    const large = sweep > Math.PI ? 1 : 0
    const end   = angle - 0.001
    const ox1 = cx + R  * Math.cos(start), oy1 = cy + R  * Math.sin(start)
    const ox2 = cx + R  * Math.cos(end),   oy2 = cy + R  * Math.sin(end)
    const ix1 = cx + ri * Math.cos(start), iy1 = cy + ri * Math.sin(start)
    const ix2 = cx + ri * Math.cos(end),   iy2 = cy + ri * Math.sin(end)
    return `M${ox1.toFixed(2)},${oy1.toFixed(2)} A${R},${R},0,${large},1,${ox2.toFixed(2)},${oy2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${ri},${ri},0,${large},0,${ix1.toFixed(2)},${iy1.toFixed(2)} Z`
  }

  const paths = SEGS.map(s => ({ ...s, d: buildArc(s.value) }))

  return (
    <svg viewBox="0 0 110 110" style={{ width:110, height:110, flexShrink:0 }}>
      {!total
        ? <circle cx={cx} cy={cy} r={R} fill="#E5E7EB" />
        : paths.map((s, i) => s.d && <path key={i} d={s.d} fill={s.color} />)
      }
      <circle cx={cx} cy={cy} r={ri} fill="white" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight="700" fill="#111827">
        {active + trial}
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={7} fill="#9CA3AF">
        active
      </text>
    </svg>
  )
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate             = useNavigate()
  const { profile, signOut } = useAdminAuth()
  const { isAr, toggleLang } = useLanguage()

  const [dashData, setDashData] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const fetchDashboard = useCallback(async () => {
    if (!profile) return
    setError('')

    const cacheKey = `admin-dashboard-v2-${profile.id}`
    const cached   = getCached(cacheKey)
    if (cached) { setDashData(cached); setLoading(false); return }

    try {
      const now           = new Date()
      const today         = now.toISOString().split('T')[0]
      const monthStart    = new Date(now.getFullYear(), now.getMonth(),     1).toISOString().split('T')[0]
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      const sevenDaysAgo   = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]

      const [
        ownersRes,
        subsRes,
        branchesRes,
        managersRes,
        billingRes,
        activityRes,
        newThisMonthRes,
        settingsRes,
      ] = await Promise.all([
        supabaseAdmin.from('users').select('id, name, phone, created_at, is_active').eq('role', 'owner').limit(500),
        supabaseAdmin.from('subscriptions').select('id, owner_id, plan, status, expires_at, trial_ends_at, branches_limit, started_at').limit(500),
        supabaseAdmin.from('branches').select('id, owner_id, is_active').eq('is_active', true).limit(500),
        supabaseAdmin.from('users').select('id, branch_id, is_active').eq('role', 'branch_manager').eq('is_active', true).limit(500),
        supabaseAdmin.from('billing_history').select('amount, plan, paid_at, status').eq('status', 'paid').gte('paid_at', lastMonthStart).order('paid_at', { ascending: true }),
        supabaseAdmin.from('activity_log').select('actor_id').gte('created_at', sevenDaysAgo + 'T00:00:00.000Z').lte('created_at', today + 'T23:59:59.999Z'),
        supabaseAdmin.from('users').select('id, name, created_at').eq('role', 'owner').gte('created_at', monthStart).order('created_at', { ascending: false }),
        supabaseAdmin.from('platform_settings').select('key, value'),
      ])

      if (ownersRes.error)       throw ownersRes.error
      if (subsRes.error)         throw subsRes.error
      if (branchesRes.error)     throw branchesRes.error
      if (managersRes.error)     throw managersRes.error
      if (billingRes.error)      throw billingRes.error
      if (newThisMonthRes.error) throw newThisMonthRes.error
      if (settingsRes.error)     throw settingsRes.error

      const settings   = Object.fromEntries((settingsRes.data || []).map(s => [s.key, s.value]))
      const planLimits = getPlanLimits(settings)

      const owners   = ownersRes.data   || []
      const subs     = subsRes.data     || []
      const branches = branchesRes.data || []
      const managers = managersRes.data || []
      const billing  = billingRes.data  || []

      // ── subscription buckets (trial only if expires_at > now) ──
      const nowMs       = Date.now()
      const activeSubs  = subs.filter(s => s.status === 'active')
      const trialSubs   = subs.filter(s => s.status === 'trial' && new Date(s.expires_at) > nowMs)
      const expiredSubs = subs.filter(s => s.status === 'expired' || (s.status === 'trial' && new Date(s.expires_at) <= nowMs))
      const blockedSubs = subs.filter(s => s.status === 'blocked')

      // ── MRR + ARR ──
      const mrr = activeSubs.reduce((sum, s) => sum + (planLimits[s.plan]?.price || 0), 0)
      const arr = mrr * 12

      // ── MRR % change from billing history ──
      const currentMonthStr  = monthStart.slice(0, 7)
      const lastMonthStr     = lastMonthStart.slice(0, 7)
      const thisMonthRevenue = billing.filter(b => b.paid_at?.startsWith(currentMonthStr)).reduce((s, b) => s + (Number(b.amount) || 0), 0)
      const lastMonthRevenue = billing.filter(b => b.paid_at?.startsWith(lastMonthStr)).reduce((s, b) => s + (Number(b.amount) || 0), 0)
      const mrrChangePct = lastMonthRevenue > 0
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : (thisMonthRevenue > 0 ? 100 : 0)

      // ── trials expiring ≤ 7 days ──
      const trialsExpiringSoon = trialSubs.filter(s => {
        const d = daysLeft(s.expires_at)
        return d !== null && d >= 0 && d <= 7
      })

      // ── daily active / at risk ──
      const recentActiveOwnerIds = new Set((activityRes.data || []).map(a => a.actor_id).filter(Boolean))
      const dailyActive          = owners.filter(o => recentActiveOwnerIds.has(o.id)).length
      const atRiskOwners         = owners.filter(o => !recentActiveOwnerIds.has(o.id))

      // ── monthly revenue trend (last 6 months) ──
      const monthlyRevenue = []
      for (let i = 5; i >= 0; i--) {
        const d  = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const ms = d.toISOString().slice(0, 7)
        const revenue = billing.filter(b => b.paid_at?.startsWith(ms)).reduce((s, b) => s + (Number(b.amount) || 0), 0)
        monthlyRevenue.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), revenue })
      }

      // ── revenue by plan ──
      const revenueByPlan = {
        starter: { count: activeSubs.filter(s => s.plan === 'starter').length, price: planLimits.starter?.price || 0 },
        growth:  { count: activeSubs.filter(s => s.plan === 'growth').length,  price: planLimits.growth?.price  || 0 },
        pro:     { count: activeSubs.filter(s => s.plan === 'pro').length,     price: planLimits.pro?.price     || 0 },
      }

      const payload = {
        owners, branches, managers,
        totalOwners:         owners.length,
        activeSubs:          activeSubs.length,
        trialSubs:           trialSubs.length,
        expiredSubs:         expiredSubs.length,
        blockedSubs:         blockedSubs.length,
        mrr, arr, mrrChangePct,
        trialsExpiringSoon,
        dailyActive,
        atRiskOwners,
        newThisMonth:        newThisMonthRes.data || [],
        monthlyRevenue,
        revenueByPlan,
      }

      setDashData(payload)
      setCached(cacheKey, payload)

    } catch (err) {
      console.error('Admin dashboard fetch error:', err)
      setError(isAr ? 'فشل تحميل بيانات لوحة التحكم' : 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  useEffect(() => {
    if (!profile) return
    const cacheKey = `admin-dashboard-v2-${profile.id}`
    const ch = supabaseAdmin
      .channel(`admin-dashboard-${profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'subscriptions' }, () => { invalidateCache(cacheKey); fetchDashboard() })
      .subscribe()
    return () => supabaseAdmin.removeChannel(ch)
  }, [profile, fetchDashboard])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  // ── loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <AdminLayout currentPath="/admin/dashboard" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Dashboard" titleAr="لوحة التحكم">
      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:12 }} />)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:12 }}>
          <div className="skeleton" style={{ height:220, borderRadius:12 }} />
          <div className="skeleton" style={{ height:220, borderRadius:12 }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:90, borderRadius:12 }} />)}
        </div>
      </div>
    </AdminLayout>
  )

  // ── destructure ──────────────────────────────────────────────────────────

  const {
    owners = [], branches = [], managers = [],
    totalOwners = 0, activeSubs = 0, trialSubs = 0, expiredSubs = 0, blockedSubs = 0,
    mrr = 0, arr = 0, mrrChangePct = 0,
    trialsExpiringSoon = [], dailyActive = 0,
    atRiskOwners = [], newThisMonth = [],
    monthlyRevenue = [], revenueByPlan = {},
  } = dashData || {}

  const engagementPct = calcRate(dailyActive, totalOwners)

  // ── shared card style ────────────────────────────────────────────────────

  const card = { background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout currentPath="/admin/dashboard" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Dashboard" titleAr="لوحة التحكم" topbarRight={
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
    }>
      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

          {/* error */}
          <ErrorBanner message={error} isAr={isAr} onRetry={fetchDashboard} />

          {/* ── ROW 1 — 4 KPI cards ─────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>

            {/* Card 1 — MRR */}
            <div style={{ ...card, background:'#1B4332', border:'none', display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {isAr ? 'الإيرادات الشهرية' : 'MRR'}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:'#fff', letterSpacing:'-1px', lineHeight:1.1 }}>
                {fmtSAR(mrr)} <span style={{ fontSize:13, fontWeight:400 }}>SAR</span>
              </div>
              <div style={{ fontSize:12, color: mrrChangePct >= 0 ? '#86EFAC' : '#FCA5A5', fontWeight:600 }}>
                {mrrChangePct >= 0 ? '↑' : '↓'} {Math.abs(mrrChangePct)}% {isAr ? 'من الشهر الماضي' : 'vs last month'}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:4 }}>
                ARR: {fmtSAR(arr)} SAR/{isAr ? 'سنة' : 'yr'}
              </div>
            </div>

            {/* Card 2 — Total restaurants */}
            <div style={{ ...card, cursor:'pointer' }} onClick={() => navigate('/admin/restaurants')}>
              <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
                {isAr ? 'إجمالي المطاعم' : 'Total restaurants'}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:'#111827', letterSpacing:'-1px', lineHeight:1.1 }}>{totalOwners}</div>
              {newThisMonth.length > 0 && (
                <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:4, background:'#DCFCE7', color:'#166534', fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20 }}>
                  +{newThisMonth.length} {isAr ? 'هذا الشهر' : 'this month'}
                </div>
              )}
              <div style={{ marginTop:8, fontSize:11, color:'#9CA3AF' }}>{isAr ? 'عرض الكل →' : 'View all →'}</div>
            </div>

            {/* Card 3 — Active paying */}
            <div style={{ ...card, cursor:'pointer' }} onClick={() => navigate('/admin/subscriptions')}>
              <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
                {isAr ? 'المدفوعون النشطون' : 'Active paying'}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:'#1B4332', letterSpacing:'-1px', lineHeight:1.1 }}>{activeSubs}</div>
              <div style={{ marginTop:8, fontSize:12, color:'#6B7280' }}>
                {trialSubs} {isAr ? 'على تجربة' : 'on trial'}
              </div>
              <div style={{ marginTop:4, fontSize:11, color:'#9CA3AF' }}>{isAr ? 'عرض الاشتراكات →' : 'View subscriptions →'}</div>
            </div>

            {/* Card 4 — Trials expiring */}
            <div style={{ ...card, cursor:'pointer' }} onClick={() => navigate('/admin/trials')}>
              <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
                {isAr ? 'التجارب المنتهية' : 'Trials expiring'}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color: trialsExpiringSoon.length > 0 ? '#D97706' : '#1B4332', letterSpacing:'-1px', lineHeight:1.1 }}>
                {trialsExpiringSoon.length}
              </div>
              <div style={{ marginTop:8, fontSize:12, color:'#6B7280' }}>
                {isAr ? 'خلال 7 أيام' : 'within 7 days'}
              </div>
              <div style={{ marginTop:4, fontSize:11, color:'#9CA3AF' }}>{isAr ? 'عرض التجارب →' : 'View trials →'}</div>
            </div>
          </div>

          {/* ── ROW 2 — Revenue chart + Donut ───────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:12 }}>

            {/* Revenue trend card */}
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{isAr ? 'اتجاه الإيرادات' : 'Revenue trend'}</div>
                <div style={{ fontSize:11, color:'#9CA3AF' }}>{isAr ? 'آخر 6 أشهر' : 'Last 6 months'}</div>
              </div>
              <LineChart data={monthlyRevenue} isAr={isAr} />

              {/* Plan breakdown */}
              <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
                {Object.entries(revenueByPlan).map(([plan, { count, price }]) => {
                  const rev = count * price
                  const pct = mrr > 0 ? Math.round((rev / mrr) * 100) : 0
                  return (
                    <div key={plan} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:52, fontSize:11, color:'#6B7280', textTransform:'capitalize', flexShrink:0 }}>{plan}</div>
                      <div style={{ flex:1, height:5, background:'#F0FDF4', borderRadius:3 }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:'#1B4332', borderRadius:3 }} />
                      </div>
                      <div style={{ width:90, fontSize:11, color:'#374151', textAlign:'end', flexShrink:0 }}>
                        {count} × {fmtSAR(price)} = <span style={{ fontWeight:600 }}>{fmtSAR(rev)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Status donut card */}
            <div style={{ ...card, cursor:'pointer' }} onClick={() => navigate('/admin/restaurants')}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:16 }}>
                {isAr ? 'حالة المطاعم' : 'Restaurant status'}
              </div>
              <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                <DonutChart active={activeSubs} trial={trialSubs} expired={expiredSubs} blocked={blockedSubs} />
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { label: isAr ? 'نشط'    : 'Active',  count: activeSubs,  color:'#1B4332' },
                    { label: isAr ? 'تجربة'  : 'Trial',   count: trialSubs,   color:'#378ADD' },
                    { label: isAr ? 'منتهي'  : 'Expired', count: expiredSubs, color:'#E24B4A' },
                    { label: isAr ? 'محظور'  : 'Blocked', count: blockedSubs, color:'#F59E0B' },
                  ].map((s, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                        <span style={{ fontSize:12, color:'#374151' }}>{s.label}</span>
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              {newThisMonth.length > 0 && (
                <div style={{ marginTop:16, background:'#F0FDF4', borderRadius:8, padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:'#166534', fontWeight:500 }}>
                    +{newThisMonth.length} {isAr ? 'جديد هذا الشهر' : 'new this month'}
                  </span>
                  <span style={{ fontSize:18 }}>🎉</span>
                </div>
              )}
            </div>
          </div>

          {/* ── ROW 3 — 3 KPI cards ─────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>

            {/* Branches */}
            <div style={card}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#F0FDF4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#1B4332', marginBottom:12 }}>
                <i className="ti ti-building-store" />
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:'#111827', letterSpacing:'-0.5px' }}>{branches.length}</div>
              <div style={{ fontSize:12, color:'#6B7280', marginTop:4 }}>{isAr ? 'عبر جميع المطاعم' : 'across all restaurants'}</div>
              <button onClick={() => navigate('/admin/restaurants')} style={{ marginTop:10, background:'none', border:'none', padding:0, fontSize:11, color:'#1B4332', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                {isAr ? 'عرض الفروع ←' : 'View branches →'}
              </button>
            </div>

            {/* Managers */}
            <div style={card}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#F0FDF4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#1B4332', marginBottom:12 }}>
                <i className="ti ti-users" />
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:'#111827', letterSpacing:'-0.5px' }}>{managers.length}</div>
              <div style={{ fontSize:12, color:'#6B7280', marginTop:4 }}>{isAr ? 'حسابات نشطة' : 'active accounts'}</div>
              <button onClick={() => navigate('/admin/users')} style={{ marginTop:10, background:'none', border:'none', padding:0, fontSize:11, color:'#1B4332', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                {isAr ? 'عرض المديرين ←' : 'View managers →'}
              </button>
            </div>

            {/* Daily active */}
            <div style={card}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#F0FDF4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#1B4332', marginBottom:12 }}>
                <i className="ti ti-activity" />
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontSize:24, fontWeight:800, color:'#111827', letterSpacing:'-0.5px' }}>{dailyActive}</span>
                <span style={{ fontSize:12, color:'#9CA3AF' }}>/ {totalOwners}</span>
              </div>
              <div style={{ fontSize:12, color:'#6B7280', marginTop:4 }}>{isAr ? 'نشط اليوم' : 'active today'}</div>
              <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1, height:4, background:'#F0FDF4', borderRadius:3 }}>
                  <div style={{ width:`${engagementPct}%`, height:'100%', background: engagementPct >= 60 ? '#1B4332' : '#D97706', borderRadius:3, transition:'width 0.4s' }} />
                </div>
                <span style={{ fontSize:11, fontWeight:600, color: engagementPct >= 60 ? '#1B4332' : '#D97706', flexShrink:0 }}>
                  {engagementPct}%
                </span>
              </div>
            </div>
          </div>

          {/* ── ROW 4 — 2 alert cards ───────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

            {/* Trials expiring soon */}
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>
                  ⚠️ {isAr ? 'التجارب تنتهي قريباً' : 'Trials expiring soon'}
                </div>
                <button onClick={() => navigate('/admin/trials')} style={{ background:'none', border:'none', fontSize:11, color:'#1B4332', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  {isAr ? 'عرض الكل ←' : 'View all trials →'}
                </button>
              </div>

              {trialsExpiringSoon.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'#9CA3AF', fontSize:13 }}>
                  {isAr ? 'لا توجد تجارب تنتهي قريباً 🎉' : 'No trials expiring soon 🎉'}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {trialsExpiringSoon.slice(0, 3).map(sub => {
                    const owner   = owners.find(o => o.id === sub.owner_id)
                    const days    = daysLeft(sub.expires_at)
                    const bCount  = branches.filter(b => b.owner_id === sub.owner_id).length
                    const phone   = owner?.phone || ''
                    const message = `Hi ${owner?.name || ''}! Your Scop trial expires in ${days} day${days === 1 ? '' : 's'}. Ready to continue? Reply to activate your subscription.`
                    const waHref  = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : null
                    return (
                      <div key={sub.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#FFFBEB', border:'0.5px solid #FDE68A', borderRadius:8, gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {owner?.name || sub.owner_id}
                          </div>
                          <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>
                            {sub.plan} · {bCount} {isAr ? 'فرع' : 'branch'}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, background: (days ?? 0) <= 3 ? '#FFF1F2' : '#FFFBEB', color: (days ?? 0) <= 3 ? '#9F1239' : '#92400E' }}>
                            {days ?? 0}d
                          </span>
                          {waHref && (
                            <a href={waHref} target="_blank" rel="noopener noreferrer"
                              style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', background:'#25D366', color:'#fff', borderRadius:6, fontSize:11, fontWeight:500, textDecoration:'none', flexShrink:0 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* At risk — no activity */}
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>
                  🔴 {isAr ? 'في خطر — لا نشاط' : 'At risk — no activity'}
                </div>
                <button onClick={() => navigate('/admin/analytics')} style={{ background:'none', border:'none', fontSize:11, color:'#1B4332', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  {isAr ? 'عرض التحليلات ←' : 'View analytics →'}
                </button>
              </div>

              {atRiskOwners.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'#9CA3AF', fontSize:13 }}>
                  {isAr ? 'جميع المطاعم نشطة خلال 7 أيام 🎉' : 'All restaurants active in last 7 days 🎉'}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {atRiskOwners.map(owner => {
                    const message = `Hi ${owner.name}! We noticed you haven't been active on Scop in the last 7 days. Need any help? We're here for you.`
                    const waHref  = owner.phone ? `https://wa.me/${owner.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : null
                    return (
                      <div key={owner.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:8, gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {owner.name}
                          </div>
                          <div style={{ fontSize:11, color:'#E24B4A', marginTop:2 }}>
                            {isAr ? 'لا نشاط خلال 7 أيام' : 'No activity in last 7 days'}
                          </div>
                        </div>
                        {waHref && (
                          <a href={waHref} target="_blank" rel="noopener noreferrer"
                            style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', background:'#25D366', color:'#fff', borderRadius:6, fontSize:11, fontWeight:500, textDecoration:'none', flexShrink:0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

      </div>
    </AdminLayout>
  )
}
