import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { getTotalExpected, getExpectedForBranch, calcRate } from '../../lib/stats'
import { useLanguage } from '../../context/LanguageContext'
import NotificationBell from '../../components/NotificationBell'
import OwnerLayout from '../../components/OwnerLayout'
import { getWeekStartStr } from '../../lib/weekUtils'

// ── PERIODS ───────────────────────────────────────────────────
const PERIODS = [
  { key: 'today', en: 'Today',         ar: 'اليوم'       },
  { key: 'week',  en: 'This Week',     ar: 'هذا الأسبوع' },
  { key: 'month', en: 'This Month',    ar: 'هذا الشهر'   },
  { key: '3m',    en: 'Last 3 Months', ar: 'آخر 3 أشهر'  },
]

// ── HELPERS ───────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().split('T')[0] }

function getPeriodStart(key) {
  const now = new Date()
  if (key === 'today') return toDateStr(now)
  if (key === 'month') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
  if (key === 'week') {
    return getWeekStartStr()
  }
  // '3m': 90 days ago
  const d = new Date(now)
  d.setDate(d.getDate() - 89)
  return toDateStr(d)
}

function rateColor(pct) {
  if (pct >= 80) return '#1B4332'
  if (pct >= 60) return '#F59E0B'
  return '#E24B4A'
}

function rateTrack(pct) {
  if (pct >= 80) return '#D1FAE5'
  if (pct >= 60) return '#FDE68A'
  return '#FECDD3'
}

