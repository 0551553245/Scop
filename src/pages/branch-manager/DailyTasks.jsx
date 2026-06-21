import { useEffect, useState, useCallback } from 'react'
import { supabaseBranchManager } from '../../lib/supabase'
import { useBranchManagerAuth } from '../../context/BranchManagerAuthContext'
import { getCached, setCached, invalidateCache, debounce } from '../../lib/cache'
import { useLanguage } from '../../context/LanguageContext'
import { uploadPhoto } from '../../lib/upload'
import BMLayout from '../../components/BMLayout'
import { CATEGORY_ORDER, CATEGORY_LABELS, formatTime } from '../../lib/taskConstants'

export default function BMDailyTasks() {
  const { profile, ownerHasAccess } = useBranchManagerAuth()
  const { isAr } = useLanguage()

  const [tasks,      setTasks]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState(null)
  const [branch,     setBranch]     = useState(null)

  const [notes,      setNotes]      = useState({})
  const [values,     setValues]     = useState({})
  const [photos,     setPhotos]     = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState({})

  const fetchTasks = useCallback(async () => {
    if (!profile?.branch_id) return
    setError('')

    const today    = new Date().toISOString().split('T')[0]
    const cacheKey = `bm-daily-tasks-${profile.branch_id}-${today}`
    const cached = getCached(cacheKey)
    if (cached) {
      setBranch(cached.branch)
      setTasks(cached.tasks)
      setLoading(false)
    }

    try {
      const branchId = profile.branch_id

      const branchRes = await supabaseBranchManager.from('branches').select('id, name, name_ar, owner_id').eq('id', branchId).single()
      const ownerId   = branchRes.data?.owner_id

      const [taskDataRes, subDataRes] = await Promise.all([
        supabaseBranchManager.from('tasks').select('id, name, name_ar, frequency, category, requires_photo, requires_note, requires_value, value_unit').eq('is_active', true).or(`branch_id.eq.${branchId},and(branch_id.is.null,created_by.eq.${ownerId})`).eq('frequency', 'daily').order('created_at', { ascending: true }),
        supabaseBranchManager.from('task_submissions').select('id, task_id, status, note, value_entered, submitted_at').eq('branch_id', branchId).eq('submitted_by', profile.id).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(1000),
      ])

      if (taskDataRes.error) throw taskDataRes.error

      const branchData = branchRes.data
      setBranch(branchData)

      const subs = subDataRes.data || []
      const merged = (taskDataRes.data || []).map(task => {
        const sub = subs.find(s => s.task_id === task.id)
        return { task, submission: sub || null }
      })
      setTasks(merged)

      setCached(cacheKey, { branch: branchData, tasks: merged })
    } catch (err) {
      console.error(err)
      if (!cached) setError('Failed to load tasks.')
    } finally {
      if (!cached) setLoading(false)
    }
  }, [profile?.id, profile?.branch_id])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    if (!profile?.branch_id) return
    const today    = new Date().toISOString().split('T')[0]
    const cacheKey = `bm-daily-tasks-${profile.branch_id}-${today}`
    const debouncedFetch = debounce(() => { invalidateCache(cacheKey); fetchTasks() }, 300)
    const ch = supabaseBranchManager
      .channel(`bm-daily-tasks-rt-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'task_submissions',
        filter: `branch_id=eq.${profile.branch_id}`,
      }, debouncedFetch)
      .subscribe()
    return () => { debouncedFetch.cancel(); supabaseBranchManager.removeChannel(ch) }
  }, [profile?.id, profile?.branch_id, fetchTasks])

  async function quickComplete(task) {
    if (submitting[task.id]) return
    if (ownerHasAccess === false) {
      setFormErrors(p => ({ ...p, [task.id]: isAr ? 'الاشتراك منتهي. تواصل مع مالك المطعم.' : 'Subscription expired. Contact your restaurant owner.' }))
      return
    }
    if (task.requires_photo) { setExpanded(task.id); return }
    setSubmitting(p => ({ ...p, [task.id]: true }))
    try {
      await supabaseBranchManager.from('task_submissions').insert({
        task_id:       task.id,
        branch_id:     profile.branch_id,
        submitted_by:  profile.id,
        status:        'completed',
        note:          null,
        photo_url:     null,
        value_entered: null,
        submitted_at:  new Date().toISOString(),
      })
      await fetchTasks()
    } catch (err) {
      console.error('Submission failed:', err)
      setFormErrors(p => ({ ...p, [task.id]: isAr ? 'فشل الإرسال. تحقق من الاتصال وحاول مجدداً.' : 'Submission failed. Check your connection and try again.' }))
    } finally {
      setSubmitting(p => ({ ...p, [task.id]: false }))
    }
  }

  async function submitWithReqs(task) {
    if (submitting[task.id]) return
    if (ownerHasAccess === false) {
      setFormErrors(p => ({ ...p, [task.id]: isAr ? 'الاشتراك منتهي. تواصل مع مالك المطعم.' : 'Subscription expired. Contact your restaurant owner.' }))
      return
    }
    if (task.requires_photo && !photos[task.id]) {
      setFormErrors(p => ({ ...p, [task.id]: isAr ? 'الصورة مطلوبة' : 'Photo is required' }))
      return
    }
    setFormErrors(p => ({ ...p, [task.id]: '' }))
    setSubmitting(p => ({ ...p, [task.id]: true }))
    try {
      const note     = notes[task.id]  || null
      const value    = values[task.id] ? parseFloat(values[task.id]) : null
      const photoUrl = photos[task.id] ? await uploadPhoto(photos[task.id], profile.branch_id, task.id) : null
      await supabaseBranchManager.from('task_submissions').insert({
        task_id:       task.id,
        branch_id:     profile.branch_id,
        submitted_by:  profile.id,
        status:        'completed',
        note:          note,
        photo_url:     photoUrl,
        value_entered: value,
        submitted_at:  new Date().toISOString(),
      })
      setNotes(p      => ({ ...p, [task.id]: '' }))
      setValues(p     => ({ ...p, [task.id]: '' }))
      setPhotos(p     => ({ ...p, [task.id]: null }))
      setFormErrors(p => ({ ...p, [task.id]: '' }))
      setExpanded(null)
      await fetchTasks()
    } catch (err) {
      console.error('Submission failed:', err)
      setFormErrors(p => ({ ...p, [task.id]: isAr ? 'فشل الإرسال. تحقق من الاتصال وحاول مجدداً.' : 'Submission failed. Check your connection and try again.' }))
    } finally {
      setSubmitting(p => ({ ...p, [task.id]: false }))
    }
  }

  const branchName = isAr ? branch?.name_ar || branch?.name : branch?.name || '—'

  const done    = tasks.filter(t => t.submission?.status === 'completed').length
  const total   = tasks.length

  function hasRequirements(task) {
    return task.requires_note || task.requires_value || task.requires_photo
  }

  if (loading) return (
    <BMLayout activePath="/branch-manager/daily-tasks" title="Today's Tasks" titleAr="مهام اليوم"
      subtitle={new Date().toLocaleDateString(isAr?'ar-SA':'en-US', { weekday:'short', month:'short', day:'numeric' })}
      branchName={branchName}>
      <div style={{ padding:'16px 20px' }}>
        {['a','b','c','d','e','f'].map(k => <div key={k} className="skeleton" style={{ height:68, marginBottom:8 }} />)}
      </div>
    </BMLayout>
  )

  return (
    <BMLayout activePath="/branch-manager/daily-tasks" title="Today's Tasks" titleAr="مهام اليوم"
      subtitle={new Date().toLocaleDateString(isAr?'ar-SA':'en-US', { weekday:'short', month:'short', day:'numeric' })}
      branchName={branchName}>
      <div style={{ padding:'16px 20px' }}>

          {error && (
            <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:10, padding:'10px 14px', color:'#9F1239', fontSize:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10 }}>
              <span>{error}</span>
              <button onClick={fetchTasks} style={{ background:'none', border:'1px solid #FECDD3', borderRadius:8, padding:'3px 8px', color:'#9F1239', fontSize:11, cursor:'pointer', flexShrink:0 }}>{isAr?'إعادة':'Retry'}</button>
            </div>
          )}

          {ownerHasAccess === false && (
            <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:10, padding:'10px 14px', color:'#9F1239', fontSize:12, fontWeight:500, marginBottom:10 }}>
              {isAr ? 'انتهى اشتراك المطعم. لا يمكن إرسال المهام حتى يتم تجديد الاشتراك.' : "This restaurant's subscription has expired. Tasks cannot be submitted until it is renewed."}
            </div>
          )}

          {/* Progress bar */}
          {tasks.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{isAr ? 'تقدم اليوم' : "Today's progress"}</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#1B4332' }}>{done} / {total}</span>
              </div>
              <div style={{ background:'#F3F4F6', borderRadius:20, height:8, overflow:'hidden' }}>
                <div style={{ height:'100%', width: total > 0 ? (done/total*100)+'%' : '0%', background: done===total ? '#1B4332' : '#F59E0B', borderRadius:20, transition:'width 0.4s' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:4 }}>
                <span style={{ color:'#1B4332', fontWeight:500 }}>{done} {isAr ? 'مكتمل' : 'done'}</span>
                <span style={{ color:'#9CA3AF' }}>{total} {isAr ? 'المجموع' : 'total'}</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {tasks.length === 0 && (
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:40, textAlign:'center', marginTop:8 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>✓</div>
              <div style={{ fontSize:14, fontWeight:500, color:'#111827', marginBottom:6 }}>{isAr ? 'لا توجد مهام اليوم' : 'No tasks assigned for today'}</div>
              <div style={{ fontSize:12, color:'#9CA3AF' }}>{isAr ? 'مالك المطعم لم يُضف مهام بعد' : "Your restaurant owner hasn't added any tasks yet"}</div>
            </div>
          )}

          {/* Category-grouped tasks */}
          {tasks.length > 0 && CATEGORY_ORDER.map(catKey => {
            const catTasks = tasks.filter(({ task }) => {
              const tc = task?.category || 'custom'
              return catKey === 'food_safety' ? (tc === 'food_safety' || tc === 'safety') : tc === catKey
            })
            if (catTasks.length === 0) return null
            const catInfo = CATEGORY_LABELS[catKey]
            const catDone = catTasks.filter(({ submission }) => submission?.status === 'completed').length

            return (
              <div key={catKey} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background:'#F9FAFB', borderTop:'0.5px solid #E5E7EB', borderBottom:'0.5px solid #E5E7EB' }}>
                  <span style={{ fontSize:15 }}>{catInfo.emoji}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#111827' }}>
                    {isAr ? catInfo.labelAr : catInfo.label}
                  </span>
                  <span style={{ fontSize:11, color:'#9CA3AF', marginLeft:'auto' }}>
                    {catDone}/{catTasks.length} {isAr ? 'مكتمل' : 'done'}
                  </span>
                </div>

                <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
                  {catTasks.filter(({ submission }) => !submission || submission.status !== 'completed').map(({ task }) => {
                    const isExp    = expanded === task.id
                    const hasReqs  = hasRequirements(task)
                    const isSaving = submitting[task.id]
                    return (
                      <div key={task.id}>
                        <div
                          onClick={() => hasReqs ? setExpanded(isExp ? null : task.id) : quickComplete(task)}
                          style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#FFFDF5', borderBottom: isExp ? 'none' : '0.5px solid #F3F4F6', cursor:'pointer' }}
                        >
                          <div style={{ width:38, height:38, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#FEF3C7', border:'0.5px solid #FCD34D', fontSize:16, color:'#D97706' }}>
                            {isSaving ? <div style={{ width:16, height:16, border:'2px solid #FCD34D', borderTopColor:'#D97706', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> : '⏳'}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>
                              {isAr ? task.name_ar || task.name : task.name}
                            </div>
                            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                              {task.requires_photo && <span>📷</span>}
                              {task.requires_note  && <span>📝</span>}
                              {task.requires_value && <span>🌡</span>}
                              {!hasReqs && <span>{isAr ? 'اضغط للإتمام' : 'Tap to complete'}</span>}
                            </div>
                          </div>
                          <div style={{ fontSize:12, fontWeight:500, color:'#D97706', background:'#FEF3C7', border:'0.5px solid #FCD34D', padding:'5px 12px', borderRadius:20, flexShrink:0 }}>
                            {isAr ? 'إرسال ←' : 'Submit →'}
                          </div>
                        </div>

                        {isExp && hasReqs && (
                          <div style={{ padding:'12px 16px 16px 66px', borderTop:'0.5px solid #F3F4F6', background:'#F0FDF4', display:'flex', flexDirection:'column', gap:10, borderBottom:'0.5px solid #BBF7D0' }}>

                            {task.requires_note && (
                              <textarea
                                value={notes[task.id] || ''}
                                onChange={e => setNotes(p => ({ ...p, [task.id]: e.target.value }))}
                                placeholder={isAr?'أضف ملاحظة...':'Add a note...'}
                                style={{ border:'0.5px solid #E5E7EB', borderRadius:8, padding:'8px 10px', fontSize:12, color:'#111827', fontFamily:'inherit', outline:'none', resize:'none', background:'#fff', minHeight:60, width:'100%', boxSizing:'border-box' }}
                                onFocus={e => e.target.style.borderColor='#1B4332'}
                                onBlur={e => e.target.style.borderColor='#E5E7EB'}
                              />
                            )}

                            {task.requires_value && (
                              <div style={{ display:'flex', alignItems:'center', gap:8, background:'#F9FAFB', border:'0.5px solid #E5E7EB', borderRadius:8, padding:'8px 12px' }}>
                                <input
                                  type="number"
                                  value={values[task.id] || ''}
                                  onChange={e => setValues(p => ({ ...p, [task.id]: e.target.value }))}
                                  placeholder="0"
                                  style={{ border:'none', background:'transparent', fontSize:22, fontWeight:500, color:'#111827', width:80, outline:'none', fontFamily:'inherit' }}
                                />
                                <div style={{ fontSize:16, color:'#9CA3AF', fontWeight:500 }}>{task.value_unit || '°C'}</div>
                                <div style={{ fontSize:10, color:'#9CA3AF', marginLeft:'auto' }}>{isAr ? 'أدخل القراءة' : 'Enter reading'}</div>
                              </div>
                            )}

                            {task.requires_photo && (
                              <div>
                                <label style={{ display:'block', cursor:'pointer' }}>
                                  <input type="file" accept="image/*" style={{ display:'none' }}
                                    onChange={e => {
                                      const file = e.target.files[0]
                                      if (file) { setPhotos(p => ({ ...p, [task.id]: file })); setFormErrors(p => ({ ...p, [task.id]: '' })) }
                                    }}
                                  />
                                  <div style={{ border: photos[task.id] ? '1.5px solid #1B4332' : '1.5px dashed #D1D5DB', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:8, background: photos[task.id] ? '#F0FDF4' : '#FAFAFA' }}>
                                    <span style={{ fontSize:18 }}>📷</span>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontSize:12, fontWeight:500, color: photos[task.id] ? '#1B4332' : '#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                        {photos[task.id] ? photos[task.id].name : (isAr ? 'اضغط لاختيار صورة' : 'Tap to attach photo')}
                                      </div>
                                      {!photos[task.id] && <div style={{ fontSize:10, color:'#9CA3AF', marginTop:1 }}>{isAr ? 'مطلوب *' : 'Required *'}</div>}
                                    </div>
                                    {photos[task.id] && <span style={{ fontSize:13, color:'#1B4332', fontWeight:700 }}>✓</span>}
                                  </div>
                                </label>
                                {formErrors[task.id] && <div style={{ fontSize:11, color:'#E24B4A', marginTop:4 }}>{formErrors[task.id]}</div>}
                              </div>
                            )}

                            <button onClick={() => submitWithReqs(task)} disabled={isSaving}
                              style={{ width:'100%', padding:10, background: isSaving?'#6B9E83':'#1B4332', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor: isSaving?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                              {isSaving && <div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                              {isSaving ? (isAr?'جارٍ الإرسال…':'Submitting…') : (isAr?'إرسال وإكمال':'Submit & Complete')}
                            </button>

                            {formErrors[task.id] && !task.requires_photo && (
                              <div style={{ color:'#E24B4A', fontSize:12, padding:'8px 12px', background:'#FFF1F2', borderRadius:8 }}>{formErrors[task.id]}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {catTasks.filter(({ submission }) => submission?.status === 'completed').map(({ task, submission }) => {
                    const isExp = expanded === `done-${task.id}`
                    return (
                      <div key={task.id}>
                        <div
                          onClick={() => setExpanded(isExp ? null : `done-${task.id}`)}
                          style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#fff', borderBottom:'0.5px solid #F3F4F6', cursor:'pointer', opacity:0.8 }}
                          onMouseEnter={e => e.currentTarget.style.opacity='1'}
                          onMouseLeave={e => e.currentTarget.style.opacity='0.8'}
                        >
                          <div style={{ width:38, height:38, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#DCFCE7', border:'0.5px solid #86EFAC', fontSize:16, color:'#166534' }}>
                            ✓
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:500, color:'#9CA3AF', textDecoration:'line-through' }}>
                              {isAr ? task.name_ar || task.name : task.name}
                            </div>
                            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>
                              {isAr ? 'مكتمل' : 'Completed'} · {submission ? formatTime(submission.submitted_at) : ''}
                            </div>
                          </div>
                          <div style={{ fontSize:12, color:'#166534', fontWeight:500, flexShrink:0 }}>
                            {submission ? formatTime(submission.submitted_at) : ''}
                          </div>
                        </div>

                        {isExp && (submission?.note || submission?.value_entered) && (
                          <div style={{ padding:'10px 16px 12px', background:'#F0FDF4', borderBottom:'0.5px solid #E5E7EB' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                              {submission.value_entered && (
                                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10, background:'#D1FAE5', color:'#065F46' }}>
                                  🌡 {submission.value_entered}{task.value_unit || '°C'}
                                </span>
                              )}
                              {submission.note && (
                                <span style={{ fontSize:12, color:'#374151', fontStyle:'italic' }}>"{submission.note}"</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
      </div>
    </BMLayout>
  )
}
