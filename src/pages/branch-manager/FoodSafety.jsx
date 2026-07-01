import { useEffect, useState, useCallback } from 'react'
import { supabaseBranchManager } from '../../lib/supabase'
import { useBranchManagerAuth } from '../../context/BranchManagerAuthContext'
import { getCached, setCached, invalidateCache, debounce } from '../../lib/cache'
import { useLanguage } from '../../context/LanguageContext'
import BMLayout from '../../components/BMLayout'

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })
}

function getStandardIcon(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('fridge') || n.includes('cold') || n.includes('refriger')) return { icon:'🧊', bg:'#EFF6FF' }
  if (n.includes('freezer')) return { icon:'❄️', bg:'#EFF6FF' }
  if (n.includes('hot') || n.includes('counter') || n.includes('heat')) return { icon:'🔥', bg:'#FFF7ED' }
  if (n.includes('storage') || n.includes('store')) return { icon:'📦', bg:'#ECFDF5' }
  if (n.includes('clean')) return { icon:'🧹', bg:'#F5F3FF' }
  return { icon:'🛡', bg:'#F0FDF4' }
}

function getRangeLabel(std, isAr) {
  if (std.min_temp !== null && std.max_temp !== null) return isAr ? `${std.min_temp}°م – ${std.max_temp}°م` : `${std.min_temp}°C – ${std.max_temp}°C`
  if (std.min_temp !== null) return isAr ? `فوق ${std.min_temp}°م` : `Above ${std.min_temp}°C`
  if (std.max_temp !== null) return isAr ? `تحت ${std.max_temp}°م` : `Below ${std.max_temp}°C`
  return isAr ? 'فحص امتثال' : 'Compliance check'
}

function checkResult(value, std) {
  if (value === null || value === undefined) return null
  if (std.min_temp !== null && std.max_temp !== null) return value >= std.min_temp && value <= std.max_temp ? 'pass' : 'fail'
  if (std.min_temp !== null) return value >= std.min_temp ? 'pass' : 'fail'
  if (std.max_temp !== null) return value <= std.max_temp ? 'pass' : 'fail'
  return null // compliance check — manual pass/fail
}

