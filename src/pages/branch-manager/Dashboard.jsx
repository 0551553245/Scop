import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseBranchManager } from '../../lib/supabase'
import { useBranchManagerAuth } from '../../context/BranchManagerAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getCached, setCached, invalidateCache, debounce } from '../../lib/cache'
import { calcRate } from '../../lib/stats'
import { getWeekStartStr } from '../../lib/weekUtils'
import BMLayout from '../../components/BMLayout'

export default function BranchManagerDashboard() {
  const navigate = useNavigate()
  const { profile, ownerHasAccess } = useBranchManagerAuth()
  const { isAr } = useLanguage()

  const [branch,    setBranch]    = useState(null)
  const [stats,     setStats]     = useState(null)
  const [nextEvent, setNextEvent] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [isMobile,  setIsMobile]  = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const fetchDashboard = useCallback(async () => {
    if (!profile?.branch_id) return
    setError('')

    const today    = new Date().toISOString().split('T')[0]
    const cacheKey = `bm-dashboard-${profile.branch_id}-${today}`
    const cached   = getCached(cacheKey)
    if (cached) {
      setBranch(cached.branch)
      setStats(cached.stats)
      setNextEvent(cached.nextEvent)
      setLoading(false)
    }

    try {
      const branchId   = profile.branch_id
      const weekStart  = getWeekStartStr()
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

      const branchRes = await supabaseBranchManager.from('branches').select('id, name, name_ar, owner_id').eq('id', branchId).single()
      const ownerId   = branchRes.data?.owner_id

      const [
        taskRes,
        todaySubRes,
        weekSubRes,
        monthSubRes,
        fsStdRes,
        fsSubRes,
        eventRes,
      ] = await Promise.all([
        supabaseBranchManager.from('tasks').select('id, frequency, branch_id').eq('is_active', true).or(`branch_id.eq.${branchId},and(branch_id.is.null,created_by.eq.${ownerId})`).limit(1000),
        supabaseBranchManager.from('task_submissions').select('id, task_id, status').eq('branch_id', branchId).gte('submitted_at', today+'T00:00:00.000Z').lte('submitted_at', today+'T23:59:59.999Z').limit(1000),
        supabaseBranchManager.from('task_submissions').select('id, task_id, status').eq('branch_id', branchId).gte('submitted_at', weekStart+'T00:00:00.000Z').lte('submitted_at', today+'T23:59:59.999Z').limit(1000),
        supabaseBranchManager.from('task_submissions').select('id, task_id, status').eq('branch_id', branchId).gte('submitted_at', monthStart+'T00:00:00.000Z').lte('submitted_at', today+'T23:59:59.999Z').limit(1000),
        supabaseBranchManager.from('food_safety_standards').select('id').eq('is_active', true).or(`branch_id.eq.${branchId},and(branch_id.is.null,created_by.eq.${ownerId})`),
        supabaseBranchManager.from('food_safety_submissions').select('id, result').eq('branch_id', branchId).gte('submitted_at', today+'T00:00:00.000Z').lte('submitted_at', today+'T23:59:59.999Z').limit(1000),
        supabaseBranchManager.from('schedule_events').select('id, title, title_ar, event_date, start_time, category').or(`branch_id.eq.${branchId},branch_id.is.null`).eq('is_private', false).gte('event_date', today).order('event_date', { ascending:true }).order('start_time', { ascending:true }).limit(1),
      ])

      const branchData = branchRes.data
      setBranch(branchData)

      const allTasks     = taskRes.data || []
      const dailyTasks   = allTasks.filter(t => t.frequency === 'daily')
      const weeklyTasks  = allTasks.filter(t => t.frequency === 'weekly')
      const monthlyTasks = allTasks.filter(t => t.frequency === 'monthly')

      const dailyIds   = new Set(dailyTasks.map(t => t.id))
      const weeklyIds  = new Set(weeklyTasks.map(t => t.id))
      const monthlyIds = new Set(monthlyTasks.map(t => t.id))

      const todaySubs  = todaySubRes.data || []
      const todayDone  = todaySubs.filter(s => s.status === 'completed' && dailyIds.has(s.task_id)).length
      const todayTotal = dailyTasks.length
      const todayPct   = calcRate(todayDone, todayTotal)

      const weekSubs  = weekSubRes.data || []
      const weekDone  = weekSubs.filter(s => s.status === 'completed' && weeklyIds.has(s.task_id)).length
      const weekTotal = weeklyTasks.length
      const weekPct   = calcRate(weekDone, weekTotal)

      const monthSubs  = monthSubRes.data || []
      const monthDone  = monthSubs.filter(s => s.status === 'completed' && monthlyIds.has(s.task_id)).length
      const monthTotal = monthlyTasks.length
      const monthPct   = calcRate(monthDone, monthTotal)

      const fsStds    = fsStdRes.data || []
      const fsSubs    = fsSubRes.data || []
      const fsPassed  = fsSubs.filter(s => s.result === 'pass').length
      const fsFailed  = fsSubs.filter(s => s.result === 'fail').length
      const fsPending = Math.max(0, fsStds.length - fsPassed - fsFailed)
      const fsScore   = calcRate(fsPassed, fsStds.length)

      const nextEventData = eventRes.data?.[0] || null

      const computed = { todayDone, todayTotal, todayPct, weekDone, weekTotal, weekPct, monthDone, monthTotal, monthPct, fsPassed, fsFailed, fsPending, fsScore }
      setStats(computed)
      setNextEvent(nextEventData)

      setCached(cacheKey, { branch: branchData, stats: computed, nextEvent: nextEventData })

    } catch (err) {
      console.error('BM Dashboard fetch error:', err)
      if (!cached) setError('Failed to load dashboard.')
    } finally {
      if (!cached) setLoading(false)
    }
  }, [profile?.id, profile?.branch_id])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  useEffect(() => {
    if (!profile?.branch_id) return
    const today    = new Date().toISOString().split('T')[0]
    const cacheKey = `bm-dashboard-${profile.branch_id}-${today}`
    const debouncedFetch = debounce(() => { invalidateCache(cacheKey); fetchDashboard() }, 300)
    const ch = supabaseBranchManager
      .channel(`bm-dashboard-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'task_submissions',
        filter: `branch_id=eq.${profile.branch_id}`,
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'food_safety_submissions',
        filter: `branch_id=eq.${profile.branch_id}`,
      }, debouncedFetch)
      .on('system', {}, (status) => {
        if (status === 'CLOSED') debouncedFetch()
      })
      .subscribe()
    return () => { debouncedFetch.cancel(); supabaseBranchManager.removeChannel(ch) }
  }, [profile?.id, profile?.branch_id, fetchDashboard])

  const branchName = isAr ? branch?.name_ar || branch?.name : branch?.name || '—'
  const {
    todayDone=0, todayTotal=0, todayPct=0,
    weekDone=0,  weekTotal=0,  weekPct=0,
    monthDone=0, monthTotal=0, monthPct=0,
    fsPassed=0,  fsFailed=0,   fsPending=0, fsScore=0,
  } = stats || {}

  if (loading) return (
    <BMLayout activePath="/branch-manager/dashboard" title="Dashboard" titleAr="لوحة التحكم" branchName={branchName}>
      <div style={{ padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:12, marginBottom:12 }}>
          {['a','b','c'].map(k => <div key={k} className="skeleton" style={{ height:168 }} />)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {['d','e'].map(k => <div key={k} className="skeleton" style={{ height:180 }} />)}
        </div>
      </div>
    </BMLayout>
  )

  return (
    <BMLayout activePath="/branch-manager/dashboard" title="Dashboard" titleAr="لوحة التحكم" branchName={branchName}>
      <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>

        {error && (
          <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:10, padding:'10px 14px', color:'#9F1239', fontSize:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <span>{error}</span>
            <button onClick={fetchDashboard} style={{ background:'none', border:'1px solid #FECDD3', borderRadius:8, padding:'3px 8px', color:'#9F1239', fontSize:11, cursor:'pointer', flexShrink:0 }}>{isAr?'إعادة':'Retry'}</button>
          </div>
        )}

        {!ownerHasAccess && (
          <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:10, padding:'10px 14px', color:'#9F1239', fontSize:12, fontWeight:500 }}>
            {isAr ? 'انتهى اشتراك المطعم. لا يمكن إرسال المهام حتى يتم تجديد الاشتراك.' : "This restaurant's subscription has expired. Tasks cannot be submitted until it is renewed."}
          </div>
        )}

        {/* THREE PERIOD CARDS */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:12 }}>

          {/* TODAY — dark green */}
          <div style={{ background:'#1B4332', borderRadius:12, padding:'18px 16px' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>
              {isAr ? 'اليوم' : 'Today'}
            </div>
            <div style={{ fontSize:36, fontWeight:500, color: todayPct===100?'#4ADE80':todayPct>=60?'#FCD34D':'#FCA5A5', lineHeight:1, marginBottom:4 }}>
              {todayPct}%
            </div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginBottom:14 }}>
              {todayDone} {isAr ? 'من' : 'of'} {todayTotal} {isAr ? 'مهمة' : 'tasks done'}
            </div>
            <div style={{ height:5, background:'rgba(255,255,255,0.15)', borderRadius:20, overflow:'hidden', marginBottom:10 }}>
              <div style={{ height:'100%', width:todayPct+'%', background: todayPct===100?'#4ADE80':todayPct>=60?'#FCD34D':'#FCA5A5', borderRadius:20, transition:'width 0.4s' }}/>
            </div>
            <div
              onClick={() => navigate('/branch-manager/daily-tasks')}
              style={{ textAlign:'center', padding:8, background:'rgba(255,255,255,0.1)', borderRadius:8, fontSize:12, fontWeight:500, color:'#fff', cursor:'pointer' }}
            >
              {isAr ? '← المهام اليومية' : 'Go to daily tasks →'}
            </div>
          </div>

          {/* THIS WEEK */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:'18px 16px' }}>
            <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>
              {isAr ? 'هذا الأسبوع' : 'This week'}
            </div>
            <div style={{ fontSize:36, fontWeight:500, color: weekTotal===0?'#9CA3AF':weekPct===100?'#166534':weekPct>=60?'#D97706':'#DC2626', lineHeight:1, marginBottom:4 }}>
              {weekTotal === 0 ? '—' : weekPct+'%'}
            </div>
            <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:14 }}>
              {weekTotal === 0
                ? (isAr ? 'لا توجد مهام أسبوعية' : 'No weekly tasks')
                : `${weekDone} ${isAr?'من':'of'} ${weekTotal} ${isAr?'مهمة':'tasks done'}`}
            </div>
            <div style={{ height:5, background:'#F3F4F6', borderRadius:20, overflow:'hidden', marginBottom:10 }}>
              <div style={{ height:'100%', width:weekPct+'%', background: weekPct===100?'#1B4332':'#F59E0B', borderRadius:20 }}/>
            </div>
            <div
              onClick={() => navigate('/branch-manager/weekly-tasks')}
              style={{ textAlign:'center', padding:8, background:'#FEF3C7', borderRadius:8, fontSize:12, fontWeight:500, color:'#D97706', cursor:'pointer' }}
            >
              {weekTotal === 0
                ? (isAr?'لا توجد مهام':'No tasks')
                : (isAr ? `${Math.max(0,weekTotal-weekDone)} متبقي ←` : `${Math.max(0,weekTotal-weekDone)} remaining →`)}
            </div>
          </div>

          {/* THIS MONTH */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:'18px 16px' }}>
            <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>
              {isAr ? 'هذا الشهر' : 'This month'}
            </div>
            <div style={{ fontSize:36, fontWeight:500, color: monthTotal===0?'#9CA3AF':monthPct===100?'#166534':monthPct>=60?'#D97706':'#DC2626', lineHeight:1, marginBottom:4 }}>
              {monthTotal === 0 ? '—' : monthPct+'%'}
            </div>
            <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:14 }}>
              {monthTotal === 0
                ? (isAr ? 'لا توجد مهام شهرية' : 'No monthly tasks')
                : `${monthDone} ${isAr?'من':'of'} ${monthTotal} ${isAr?'مهمة':'tasks done'}`}
            </div>
            <div style={{ height:5, background:'#F3F4F6', borderRadius:20, overflow:'hidden', marginBottom:10 }}>
              <div style={{ height:'100%', width:monthPct+'%', background: monthPct===100?'#1B4332':'#F59E0B', borderRadius:20 }}/>
            </div>
            <div
              onClick={() => navigate('/branch-manager/monthly-tasks')}
              style={{ textAlign:'center', padding:8, background:'#F0FDF4', borderRadius:8, fontSize:12, fontWeight:500, color:'#1B4332', cursor:'pointer' }}
            >
              {monthTotal === 0
                ? (isAr?'لا توجد مهام':'No tasks')
                : (isAr ? `${Math.max(0,monthTotal-monthDone)} متبقي ←` : `${Math.max(0,monthTotal-monthDone)} remaining →`)}
            </div>
          </div>

        </div>

        {/* FOOD SAFETY + NEXT EVENT */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

          {/* Food Safety */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>
                {isAr ? 'سلامة الغذاء اليوم' : 'Food safety today'}
              </div>
              <span style={{ fontSize:11, fontWeight:500, background: fsScore===100?'#F0FDF4':fsScore>=50?'#FFFBEB':'#FFF1F2', color: fsScore===100?'#166534':fsScore>=50?'#92400E':'#9F1239', padding:'3px 10px', borderRadius:20 }}>
                {fsScore}% {isAr ? 'نجاح' : 'pass'}
              </span>
            </div>
            <div style={{ padding:'16px 16px 12px', display:'flex', gap:8 }}>
              <div style={{ flex:1, textAlign:'center', background:'#DCFCE7', borderRadius:10, padding:'12px 8px' }}>
                <div style={{ fontSize:22, fontWeight:500, color:'#166534' }}>{fsPassed}</div>
                <div style={{ fontSize:10, color:'#166534', marginTop:2 }}>{isAr?'نجح':'Passed'}</div>
              </div>
              <div style={{ flex:1, textAlign:'center', background:'#FEF3C7', borderRadius:10, padding:'12px 8px' }}>
                <div style={{ fontSize:22, fontWeight:500, color:'#D97706' }}>{fsPending}</div>
                <div style={{ fontSize:10, color:'#D97706', marginTop:2 }}>{isAr?'معلق':'Pending'}</div>
              </div>
              <div style={{ flex:1, textAlign:'center', background: fsFailed>0?'#FEE2E2':'#F3F4F6', borderRadius:10, padding:'12px 8px' }}>
                <div style={{ fontSize:22, fontWeight:500, color: fsFailed>0?'#DC2626':'#6B7280' }}>{fsFailed}</div>
                <div style={{ fontSize:10, color: fsFailed>0?'#DC2626':'#6B7280', marginTop:2 }}>{isAr?'فشل':'Failed'}</div>
              </div>
            </div>
            {fsPending > 0 && (
              <div style={{ padding:'0 16px 14px' }}>
                <div
                  onClick={() => navigate('/branch-manager/food-safety')}
                  style={{ textAlign:'center', padding:8, background:'#F0FDF4', borderRadius:8, fontSize:12, fontWeight:500, color:'#1B4332', cursor:'pointer' }}
                >
                  {isAr ? '← إرسال القراءة المعلقة' : 'Submit pending reading →'}
                </div>
              </div>
            )}
          </div>

          {/* Next Event */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #E5E7EB' }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>
                {isAr ? 'الحدث القادم' : 'Next event'}
              </div>
            </div>
            {nextEvent ? (
              <div style={{ padding:16 }}>
                <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:14 }}>
                  <div style={{ background:'#1B4332', borderRadius:10, padding:'10px 14px', textAlign:'center', flexShrink:0 }}>
                    <div style={{ fontSize:22, fontWeight:500, color:'#fff', lineHeight:1 }}>
                      {new Date(nextEvent.event_date).getDate()}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:2 }}>
                      {new Date(nextEvent.event_date).toLocaleDateString(isAr?'ar-SA':'en-US',{month:'short'})}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:3 }}>
                      {nextEvent.start_time?.slice(0,5)}
                    </div>
                    <div style={{ fontSize:14, fontWeight:500, color:'#111827' }}>
                      {isAr ? nextEvent.title_ar || nextEvent.title : nextEvent.title}
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => navigate('/branch-manager/schedule')}
                  style={{ background:'#F0FDF4', borderRadius:8, padding:'8px 12px', textAlign:'center', fontSize:12, fontWeight:500, color:'#1B4332', cursor:'pointer' }}
                >
                  {isAr ? '← عرض الجدول' : 'View schedule →'}
                </div>
              </div>
            ) : (
              <div style={{ padding:24, textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>📅</div>
                <div style={{ fontSize:13, color:'#9CA3AF' }}>
                  {isAr ? 'لا توجد أحداث قادمة' : 'No upcoming events'}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </BMLayout>
  )
}
