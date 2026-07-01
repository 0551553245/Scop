import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Link } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { getCached, setCached, invalidateCache } from '../../lib/cache'
import { calcPending, calcRate } from '../../lib/stats'
import { useLanguage } from '../../context/LanguageContext'
import { useSubscription } from '../../hooks/useSubscription'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import NotificationBell from '../../components/NotificationBell'
import { getPlatformSettings, DEFAULT_SETTINGS } from '../../lib/platformSettings'
import OwnerLayout from '../../components/OwnerLayout'
import { getWeekStartStr } from '../../lib/weekUtils'

function greeting(lang) {
  const h = new Date().getHours()
  if (lang === 'ar') {
    if (h < 12) return 'صباح الخير'
    if (h < 17) return 'مساء الخير'
    return 'مساء النور'
  }
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(lang) {
  return new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function getBarColor(pct) {
  if (pct === 100) return '#1B4332'
  if (pct > 0)    return '#F59E0B'
  return '#E24B4A'
}

function getSubText(done, total, isAr) {
  if (total === 0)      return isAr ? 'لا توجد مهام' : 'No tasks'
  if (done === total)   return isAr ? 'تم الكل' : 'All done'
  return isAr ? `${total - done} متبقي` : `${total - done} remaining`
}

function getSubColor(done, total) {
  if (total === 0)    return '#9CA3AF'
  if (done === total) return '#4ADE80'
  if (done === 0)     return '#E24B4A'
  return '#F59E0B'
}

export default function OwnerDashboard() {
  const { profile } = useOwnerAuth()
  const { lang, isAr, toggleLang } = useLanguage()
  const { subscription, daysLeft, isTrial, isExpired, expiringSoon } = useSubscription()

  const [branches,       setBranches]       = useState([])
  const [activeBranch,   setActiveBranch]   = useState(null)
  const [allTasks,       setAllTasks]       = useState([])
  const [allTodaySubs,   setAllTodaySubs]   = useState([])
  const [allWeekSubs,    setAllWeekSubs]    = useState([])
  const [allMonthSubs,   setAllMonthSubs]   = useState([])
  const [allFsStds,      setAllFsStds]      = useState([])
  const [allFsSubs,      setAllFsSubs]      = useState([])
  const [allEvents,      setAllEvents]      = useState([])
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_SETTINGS.support_whatsapp)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const isMobile = useIsMobile()
  const loadTimerRef = useRef(null)

  const fetchDashboard = useCallback(async () => {
    if (!profile) return
    setError('')

    const today = new Date().toISOString().split('T')[0]
    const cacheKey = `owner-dashboard-${profile.id}-${today}`
    const cached = getCached(cacheKey)

    if (cached) {
      setBranches(cached.branches)
      setAllTasks(cached.allTasks)
      setAllTodaySubs(cached.allTodaySubs)
      setAllWeekSubs(cached.allWeekSubs)
      setAllMonthSubs(cached.allMonthSubs)
      setAllFsStds(cached.allFsStds)
      setAllFsSubs(cached.allFsSubs)
      setAllEvents(cached.allEvents)
      setLoading(false)
    }

    if (!cached) {
      loadTimerRef.current = setTimeout(() => setLoading(false), 800)
    }

    try {
      const settings = await getPlatformSettings(supabaseOwner)
      setWhatsappNumber(settings.support_whatsapp || DEFAULT_SETTINGS.support_whatsapp)

      const branchRes = await supabaseOwner
        .from('branches')
        .select('id, name, name_ar, is_active, manager_id')
        .eq('owner_id', profile.id)
        .eq('is_active', true)

      if (branchRes.error) throw branchRes.error
      const activeBranches = branchRes.data || []
      setBranches(activeBranches)

      if (activeBranches.length === 0) {
        setLoading(false)
        return
      }

      const branchIds = activeBranches.map(b => b.id)

      const weekStartStr = getWeekStartStr()

      const monthStart = new Date()
      monthStart.setDate(1)
      const monthStartStr = monthStart.toISOString().split('T')[0]

      const [
        branchTasksRes, globalTasksRes,
        todaySubsRes, fsStdsRes, fsSubsRes,
        eventsRes, weekSubsRes, monthSubsRes,
      ] = await Promise.all([
        supabaseOwner.from('tasks').select('id, branch_id, frequency').in('branch_id', branchIds).eq('is_active', true).limit(2000),
        supabaseOwner.from('tasks').select('id, branch_id, frequency').is('branch_id', null).eq('is_active', true).eq('created_by', profile.id).limit(2000),
        supabaseOwner.from('task_submissions').select('id, status, branch_id, task_id, submitted_at').in('branch_id', branchIds).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(5000),
        supabaseOwner.from('food_safety_standards').select('id, branch_id').eq('created_by', profile.id).eq('is_active', true).limit(2000),
        supabaseOwner.from('food_safety_submissions').select('id, result, branch_id').in('branch_id', branchIds).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(2000),
        supabaseOwner.from('schedule_events').select('id, title, title_ar, event_date, start_time, branch_id, is_private').or(`branch_id.in.(${branchIds.join(',')}),branch_id.is.null`).eq('created_by', profile.id).gte('event_date', today).order('event_date', { ascending: true }).order('start_time', { ascending: true }).limit(20),
        supabaseOwner.from('task_submissions').select('status, branch_id, task_id').in('branch_id', branchIds).gte('submitted_at', `${weekStartStr}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(5000),
        supabaseOwner.from('task_submissions').select('status, branch_id, task_id').in('branch_id', branchIds).gte('submitted_at', `${monthStartStr}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(5000),
      ])

      if (branchTasksRes.error) throw branchTasksRes.error
      if (globalTasksRes.error) throw globalTasksRes.error
      if (todaySubsRes.error)   throw todaySubsRes.error
      if (fsStdsRes.error)      throw fsStdsRes.error
      if (fsSubsRes.error)      throw fsSubsRes.error
      if (eventsRes.error)      throw eventsRes.error
      if (weekSubsRes.error)    throw weekSubsRes.error
      if (monthSubsRes.error)   throw monthSubsRes.error

      const tasks     = [...(branchTasksRes.data || []), ...(globalTasksRes.data || [])]
      const todaySubs = todaySubsRes.data || []
      const fsStds    = fsStdsRes.data || []
      const fsSubs    = fsSubsRes.data || []
      const events    = eventsRes.data || []
      const weekSubs  = weekSubsRes.data || []
      const monthSubs = monthSubsRes.data || []

      setAllTasks(tasks)
      setAllTodaySubs(todaySubs)
      setAllWeekSubs(weekSubs)
      setAllMonthSubs(monthSubs)
      setAllFsStds(fsStds)
      setAllFsSubs(fsSubs)
      setAllEvents(events)

      setCached(cacheKey, {
        branches: activeBranches, allTasks: tasks,
        allTodaySubs: todaySubs, allWeekSubs: weekSubs, allMonthSubs: monthSubs,
        allFsStds: fsStds, allFsSubs: fsSubs, allEvents: events,
      })

    } catch (err) {
      console.error('Dashboard fetch error:', err)
      if (!cached) setError('Failed to load dashboard data.')
    } finally {
      clearTimeout(loadTimerRef.current)
      if (!cached) setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  useEffect(() => {
    if (branches.length > 0 && !activeBranch) {
      setActiveBranch(branches[0])
    }
  }, [branches, activeBranch])

  useEffect(() => {
    if (!profile || branches.length === 0) return
    const today = new Date().toISOString().split('T')[0]
    const cacheKey = `owner-dashboard-${profile.id}-${today}`

    const channel = supabaseOwner
      .channel(`owner-dashboard-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_submissions' },
        () => { invalidateCache(cacheKey); fetchDashboard() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_safety_submissions' },
        () => { invalidateCache(cacheKey); fetchDashboard() })
      .subscribe()

    return () => supabaseOwner.removeChannel(channel)
  }, [profile?.id, branches, fetchDashboard])

  const branchStats = useMemo(() => {
    if (!activeBranch) return null
    const branchId = activeBranch.id

    const taskDefs    = allTasks.filter(t => t.branch_id === null || t.branch_id === branchId)
    const dailyDefs   = taskDefs.filter(t => t.frequency === 'daily')
    const weeklyDefs  = taskDefs.filter(t => t.frequency === 'weekly')
    const monthlyDefs = taskDefs.filter(t => t.frequency === 'monthly')

    const dailyIds   = new Set(dailyDefs.map(t => t.id))
    const weeklyIds  = new Set(weeklyDefs.map(t => t.id))
    const monthlyIds = new Set(monthlyDefs.map(t => t.id))

    const todaySubs = allTodaySubs.filter(s => s.branch_id === branchId)
    const dailyDone = todaySubs.filter(s => s.status === 'completed' && dailyIds.has(s.task_id)).length
    const dailyMiss = todaySubs.filter(s => s.status === 'missed'    && dailyIds.has(s.task_id)).length
    const dailyExp  = dailyDefs.length

    const weekSubs  = allWeekSubs.filter(s => s.branch_id === branchId)
    const weekDone  = weekSubs.filter(s => s.status === 'completed' && weeklyIds.has(s.task_id)).length
    const weekMiss  = weekSubs.filter(s => s.status === 'missed'    && weeklyIds.has(s.task_id)).length
    const weekExp   = weeklyDefs.length

    const monthSubs  = allMonthSubs.filter(s => s.branch_id === branchId)
    const monthDone  = monthSubs.filter(s => s.status === 'completed' && monthlyIds.has(s.task_id)).length
    const monthMiss  = monthSubs.filter(s => s.status === 'missed'    && monthlyIds.has(s.task_id)).length
    const monthExp   = monthlyDefs.length

    const fsStds   = allFsStds.filter(s => s.branch_id === null || s.branch_id === branchId)
    const fsExp    = fsStds.length
    const fsSubs   = allFsSubs.filter(s => s.branch_id === branchId)
    const fsPassed = fsSubs.filter(s => s.result === 'pass').length
    const fsFailed = fsSubs.filter(s => s.result === 'fail').length

    const nextEvent = allEvents.find(e => e.branch_id === branchId || e.branch_id === null) || null

    const overall = calcRate(dailyDone, dailyExp)
    const status  = overall === 100 ? 'on_track' : overall >= 60 ? 'needs_attention' : 'at_risk'

    return {
      daily:   { done: dailyDone, missed: dailyMiss, expected: dailyExp,  pending: calcPending(dailyDone, dailyExp),  rate: calcRate(dailyDone, dailyExp)  },
      weekly:  { done: weekDone,  missed: weekMiss,  expected: weekExp,   pending: calcPending(weekDone,  weekExp),   rate: calcRate(weekDone,  weekExp)   },
      monthly: { done: monthDone, missed: monthMiss, expected: monthExp,  pending: calcPending(monthDone, monthExp),  rate: calcRate(monthDone, monthExp)  },
      fs:      { passed: fsPassed, failed: fsFailed, expected: fsExp, rate: calcRate(fsPassed, fsExp) },
      overall,
      status,
      nextEvent,
    }
  }, [activeBranch, allTasks, allTodaySubs, allWeekSubs, allMonthSubs, allFsStds, allFsSubs, allEvents])

  const name     = isAr ? profile?.name_ar || profile?.name : profile?.name || '—'
  const initials = (profile?.name || 'O').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const statusConfig = {
    on_track:        { bg: '#4ADE80',  color: '#052e16', text: 'On track',        textAr: 'على المسار'    },
    needs_attention: { bg: '#FDE68A',  color: '#92400E', text: 'Needs attention', textAr: 'يحتاج انتباه' },
    at_risk:         { bg: '#FECDD3',  color: '#9F1239', text: 'At risk',         textAr: 'في خطر'        },
  }
  const bannerScoreColor = branchStats?.overall === 100 ? '#4ADE80' : branchStats?.overall >= 60 ? '#FCD34D' : '#FCA5A5'
  const statusInfo       = statusConfig[branchStats?.status] || statusConfig.at_risk
  const fsBadgeStyle     = branchStats?.fs.rate === 100
    ? { bg: '#F0FDF4', color: '#166534' }
    : branchStats?.fs.rate >= 50
    ? { bg: '#FFFBEB', color: '#92400E' }
    : { bg: '#FFF1F2', color: '#9F1239' }

  const dashTopbarRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '4px 12px', borderRadius: 20 }}>
        {formatDate(lang)}
      </div>
      <button onClick={toggleLang} style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
      <NotificationBell isAr={isAr} />
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1B4332', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
        {initials}
      </div>
    </div>
  )

  // ── LOADING SKELETON ────────────────────────────────────────
  if (loading) return (
    <OwnerLayout activePath="/owner/dashboard" title="Dashboard" titleAr="لوحة التحكم"
      branches={branches} topbarRight={dashTopbarRight}>
      <div style={{ padding: '20px 24px' }}>
        <div className="skeleton" style={{ height: 36, width: 300, marginBottom: 16, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 80, marginBottom: 16, borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          {['a', 'b', 'c'].map(k => <div key={k} className="skeleton" style={{ height: 140, borderRadius: 12 }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
        </div>
      </div>
    </OwnerLayout>
  )

  // ── ERROR STATE ──────────────────────────────────────────────
  if (error) return (
    <OwnerLayout activePath="/owner/dashboard" title="Dashboard" titleAr="لوحة التحكم"
      branches={branches} topbarRight={dashTopbarRight}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 14, color: '#111827', fontWeight: 600, marginBottom: 6 }}>{error}</div>
          <button onClick={fetchDashboard} style={{ marginTop: 12, padding: '8px 20px', background: '#1B4332', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      </div>
    </OwnerLayout>
  )

  return (
    <OwnerLayout activePath="/owner/dashboard" title="Dashboard" titleAr="لوحة التحكم"
      branches={branches} topbarRight={dashTopbarRight}>
      <div style={{ padding: '20px 24px' }}>

          <SubscriptionBanner
            subscription={subscription}
            daysLeft={daysLeft}
            isTrial={isTrial}
            isExpired={isExpired}
            expiringSoon={expiringSoon}
            isAr={isAr}
            supportWhatsapp={whatsappNumber}
          />

          {/* Welcome */}
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
              {greeting(lang)}, {name} 👋
            </h1>
            <p style={{ fontSize: 13, color: '#6B7280', marginTop: 3, marginBottom: 0 }}>
              {isAr ? 'هذا ما يحدث في فروعك اليوم' : "Here is what is happening across your branches today"}
            </p>
          </div>

          {/* Empty state */}
          {branches.length === 0 ? (
            <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                {isAr ? 'لا توجد فروع بعد' : 'No branches yet'}
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                {isAr ? 'أضف فرعك الأول لتبدأ' : 'Add your first branch to get started'}
              </div>
              <Link to="/owner/branches">
                <button style={{ padding: '10px 24px', background: '#1B4332', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {isAr ? 'إضافة فرع' : 'Add Branch'}
                </button>
              </Link>
            </div>
          ) : (
            <>
              {/* Branch switcher */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setActiveBranch(b)}
                    style={{
                      padding: '6px 18px',
                      borderRadius: 20,
                      border: activeBranch?.id === b.id ? 'none' : '1px solid #BBF7D0',
                      background: activeBranch?.id === b.id ? '#1B4332' : '#fff',
                      color: activeBranch?.id === b.id ? '#fff' : '#1B4332',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isAr ? b.name_ar || b.name : b.name}
                  </button>
                ))}
              </div>

              {activeBranch && branchStats && (
                <>
                  {/* Health banner */}
                  <div style={{
                    background: '#1B4332', borderRadius: 12, padding: '16px 22px',
                    marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {isAr ? 'الصحة العامة اليوم' : "Today's Health"}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                        {isAr ? activeBranch.name_ar || activeBranch.name : activeBranch.name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAr ? 'flex-start' : 'flex-end', gap: 6 }}>
                      <div style={{ fontSize: 40, fontWeight: 800, color: bannerScoreColor, lineHeight: 1 }}>
                        {branchStats.overall}%
                      </div>
                      <div style={{ background: statusInfo.bg, color: statusInfo.color, fontSize: 12, fontWeight: 500, padding: '6px 16px', borderRadius: 20 }}>
                        {isAr ? statusInfo.textAr : statusInfo.text}
                      </div>
                    </div>
                  </div>

                  {/* 3 frequency cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
                    {[
                      { key: 'daily',   label: isAr ? 'يومي'   : 'Daily',   icon: '🌅', stats: branchStats.daily   },
                      { key: 'weekly',  label: isAr ? 'أسبوعي' : 'Weekly',  icon: '📅', stats: branchStats.weekly  },
                      { key: 'monthly', label: isAr ? 'شهري'   : 'Monthly', icon: '📆', stats: branchStats.monthly },
                    ].map(({ key, label, icon, stats }) => (
                      <div key={key} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 18 }}>{icon}</span>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</div>
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 800, color: '#111827', lineHeight: 1, marginBottom: 6 }}>
                          {stats.rate}%
                        </div>
                        <div style={{ height: 8, background: '#F3F4F6', borderRadius: 20, overflow: 'hidden', margin: '10px 0 6px' }}>
                          <div style={{
                            height: '100%',
                            width: `${stats.rate}%`,
                            background: getBarColor(stats.rate),
                            borderRadius: 20, transition: 'width 0.4s, background 0.3s',
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: getSubColor(stats.done, stats.expected), marginBottom: 10 }}>
                          {getSubText(stats.done, stats.expected, isAr)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                          {[
                            { num: stats.done,    label: isAr ? 'مكتمل' : 'Done',    bg: '#F0FDF4', color: '#166534' },
                            { num: stats.pending, label: isAr ? 'معلق'  : 'Pending', bg: '#FFFBEB', color: '#92400E' },
                            { num: stats.missed,  label: isAr ? 'فائت'  : 'Missed',  bg: '#FFF1F2', color: '#9F1239' },
                          ].map((cell, ci) => (
                            <div key={ci} style={{ textAlign: 'center', background: cell.bg, borderRadius: 8, padding: '6px 4px' }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: cell.color }}>{cell.num}</div>
                              <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>{cell.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Food safety + next event */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                    {/* Food safety card */}
                    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 18 }}>🛡</span>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {isAr ? 'سلامة الغذاء اليوم' : 'Food Safety Today'}
                        </div>
                      </div>
                      {branchStats.fs.expected === 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF', fontSize: 12 }}>
                          {isAr ? 'لا توجد معايير محددة' : 'No standards defined'}
                        </div>
                      ) : (
                        <>
                          <div style={{
                            fontSize: 30, fontWeight: 800, lineHeight: 1, marginBottom: 6,
                            color: branchStats.fs.rate >= 90 ? '#166534' : branchStats.fs.rate >= 70 ? '#92400E' : '#9F1239',
                          }}>
                            {branchStats.fs.rate}%
                          </div>
                          <div style={{ height: 4, background: '#F3F4F6', borderRadius: 4, marginBottom: 12 }}>
                            <div style={{
                              height: '100%',
                              width: `${branchStats.fs.rate}%`,
                              background: branchStats.fs.rate >= 90 ? '#1B4332' : branchStats.fs.rate >= 70 ? '#F59E0B' : '#F43F5E',
                              borderRadius: 4, transition: 'width 0.5s',
                            }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                            <div style={{ textAlign: 'center', background: '#F0FDF4', borderRadius: 8, padding: '8px 4px' }}>
                              <div style={{ fontSize: 20, fontWeight: 700, color: '#166534' }}>{branchStats.fs.passed}</div>
                              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{isAr ? 'ناجح' : 'Passed'}</div>
                            </div>
                            <div style={{ textAlign: 'center', background: '#FFF1F2', borderRadius: 8, padding: '8px 4px' }}>
                              <div style={{ fontSize: 20, fontWeight: 700, color: '#9F1239' }}>{branchStats.fs.failed}</div>
                              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{isAr ? 'فاشل' : 'Failed'}</div>
                            </div>
                          </div>
                          <div style={{ background: fsBadgeStyle.bg, color: fsBadgeStyle.color, fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>
                            {branchStats.fs.rate}% {isAr ? 'نجاح' : 'Pass'}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Next event card */}
                    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 18 }}>📅</span>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {isAr ? 'الحدث القادم' : 'Next Event'}
                        </div>
                      </div>
                      {branchStats.nextEvent ? (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                            {branchStats.nextEvent.is_private && <span style={{ marginRight: 4 }}>🔒</span>}
                            {isAr ? branchStats.nextEvent.title_ar || branchStats.nextEvent.title : branchStats.nextEvent.title}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: '#1B4332', background: '#F0FDF4', border: '0.5px solid #BBF7D0', padding: '4px 10px', borderRadius: 20 }}>
                              📅 {branchStats.nextEvent.event_date}
                            </span>
                            {branchStats.nextEvent.start_time && (
                              <span style={{ fontSize: 11, color: '#1B4332', background: '#F0FDF4', border: '0.5px solid #BBF7D0', padding: '4px 10px', borderRadius: 20 }}>
                                🕐 {branchStats.nextEvent.start_time}
                              </span>
                            )}
                          </div>
                          <Link to="/owner/schedule" style={{ display: 'inline-block', marginTop: 12, fontSize: 12, color: '#1B4332', fontWeight: 600, textDecoration: 'none' }}>
                            {isAr ? 'عرض الجدول ←' : 'View schedule →'}
                          </Link>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>🗓</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
                            {isAr ? 'لا توجد أحداث قادمة' : 'No upcoming events'}
                          </div>
                          <Link to="/owner/schedule" style={{ fontSize: 12, color: '#1B4332', fontWeight: 600, textDecoration: 'none' }}>
                            {isAr ? 'إنشاء حدث ←' : 'Create event →'}
                          </Link>
                        </div>
                      )}
                    </div>

                  </div>
                </>
              )}
            </>
          )}
      </div>
    </OwnerLayout>
  )
}
