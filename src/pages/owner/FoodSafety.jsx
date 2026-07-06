import { useEffect, useState, useCallback } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { supabaseOwner } from '../../lib/supabase'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useSubscription } from '../../hooks/useSubscription'
import { invalidateCache } from '../../lib/cache'
import SubscriptionGuard from '../../components/SubscriptionGuard'
import OwnerLayout from '../../components/OwnerLayout'

const TEMPLATES = [
  { icon:'🧊', name:'Fridge 1',              nameAr:'ثلاجة 1',            type:'temperature', minTemp:2,   maxTemp:8,    unit:'°C' },
  { icon:'❄️', name:'Freezer 1',             nameAr:'مجمد 1',             type:'temperature', minTemp:null,maxTemp:-18,  unit:'°C' },
  { icon:'🔥', name:'Hot Counter',           nameAr:'كاونتر ساخن',        type:'temperature', minTemp:60,  maxTemp:null, unit:'°C' },
  { icon:'⚖️', name:'Portion Weight Check',  nameAr:'فحص وزن الحصة',      type:'weight',      minTemp:null,maxTemp:null, unit:'kg' },
  { icon:'📦', name:'Food Storage Check',    nameAr:'فحص تخزين الغذاء',   type:'compliance',  minTemp:null,maxTemp:null, unit:null },
  { icon:'✏️', name:'',                      nameAr:'',                    type:'temperature', minTemp:null,maxTemp:null, unit:'°C' },
]

function getIcon(name, type) {
  if (type === 'weight') return { icon:'⚖️', bg:'#FFFBEB' }
  const n = (name || '').toLowerCase()
  if (n.includes('fridge') || n.includes('ثلاجة')) return { icon:'🧊', bg:'#EFF6FF' }
  if (n.includes('freezer') || n.includes('مجمد')) return { icon:'❄️', bg:'#EFF6FF' }
  if (n.includes('hot') || n.includes('ساخن'))    return { icon:'🔥', bg:'#FFF7ED' }
  if (n.includes('storage') || n.includes('تخزين')) return { icon:'📦', bg:'#ECFDF5' }
  return { icon:'🛡', bg:'#F0FDF4' }
}

function getRangeLabel(std, isAr) {
  const unit   = std.standard_type === 'weight' ? (std.unit || 'kg') : '°C'
  const unitAr = std.standard_type === 'weight' ? (std.unit === 'g' ? 'جم' : 'كجم') : '°م'
  if (std.min_temp !== null && std.max_temp !== null) return isAr ? `${std.min_temp}${unitAr} – ${std.max_temp}${unitAr}` : `${std.min_temp}${unit} – ${std.max_temp}${unit}`
  if (std.min_temp !== null) return isAr ? `فوق ${std.min_temp}${unitAr}` : `Above ${std.min_temp}${unit}`
  if (std.max_temp !== null) return isAr ? `تحت ${std.max_temp}${unitAr}` : `Below ${std.max_temp}${unit}`
  return isAr ? 'فحص امتثال' : 'Compliance check'
}

function formatActualValue(std, value) {
  if (value == null) return ''
  if (std.standard_type === 'weight') return `${value} ${std.unit || 'kg'}`
  return `${value}°C`
}