export default function BMFoodSafety() {
  const { profile, ownerHasAccess } = useBranchManagerAuth()
  const { isAr } = useLanguage()

  const [standards,  setStandards]  = useState([]) // { standard, submission }
  const [branch,     setBranch]     = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState(null)

  // Per-standard form state
  const [tempValues,    setTempValues]    = useState({}) // { stdId: string }
  const [notes,         setNotes]         = useState({}) // { stdId: string }
  const [compliance,    setCompliance]    = useState({}) // { stdId: 'pass'|'fail'|null }
  const [submitting,    setSubmitting]    = useState({}) // { stdId: bool }

  const fetchData = useCallback(async () => {
    if (!profile?.branch_id) return
    setError('')

    const today    = new Date().toISOString().split('T')[0]
    const cacheKey = `bm-food-safety-${profile.branch_id}-${today}`
    const cached = getCached(cacheKey)
    if (cached) {
      setBranch(cached.branch)
      setStandards(cached.standards)
      setLoading(false)
      // fall through: refresh in background
    }

    try {
      const branchId = profile.branch_id

      const branchRes = await supabaseBranchManager.from('branches').select('id, name, name_ar, owner_id').eq('id', branchId).single()
      const ownerId   = branchRes.data?.owner_id

      const [stdsRes, subsRes] = await Promise.all([
        supabaseBranchManager.from('food_safety_standards').select('id, name, name_ar, description, min_temp, max_temp, branch_id').eq('is_active', true).or(`branch_id.eq.${branchId},and(branch_id.is.null,created_by.eq.${ownerId})`).order('created_at', { ascending: true }),
        supabaseBranchManager.from('food_safety_submissions').select('id, standard_id, result, actual_value, corrective_note, submitted_at').eq('branch_id', branchId).eq('submitted_by', profile.id).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(500),
      ])

      if (stdsRes.error) throw stdsRes.error
      if (subsRes.error) console.error('Food safety submissions fetch error:', subsRes.error)

      setBranch(branchRes.data)

      const stds = stdsRes.data || []
      const subs = subsRes.data || []

      // Merge
      const merged = (stds || []).map(std => ({
        standard:   std,
        submission: (subs || []).find(s => s.standard_id === std.id) || null,
      }))

      // Pending first, then passed, then failed
      merged.sort((a, b) => {
        const order = { null: 0, pass: 1, fail: 2 }
        const aR = a.submission?.result ?? null
        const bR = b.submission?.result ?? null
        return (order[aR] ?? 0) - (order[bR] ?? 0)
      })

      setStandards(merged)
      setCached(cacheKey, { branch: branchRes.data, standards: merged })
    } catch (err) {
      console.error('BM FoodSafety fetch error:', err)
      if (!cached) setError(isAr ? 'فشل تحميل معايير سلامة الغذاء' : 'Failed to load food safety standards.')
    } finally {
      if (!cached) setLoading(false)
    }
  }, [profile?.id, profile?.branch_id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!profile?.branch_id) return
    const debouncedFetch = debounce(() => { invalidateCache(`bm-food-safety-${profile.branch_id}-${new Date().toISOString().split('T')[0]}`); fetchData() }, 300)
    const ch = supabaseBranchManager
      .channel(`bm-fs-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'food_safety_submissions',
        filter: `branch_id=eq.${profile.branch_id}`,
      }, debouncedFetch)
      .subscribe()
    return () => { debouncedFetch.cancel(); supabaseBranchManager.removeChannel(ch) }
  }, [profile?.id, profile?.branch_id, fetchData])

  const isTemperatureStd = (std) => std.min_temp !== null || std.max_temp !== null

  async function handleSubmit(std) {
    const stdId = std.id
    if (submitting[stdId]) return

    if (ownerHasAccess === false) {
      setError(isAr ? 'الاشتراك منتهي. تواصل مع مالك المطعم.' : 'Subscription expired. Contact your restaurant owner.')
      return
    }

    const isTempStd = isTemperatureStd(std)
    const tempVal   = tempValues[stdId] ? parseFloat(tempValues[stdId]) : null
    const compVal   = compliance[stdId] // 'pass' or 'fail'
    const note      = notes[stdId] || null

    // Validation
    if (isTempStd && (tempVal === null || isNaN(tempVal))) {
      setError(isAr ? 'يرجى إدخال قراءة درجة الحرارة' : 'Please enter a temperature reading.')
      return
    }
    if (!isTempStd && !compVal) {
      setError(isAr ? 'يرجى اختيار ناجح أو فاشل' : 'Please select Pass or Fail.')
      return
    }

    setError('')
    setSubmitting(p => ({ ...p, [stdId]: true }))

    try {
      const result = isTempStd ? checkResult(tempVal, std) : compVal

      await supabaseBranchManager
        .from('food_safety_submissions')
        .insert({
          standard_id:      stdId,
          branch_id:        profile.branch_id,
          submitted_by:     profile.id,
          result:           result,
          actual_value:     isTempStd ? tempVal : null,
          corrective_note:  note,
          submitted_at:     new Date().toISOString(),
        })

      // Clear form state
      setTempValues(p  => ({ ...p, [stdId]: '' }))
      setNotes(p       => ({ ...p, [stdId]: '' }))
      setCompliance(p  => ({ ...p, [stdId]: null }))
      setExpanded(null)
      await fetchData()

    } catch (err) {
      console.error('BM FoodSafety submit error:', err)
      setError(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(p => ({ ...p, [stdId]: false }))
    }
  }

  const passed  = standards.filter(s => s.submission?.result === 'pass').length
  const failed  = standards.filter(s => s.submission?.result === 'fail').length
  const pending = standards.filter(s => !s.submission).length
  const branchName = isAr ? branch?.name_ar || branch?.name : branch?.name || '—'

  if (loading) return (
    <BMLayout activePath="/branch-manager/food-safety" title="Food Safety" titleAr="سلامة الغذاء"
      subtitle={new Date().toLocaleDateString(isAr?'ar-SA':'en-US', { weekday:'short', month:'short', day:'numeric' })}
      branchName={branchName}>
      <div style={{ padding:'16px 20px' }}>
        {['a','b','c','d','e'].map(k => <div key={k} className="skeleton" style={{ height:80, marginBottom:8 }} />)}
      </div>
    </BMLayout>
  )

  return (
    <BMLayout activePath="/branch-manager/food-safety" title="Food Safety" titleAr="سلامة الغذاء"
      subtitle={new Date().toLocaleDateString(isAr?'ar-SA':'en-US', { weekday:'short', month:'short', day:'numeric' })}
      branchName={branchName}>
      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>

          {error && <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:10, padding:'10px 14px', color:'#9F1239', fontSize:12 }}>{error}</div>}

          {ownerHasAccess === false && (
            <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:10, padding:'10px 14px', color:'#9F1239', fontSize:12, fontWeight:500 }}>
              {isAr ? 'انتهى اشتراك المطعم. لا يمكن إرسال سجلات سلامة الغذاء حتى يتم تجديد الاشتراك.' : 'This restaurant\'s subscription has expired. Food safety records cannot be submitted until it is renewed.'}
            </div>
          )}

          {/* Summary row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[
              { icon:'✅', bg:'#F0FDF4', num:passed, numColor:'#1B4332', label: isAr?'ناجح':'Passed' },
              { icon:'⏰', bg:'#FFFBEB', num:pending, numColor:'#F59E0B', label: isAr?'معلق':'Pending' },
              { icon:'❌', bg:'#FFF1F2', num:failed, numColor:'#E24B4A', label: isAr?'فاشل':'Failed' },
            ].map((s,i) => (
              <div key={['passed','pending','failed'][i]} style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize:20, fontWeight:500, lineHeight:1, color:s.numColor }}>{s.num}</div>
                  <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {standards.length === 0 && (
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:32, textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🛡</div>
              <div style={{ fontSize:14, fontWeight:500, color:'#111827', marginBottom:6 }}>{isAr?'لا توجد معايير بعد':'No standards yet'}</div>
              <div style={{ fontSize:12, color:'#9CA3AF' }}>{isAr?'مالك المطعم لم يُضف معايير سلامة الغذاء بعد':'Your restaurant owner hasn\'t added food safety standards yet'}</div>
            </div>
          )}

          {/* Standards list — pending first */}
          {standards.map(({ standard: std, submission: sub }) => {
            const isTempStd = isTemperatureStd(std)
            const isPending = !sub
            const isPassed  = sub?.result === 'pass'
            const isFailed  = sub?.result === 'fail'
            const isExp     = expanded === std.id
            const isSaving  = submitting[std.id]
            const { icon, bg } = getStandardIcon(std.name)

            const borderColor = isPending ? '#F59E0B' : isPassed ? '#1B4332' : '#E24B4A'
            const opacity     = isPassed ? 0.7 : 1

            // Live temp status
            const tempVal   = tempValues[std.id]
            const liveResult = tempVal ? checkResult(parseFloat(tempVal), std) : null

            return (
              <div key={std.id}
                style={{ background:'#fff', border:`0.5px solid ${isExp?'#1B4332':'#E5E7EB'}`, borderLeft:`3px solid ${borderColor}`, borderRadius:12, overflow:'hidden', opacity:isExp?1:opacity, transition:'all 0.2s' }}
              >
                {/* Standard row */}
                <div
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', cursor:'pointer' }}
                  onClick={() => setExpanded(isExp ? null : std.id)}
                >
                  <div style={{ width:36, height:36, borderRadius:8, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color: isPassed?'#6B7280':'#111827' }}>
                      {isAr ? std.name_ar || std.name : std.name}
                    </div>
                    <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>
                      {isAr?'المطلوب:':'Required:'} {getRangeLabel(std, isAr)}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    {sub?.actual_value !== null && sub?.actual_value !== undefined && (
                      <div style={{ fontSize:11, fontWeight:500, color:'#1B4332' }}>{sub.actual_value}°C</div>
                    )}
                    <div style={{
                      fontSize:11, fontWeight:500, padding:'4px 10px', borderRadius:20,
                      background: isPending?'#FFFBEB':isPassed?'#F0FDF4':'#FFF1F2',
                      color:      isPending?'#92400E':isPassed?'#166534':'#9F1239',
                    }}>
                      {isPending?(isAr?'لم يُرسَل':'Not submitted'):isPassed?(isAr?'ناجح':'Pass'):(isAr?'فاشل':'Fail')}
                    </div>
                    <div style={{ fontSize:11, color:'#9CA3AF', transition:'transform 0.2s', transform:isExp?'rotate(180deg)':'rotate(0)' }}>▼</div>
                  </div>
                </div>

                {/* Expanded form */}
                {isExp && (
                  <div style={{ padding:'0 16px 16px', borderTop:'0.5px solid #F3F4F6' }}>

                    {isPending ? (
                      <>
                        {/* Temperature input */}
                        {isTempStd && (
                          <div style={{ background:'#F9FAFB', border:'0.5px solid #E5E7EB', borderRadius:12, padding:16, display:'flex', alignItems:'center', gap:12, marginTop:10 }}>
                            <div>
                              <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:4 }}>{isAr?'أدخل درجة الحرارة':'Enter temperature'}</div>
                              <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                                <input
                                  type="number"
                                  value={tempValues[std.id] || ''}
                                  onChange={e => setTempValues(p => ({ ...p, [std.id]: e.target.value }))}
                                  placeholder="0"
                                  style={{ border:'none', background:'transparent', fontSize:36, fontWeight:500, color:'#111827', width:90, outline:'none', fontFamily:'inherit' }}
                                />
                                <div style={{ fontSize:24, color:'#9CA3AF', fontWeight:500 }}>°C</div>
                              </div>
                            </div>
                            <div style={{ marginLeft:'auto', textAlign:'right' }}>
                              <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:4 }}>{getRangeLabel(std, isAr)}</div>
                              {liveResult && (
                                <div style={{ fontSize:11, fontWeight:500, marginTop:4, color: liveResult==='pass'?'#1B4332':'#E24B4A' }}>
                                  {liveResult==='pass' ? (isAr?'✓ ضمن النطاق الآمن':'✓ Within safe range') : (isAr?'✗ خارج النطاق الآمن':'✗ Outside safe range')}
                                </div>
                              )}
                              {!liveResult && (
                                <div style={{ fontSize:11, color:'#9CA3AF' }}>{isAr?'أدخل قراءة':'Enter a reading'}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Pass/Fail toggle for compliance checks */}
                        {!isTempStd && (
                          <div style={{ display:'flex', gap:8, marginTop:10 }}>
                            {['pass','fail'].map(v => (
                              <div key={v} onClick={() => setCompliance(p => ({ ...p, [std.id]: v }))}
                                style={{
                                  flex:1, padding:12, borderRadius:8, border:'0.5px solid', cursor:'pointer', textAlign:'center', fontSize:13, fontWeight:500, transition:'all 0.2s',
                                  background:  compliance[std.id]===v ? (v==='pass'?'#F0FDF4':'#FFF1F2') : '#fff',
                                  borderColor: compliance[std.id]===v ? (v==='pass'?'#1B4332':'#E24B4A') : '#E5E7EB',
                                  color:       compliance[std.id]===v ? (v==='pass'?'#1B4332':'#E24B4A') : '#6B7280',
                                }}>
                                {v==='pass' ? (isAr?'✓ ناجح':'✓ Pass') : (isAr?'✗ فاشل':'✗ Fail')}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Note */}
                        <textarea
                          value={notes[std.id] || ''}
                          onChange={e => setNotes(p => ({ ...p, [std.id]: e.target.value }))}
                          placeholder={isAr?'ملاحظة اختيارية...':'Optional note...'}
                          rows={2}
                          style={{ border:'0.5px solid #E5E7EB', borderRadius:8, padding:'8px 10px', fontSize:12, color:'#111827', fontFamily:'inherit', outline:'none', resize:'none', background:'#fff', width:'100%', boxSizing:'border-box', marginTop:8 }}
                          onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'}
                        />

                        {/* Submit button */}
                        <button
                          onClick={() => handleSubmit(std)}
                          disabled={isSaving}
                          style={{ width:'100%', padding:11, background:isSaving?'#6B9E83':'#1B4332', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:isSaving?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:8 }}
                        >
                          {isSaving && <div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                          {isSaving?(isAr?'جارٍ الإرسال…':'Submitting…'):(isAr?'إرسال القراءة':'Submit Reading')}
                        </button>
                      </>
                    ) : (
                      /* Done confirmation */
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#F0FDF4', borderRadius:8, padding:'10px 12px', marginTop:10 }}>
                        <span style={{ color:'#1B4332', fontSize:18 }}>✓</span>
                        <div style={{ fontSize:12, fontWeight:500, color:'#1B4332', flex:1 }}>
                          {sub.actual_value !== null && sub.actual_value !== undefined
                            ? `${sub.actual_value}°C ${isAr?'— تم الإرسال':'— submitted'}`
                            : (sub.result === 'pass' ? (isAr?'ناجح':'Passed') : (isAr?'فاشل':'Failed'))
                          }
                          {sub.corrective_note ? ` · ${sub.corrective_note}` : ''}
                        </div>
                        <div style={{ fontSize:11, color:'#166534' }}>{formatTime(sub.submitted_at)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </BMLayout>
  )
}
