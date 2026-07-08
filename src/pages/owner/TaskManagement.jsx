import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { supabaseOwner } from '../../lib/supabase'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { getCached, setCached, invalidateCache } from '../../lib/cache'
import { useLanguage } from '../../context/LanguageContext'
import { useSubscription } from '../../hooks/useSubscription'
import { calcRate } from '../../lib/stats'
import { useSignedUrl } from '../../hooks/useSignedUrl'
import SubscriptionGuard from '../../components/SubscriptionGuard'
import OwnerLayout from '../../components/OwnerLayout'
import ErrorBanner from '../../components/ErrorBanner'

const isFullUrl = (val) => val && (val.startsWith('http://') || val.startsWith('https://'))

function SubmissionPhotoThumb({ photoUrl, onOpen }) {
  const legacy    = isFullUrl(photoUrl)
  const signedUrl = useSignedUrl(legacy ? null : photoUrl, supabaseOwner)
  const src       = legacy ? photoUrl : signedUrl

  if (!src) return <div style={{ width:80, height:80, borderRadius:10, background:'#F3F4F6' }} />

  return (
    <img
      src={src}
      loading="lazy"
      onClick={() => onOpen(src)}
      style={{ width:80, height:80, borderRadius:10, objectFit:'cover', cursor:'pointer', border:'1px solid #E5E7EB', display:'block' }}
    />
  )
}

const TEMPLATES = [
  { icon:'🌅', name:'Opening Checklist',  nameAr:'قائمة الافتتاح',    freq:'daily',   category:'opening'     },
  { icon:'🌙', name:'Closing Checklist',  nameAr:'قائمة الإغلاق',     freq:'daily',   category:'closing'     },
  { icon:'🛡', name:'Food Storage Check', nameAr:'فحص تخزين الطعام',  freq:'daily',   category:'safety'      },
  { icon:'🧹', name:'Deep Cleaning',      nameAr:'تنظيف عميق',        freq:'weekly',  category:'cleaning'    },
  { icon:'🔧', name:'Maintenance Check',  nameAr:'فحص الصيانة',       freq:'monthly', category:'maintenance' },
  { icon:'✏️', name:'',                   nameAr:'',                   freq:'daily',   category:'custom'      },
]

const FREQ_COLORS = {
  daily:   { bg:'#EFF6FF', color:'#1D4ED8', label:'Daily',   labelAr:'يومي'   },
  weekly:  { bg:'#F5F3FF', color:'#6D28D9', label:'Weekly',  labelAr:'أسبوعي' },
  monthly: { bg:'#FFF7ED', color:'#C2410C', label:'Monthly', labelAr:'شهري'   },
}

const CATEGORY_ORDER = ['opening', 'food_safety', 'cleaning', 'maintenance', 'closing', 'custom']
const CAT_META = {
  opening:     { emoji:'🌅', label:'Opening',     labelAr:'الفتح',        bg:'#EFF6FF', color:'#1D4ED8' },
  food_safety: { emoji:'🌡', label:'Food Safety', labelAr:'سلامة الغذاء', bg:'#FFF7ED', color:'#C2410C' },
  cleaning:    { emoji:'🧹', label:'Cleaning',    labelAr:'التنظيف',      bg:'#FDF2F8', color:'#9D174D' },
  maintenance: { emoji:'🔧', label:'Maintenance', labelAr:'الصيانة',      bg:'#F5F3FF', color:'#6D28D9' },
  closing:     { emoji:'🌙', label:'Closing',     labelAr:'الإغلاق',      bg:'#ECFDF5', color:'#065F46' },
  custom:      { emoji:'⚡', label:'Custom',      labelAr:'مخصص',         bg:'#F3F4F6', color:'#6B7280' },
}

