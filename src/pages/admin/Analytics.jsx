import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../../lib/supabase'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { calcRate } from '../../lib/stats'
import { getCached, setCached, invalidateCache } from '../../lib/cache'
import AdminLayout from '../../components/AdminLayout'
import ErrorBanner from '../../components/ErrorBanner'

function dayKey(d) { return new Date(d).toISOString().split('T')[0] }

export default function AdminAnalytics() {
  const navigate             = useNavigate()
  const { profile, signOut } = useAdminAuth()
  const { isAr, toggleLang } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [tasksToday,    setTasksToday]    = useState(0)
  const [fsToday,       setFsToday]       = useState(0)
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [dailyChart,    setDailyChart]    = useState([])
  const [adoption,      setAdoption]      = useState({ tasks: 0, foodSafety: 0, schedule: 0 })
  const [atRisk,        setAtRisk]        = useState([])
  const [topCities,     setTopCities]     = useState([])

  const fetchAnalytics = useCallback(async () => {
    setError('')

    const cacheKey = `admin-analytics-${profile.id}`
    const cached   = getCached(cacheKey)
    if (cached) {
      setTasksToday(cached.tasksToday)
      setFsToday(cached.fsToday)
      setAvgCompletion(cached.avgCompletion)
      setDailyChart(cached.dailyChart)
      setAdoption(cached.adoption)
      setAtRisk(cached.atRisk)
      setTopCities(cached.topCities)
      setLoading(false)
    }

    try {
      const now        = new Date()
      const today       = dayKey(now)
      const last30      = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const last7       = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()

      const [branchesRes, taskSubsRes, fsSubsRes, scheduleRes] = await Promise.all([
        supabaseAdmin.from('branches').select('id, name, name_ar, city, owner_id').eq('is_active', true),
        supabaseAdmin.from('task_submissions').select('id, branch_id, status, submitted_at').gte('submitted_at', last30),
        supabaseAdmin.from('food_safety_submissions').select('id, branch_id, result, submitted_at').gte('submitted_at', last30),
        supabaseAdmin.from('schedule_events').select('branch_id'),
      ])

      if (branchesRes.error) throw branchesRes.error
      if (taskSubsRes.error) throw taskSubsRes.error
      if (fsSubsRes.error)   throw fsSubsRes.error

      const branches  = branchesRes.data || []
      const taskSubs   = taskSubsRes.data || []
      const fsSubs     = fsSubsRes.data || []
      const scheduleRows = scheduleRes.data || []

      const tasksTodayCount = taskSubs.filter(s => dayKey(s.submitted_at) === today).length
      const fsTodayCount    = fsSubs.filter(s => dayKey(s.submitted_at) === today).length
      setTasksToday(tasksTodayCount)
      setFsToday(fsTodayCount)

      const completedCount   = taskSubs.filter(s => s.status === 'completed').length
      const avgCompletionPct = calcRate(completedCount, taskSubs.length)
      setAvgCompletion(avgCompletionPct)

      // Daily completion bar chart, last 14 days
      const days = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        days.push(dayKey(d))
      }
      const chart = days.map(d => ({
        day: d,
        count: taskSubs.filter(s => s.status === 'completed' && dayKey(s.submitted_at) === d).length,
      }))
      setDailyChart(chart)

      // Feature adoption
      const totalBranches = Math.max(1, branches.length)
      const branchesWithTasks    = new Set(taskSubs.map(s => s.branch_id)).size
      const branchesWithFS       = new Set(fsSubs.map(s => s.branch_id)).size
      const branchesWithSchedule = new Set(scheduleRows.map(r => r.branch_id)).size

      const adoptionObj = {
        tasks:      Math.round((branchesWithTasks    / totalBranches) * 100),
        foodSafety: Math.round((branchesWithFS       / totalBranches) * 100),
        schedule:   Math.round((branchesWithSchedule / totalBranches) * 100),
      }
      setAdoption(adoptionObj)

      // At-risk: zero task AND food-safety activity in last 7 days
      const activeBranchIds7d = new Set([
        ...taskSubs.filter(s => s.submitted_at >= last7).map(s => s.branch_id),
        ...fsSubs.filter(s => s.submitted_at >= last7).map(s => s.branch_id),
      ])
      const riskyBranches = branches.filter(b => !activeBranchIds7d.has(b.id))

      let ownersById = {}
      const ownerIds = [...new Set(riskyBranches.map(b => b.owner_id))]
      if (ownerIds.length > 0) {
        const ownersRes = await supabaseAdmin.from('users').select('id, name, phone, email').in('id', ownerIds)
        if (ownersRes.error) throw ownersRes.error
        ;(ownersRes.data || []).forEach(o => { ownersById[o.id] = o })
      }
      const atRiskList = riskyBranches.map(b => ({ ...b, owner: ownersById[b.owner_id] }))
      setAtRisk(atRiskList)

      // Most active cities — skip branches with no city set
      const cityCounts = {}
      taskSubs.forEach(s => {
        const branch = branches.find(b => b.id === s.branch_id)
        const city = branch?.city
        if (!city) return
        cityCounts[city] = (cityCounts[city] || 0) + 1
      })
      const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
      setTopCities(sortedCities)

      setCached(cacheKey, {
        tasksToday: tasksTodayCount, fsToday: fsTodayCount, avgCompletion: avgCompletionPct,
        dailyChart: chart, adoption: adoptionObj, atRisk: atRiskList, topCities: sortedCities,
      }, 60000)

    } catch (err) {
      console.error('Analytics fetch error:', err)
      setError(isAr ? 'فشل تحميل التحليلات' : 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  useEffect(() => {
    if (!profile) return
    const channel = supabaseAdmin
      .channel(`admin-analytics-${profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'task_submissions' },        () => { invalidateCache(`admin-analytics-${profile.id}`); fetchAnalytics() })
      .on('postgres_changes', { event:'*', schema:'public', table:'food_safety_submissions' },  () => { invalidateCache(`admin-analytics-${profile.id}`); fetchAnalytics() })
      .subscribe()
    return () => supabaseAdmin.removeChannel(channel)
  }, [profile, fetchAnalytics])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  const maxDaily = Math.max(1, ...dailyChart.map(d => d.count))
  const maxCity  = Math.max(1, ...topCities.map(c => c[1]))

  if (loading) return (
    <AdminLayout currentPath="/admin/analytics" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Analytics" titleAr="التحليلات">
      <div style={{ padding:'20px 24px' }}>
        <div className="skeleton" style={{ height:420 }} />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout currentPath="/admin/analytics" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Analytics" titleAr="التحليلات" topbarRight={
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
    }>
      <div style={{ padding:'20px 24px' }}>

          <ErrorBanner message={error} isAr={isAr} />

          {/* KPI cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:20 }}>
            {[
              { label: isAr?'مهام اليوم':'Tasks Today',               value:tasksToday,            icon:'ti-checklist',    color:'#166534' },
              { label: isAr?'سلامة الغذاء اليوم':'Food Safety Today',  value:fsToday,                icon:'ti-shield-check', color:'#166534' },
              { label: isAr?'متوسط الإنجاز':'Avg Completion %',       value:`${avgCompletion}%`,   icon:'ti-chart-pie',    color:'#1B4332' },
              { label: isAr?'مطاعم معرضة للخطر':'At-Risk Restaurants', value:atRisk.length,         icon:'ti-alert-triangle', color:'#9F1239' },
            ].map(c => (
              <div key={c.label} style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:18 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:12, color:'#6B7280', fontWeight:500 }}>{c.label}</span>
                  <i className={`ti ${c.icon}`} style={{ fontSize:16, color:'#9CA3AF' }} />
                </div>
                <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Daily completion chart */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20, marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'الإنجاز اليومي (آخر 14 يوماً)' : 'Daily Completion (Last 14 Days)'}</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:140 }}>
              {dailyChart.map(d => (
                <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ width:'100%', maxWidth:24, height:`${(d.count / maxDaily) * 100}px`, background:'#1B4332', borderRadius:'4px 4px 0 0', minHeight:2 }} title={`${d.count}`} />
                  <span style={{ fontSize:9, color:'#9CA3AF' }}>{new Date(d.day).getDate()}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            {/* Feature adoption */}
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'تبني الميزات' : 'Feature Adoption'}</div>
              {[
                { label: isAr?'المهام':'Tasks',        value:adoption.tasks },
                { label: isAr?'سلامة الغذاء':'Food Safety', value:adoption.foodSafety },
                { label: isAr?'الجدول':'Schedule',     value:adoption.schedule },
              ].map(a => (
                <div key={a.label} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                    <span style={{ color:'#374151', fontWeight:600 }}>{a.label}</span>
                    <span style={{ color:'#6B7280' }}>{a.value}%</span>
                  </div>
                  <div style={{ background:'#F3F4F6', borderRadius:6, height:8, overflow:'hidden' }}>
                    <div style={{ width:`${a.value}%`, height:'100%', background:'#1B4332', borderRadius:6 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Top cities */}
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'أكثر المدن نشاطاً' : 'Most Active Cities'}</div>
              {topCities.length === 0 ? (
                <div style={{ fontSize:12, color:'#9CA3AF' }}>{isAr ? 'لا توجد بيانات مدن بعد' : 'No city data yet'}</div>
              ) : topCities.map(([city, count]) => (
                <div key={city} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                    <span style={{ color:'#374151', fontWeight:600 }}>{city}</span>
                    <span style={{ color:'#6B7280' }}>{count}</span>
                  </div>
                  <div style={{ background:'#F3F4F6', borderRadius:6, height:8, overflow:'hidden' }}>
                    <div style={{ width:`${(count / maxCity) * 100}%`, height:'100%', background:'#1D4ED8', borderRadius:6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* At-risk restaurants */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#9F1239', marginBottom:16 }}>{isAr ? `مطاعم معرضة للخطر (${atRisk.length})` : `At-Risk Restaurants (${atRisk.length})`}</div>
            {atRisk.length === 0 ? (
              <div style={{ fontSize:12, color:'#9CA3AF' }}>{isAr ? 'لا توجد مطاعم معرضة للخطر' : 'No at-risk restaurants — all branches active in the last 7 days.'}</div>
            ) : (
              atRisk.map(b => (
                <div key={b.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'0.5px solid #F3F4F6' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{isAr ? b.name_ar || b.name : b.name}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{b.owner?.name || '—'} · {b.city || '—'}</div>
                  </div>
                  {b.owner?.phone ? (
                    <a href={`tel:${b.owner.phone}`} style={{ fontSize:11, fontWeight:600, padding:'6px 14px', borderRadius:8, background:'#FEE2E2', color:'#991B1B' }}>
                      {isAr ? 'تواصل' : 'Contact'}
                    </a>
                  ) : b.owner?.email ? (
                    <a href={`mailto:${b.owner.email}`} style={{ fontSize:11, fontWeight:600, padding:'6px 14px', borderRadius:8, background:'#FEE2E2', color:'#991B1B' }}>
                      {isAr ? 'تواصل' : 'Contact'}
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
      </div>
    </AdminLayout>
  )
}
