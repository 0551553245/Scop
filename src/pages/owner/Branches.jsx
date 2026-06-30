import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { getExpectedForBranch, calcRate, calcPending } from '../../lib/stats'
import { useLanguage } from '../../context/LanguageContext'
import { useSubscription } from '../../hooks/useSubscription'
import SubscriptionGuard from '../../components/SubscriptionGuard'
import NotificationBell from '../../components/NotificationBell'
import OwnerLayout from '../../components/OwnerLayout'

function getHealthScore(taskPct, fsPct) {
  if (taskPct === null && fsPct === null) return null
  const t = taskPct ?? 50
  const f = fsPct  ?? 50
  return Math.round(t * 0.6 + f * 0.4)
}

function getStatus(score) {
  if (score === null) return 'no-data'
  if (score >= 85) return 'on-track'
  if (score >= 65) return 'attention'
  return 'risk'
}

function statusStyle(status) {
  if (status === 'on-track')  return { bg:'#F0FDF4', color:'#166534', border:'#1B4332', label:'On Track',        labelAr:'على المسار'   }
  if (status === 'attention') return { bg:'#FFFBEB', color:'#92400E', border:'#F59E0B', label:'Needs Attention', labelAr:'يحتاج اهتمام' }
  if (status === 'risk')      return { bg:'#FFF1F2', color:'#9F1239', border:'#F43F5E', label:'At Risk',         labelAr:'في خطر'       }
  return                             { bg:'#F9FAFB', color:'#6B7280', border:'#E5E7EB', label:'No Data',         labelAr:'لا بيانات'    }
}

function scoreStyle(score) {
  if (score === null)  return { bg:'#F9FAFB', color:'#9CA3AF' }
  if (score >= 85)     return { bg:'#F0FDF4', color:'#1B4332' }
  if (score >= 65)     return { bg:'#FFFBEB', color:'#F59E0B' }
  return                      { bg:'#FFF1F2', color:'#F43F5E' }
}

function barColor(pct) {
  if (pct >= 80) return '#1B4332'
  if (pct >= 60) return '#F59E0B'
  return '#F43F5E'
}