export default function OwnerTaskManagement() {
  const { profile } = useOwnerAuth()
  const { isAr } = useLanguage()
  const { isExpired }        = useSubscription()

  // ── DATA ──────────────────────────────────────────────────
  const [tasks,         setTasks]         = useState([])
  const [taskSubMap,    setTaskSubMap]     = useState({})
  const [branches,      setBranches]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [activeFreq,    setActiveFreq]    = useState('daily')
  const [selectedCell,  setSelectedCell]  = useState(null)
  const [lightboxUrl,   setLightboxUrl]   = useState(null)
  const [expandedPhotos,setExpandedPhotos]= useState({})

  const isMobile = useIsMobile()
  const [showMobileForm, setShowMobileForm] = useState(false)

  // ── CREATE FORM ───────────────────────────────────────────
  const [tplIdx,       setTplIdx]       = useState(null)
  const [taskName,     setTaskName]     = useState('')
  const [taskNameAr,   setTaskNameAr]   = useState('')
  const [taskFreq,     setTaskFreq]     = useState('daily')
  const [taskBranches, setTaskBranches] = useState([])
  const [reqPhoto,     setReqPhoto]     = useState(false)
  const [reqNote,      setReqNote]      = useState(false)
  const [reqValue,     setReqValue]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveErr,      setSaveErr]      = useState('')
  const [saveOk,       setSaveOk]       = useState('')

  // ── FETCH ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!profile) return
    setError('')

    const today    = new Date().toISOString().split('T')[0]
    const cacheKey = `owner-tasks-${profile.id}-${today}`
    const cached   = getCached(cacheKey)
    if (cached) {
      setBranches(cached.branches)
      setTasks(cached.tasks)
      setTaskSubMap(cached.subMap)
      setLoading(false)
    }

    try {
      const bRes = await supabaseOwner
        .from('branches')
        .select('id, name, name_ar')
        .eq('owner_id', profile.id)
        .eq('is_active', true)
      if (bRes.error) throw bRes.error

      const branchList = bRes.data || []
      const branchIds  = branchList.map(b => b.id)
      setBranches(branchList)

      if (branchIds.length === 0) {
        setTasks([])
        setTaskSubMap({})
        setLoading(false)
        return
      }

      const [tRes, subRes, globalTasksRes] = await Promise.all([
        supabaseOwner
          .from('tasks')
          .select('id, name, name_ar, frequency, branch_id, category, requires_photo, requires_note, requires_value, is_active, created_at')
          .eq('is_active', true)
          .in('branch_id', branchIds)
          .order('created_at', { ascending: false })
          .limit(500),
        supabaseOwner
          .from('task_submissions')
          .select('id, task_id, branch_id, status, note, photo_url, value_entered, submitted_at, submitted_by, users(name, name_ar)')
          .in('branch_id', branchIds)
          .gte('submitted_at', today + 'T00:00:00.000Z')
          .lte('submitted_at', today + 'T23:59:59.999Z')
          .limit(2000),
        supabaseOwner
          .from('tasks')
          .select('id, name, name_ar, frequency, branch_id, category, requires_photo, requires_note, requires_value, is_active, created_at')
          .is('branch_id', null)
          .eq('is_active', true)
          .eq('created_by', profile.id)
          .order('created_at', { ascending: false })
          .limit(500),
      ])
      if (tRes.error)           throw tRes.error
      if (subRes.error)         throw subRes.error
      if (globalTasksRes.error) throw globalTasksRes.error

      const taskList = [...(tRes.data || []), ...(globalTasksRes.data || [])]
      const subList  = subRes.data || []

      const subMap = {}
      subList.forEach(s => {
        if (!subMap[s.task_id]) subMap[s.task_id] = []
        subMap[s.task_id].push(s)
      })

      setTasks(taskList)
      setTaskSubMap(subMap)
      setCached(cacheKey, { branches: branchList, tasks: taskList, subMap })
    } catch (err) {
      console.error('TaskManagement fetch error:', err)
      setError(isAr ? 'فشل تحميل المهام' : 'Failed to load tasks.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!profile?.id) return
    const ch = supabaseOwner
      .channel(`owner-tasks-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_submissions' }, () => {
        const today = new Date().toISOString().split('T')[0]
        invalidateCache(`owner-tasks-${profile.id}-${today}`)
        fetchData()
      })
      .subscribe()
    return () => supabaseOwner.removeChannel(ch)
  }, [profile?.id, fetchData])

  // ── PICK TEMPLATE ─────────────────────────────────────────
  function pickTemplate(idx) {
    setTplIdx(idx)
    const tpl = TEMPLATES[idx]
    setTaskName(tpl.name)
    setTaskNameAr(tpl.nameAr)
    setTaskFreq(tpl.freq || 'daily')
    setSaveErr('')
    setSaveOk('')
  }

  // ── TOGGLE BRANCH ─────────────────────────────────────────
  function toggleBranch(id) {
    setTaskBranches(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  // ── SAVE TASK ─────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault()
    setSaveErr('')
    setSaveOk('')

    if (!taskName.trim()) {
      setSaveErr(isAr ? 'اسم المهمة مطلوب' : 'Task name is required.')
      return
    }

    setSaving(true)
    try {
      const targets = taskBranches.length > 0 ? taskBranches : [null]

      const inserts = targets.map(bId => ({
        name:           taskName.trim(),
        name_ar:        taskNameAr.trim() || taskName.trim(),
        frequency:      taskFreq,
        branch_id:      bId,
        category:       TEMPLATES[tplIdx]?.category || 'custom',
        requires_photo: reqPhoto,
        requires_note:  reqNote,
        requires_value: reqValue,
        value_unit:     reqValue ? '°C' : null,
        is_active:      true,
        created_by:     profile.id,
      }))

      const { error: insErr } = await supabaseOwner
        .from('tasks')
        .insert(inserts)

      if (insErr) throw insErr

      setSaveOk(isAr ? '✓ تم حفظ المهمة بنجاح' : '✓ Task saved successfully.')

      setTplIdx(null)
      setTaskName('')
      setTaskNameAr('')
      setTaskFreq('daily')
      setTaskBranches([])
      setReqPhoto(false)
      setReqNote(false)
      setReqValue(false)

      await fetchData()

    } catch (err) {
      console.error('TaskManagement save error:', err)
      setSaveErr(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── DELETE TASK ───────────────────────────────────────────
  async function handleDelete(taskId) {
    try {
      const { error } = await supabaseOwner
        .from('tasks')
        .update({ is_active: false })
        .eq('id', taskId)
        .eq('created_by', profile.id)
      if (error) throw error
      setTasks(prev => prev.filter(t => t.id !== taskId))
      const today = new Date().toISOString().split('T')[0]
      invalidateCache(`owner-tasks-${profile.id}-${today}`)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // ── FILTERED TASKS ────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => t.frequency === activeFreq)
  }, [tasks, activeFreq])

  // ── GRID HELPERS ──────────────────────────────────────────
  function truncate(str, len) {
    if (!str) return ''
    return str.length > len ? str.slice(0, len) + '…' : str
  }

  function cellStatus(taskId, branchId) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return 'none'
    if (task.branch_id !== null && task.branch_id !== branchId) return 'none'
    const subs = (taskSubMap[taskId] || []).filter(s => s.branch_id === branchId)
    if (subs.some(s => s.status === 'completed')) return 'done'
    if (subs.some(s => s.status === 'missed'))    return 'missed'
    return 'pending'
  }

  function branchScore(branch) {
    const applicable = filteredTasks.filter(t => t.branch_id === null || t.branch_id === branch.id)
    const done = applicable.filter(t => {
      const subs = (taskSubMap[t.id] || []).filter(s => s.branch_id === branch.id)
      return subs.some(s => s.status === 'completed')
    }).length
    return calcRate(done, applicable.length)
  }

  function scoreStyle(rate) {
    const base = { padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, display:'inline-block' }
    if (rate === 100) return { ...base, background:'#DCFCE7', color:'#166534' }
    if (rate >= 60)   return { ...base, background:'#FEF3C7', color:'#D97706' }
    return { ...base, background:'#FEE2E2', color:'#DC2626' }
  }

  const tasksTopbarLeft = (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{isAr ? 'إدارة المهام' : 'Task Management'}</span>
      <span style={{ fontSize:12, color:'#9CA3AF' }}>{tasks.length} {isAr ? 'مهمة' : 'tasks'}</span>
    </div>
  )

  const inputStyle = {
    width:'100%', padding:'9px 12px', fontSize:13,
    border:'1.5px solid #E5E7EB', borderRadius:10, outline:'none',
    color:'#111827', fontFamily:'inherit', background:'#fff',
    boxSizing:'border-box', transition:'border-color 0.15s',
  }

  if (loading) return (
    <OwnerLayout activePath="/owner/tasks" title="Task Management" titleAr="إدارة المهام"
      topbarLeft={tasksTopbarLeft} branches={branches}>
      <div style={{ padding:'20px 24px' }}>
        <div className="skeleton" style={{ height:36, width:260, marginBottom:20 }} />
        {['a','b','c'].map(k => <div key={k} className="skeleton" style={{ height:56, marginBottom:10 }} />)}
      </div>
    </OwnerLayout>
  )

  return (
    <OwnerLayout activePath="/owner/tasks" title="Task Management" titleAr="إدارة المهام"
      topbarLeft={tasksTopbarLeft} branches={branches}>

      {/* Content — split on desktop, single panel on mobile */}
      <div style={{ height:'100%', display:'flex', overflow:'hidden' }}>

          {/* LEFT — Grid (hidden on mobile when form is open) */}
          {(!isMobile || !showMobileForm) && (
          <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '16px' : '20px 20px 20px 24px' }}>

            {isMobile && (
              <button
                onClick={() => setShowMobileForm(true)}
                style={{ width:'100%', marginBottom:16, padding:'12px', background:'#1B4332', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
              >
                + {isAr ? 'مهمة جديدة' : 'New Task'}
              </button>
            )}

            <ErrorBanner message={error} isAr={isAr} onRetry={fetchData} />

            {tasks.length === 0 ? (
              <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:40, textAlign:'center', marginTop:20 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✓</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:6 }}>{isAr?'لا توجد مهام بعد':'No tasks yet'}</div>
                <div style={{ fontSize:13, color:'#6B7280' }}>{isAr ? (isMobile ? 'اضغط زر "مهمة جديدة" أعلاه للبدء' : 'أنشئ مهمتك الأولى من اللوحة على اليمين') : (isMobile ? 'Tap "+ New Task" above to get started' : 'Create your first task using the panel on the right')}</div>
              </div>
            ) : (
              <>
                {/* Freq tabs with task counts */}
                <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                  {['daily','weekly','monthly'].map(f => {
                    const count = tasks.filter(t => t.frequency === f).length
                    const fc    = FREQ_COLORS[f]
                    const isOn  = activeFreq === f
                    return (
                      <button key={f} onClick={() => { setActiveFreq(f); setSelectedCell(null) }}
                        style={{
                          padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:600,
                          cursor:'pointer', border:'1.5px solid', fontFamily:'inherit',
                          display:'flex', alignItems:'center', gap:6, transition:'all 0.15s',
                          background:  isOn ? '#1B4332' : '#fff',
                          color:       isOn ? '#fff'    : '#6B7280',
                          borderColor: isOn ? '#1B4332' : '#E5E7EB',
                        }}>
                        {isAr ? fc.labelAr : fc.label}
                        <span style={{
                          fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:10,
                          background: isOn ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                          color:      isOn ? '#fff' : '#9CA3AF',
                        }}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {filteredTasks.length === 0 ? (
                  <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:32, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>
                    {isAr ? 'لا توجد مهام لهذه الفترة' : 'No tasks for this frequency'}
                  </div>
                ) : (
                  <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
                    <div style={{ overflowX:'auto', width:'100%' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', minWidth: Math.max(500, branches.length * 120 + 220) }}>
                        <thead>
                          <tr style={{ background:'#F9FAFB', borderBottom:'1px solid #E5E7EB' }}>
                            <th style={{ padding:'10px 16px', textAlign: isAr ? 'right' : 'left', fontSize:11, fontWeight:700, color:'#6B7280', whiteSpace:'nowrap', minWidth:180, position:'sticky', left:0, background:'#F9FAFB', zIndex:2, borderRight:'0.5px solid #E5E7EB' }}>
                              {isAr ? 'المهمة' : 'Task'}
                            </th>
                            {branches.map(b => (
                              <th key={b.id} style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:600, color:'#111827', minWidth:100, whiteSpace:'nowrap', background:'#F9FAFB', borderBottom:'0.5px solid #E5E7EB' }}>
                                {isAr ? b.name_ar || b.name : b.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {CATEGORY_ORDER.map(catKey => {
                            const catTasks = filteredTasks.filter(t => {
                              const tc = t.category || 'custom'
                              return catKey === 'food_safety' ? (tc === 'food_safety' || tc === 'safety') : tc === catKey
                            })
                            if (catTasks.length === 0) return null
                            const meta = CAT_META[catKey] || CAT_META.custom
                            return (
                              <Fragment key={catKey}>
                                <tr>
                                  <td colSpan={branches.length + 1} style={{ padding:'6px 16px', background:meta.bg, borderTop:'1px solid #E5E7EB', borderBottom:'0.5px solid #E5E7EB' }}>
                                    <span style={{ fontSize:10, fontWeight:700, color:meta.color, textTransform:'uppercase', letterSpacing:'0.7px' }}>
                                      {meta.emoji} {isAr ? meta.labelAr : meta.label}
                                    </span>
                                  </td>
                                </tr>
                                {catTasks.map(task => {
                                  const tName    = isAr ? task.name_ar || task.name : task.name
                                  const isExpRow = selectedCell?.taskId === task.id
                                  const detailSubs = isExpRow
                                    ? (taskSubMap[task.id] || []).filter(s => s.branch_id === selectedCell.branchId && s.status === 'completed')
                                    : []
                                  return (
                                    <Fragment key={task.id}>
                                      <tr style={{ borderBottom: isExpRow ? 'none' : '0.5px solid #F3F4F6' }}>
                                        <td style={{ padding:'9px 16px', fontSize:13, fontWeight:500, color:'#111827', position:'sticky', left:0, background:'#fff', zIndex:1, borderRight:'0.5px solid #E5E7EB', minWidth:180 }}>
                                          <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                                            <div style={{ flex:1, minWidth:0 }}>
                                              <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{truncate(tName, 30)}</div>
                                              {(task.requires_photo || task.requires_note || task.requires_value) && (
                                                <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                                                  {task.requires_photo && (
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                                      <circle cx="12" cy="13" r="4"/>
                                                    </svg>
                                                  )}
                                                  {task.requires_note && (
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                      <polyline points="14 2 14 8 20 8"/>
                                                      <line x1="16" y1="13" x2="8" y2="13"/>
                                                      <line x1="16" y1="17" x2="8" y2="17"/>
                                                    </svg>
                                                  )}
                                                  {task.requires_value && (
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
                                                    </svg>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => handleDelete(task.id)}
                                              style={{ background:'none', border:'none', cursor:'pointer', color:'#D1D5DB', fontSize:10, padding:'2px 4px', fontFamily:'inherit', flexShrink:0, lineHeight:1 }}
                                              onMouseEnter={e => e.currentTarget.style.color = '#F43F5E'}
                                              onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}
                                              title={isAr ? 'حذف' : 'Delete'}
                                            >✕</button>
                                          </div>
                                        </td>

                                        {branches.map(branch => {
                                          const status   = cellStatus(task.id, branch.id)
                                          const isActive = selectedCell?.taskId === task.id && selectedCell?.branchId === branch.id
                                          const CELL_CFG = {
                                            done:    { bg:'#DCFCE7', border:'#86EFAC', color:'#166534', icon:'✓', cursor:'pointer'  },
                                            pending: { bg:'#FEF3C7', border:'#FCD34D', color:'#D97706', icon:'⏳', cursor:'default' },
                                            missed:  { bg:'#FEE2E2', border:'#FCA5A5', color:'#DC2626', icon:'✗', cursor:'default'  },
                                            none:    { bg:'#F3F4F6', border:'#E5E7EB', color:'#D1D5DB', icon:'—', cursor:'default'  },
                                          }
                                          const cfg = CELL_CFG[status] || CELL_CFG.none
                                          return (
                                            <td key={branch.id} style={{ padding:'6px', textAlign:'center' }}>
                                              <span
                                                onClick={status === 'done' ? () => setSelectedCell(prev =>
                                                  prev?.taskId === task.id && prev?.branchId === branch.id
                                                    ? null
                                                    : { taskId: task.id, branchId: branch.id }
                                                ) : undefined}
                                                style={{
                                                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                                                  width:32, height:32, borderRadius:8, fontSize:14,
                                                  background: isActive ? cfg.color : cfg.bg,
                                                  color:      isActive ? '#fff'    : cfg.color,
                                                  cursor:     cfg.cursor,
                                                  border:     `0.5px solid ${isActive ? cfg.color : cfg.border}`,
                                                  transition: 'all 0.15s',
                                                }}
                                              >
                                                {cfg.icon}
                                              </span>
                                            </td>
                                          )
                                        })}
                                      </tr>
                                      {isExpRow && detailSubs.length > 0 && (
                                        <tr>
                                          <td colSpan={branches.length + 1} style={{ padding:'12px 16px', background:'#F0FDF4', borderBottom:'1px solid #E5E7EB', borderTop:'1px solid #BBF7D0' }}>
                                            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                              {detailSubs.map(sub => {
                                                const mgr  = isAr ? sub.users?.name_ar || sub.users?.name : sub.users?.name || '—'
                                                const time = new Date(sub.submitted_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })
                                                return (
                                                  <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                                    <span style={{ fontSize:11, fontWeight:600, color:'#1B4332' }}>{mgr}</span>
                                                    <span style={{ fontSize:11, color:'#9CA3AF' }}>· {time}</span>
                                                    {sub.value_entered != null && (
                                                      <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:10, background:'#D1FAE5', color:'#065F46' }}>🌡 {sub.value_entered}°C</span>
                                                    )}
                                                    {sub.note && (
                                                      <span style={{ fontSize:11, color:'#374151', fontStyle:'italic' }}>"{sub.note}"</span>
                                                    )}
                                                    {sub.photo_url && (
                                                      <div style={{ marginTop:4 }}>
                                                        {!expandedPhotos[sub.id] ? (
                                                          <div
                                                            onClick={() => setExpandedPhotos(p => ({ ...p, [sub.id]: true }))}
                                                            style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:500, color:'#1B4332', background:'#F0FDF4', border:'1px solid #BBF7D0', padding:'3px 10px', borderRadius:20, cursor:'pointer' }}
                                                          >
                                                            📷 {isAr ? 'عرض الصورة' : 'View photo'}
                                                          </div>
                                                        ) : (
                                                          <div style={{ position:'relative', display:'inline-block' }}>
                                                            <SubmissionPhotoThumb photoUrl={sub.photo_url} onOpen={setLightboxUrl} />
                                                            <div
                                                              onClick={() => setExpandedPhotos(p => ({ ...p, [sub.id]: false }))}
                                                              style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                                                            >✕</div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  )
                                })}
                              </Fragment>
                            )
                          })}
                          <tr style={{ background:'#F9FAFB', borderTop:'2px solid #E5E7EB' }}>
                            <td style={{ padding:'9px 16px', fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.6px', position:'sticky', left:0, background:'#F9FAFB', zIndex:1, borderRight:'0.5px solid #E5E7EB' }}>
                              {isAr ? 'النتيجة' : 'Score'}
                            </td>
                            {branches.map(branch => {
                              const score = branchScore(branch)
                              return (
                                <td key={branch.id} style={{ padding:'6px', textAlign:'center' }}>
                                  <span style={scoreStyle(score)}>{score}%</span>
                                </td>
                              )
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Legend */}
                    <div style={{ padding:'10px 16px', borderTop:'1px solid #F3F4F6', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                      {[
                        { icon:'✓',  bg:'#DCFCE7', color:'#166534', label:'Done',        labelAr:'منجزة'       },
                        { icon:'⏳', bg:'#FEF3C7', color:'#D97706', label:'Pending',      labelAr:'قيد التنفيذ' },
                        { icon:'✗',  bg:'#FEE2E2', color:'#DC2626', label:'Not done',     labelAr:'لم تنجز'     },
                        { icon:'—',  bg:'#F3F4F6', color:'#D1D5DB', label:'Not assigned', labelAr:'غير مخصصة'  },
                      ].map(l => (
                        <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ width:22, height:22, borderRadius:6, background:l.bg, color:l.color, fontSize:12, display:'inline-flex', alignItems:'center', justifyContent:'center', border:'1px solid #E5E7EB' }}>
                            {l.icon}
                          </span>
                          <span style={{ fontSize:11, color:'#6B7280' }}>{isAr ? l.labelAr : l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          )}

          {/* RIGHT — New Task form (full-screen on mobile) */}
          {(!isMobile || showMobileForm) && (
          <div style={{ width: isMobile ? '100%' : 340, background:'#fff', borderLeft: isMobile ? 'none' : '1px solid #E5E7EB', overflowY:'auto', padding: isMobile ? 16 : 24, flexShrink:0 }}>
            {isMobile && (
              <button
                onClick={() => setShowMobileForm(false)}
                style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:600, color:'#374151', fontFamily:'inherit', padding:'4px 0', marginBottom:16, minHeight:44 }}
              >
                {isAr ? 'رجوع →' : '← Back'}
              </button>
            )}
            <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:4 }}>{isAr?'مهمة جديدة':'New Task'}</div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:20 }}>{isAr?'اختر قالباً أو اكتب مهمتك':'Pick a template or write your own'}</div>

            {/* Templates */}
            <div style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>
              {isAr?'بداية سريعة':'Quick start'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:6 }}>
              {TEMPLATES.map((tpl, idx) => {
                const isOn = tplIdx === idx
                return (
                  <div key={tpl.name || idx} onClick={()=>pickTemplate(idx)}
                    style={{ borderRadius:12, border:`1.5px solid ${isOn?'#1B4332':'#E5E7EB'}`, background:isOn?'#F0FDF4':'#F9FAFB', cursor:'pointer', padding:'10px 6px', textAlign:'center', transition:'all 0.15s' }}
                    onMouseEnter={e=>{if(!isOn){e.currentTarget.style.borderColor='#BBF7D0';e.currentTarget.style.background='#F0FDF4'}}}
                    onMouseLeave={e=>{if(!isOn){e.currentTarget.style.borderColor='#E5E7EB';e.currentTarget.style.background='#F9FAFB'}}}
                  >
                    <span style={{ fontSize:22, display:'block', marginBottom:4 }}>{tpl.icon}</span>
                    <div style={{ fontSize:11, fontWeight:700, color:isOn?'#1B4332':'#374151' }}>
                      {idx === 5 ? (isAr?'مخصص':'Custom') : isAr ? tpl.nameAr.split(' ')[0] : tpl.name.split(' ')[0]}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* OR divider */}
            <div style={{ display:'flex', alignItems:'center', gap:8, margin:'14px 0' }}>
              <div style={{ flex:1, height:1, background:'#F3F4F6' }} />
              <div style={{ fontSize:10, fontWeight:600, color:'#D1D5DB' }}>{isAr?'أو أدخل يدوياً':'OR FILL MANUALLY'}</div>
              <div style={{ flex:1, height:1, background:'#F3F4F6' }} />
            </div>

            {saveOk && <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#166534' }}>{saveOk}</div>}
            {saveErr && <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#9F1239' }}>{saveErr}</div>}

            <form onSubmit={handleSave} noValidate>

              {/* 1. Task name */}
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>1</span>
                  {isAr?'اسم المهمة':'Task name'}
                </div>
                <input type="text" value={taskName} onChange={e=>{setTaskName(e.target.value);setSaveErr('');setSaveOk('')}}
                  placeholder={isAr?'مثال: قائمة الافتتاح...':'e.g. Opening Checklist...'}
                  style={inputStyle}
                  onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
              </div>

              {/* 2. Frequency */}
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>2</span>
                  {isAr?'كم مرة؟':'How often?'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {['daily','weekly','monthly'].map(f => {
                    const fc   = FREQ_COLORS[f]
                    const isOn = taskFreq === f
                    return (
                      <div key={f} onClick={()=>setTaskFreq(f)}
                        style={{ padding:'11px 6px', borderRadius:12, border:`1.5px solid ${isOn?'#1B4332':'#E5E7EB'}`, background:isOn?'#1B4332':'#F9FAFB', fontSize:12, fontWeight:700, color:isOn?'#fff':'#6B7280', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                        <span style={{ fontSize:18, display:'block', marginBottom:4 }}>
                          {f==='daily'?'📅':f==='weekly'?'📆':'🗓'}
                        </span>
                        {isAr?fc.labelAr:fc.label}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 3. Branches */}
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>3</span>
                  {isAr?'أي الفروع؟':'Which branches?'}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  <div onClick={()=>setTaskBranches([])}
                    style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${taskBranches.length===0?'#1B4332':'#E5E7EB'}`, background:taskBranches.length===0?'#1B4332':'#F9FAFB', fontSize:12, fontWeight:600, color:taskBranches.length===0?'#fff':'#6B7280', cursor:'pointer', transition:'all 0.15s' }}>
                    {isAr?'جميع الفروع':'All Branches'}
                  </div>
                  {branches.map(b => {
                    const isOn = taskBranches.includes(b.id)
                    return (
                      <div key={b.id} onClick={()=>toggleBranch(b.id)}
                        style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${isOn?'#1B4332':'#E5E7EB'}`, background:isOn?'#F0FDF4':'#F9FAFB', fontSize:12, fontWeight:600, color:isOn?'#1B4332':'#6B7280', cursor:'pointer', transition:'all 0.15s' }}>
                        {isAr?b.name_ar||b.name:b.name}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 4. Requirements */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>4</span>
                  {isAr?'يجب على المدير تقديم':'Manager must submit'}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {[
                    { key:'photo', icon:'📷', label:'Photo',       labelAr:'صورة',       val:reqPhoto, set:setReqPhoto },
                    { key:'note',  icon:'📝', label:'Note',        labelAr:'ملاحظة',     val:reqNote,  set:setReqNote  },
                    { key:'value', icon:'🌡', label:'Temperature', labelAr:'درجة حرارة', val:reqValue, set:setReqValue },
                  ].map(req => (
                    <div key={req.key} onClick={()=>req.set(p=>!p)}
                      style={{ flex:1, padding:'12px 8px', borderRadius:14, border:`1.5px solid ${req.val?'#1B4332':'#E5E7EB'}`, background:req.val?'#F0FDF4':'#F9FAFB', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}
                      onMouseEnter={e=>{if(!req.val)e.currentTarget.style.borderColor='#BBF7D0'}}
                      onMouseLeave={e=>{if(!req.val)e.currentTarget.style.borderColor='#E5E7EB'}}
                    >
                      <span style={{ fontSize:20, display:'block', marginBottom:4 }}>{req.icon}</span>
                      <span style={{ fontSize:10, fontWeight:700, color:req.val?'#1B4332':'#9CA3AF' }}>
                        {isAr?req.labelAr:req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <SubscriptionGuard isExpired={isExpired} isAr={isAr}>
                <button type="submit" disabled={saving}
                  style={{ width:'100%', padding:13, background:saving?'#6B9E83':'#1B4332', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'background 0.2s' }}>
                  {saving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                  {saving?(isAr?'جارٍ الحفظ…':'Saving…'):(isAr?'حفظ المهمة':'Save Task')}
                </button>
              </SubscriptionGuard>
            </form>
          </div>
          )}
        </div>

      {/* ── LIGHTBOX ── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            style={{ position:'absolute', top:20, right:24, background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:22, width:40, height:40, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}
          >✕</button>
          <img
            src={lightboxUrl}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:12, objectFit:'contain' }}
          />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </OwnerLayout>
  )
}