// ── DIV-BASED BAR CHART ───────────────────────────────────────
function BarChart({ data, isMobile }) {
  const maxVal = Math.max(...data.map(d => d.completed + d.missed), 1)
  const H      = isMobile ? 80 : 120

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 3 : 4, height: H + 24 }}>
      {data.map((d, i) => {
        const total = d.completed + d.missed
        const barH  = total > 0 ? Math.max(3, (total / maxVal) * H) : 0
        const compH = total > 0 ? Math.round((d.completed / total) * barH) : 0
        const missH = barH - compH

        return (
          <div key={i} style={{ flex: 1, minWidth: isMobile ? 28 : 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {total > 0 ? (
                <div style={{ width: '100%', overflow: 'hidden', borderRadius: '3px 3px 0 0' }}>
                  {missH > 0 && <div style={{ height: missH, background: '#FECDD3', borderRadius: compH === 0 ? '3px 3px 0 0' : 0 }} />}
                  {compH > 0 && <div style={{ height: compH, background: '#1B4332', borderRadius: missH > 0 ? 0 : '3px 3px 0 0' }} />}
                </div>
              ) : (
                <div style={{ height: 2, background: '#E8E4DC', borderRadius: 1 }} />
              )}
            </div>
            <div style={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: isMobile ? 9 : 8, color: '#9CA3AF', whiteSpace: 'nowrap', lineHeight: 1 }}>{d.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── COMPONENT ─────────────────────────────────────────────────
export default function OwnerReports() {
  const { profile } = useOwnerAuth()
  const { isAr, toggleLang } = useLanguage()

  // raw data (always 90-day window; period filter is client-side)
  const [branches,  setBranches]  = useState([])
  const [taskSubs,  setTaskSubs]  = useState([])
  const [fsSubs,    setFsSubs]    = useState([])
  const [taskDefs,  setTaskDefs]  = useState([])   // active tasks owned by this owner
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const [period,      setPeriod]      = useState('week')
  const [chartOffset, setChartOffset] = useState(0)
  const [isMobile,    setIsMobile]    = useState(window.innerWidth < 768)

  // reset chart window whenever period changes
  useEffect(() => { setChartOffset(0) }, [period])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── FETCH ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!profile) return
    setError('')
    setLoading(true)
    try {
      const { data: bData, error: bErr } = await supabaseOwner
        .from('branches')
        .select('id, name, name_ar')
        .eq('owner_id', profile.id)
        .eq('is_active', true)
      if (bErr) throw bErr

      const bList = bData || []
      setBranches(bList)
      if (bList.length === 0) { setLoading(false); return }

      const ids   = bList.map(b => b.id)
      const start = (() => { const d = new Date(); d.setDate(d.getDate() - 89); return toDateStr(d) })()
      const end   = toDateStr(new Date())

      const [fsRes, tasksRes, globalTasksRes] = await Promise.all([
        supabaseOwner
          .from('food_safety_submissions')
          .select('id, result, branch_id, submitted_at, standard_id, food_safety_standards(id, name, name_ar)')
          .in('branch_id', ids)
          .gte('submitted_at', `${start}T00:00:00.000Z`)
          .lte('submitted_at', `${end}T23:59:59.999Z`)
          .limit(5000),
        supabaseOwner
          .from('tasks')
          .select('id, branch_id, frequency')
          .in('branch_id', ids)
          .eq('is_active', true),
        supabaseOwner
          .from('tasks')
          .select('id, branch_id, frequency')
          .is('branch_id', null)
          .eq('is_active', true)
          .eq('created_by', profile.id),
      ])
      if (fsRes.error)          throw fsRes.error
      if (tasksRes.error)       throw tasksRes.error
      if (globalTasksRes.error) throw globalTasksRes.error

      // Paginate task_submissions — 90 days can exceed default row limits
      // Fetch page 0 first; if full, fetch remaining pages in parallel (max 5000 rows)
      const PAGE = 1000
      const taskSubQuery = () => supabaseOwner
        .from('task_submissions')
        .select('id, status, branch_id, submitted_at, task_id, tasks(name, name_ar)')
        .in('branch_id', ids)
        .gte('submitted_at', `${start}T00:00:00.000Z`)
        .lte('submitted_at', `${end}T23:59:59.999Z`)
      const { data: p0Data, error: p0Err } = await taskSubQuery().range(0, PAGE - 1)
      if (p0Err) throw p0Err
      let allTaskSubs = p0Data || []
      if (allTaskSubs.length === PAGE) {
        const extraPages = await Promise.all(
          [1, 2, 3, 4].map(p => taskSubQuery().range(p * PAGE, (p + 1) * PAGE - 1))
        )
        for (const r of extraPages) {
          if (r.error) throw r.error
          if (!r.data?.length) break
          allTaskSubs = [...allTaskSubs, ...r.data]
          if (r.data.length < PAGE) break
        }
      }

      const allTaskDefs = [...(tasksRes.data || []), ...(globalTasksRes.data || [])]
      const activeTaskIds = new Set(allTaskDefs.map(t => t.id))
      setTaskSubs(allTaskSubs.filter(s => activeTaskIds.has(s.task_id)))
      setFsSubs(fsRes.data     || [])
      setTaskDefs(allTaskDefs)
    } catch (err) {
      console.error('Reports fetch error:', err)
      setError('Failed to load report data.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchData() }, [fetchData])



  // ── DERIVED STATE ─────────────────────────────────────────
  const pStart = useMemo(() => getPeriodStart(period), [period])

  const numDays = useMemo(() => {
    const now = new Date()
    if (period === 'today') return 1
    if (period === 'month') return now.getDate()
    if (period === '3m')    return 90
    // week: days from Saturday to today inclusive (Saudi week starts Sat)
    const weekStart = new Date(getWeekStartStr() + 'T00:00:00.000Z')
    const today = new Date()
    return Math.floor((today - weekStart) / 86400000) + 1
  }, [period])

  const filtered = useMemo(() => {
    const d = new Date(`${pStart}T00:00:00.000Z`)
    d.setUTCHours(d.getUTCHours() - 3) // Saudi Arabia UTC+3: midnight local = 21:00 UTC previous day
    const utcStart = d.toISOString().slice(0, 19)
    return taskSubs.filter(s => s.submitted_at >= utcStart)
  }, [taskSubs, pStart])

  const fsFiltered = useMemo(() => {
    const d = new Date(`${pStart}T00:00:00.000Z`)
    d.setUTCHours(d.getUTCHours() - 3)
    const utcStart = d.toISOString().slice(0, 19)
    return fsSubs.filter(s => s.submitted_at >= utcStart)
  }, [fsSubs, pStart])

  // ── KPI ───────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const branchIds = branches.map(b => b.id)
    const expected  = getTotalExpected(branchIds, taskDefs)
    const submitted = filtered.length
    const done      = filtered.filter(s => s.status === 'completed').length
    const missed    = Math.max(0, expected - done)
    const compRate  = calcRate(done, expected)
    const fsPassed  = fsFiltered.filter(s => s.result === 'pass').length
    const fsTotal   = fsFiltered.length
    const fsRate    = calcRate(fsPassed, fsTotal)
    return { submitted, done, expected, missed, compRate, fsRate, fsPassed, fsTotal }
  }, [filtered, fsFiltered, branches, taskDefs])

  // ── CHART DATA ────────────────────────────────────────────
  const chartData = useMemo(() => {
    const branchIds = branches.map(b => b.id)
    const dailyExp  = getTotalExpected(branchIds, taskDefs)
    if (period === '3m') {
      // group by week — all 13 bars fit in one view, no navigation needed
      return Array.from({ length: 13 }, (_, wk) => {
        const ws = new Date(pStart + 'T12:00:00Z')
        ws.setUTCDate(ws.getUTCDate() + wk * 7)
        const we = new Date(ws)
        we.setUTCDate(we.getUTCDate() + 6)
        const wsStr = toDateStr(ws), weStr = toDateStr(we)
        const week  = filtered.filter(s => {
          const ds = s.submitted_at.slice(0, 10)
          return ds >= wsStr && ds <= weStr
        })
        // label: "Jun W1", "Jun W2" etc. based on the week's start date
        const monthAbbr  = ws.toLocaleDateString('en-US', { month: 'short' })
        const wInMonth   = Math.floor((ws.getUTCDate() - 1) / 7) + 1
        const completed  = week.filter(s => s.status === 'completed').length
        return {
          label:     `${monthAbbr} W${wInMonth}`,
          completed,
          missed:    Math.max(0, dailyExp * 7 - completed),
        }
      })
    }
    return Array.from({ length: numDays }, (_, i) => {
      const d = new Date(pStart + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() + i)
      const ds        = toDateStr(d)
      const day       = filtered.filter(s => s.submitted_at.startsWith(ds))
      const completed = day.filter(s => s.status === 'completed').length
      return {
        label:     d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed,
        missed:    Math.max(0, dailyExp - completed),
      }
    })
  }, [filtered, period, pStart, numDays, branches, taskDefs])

  // ── CHART NAVIGATION ─────────────────────────────────────
  // month: page through 7 bars at a time; all other periods show everything
  const windowSize  = period === 'month' ? 7 : chartData.length
  const canGoBack   = chartOffset > 0
  const canGoFwd    = chartOffset + windowSize < chartData.length
  const visibleData = chartData.slice(chartOffset, chartOffset + windowSize)

  // ── BRANCH PERFORMANCE ────────────────────────────────────
  const branchPerf = useMemo(() =>
    branches.map(b => {
      const bExpected = getExpectedForBranch(b.id, taskDefs)
      const bDone     = filtered.filter(s => s.branch_id === b.id && s.status === 'completed').length
      const pct       = calcRate(bDone, bExpected)
      return { ...b, expected: bExpected, done: bDone, pct }
    }).sort((a, b) => b.pct - a.pct),
    [branches, filtered, taskDefs],
  )

  // ── TOP MISSED TASKS ──────────────────────────────────────
  const topMissed = useMemo(() => {
    const map = {}
    for (const s of filtered) {
      if (s.status !== 'missed' || !s.task_id) continue
      const tid = s.task_id
      if (!map[tid]) map[tid] = {
        name:    s.tasks?.name    || '—',
        name_ar: s.tasks?.name_ar || s.tasks?.name || '—',
        count: 0,
      }
      map[tid].count++
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [filtered])

  // ── FOOD SAFETY BREAKDOWN ─────────────────────────────────
  const fsBreakdown = useMemo(() => {
    const map = {}
    for (const s of fsFiltered) {
      if (!s.standard_id) continue
      const sid = s.standard_id
      if (!map[sid]) map[sid] = {
        name:    s.food_safety_standards?.name    || '—',
        name_ar: s.food_safety_standards?.name_ar || s.food_safety_standards?.name || '—',
        pass: 0, fail: 0,
      }
      if (s.result === 'pass') map[sid].pass++
      else if (s.result === 'fail') map[sid].fail++
    }
    return Object.values(map).sort((a, b) => (b.pass + b.fail) - (a.pass + a.fail))
  }, [fsFiltered])

  // ── CSV EXPORT ────────────────────────────────────────────
  function exportCSV() {
    const periodLabel = PERIODS.find(p => p.key === period)?.[isAr ? 'ar' : 'en'] || period
    const branchMap = Object.fromEntries(branches.map(b => [b.id, isAr ? b.name_ar || b.name : b.name]))
    const rows = filtered.map(s => [
      `"${s.submitted_at.slice(0, 10)}"`,
      `"${branchMap[s.branch_id] || s.branch_id}"`,
      `"${isAr ? s.tasks?.name_ar || s.tasks?.name || '' : s.tasks?.name || ''}"`,
      `"${s.status}"`,
    ])
    const headers = isAr
      ? ['التاريخ', 'الفرع', 'المهمة', 'الحالة']
      : ['Date', 'Branch', 'Task', 'Status']
    const csv = '﻿' + [
      `# Scop Report — ${periodLabel} — ${toDateStr(new Date())}`,
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `scop-report-${toDateStr(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const reportsTopbarRight = isMobile ? (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'1px solid #E5E7EB', padding:'4px 11px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
      <NotificationBell isAr={isAr} />
      <button onClick={exportCSV}
        aria-label={isAr ? 'تصدير CSV' : 'Export CSV'}
        style={{ fontSize:16, color:'#1B4332', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minWidth:44, minHeight:44 }}>
        ↓
      </button>
    </div>
  ) : (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      {PERIODS.map(p => (
        <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', border: period===p.key ? 'none' : '1px solid #E5E7EB', background: period===p.key ? '#1B4332' : '#fff', color: period===p.key ? '#fff' : '#6B7280' }}>
          {isAr ? p.ar : p.en}
        </button>
      ))}
      <div style={{ width:1, height:18, background:'#E5E7EB', margin:'0 4px' }} />
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'1px solid #E5E7EB', padding:'4px 11px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
      <NotificationBell isAr={isAr} />
      <button onClick={exportCSV} style={{ fontSize:11, fontWeight:600, color:'#1B4332', background:'#F0FDF4', border:'1px solid #BBF7D0', padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
        ↓ {isAr ? 'تصدير' : 'Export CSV'}
      </button>
    </div>
  )

  // ── LOADING SKELETON ──────────────────────────────────────
  if (loading) return (
    <OwnerLayout activePath="/owner/reports" title="Reports" titleAr="التقارير" branches={branches}>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[0,1,2,3].map(k => <div key={k} className="skeleton" style={{ height: 100 }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 220 }} />
          <div className="skeleton" style={{ height: 220 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div className="skeleton" style={{ height: 200 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    </OwnerLayout>
  )

  // ── RENDER ────────────────────────────────────────────────
  return (
    <OwnerLayout activePath="/owner/reports" title="Reports" titleAr="التقارير"
      topbarRight={reportsTopbarRight} branches={branches}>

      {/* Scrollable content */}
      <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>

          {/* Error banner */}
          {error && (
            <div style={{ marginBottom: 16, padding: '10px 16px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, fontSize: 13, color: '#E24B4A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {error}
              <button onClick={fetchData} style={{ fontSize: 12, color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                {isAr ? 'إعادة' : 'Retry'}
              </button>
            </div>
          )}

          {/* Empty state */}
          {branches.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 16, padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                {isAr ? 'لا توجد فروع بعد' : 'No branches yet'}
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                {isAr ? 'أضف فروعاً لعرض التقارير' : 'Add branches to see reports here'}
              </div>
              <Link to="/owner/branches">
                <button style={{ padding: '9px 22px', background: '#1B4332', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {isAr ? 'إضافة فرع' : 'Add Branch'}
                </button>
              </Link>
            </div>
          ) : (
            <>
              {/* Period selector — mobile only (desktop is in topbar) */}
              {isMobile && (
                <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:16, paddingBottom:2 }}>
                  {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setPeriod(p.key)} style={{ flexShrink:0, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', border: period===p.key ? 'none' : '1px solid #E5E7EB', background: period===p.key ? '#1B4332' : '#fff', color: period===p.key ? '#fff' : '#6B7280' }}>
                      {isAr ? p.ar : p.en}
                    </button>
                  ))}
                </div>
              )}

              {/* ── 4 KPI CARDS ── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  {
                    icon: '✓',  iconBg: '#F0FDF4',
                    value: kpi.submitted, suffix: '',
                    label: isAr ? 'إجمالي المهام المُرسَلة' : 'Total Tasks Submitted',
                    sub: `${numDays} ${isAr ? 'يوم' : 'days'}`,
                    numColor: '#111827',
                  },
                  {
                    icon: '📊', iconBg: '#F0FDF4',
                    value: kpi.compRate, suffix: '%',
                    label: isAr ? 'معدل الإكمال' : 'Completion Rate',
                    sub: `${Math.min(kpi.done, kpi.expected)}/${kpi.expected} ${isAr ? 'مهمة' : 'tasks'}`,
                    numColor: rateColor(kpi.compRate),
                  },
                  {
                    icon: '🛡', iconBg: '#F0FDF4',
                    value: kpi.fsRate, suffix: '%',
                    label: isAr ? 'معدل سلامة الغذاء' : 'Food Safety Pass Rate',
                    sub: `${kpi.fsPassed}/${kpi.fsTotal} ${isAr ? 'ناجح' : 'passed'}`,
                    numColor: rateColor(kpi.fsRate),
                  },
                  {
                    icon: '⚠️', iconBg: '#FFF7ED',
                    value: kpi.missed, suffix: '',
                    label: isAr ? 'المهام الفائتة' : 'Missed Tasks',
                    sub: kpi.missed === 0 ? (isAr ? '✓ لا شيء' : '✓ None') : (isAr ? 'تحتاج مراجعة' : 'Need review'),
                    numColor: kpi.missed > 0 ? '#E24B4A' : '#111827',
                  },
                ].map((c) => (
                  <div key={c.label} style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 16, padding: isMobile ? 12 : 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>
                      {c.icon}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: c.numColor, lineHeight: 1, letterSpacing: '-1px' }}>
                      {c.value}<span style={{ fontSize: 15, fontWeight: 500, color: '#9CA3AF' }}>{c.suffix}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* ── ROW 2: BAR CHART + BRANCH PERFORMANCE ── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 14, marginBottom: 14 }}>

                {/* Daily completion bar chart */}
                <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 16, padding: 20 }}>

                  {/* Chart header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                        {isAr ? 'الإكمال اليومي' : 'Daily Completion'}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        {period === '3m'
                          ? (isAr ? 'مجمّع أسبوعياً — آخر 3 أشهر' : 'Grouped by week — last 3 months')
                          : period === 'today'
                          ? (isAr ? 'اليوم' : 'Today')
                          : (isAr ? `${numDays} يوم` : `${numDays} days`)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* legend */}
                      {[
                        { color: '#1B4332', label: isAr ? 'مكتملة' : 'Completed' },
                        { color: '#FECDD3', label: isAr ? 'فائتة'  : 'Missed'    },
                      ].map(l => (
                        <span key={l.label} style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 12, height: 12, background: l.color, borderRadius: 3, display: 'inline-block' }} />
                          {l.label}
                        </span>
                      ))}

                      {/* Navigation arrows — only for month (up to 31 daily bars) */}
                      {period === 'month' && chartData.length > windowSize && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                          <button
                            onClick={() => setChartOffset(o => Math.max(0, o - windowSize))}
                            disabled={!canGoBack}
                            style={{
                              width: 28, height: 28, border: '1px solid #E8E4DC', borderRadius: 8,
                              background: '#fff', cursor: canGoBack ? 'pointer' : 'default',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, color: canGoBack ? '#374151' : '#D1D5DB',
                              opacity: canGoBack ? 1 : 0.4,
                            }}
                          >‹</button>
                          <button
                            onClick={() => setChartOffset(o => Math.min(chartData.length - windowSize, o + windowSize))}
                            disabled={!canGoFwd}
                            style={{
                              width: 28, height: 28, border: '1px solid #E8E4DC', borderRadius: 8,
                              background: '#fff', cursor: canGoFwd ? 'pointer' : 'default',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, color: canGoFwd ? '#374151' : '#D1D5DB',
                              opacity: canGoFwd ? 1 : 0.4,
                            }}
                          >›</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Window range label for month navigation */}
                  {period === 'month' && chartData.length > windowSize && visibleData.length > 0 && (
                    <div style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', marginBottom: 6, fontWeight: 500 }}>
                      {visibleData[0].label} – {visibleData[visibleData.length - 1].label}
                    </div>
                  )}

                  {/* Scrollable chart area */}
                  <div className="chart-scroll" style={{ overflowX: 'auto', width: '100%' }}>
                    <div style={{ minWidth: isMobile ? undefined : Math.max(600, visibleData.length * 40) + 'px' }}>
                      <BarChart data={visibleData} isMobile={isMobile} />
                    </div>
                  </div>
                </div>

                {/* Branch performance */}
                <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                    {isAr ? 'أداء الفروع' : 'Branch Performance'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 14 }}>
                    {isAr ? 'معدل الإكمال لكل فرع' : 'Completion rate per branch'}
                  </div>
                  {branchPerf.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 12 }}>
                      {isAr ? 'لا توجد بيانات' : 'No data'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {branchPerf.map(b => (
                        <div key={b.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                              {isAr ? b.name_ar || b.name : b.name}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: rateColor(b.pct), flexShrink: 0 }}>
                              {b.pct}%
                            </span>
                          </div>
                          <div style={{ height: 7, background: rateTrack(b.pct), borderRadius: 20, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${b.pct}%`, background: rateColor(b.pct), borderRadius: 20, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── ROW 3: TOP MISSED + FOOD SAFETY BREAKDOWN ── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>

                {/* Top missed tasks */}
                <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                    {isAr ? 'أكثر المهام الفائتة' : 'Top Missed Tasks'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 14 }}>
                    {isAr ? 'المهام الأعلى تكراراً في الفوات' : 'Tasks missed most often this period'}
                  </div>
                  {topMissed.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 12 }}>
                      {isAr ? 'لا توجد مهام فائتة' : 'No missed tasks — great work!'}
                    </div>
                  ) : (() => {
                    const maxMiss = topMissed[0].count
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {topMissed.map((t) => (
                          <div key={t.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                                {isAr ? t.name_ar || t.name : t.name}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#E24B4A', flexShrink: 0 }}>
                                {t.count}×
                              </span>
                            </div>
                            <div style={{ height: 6, background: '#FECDD3', borderRadius: 20, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.round((t.count / maxMiss) * 100)}%`, background: '#E24B4A', borderRadius: 20 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* Food safety breakdown */}
                <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                    {isAr ? 'تفاصيل سلامة الغذاء' : 'Food Safety Breakdown'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 14 }}>
                    {isAr ? 'نتائج الفحوصات لكل معيار' : 'Pass / fail counts per standard'}
                  </div>
                  {fsBreakdown.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 12 }}>
                      {isAr ? 'لا توجد فحوصات في هذه الفترة' : 'No food safety checks this period'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {fsBreakdown.slice(0, 6).map((s) => {
                        const total  = s.pass + s.fail
                        const passPct = Math.min(100, Math.round((s.pass / Math.max(total, 1)) * 100))
                        return (
                          <div key={s.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                                {isAr ? s.name_ar || s.name : s.name}
                              </span>
                              <span style={{ fontSize: 11, color: '#6B7280', flexShrink: 0 }}>
                                <span style={{ color: '#1B4332', fontWeight: 600 }}>{s.pass}✓</span>
                                {' / '}
                                <span style={{ color: '#E24B4A', fontWeight: 600 }}>{s.fail}✗</span>
                              </span>
                            </div>
                            <div style={{ height: 6, background: '#FECDD3', borderRadius: 20, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${passPct}%`, background: '#1B4332', borderRadius: 20 }} />
                            </div>
                          </div>
                        )
                      })}
                      {fsBreakdown.length > 6 && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', paddingTop: 4 }}>
                          +{fsBreakdown.length - 6} {isAr ? 'معيار آخر' : 'more standards'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

      <style>{`
        .chart-scroll::-webkit-scrollbar { height: 4px; }
        .chart-scroll::-webkit-scrollbar-track { background: #F3F4F6; border-radius: 2px; }
        .chart-scroll::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 2px; }
      `}</style>
    </OwnerLayout>
  )
}