export default function OwnerFoodSafety() {
  const { profile } = useOwnerAuth()
  const { isAr } = useLanguage()
  const { isExpired } = useSubscription()

  const [standards,     setStandards]     = useState([])
  const [fsSubmissions, setFsSubmissions] = useState([])
  const [branches,      setBranches]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  // Form state
  const [tplIdx,    setTplIdx]    = useState(null)
  const [stdName,   setStdName]   = useState('')
  const [stdNameAr, setStdNameAr] = useState('')
  const [stdType,    setStdType]    = useState('temperature') // 'temperature' | 'weight' | 'compliance'
  const [weightUnit, setWeightUnit] = useState('kg') // 'kg' | 'g' — only used when stdType === 'weight'
  const [minTemp,    setMinTemp]    = useState('')
  const [maxTemp,    setMaxTemp]    = useState('')
  const [branches_,  setBranches_] = useState([]) // selected branch IDs, empty = all
  const [saving,    setSaving]    = useState(false)
  const [saveOk,    setSaveOk]    = useState('')
  const [saveErr,   setSaveErr]   = useState('')

  const isMobile = useIsMobile()
  const [showMobileForm, setShowMobileForm] = useState(false)

  const fetchData = useCallback(async () => {
    if (!profile) return
    setError('')
    try {
      const today = new Date().toISOString().split('T')[0]

      const [bRes, stdsRes] = await Promise.all([
        supabaseOwner.from('branches').select('id, name, name_ar').eq('owner_id', profile.id).eq('is_active', true),
        supabaseOwner.from('food_safety_standards').select('id, name, name_ar, min_temp, max_temp, standard_type, unit, branch_id, is_active, created_at').eq('created_by', profile.id).eq('is_active', true).order('created_at', { ascending: false }),
      ])
      if (stdsRes.error) throw stdsRes.error

      if (bRes.error) throw bRes.error
      const branchList = bRes.data || []
      setBranches(branchList)
      setStandards(stdsRes.data || [])

      const bIds = branchList.map(b => b.id)
      if (bIds.length > 0) {
        const { data: fsSubData, error: fsSubErr } = await supabaseOwner
          .from('food_safety_submissions')
          .select('id, standard_id, branch_id, result, actual_value, corrective_note, submitted_at, submitted_by, users(name, name_ar)')
          .in('branch_id', bIds)
          .gte('submitted_at', today + 'T00:00:00.000Z')
          .lte('submitted_at', today + 'T23:59:59.999Z')
          .limit(2000)
        if (fsSubErr) console.error('Food safety submissions fetch error:', fsSubErr)
        setFsSubmissions(fsSubData || [])
      }
    } catch (err) {
      console.error('FoodSafety fetch error:', err)
      setError('Failed to load standards.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!profile?.id) return
    const ch = supabaseOwner
      .channel(`owner-food-safety-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_safety_submissions' },
        () => { invalidateCache(`owner-food-safety-${profile.id}`); fetchData() })
      .subscribe()
    return () => supabaseOwner.removeChannel(ch)
  }, [profile?.id, fetchData])

  function pickTemplate(idx) {
    const tpl = TEMPLATES[idx]
    setTplIdx(idx)
    setStdName(tpl.name)
    setStdNameAr(tpl.nameAr)
    setStdType(tpl.type)
    setWeightUnit(tpl.type === 'weight' ? (tpl.unit || 'kg') : 'kg')
    setMinTemp(tpl.minTemp !== null ? String(tpl.minTemp) : '')
    setMaxTemp(tpl.maxTemp !== null ? String(tpl.maxTemp) : '')
    setSaveErr('')
    setSaveOk('')
  }

  function toggleBranch(id) {
    setBranches_(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveErr('')
    setSaveOk('')

    if (!stdName.trim()) {
      setSaveErr(isAr ? 'اسم المعيار مطلوب' : 'Standard name is required.')
      return
    }

    setSaving(true)
    try {
      const targets = branches_.length > 0 ? branches_ : [null]
      const isNumericType = stdType === 'temperature' || stdType === 'weight'
      const inserts = targets.map(bId => ({
        name:          stdName.trim(),
        name_ar:       stdNameAr.trim() || stdName.trim(),
        branch_id:     bId,
        standard_type: stdType,
        unit:          stdType === 'temperature' ? '°C' : stdType === 'weight' ? weightUnit : null,
        min_temp:      isNumericType && minTemp !== '' ? parseFloat(minTemp) : null,
        max_temp:      isNumericType && maxTemp !== '' ? parseFloat(maxTemp) : null,
        is_active:     true,
        created_by:    profile.id,
      }))

      const { error: insErr } = await supabaseOwner
        .from('food_safety_standards')
        .insert(inserts)

      if (insErr) throw insErr

      setSaveOk(isAr ? '✓ تم حفظ المعيار بنجاح' : '✓ Standard saved successfully.')
      setTplIdx(null)
      setStdName('')
      setStdNameAr('')
      setStdType('temperature')
      setWeightUnit('kg')
      setMinTemp('')
      setMaxTemp('')
      setBranches_([])
      await fetchData()
    } catch (err) {
      console.error(err)
      setSaveErr(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabaseOwner
        .from('food_safety_standards')
        .update({ is_active: false })
        .eq('id', id)
        .eq('created_by', profile.id)
      if (error) throw error
      setStandards(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  function getBranchName(branchId) {
    if (!branchId) return isAr ? 'جميع الفروع' : 'All Branches'
    const b = branches.find(b => b.id === branchId)
    return isAr ? b?.name_ar || b?.name : b?.name || '—'
  }

  const emptyHintAr = isMobile
    ? 'اضغط على زر "إضافة معيار" أعلاه للبدء'
    : 'أضف معايير سلامة الغذاء باستخدام اللوحة على اليمين'

  const emptyHintEn = isMobile
    ? 'Tap "+ Add Standard" above to get started'
    : 'Add food safety standards using the panel on the right'

  const fsTopbarLeft = (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{isAr ? 'سلامة الغذاء' : 'Food Safety'}</span>
      <span style={{ fontSize:12, color:'#9CA3AF' }}>{standards.length} {isAr ? 'معيار' : 'standards'}</span>
    </div>
  )

  const inputStyle = {
    width:'100%', padding:'9px 12px', fontSize:13,
    border:'1.5px solid #E5E7EB', borderRadius:10, outline:'none',
    color:'#111827', fontFamily:'inherit', background:'#fff',
    boxSizing:'border-box', transition:'border-color 0.15s',
  }

  if (loading) return (
    <OwnerLayout activePath="/owner/food-safety" title="Food Safety" titleAr="سلامة الغذاء"
      topbarLeft={fsTopbarLeft} branches={branches}>
      <div style={{ padding:'20px 24px' }}>
        {['a','b','c','d'].map(k => <div key={k} className="skeleton" style={{ height:90, marginBottom:10 }} />)}
      </div>
    </OwnerLayout>
  )

  return (
    <OwnerLayout activePath="/owner/food-safety" title="Food Safety" titleAr="سلامة الغذاء"
      topbarLeft={fsTopbarLeft} branches={branches}>

      {/* Content — split layout */}
      <div style={{ height:'100%', display:'flex', overflow:'hidden' }}>

          {/* LEFT — standards list */}
          {(!isMobile || !showMobileForm) && (
          <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '16px' : '20px 20px 20px 24px' }}>
            {isMobile && (
              <button
                onClick={() => setShowMobileForm(true)}
                style={{ width:'100%', marginBottom:16, padding:'12px', background:'#1B4332', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
              >
                + {isAr ? 'إضافة معيار' : 'Add Standard'}
              </button>
            )}
            {error && <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#9F1239', fontSize:13, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}><span>{error}</span><button onClick={fetchData} style={{ background:'none', border:'1px solid #FECDD3', borderRadius:8, padding:'4px 10px', color:'#9F1239', fontSize:12, cursor:'pointer', flexShrink:0 }}>{isAr?'إعادة المحاولة':'Retry'}</button></div>}

            {standards.length === 0 ? (
              <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:40, textAlign:'center', marginTop:20 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🛡</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:6 }}>{isAr?'لا توجد معايير بعد':'No standards yet'}</div>
                <div style={{ fontSize:13, color:'#6B7280' }}>{isAr ? emptyHintAr : emptyHintEn}</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {standards.map(std => {
                  const { icon, bg }  = getIcon(std.name, std.standard_type)
                  const isNumericStd  = std.standard_type !== 'compliance'
                  const subsForStd    = fsSubmissions.filter(s => s.standard_id === std.id)
                  const applicableBranches = branches.filter(b => std.branch_id === null || std.branch_id === b.id)
                  const branchRows = applicableBranches.map(b => ({
                    branch: b,
                    sub: subsForStd.find(s => s.branch_id === b.id) || null,
                  }))
                  const hasBreakdown = applicableBranches.length > 0
                  const failedCount  = subsForStd.filter(s => s.result === 'fail').length
                  const pendingCount = Math.max(0, applicableBranches.length - subsForStd.length)
                  const isFailed  = failedCount > 0
                  const isPending = pendingCount > 0
                  const isPassed  = !isFailed && !isPending && hasBreakdown
                  const cardBg      = isFailed ? '#FFF1F2' : isPassed ? '#F0FDF4' : '#fff'
                  const borderColor = isFailed ? '#E24B4A' : isPassed ? '#1B4332' : '#F59E0B'
                  return (
                    <div key={std.id}>
                      <div
                        style={{ background:cardBg, border:'1px solid #E5E7EB', borderLeft:`4px solid ${borderColor}`, borderRadius: hasBreakdown?'14px 14px 0 0':14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, transition:'all 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                      >
                        <div style={{ width:36, height:36, borderRadius:8, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:3 }}>
                            {isAr ? std.name_ar || std.name : std.name}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                            <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background: std.standard_type==='weight'?'#FFFBEB':isNumericStd?'#EFF6FF':'#F0FDF4', color: std.standard_type==='weight'?'#B45309':isNumericStd?'#1D4ED8':'#166534' }}>
                              {isNumericStd ? getRangeLabel(std, isAr) : (isAr?'فحص امتثال':'Compliance')}
                            </span>
                            <span style={{ fontSize:10, color:'#9CA3AF', display:'flex', alignItems:'center', gap:3 }}>
                              🏪 {getBranchName(std.branch_id)}
                            </span>
                            {isFailed && (
                              <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#FEE2E2', color:'#991B1B' }}>
                                ✗ {isAr?'فاشل':'Fail'}{applicableBranches.length>1?` (${failedCount})`:''}
                              </span>
                            )}
                            {!isFailed && isPassed && (
                              <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#D1FAE5', color:'#065F46' }}>
                                ✓ {isAr?'ناجح':'Pass'}
                              </span>
                            )}
                            {!isFailed && isPending && (
                              <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#FEF3C7', color:'#92400E' }}>
                                {applicableBranches.length>1
                                  ? `${subsForStd.length}/${applicableBranches.length} ${isAr?'مُرسل':'submitted'}`
                                  : (isAr?'لم يُرسل':'Not submitted')}
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={()=>handleDelete(std.id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#D1D5DB', fontSize:16, padding:4, borderRadius:8, transition:'color 0.15s' }}
                          onMouseEnter={e=>e.target.style.color='#F43F5E'}
                          onMouseLeave={e=>e.target.style.color='#D1D5DB'}
                        >✕</button>
                      </div>
                      {hasBreakdown && (
                        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderTop:'none', borderRadius:'0 0 14px 14px', padding:'10px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                          {branchRows.map(({ branch, sub }) => {
                            const bName   = isAr ? branch.name_ar || branch.name : branch.name
                            const bPassed = sub?.result === 'pass'
                            const mgr     = sub ? (isAr ? sub.users?.name_ar || sub.users?.name : sub.users?.name || '—') : null
                            const time    = sub ? new Date(sub.submitted_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }) : null
                            return (
                              <div key={branch.id} style={{ display:'flex', flexDirection:'column', gap:2 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                  <span style={{ fontSize:11, fontWeight:600, color:'#111827' }}>🏪 {bName}</span>
                                  {sub ? (
                                    <>
                                      <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:10, background: bPassed?'#D1FAE5':'#FEE2E2', color: bPassed?'#065F46':'#991B1B' }}>
                                        {bPassed ? `✓ ${isAr?'ناجح':'Pass'}` : `✗ ${isAr?'فاشل':'Fail'}`}
                                      </span>
                                      {sub.actual_value != null && (
                                        <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:10, background: bPassed?'#D1FAE5':'#FEE2E2', color: bPassed?'#065F46':'#991B1B' }}>
                                          {std.standard_type==='weight'?'⚖️':'🌡'} {formatActualValue(std, sub.actual_value)}
                                        </span>
                                      )}
                                      <span style={{ fontSize:11, color:'#9CA3AF' }}>{mgr} · {time}</span>
                                    </>
                                  ) : (
                                    <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:10, background:'#FEF3C7', color:'#92400E' }}>
                                      {isAr?'لم يُرسل':'Not submitted'}
                                    </span>
                                  )}
                                </div>
                                {sub?.corrective_note && (
                                  <div style={{ fontSize:11, color:'#374151', fontStyle:'italic' }}>"{sub.corrective_note}"</div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )}

          {/* RIGHT — create standard panel */}
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
            <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:4 }}>{isAr?'معيار جديد':'New Standard'}</div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:20 }}>{isAr?'اختر قالباً أو أدخل يدوياً':'Pick a template or enter manually'}</div>

            {/* Templates */}
            <div style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>
              {isAr?'قوالب شائعة':'Common templates'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:6 }}>
              {TEMPLATES.map((tpl, idx) => {
                const isOn   = tplIdx === idx
                const isLast = idx === TEMPLATES.length - 1
                const typeBadge = tpl.type==='temperature' ? { bg:'#EFF6FF', color:'#1D4ED8', label:isAr?'حرارة':'Temp' }
                                : tpl.type==='weight'      ? { bg:'#FFFBEB', color:'#B45309', label:isAr?'وزن':'Weight' }
                                : { bg:'#F0FDF4', color:'#166534', label:isAr?'امتثال':'Check' }
                return (
                  <div key={tpl.name || idx} onClick={()=>pickTemplate(idx)}
                    style={{ borderRadius:12, border:`1.5px solid ${isOn?'#1B4332':'#E5E7EB'}`, background:isOn?'#F0FDF4':'#F9FAFB', cursor:'pointer', padding:'10px 6px', textAlign:'center', transition:'all 0.15s' }}
                    onMouseEnter={e=>{if(!isOn){e.currentTarget.style.borderColor='#BBF7D0';e.currentTarget.style.background='#F0FDF4'}}}
                    onMouseLeave={e=>{if(!isOn){e.currentTarget.style.borderColor='#E5E7EB';e.currentTarget.style.background='#F9FAFB'}}}
                  >
                    <span style={{ fontSize:20, display:'block', marginBottom:4 }}>{tpl.icon || '✏️'}</span>
                    <div style={{ fontSize:10, fontWeight:700, color:isOn?'#1B4332':'#374151' }}>
                      {isLast?(isAr?'مخصص':'Custom'):tpl.name.split(' ')[0]}
                    </div>
                    <span style={{ fontSize:9, fontWeight:600, padding:'2px 5px', borderRadius:20, display:'inline-block', marginTop:2, background:typeBadge.bg, color:typeBadge.color }}>
                      {typeBadge.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:8, margin:'14px 0' }}>
              <div style={{ flex:1, height:1, background:'#F3F4F6' }} />
              <div style={{ fontSize:10, fontWeight:600, color:'#D1D5DB' }}>{isAr?'أو أدخل يدوياً':'OR FILL MANUALLY'}</div>
              <div style={{ flex:1, height:1, background:'#F3F4F6' }} />
            </div>

            {saveOk && <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#166534' }}>{saveOk}</div>}
            {saveErr && <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#9F1239' }}>{saveErr}</div>}

            <form onSubmit={handleSave} noValidate>

              {/* 1. Name */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>1</span>
                  {isAr?'اسم المعيار':'Standard name'}
                </div>
                <input type="text" value={stdName} onChange={e=>{setStdName(e.target.value);setSaveErr('');setSaveOk('')}}
                  placeholder={isAr?'مثال: ثلاجة 1...':'e.g. Fridge 1...'}
                  style={inputStyle}
                  onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
                <input type="text" value={stdNameAr} onChange={e=>setStdNameAr(e.target.value)}
                  placeholder={isAr?'الاسم بالإنجليزية (اختياري)':'Arabic name (optional)'}
                  style={{ ...inputStyle, marginTop:6, direction:'rtl' }}
                  onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
              </div>

              {/* 2. Type */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>2</span>
                  {isAr?'نوع المعيار':'Standard type'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                  {[
                    { val:'temperature', icon:'🌡', label:'Temperature', labelAr:'درجة حرارة' },
                    { val:'weight',      icon:'⚖️', label:'Weight',      labelAr:'الوزن'       },
                    { val:'compliance',  icon:'✓',  label:'Compliance',  labelAr:'امتثال'     },
                  ].map(t => (
                    <div key={t.val} onClick={()=>setStdType(t.val)}
                      style={{ padding:'10px 8px', borderRadius:10, border:`1.5px solid ${stdType===t.val?'#1B4332':'#E5E7EB'}`, background:stdType===t.val?'#F0FDF4':'#F9FAFB', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                      <span style={{ fontSize:18, display:'block', marginBottom:3 }}>{t.icon}</span>
                      <div style={{ fontSize:11, fontWeight:700, color:stdType===t.val?'#1B4332':'#6B7280' }}>{isAr?t.labelAr:t.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Temperature/Weight range (only for numeric types) */}
              {(stdType === 'temperature' || stdType === 'weight') && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:20, height:20, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>3</span>
                    {stdType === 'temperature'
                      ? (isAr?'نطاق الحرارة (°م)':'Temperature range (°C)')
                      : (isAr?`نطاق الوزن (${weightUnit==='kg'?'كجم':'جم'})`:`Weight range (${weightUnit})`)}
                  </div>

                  {stdType === 'weight' && (
                    <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                      {['kg','g'].map(u => (
                        <div key={u} onClick={()=>setWeightUnit(u)}
                          style={{ flex:1, padding:'7px 8px', borderRadius:8, border:`1.5px solid ${weightUnit===u?'#1B4332':'#E5E7EB'}`, background:weightUnit===u?'#F0FDF4':'#F9FAFB', fontSize:11, fontWeight:700, color:weightUnit===u?'#1B4332':'#6B7280', textAlign:'center', cursor:'pointer' }}>
                          {u==='kg'?(isAr?'كجم':'kg'):(isAr?'جم':'g')}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div>
                      <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:4 }}>{isAr?'الحد الأدنى':(stdType==='temperature'?'Min temp':'Min weight')}</div>
                      <input type="number" value={minTemp} onChange={e=>setMinTemp(e.target.value)}
                        placeholder={stdType==='temperature'?(isAr?'مثال: 2':'e.g. 2'):(isAr?'مثال: 0.5':'e.g. 0.5')} style={inputStyle}
                        onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:4 }}>{isAr?'الحد الأقصى':(stdType==='temperature'?'Max temp':'Max weight')}</div>
                      <input type="number" value={maxTemp} onChange={e=>setMaxTemp(e.target.value)}
                        placeholder={stdType==='temperature'?(isAr?'مثال: 8':'e.g. 8'):(isAr?'مثال: 2':'e.g. 2')} style={inputStyle}
                        onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:'#9CA3AF', marginTop:5 }}>
                    {stdType === 'temperature'
                      ? (isAr?'اترك الحد الأدنى فارغاً للمعايير "تحت درجة معينة" والعكس':'Leave min empty for "below X°C" standards and vice versa')
                      : (isAr?'اترك الحد الأدنى فارغاً للمعايير "أقل من X" والعكس':'Leave min empty for "below X" standards and vice versa')}
                  </div>
                </div>
              )}

              {/* 4. Branches */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'#1B4332', color:'#fff', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{stdType==='compliance'?'3':'4'}</span>
                  {isAr?'أي الفروع؟':'Which branches?'}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  <div onClick={()=>setBranches_([])}
                    style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${branches_.length===0?'#1B4332':'#E5E7EB'}`, background:branches_.length===0?'#1B4332':'#F9FAFB', fontSize:12, fontWeight:600, color:branches_.length===0?'#fff':'#6B7280', cursor:'pointer' }}>
                    {isAr?'جميع الفروع':'All Branches'}
                  </div>
                  {branches.map(b => {
                    const isOn = branches_.includes(b.id)
                    return (
                      <div key={b.id} onClick={()=>toggleBranch(b.id)}
                        style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${isOn?'#1B4332':'#E5E7EB'}`, background:isOn?'#F0FDF4':'#F9FAFB', fontSize:12, fontWeight:600, color:isOn?'#1B4332':'#6B7280', cursor:'pointer' }}>
                        {isAr?b.name_ar||b.name:b.name}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Save button */}
              <SubscriptionGuard isExpired={isExpired} isAr={isAr}>
                <button type="submit" disabled={saving}
                  style={{ width:'100%', padding:13, background:saving?'#6B9E83':'#1B4332', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {saving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                  {saving?(isAr?'جارٍ الحفظ…':'Saving…'):(isAr?'حفظ المعيار':'Save Standard')}
                </button>
              </SubscriptionGuard>
            </form>
          </div>
          )}
        </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </OwnerLayout>
  )
}