export default function OwnerBranches() {
  const { profile } = useOwnerAuth()
  const { lang, isAr, toggleLang } = useLanguage()
  const { subscription, isExpired } = useSubscription()

  // ── DATA ──────────────────────────────────────────────────
  const [branches,   setBranches]   = useState([])
  const [branchData, setBranchData] = useState({}) // { branchId: { taskPct, fsPct, done, pending, missed, managerName, managerInitials } }
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState(null)

  // ── ADD BRANCH MODAL ──────────────────────────────────────
  const [showModal,   setShowModal]   = useState(false)
  const [modalName,   setModalName]   = useState('')
  const [modalNameAr, setModalNameAr] = useState('')
  const [modalCity,   setModalCity]   = useState('')
  const [modalCityAr, setModalCityAr] = useState('')
  const [modalErr,    setModalErr]    = useState('')
  const [modalSaving, setModalSaving] = useState(false)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── FETCH ─────────────────────────────────────────────────
  const fetchBranches = useCallback(async () => {
    if (!profile) return
    setError('')

    try {
      const today = new Date().toISOString().split('T')[0]

      // Get all branches for this owner
      const { data: bData, error: bErr } = await supabaseOwner
        .from('branches')
        .select('id, name, name_ar, city, city_ar, is_active, manager_id, created_at')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false })

      if (bErr) throw bErr
      const allBranches = bData || []
      setBranches(allBranches)

      if (allBranches.length === 0) { setLoading(false); return }

      const branchIds = allBranches.map(b => b.id)

      const managerIds = allBranches.filter(b => b.manager_id).map(b => b.manager_id)

      const [taskSubsRes, fsSubsRes, mgrsRes, taskDefsRes, fsStdsRes, globalTasksRes] = await Promise.all([
        supabaseOwner.from('task_submissions').select('branch_id, status, task_id').in('branch_id', branchIds).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(2000),
        supabaseOwner.from('food_safety_submissions').select('branch_id, result').in('branch_id', branchIds).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(2000),
        managerIds.length > 0
          ? supabaseOwner.from('users').select('id, name, name_ar').in('id', managerIds)
          : Promise.resolve({ data: [] }),
        supabaseOwner.from('tasks').select('id, branch_id, frequency').in('branch_id', branchIds).eq('is_active', true).eq('frequency', 'daily'),
        supabaseOwner.from('food_safety_standards').select('id, branch_id').eq('created_by', profile.id).eq('is_active', true),
        supabaseOwner.from('tasks').select('id, branch_id, frequency').is('branch_id', null).eq('is_active', true).eq('frequency', 'daily').eq('created_by', profile.id),
      ])

      const taskSubs  = taskSubsRes.data  || []
      const fsSubs    = fsSubsRes.data    || []
      const managers  = mgrsRes.data      || []
      const taskDefs  = [...(taskDefsRes.data || []), ...(globalTasksRes.data || [])]
      const fsStds    = fsStdsRes.data    || []
      const taskDefIds = new Set(taskDefs.map(t => t.id))

      // Build per-branch data
      const dataMap = {}
      allBranches.forEach(b => {
        // Only count submissions for DAILY tasks — exclude weekly/monthly submissions from today
        const bTasks   = taskSubs.filter(s => s.branch_id === b.id && taskDefIds.has(s.task_id))
        const bFs      = fsSubs.filter(f => f.branch_id === b.id)
        const done     = bTasks.filter(t => t.status === 'completed').length
        const missed   = bTasks.filter(t => t.status === 'missed').length
        const expected = getExpectedForBranch(b.id, taskDefs)
        const pending  = calcPending(done, expected)
        const taskPct  = expected > 0 ? calcRate(done, expected) : null
        const bStds    = fsStds.filter(s => s.branch_id === b.id || s.branch_id === null)
        const fsTotal  = bStds.length
        const fsPassed = bFs.filter(f => f.result === 'pass').length
        const fsPct    = fsTotal > 0 ? calcRate(fsPassed, fsTotal) : null
        const manager  = managers.find(m => m.id === b.manager_id)
        const mgrName    = manager?.name    || null
        const mgrNameAr  = manager?.name_ar || null
        const mgrInit    = manager ? manager.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : null

        dataMap[b.id] = { taskPct, fsPct, done, pending, missed, mgrName, mgrNameAr, mgrInit }
      })
      setBranchData(dataMap)

    } catch (err) {
      console.error(err)
      setError('Failed to load branches.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchBranches() }, [fetchBranches])

  // ── REAL-TIME ─────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    const ch = supabaseOwner.channel(`branches-${profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'task_submissions' }, () => { fetchBranches() })
      .on('postgres_changes', { event:'*', schema:'public', table:'food_safety_submissions' }, () => { fetchBranches() })
      .on('postgres_changes', { event:'*', schema:'public', table:'branches' }, () => { fetchBranches() })
      .subscribe()
    return () => supabaseOwner.removeChannel(ch)
  }, [profile?.id, fetchBranches])

  // ── ADD BRANCH ────────────────────────────────────────────
  async function handleAddBranch(e) {
    e.preventDefault()
    setModalErr('')

    if (!modalName.trim()) {
      setModalErr(isAr ? 'اسم الفرع مطلوب' : 'Branch name is required.')
      return
    }

    if (subscription && branches.length >= subscription.branches_limit) {
      setModalErr(isAr
        ? `وصلت إلى الحد الأقصى (${subscription.branches_limit} فروع). قم بالترقية لإضافة المزيد.`
        : `Branch limit reached (${subscription.branches_limit} branches). Upgrade to add more.`)
      return
    }

    setModalSaving(true)
    try {
      const { error: insErr } = await supabaseOwner
        .from('branches')
        .insert({
          name:       modalName.trim(),
          name_ar:    modalNameAr.trim() || modalName.trim(),
          city:       modalCity.trim()   || null,
          city_ar:    modalCityAr.trim() || null,
          owner_id:   profile.id,
          manager_id: null,
          is_active:  true,
        })

      if (insErr) throw insErr

      setShowModal(false)
      setModalName('')
      setModalNameAr('')
      setModalCity('')
      setModalCityAr('')
      await fetchBranches()

    } catch (err) {
      console.error(err)
      setModalErr(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.')
    } finally {
      setModalSaving(false)
    }
  }

  function closeModal() {
    setShowModal(false)
    setModalName('')
    setModalNameAr('')
    setModalCity('')
    setModalCityAr('')
    setModalErr('')
  }

  const atBranchLimit = !!(subscription && branches.length >= subscription.branches_limit)

  const branchesTopbarLeft = (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{isAr ? 'الفروع' : 'Branches'}</span>
      <span style={{ fontSize:12, fontWeight:500, color:'#9CA3AF' }}>{branches.length} {isAr ? 'إجمالي' : 'total'}</span>
    </div>
  )
  const branchesTopbarRight = (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'1px solid #E5E7EB', padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
      <NotificationBell isAr={isAr} />
      <SubscriptionGuard isExpired={isExpired} isAr={isAr}>
        <button onClick={() => setShowModal(true)} disabled={atBranchLimit}
          aria-label={isAr ? 'إضافة فرع' : 'Add branch'}
          title={atBranchLimit ? (isAr ? `وصلت إلى الحد الأقصى (${subscription.branches_limit} فروع)` : `Branch limit reached (${subscription.branches_limit} branches)`) : undefined}
          style={{ background: atBranchLimit ? '#9CA3AF' : '#1B4332', color:'#fff', border:'none', padding: isMobile ? '8px' : '8px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor: atBranchLimit ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'inherit', minWidth: isMobile ? 44 : 'auto', minHeight: isMobile ? 44 : 'auto' }}>
          {isMobile ? '+' : (isAr ? '+ إضافة فرع' : '+ Add Branch')}
        </button>
      </SubscriptionGuard>
    </div>
  )

  // Sort branches: risk first, then attention, then on-track
  const sortedBranches = [...branches].sort((a, b) => {
    const statusOrder = { risk: 0, attention: 1, 'on-track': 2, 'no-data': 3 }
    const dA = branchData[a.id]
    const dB = branchData[b.id]
    const sA = getStatus(getHealthScore(dA?.taskPct ?? null, dA?.fsPct ?? null))
    const sB = getStatus(getHealthScore(dB?.taskPct ?? null, dB?.fsPct ?? null))
    return statusOrder[sA] - statusOrder[sB]
  })

  // Find branches needing attention
  const atRisk = sortedBranches.filter(b => {
    const d = branchData[b.id]
    return getStatus(getHealthScore(d?.taskPct ?? null, d?.fsPct ?? null)) === 'risk'
  })

  const inputStyle = {
    width:'100%', padding:'9px 12px', fontSize:13,
    border:'1px solid #E5E7EB', borderRadius:8, outline:'none',
    color:'#111827', fontFamily:'inherit', background:'#fff',
    boxSizing:'border-box', transition:'border-color 0.15s',
  }

  if (loading) return (
    <OwnerLayout activePath="/owner/branches" title="Branches" titleAr="الفروع"
      topbarLeft={branchesTopbarLeft} topbarRight={branchesTopbarRight}>
      <div style={{ padding:'20px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
          {['a','b','c','d'].map(k => <div key={k} className="skeleton" style={{ height:180 }} />)}
        </div>
      </div>
    </OwnerLayout>
  )

  return (
    <OwnerLayout activePath="/owner/branches" title="Branches" titleAr="الفروع"
      topbarLeft={branchesTopbarLeft} topbarRight={branchesTopbarRight}>
      <div style={{ padding:'20px 24px' }}>

          {/* Error */}
          {error && (
            <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#9F1239', fontSize:13 }}>{error}</div>
          )}

          {/* Alert banner — branches at risk */}
          {atRisk.length > 0 && (
            <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:14, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
              onClick={() => setExpanded(atRisk[0].id)}>
              <div style={{ width:36, height:36, background:'#F43F5E', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>⚠️</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#9F1239' }}>
                  {isAr ? `${isAr ? branchData[atRisk[0].id]?.name_ar || atRisk[0].name_ar : atRisk[0].name} يحتاج اهتماماً فورياً` : `${atRisk[0].name} needs immediate attention`}
                </div>
                <div style={{ fontSize:12, color:'#FB7185', marginTop:2 }}>
                  {isAr ? 'إكمال المهام منخفض · سلامة الغذاء في خطر' : 'Low task completion · Food safety at risk'}
                </div>
              </div>
              <div style={{ fontSize:12, fontWeight:600, color:'#F43F5E', whiteSpace:'nowrap' }}>{isAr ? 'عرض الفرع →' : 'View branch →'}</div>
            </div>
          )}

          {/* Empty state */}
          {branches.length === 0 ? (
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:48, textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:14 }}>🏪</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#111827', marginBottom:6 }}>{isAr ? 'لا توجد فروع بعد' : 'No branches yet'}</div>
              <div style={{ fontSize:13, color:'#6B7280', marginBottom:24 }}>{isAr ? 'أضف فرعك الأول لتبدأ' : 'Add your first branch to get started'}</div>
              <SubscriptionGuard isExpired={isExpired} isAr={isAr}>
                <button onClick={() => setShowModal(true)} style={{ padding:'10px 28px', background:'#1B4332', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  + {isAr ? 'إضافة فرع' : 'Add Branch'}
                </button>
              </SubscriptionGuard>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {sortedBranches.map(branch => {
                const d      = branchData[branch.id] || {}
                const score  = getHealthScore(d.taskPct ?? null, d.fsPct ?? null)
                const status = getStatus(score)
                const ss     = statusStyle(status)
                const sc     = scoreStyle(score)
                const isExp  = expanded === branch.id
                const bName  = isAr ? branch.name_ar || branch.name : branch.name
                const bCity  = isAr ? branch.city_ar || branch.city : branch.city

                return (
                  <div key={branch.id}
                    style={{ background:'#fff', border:`1px solid ${isExp ? '#D1FAE5' : '#E5E7EB'}`, borderRadius:18, overflow:'hidden', cursor:'pointer', transition:'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(27,67,50,0.08)'; e.currentTarget.style.transform='translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='translateY(0)' }}
                  >
                    {/* Card top */}
                    <div
                      style={{ padding:'18px 20px', borderLeft: isAr ? 'none' : `4px solid ${ss.border}`, borderRight: isAr ? `4px solid ${ss.border}` : 'none' }}
                      onClick={() => setExpanded(isExp ? null : branch.id)}
                    >
                      {/* Row 1 — name + status */}
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                        <div>
                          <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{bName}</div>
                          {bCity && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:3, display:'flex', alignItems:'center', gap:3 }}>📍 {bCity}</div>}
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:20, background:ss.bg, color:ss.color, flexShrink:0 }}>
                          {isAr ? ss.labelAr : ss.label}
                        </div>
                      </div>

                      {/* Health score + bars */}
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:52, height:52, borderRadius:14, background:sc.bg, flexShrink:0 }}>
                          <div style={{ fontSize:17, fontWeight:800, lineHeight:1, color:sc.color }}>{score ?? '—'}</div>
                          <div style={{ fontSize:9, fontWeight:600, marginTop:2, textTransform:'uppercase', letterSpacing:'0.3px', color:sc.color }}>{isAr ? 'نقاط' : 'Score'}</div>
                        </div>
                        <div style={{ flex:1 }}>
                          {[
                            { label: isAr ? 'المهام' : 'Tasks',       pct: d.taskPct },
                            { label: isAr ? 'سلامة الغذاء' : 'Food safety', pct: d.fsPct  },
                          ].map((row, i) => (
                            <div key={['tasks','fs'][i]} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: i === 0 ? 5 : 0 }}>
                              <div style={{ fontSize:11, color:'#6B7280', width:70, flexShrink:0 }}>{row.label}</div>
                              <div style={{ flex:1, height:5, background:'#F3F4F6', borderRadius:20, overflow:'hidden', margin:'0 8px' }}>
                                <div style={{ height:'100%', width:`${row.pct ?? 0}%`, background: row.pct !== null ? barColor(row.pct) : '#E5E7EB', borderRadius:20, transition:'width 0.5s ease' }} />
                              </div>
                              <div style={{ fontSize:11, fontWeight:700, width:28, textAlign:'right', color: row.pct !== null ? barColor(row.pct) : '#9CA3AF' }}>
                                {row.pct !== null ? `${row.pct}%` : '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Manager row */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 20px', borderTop:'1px solid #F9FAFB' }}
                      onClick={() => setExpanded(isExp ? null : branch.id)}>
                      {d.mgrName ? (
                        <>
                          <div style={{ width:24, height:24, borderRadius:'50%', background:'#1B4332', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff', flexShrink:0 }}>
                            {d.mgrInit}
                          </div>
                          <div style={{ fontSize:12, fontWeight:500, color:'#374151', flex:1 }}>{isAr ? d.mgrNameAr || d.mgrName : d.mgrName}</div>
                          <div style={{ fontSize:10, color:'#9CA3AF', background:'#F3F4F6', padding:'2px 7px', borderRadius:20 }}>
                            {isAr ? 'مدير الفرع' : 'Branch Manager'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize:11, color:'#F43F5E', display:'flex', alignItems:'center', gap:4, flex:1 }}>⚠ {isAr ? 'لم يُعيَّن مدير' : 'No manager assigned'}</div>
                          <Link to="/owner/managers" style={{ fontSize:10, fontWeight:600, color:'#F43F5E', background:'#FFF1F2', padding:'2px 7px', borderRadius:20, textDecoration:'none' }}>
                            {isAr ? 'تعيين الآن' : 'Assign now'}
                          </Link>
                        </>
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExp && (
                      <div style={{ padding:'0 20px 16px', borderTop:'1px solid #F3F4F6' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:12 }}>
                          {[
                            { num: d.done    ?? 0, label: isAr ? 'مكتمل'  : 'Completed', color:'#1B4332' },
                            { num: d.pending ?? 0, label: isAr ? 'معلق'   : 'Pending',   color:'#F59E0B' },
                            { num: d.missed  ?? 0, label: isAr ? 'فائت'   : 'Missed',    color: d.missed > 0 ? '#F43F5E' : '#9CA3AF' },
                          ].map((s, i) => (
                            <div key={['done','pending','missed'][i]} style={{ background:'#F9FAFB', borderRadius:10, padding:10, textAlign:'center' }}>
                              <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.num}</div>
                              <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2 }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:8, marginTop:12 }}>
                          {!d.mgrName && (
                            <Link to="/owner/managers" style={{ flex:1, padding:8, borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', textAlign:'center', background:'#1B4332', color:'#fff', textDecoration:'none', border:'none' }}>
                              {isAr ? 'تعيين مدير' : 'Assign Manager'}
                            </Link>
                          )}
                          <Link to="/owner/tasks" style={{ flex:1, padding:8, borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', textAlign:'center', background: d.mgrName ? '#1B4332' : '#fff', color: d.mgrName ? '#fff' : '#374151', textDecoration:'none', border:'1px solid #E5E7EB' }}>
                            {isAr ? 'المهام' : 'View Tasks'}
                          </Link>
                          <Link to="/owner/food-safety" style={{ flex:1, padding:8, borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', textAlign:'center', background:'#fff', color:'#374151', textDecoration:'none', border:'1px solid #E5E7EB' }}>
                            {isAr ? 'سلامة الغذاء' : 'Food Safety'}
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      {/* ── ADD BRANCH MODAL ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, width:'100%', maxWidth:480, boxShadow:'0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#111827' }}>{isAr ? 'إضافة فرع جديد' : 'Add New Branch'}</div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{isAr ? 'أدخل بيانات الفرع' : 'Enter branch details'}</div>
              </div>
              <button onClick={closeModal} style={{ background:'none', border:'none', fontSize:18, color:'#9CA3AF', cursor:'pointer', padding:4 }}>✕</button>
            </div>

            {modalErr && (
              <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#9F1239' }}>{modalErr}</div>
            )}

            <form onSubmit={handleAddBranch} noValidate>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    {isAr ? 'اسم الفرع (EN) *' : 'Branch Name (EN) *'}
                  </label>
                  <input type="text" value={modalName} onChange={e => { setModalName(e.target.value); setModalErr('') }}
                    placeholder="Al Nakheel Branch" style={inputStyle}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    {isAr ? 'اسم الفرع (AR)' : 'Branch Name (AR)'}
                  </label>
                  <input type="text" value={modalNameAr} onChange={e => setModalNameAr(e.target.value)}
                    placeholder="فرع النخيل" style={{ ...inputStyle, direction:'rtl' }}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    {isAr ? 'المدينة (EN)' : 'City (EN)'}
                  </label>
                  <input type="text" value={modalCity} onChange={e => setModalCity(e.target.value)}
                    placeholder="Riyadh" style={inputStyle}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    {isAr ? 'المدينة (AR)' : 'City (AR)'}
                  </label>
                  <input type="text" value={modalCityAr} onChange={e => setModalCityAr(e.target.value)}
                    placeholder="الرياض" style={{ ...inputStyle, direction:'rtl' }}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={closeModal}
                  style={{ flex:1, padding:'10px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', background:'#F9FAFB', color:'#374151', border:'1px solid #E5E7EB', fontFamily:'inherit' }}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" disabled={modalSaving}
                  style={{ flex:2, padding:'10px', borderRadius:10, fontSize:13, fontWeight:600, cursor: modalSaving ? 'not-allowed' : 'pointer', background: modalSaving ? '#6B9E83' : '#1B4332', color:'#fff', border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {modalSaving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                  {modalSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إضافة الفرع' : 'Add Branch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </OwnerLayout>
  )
}
