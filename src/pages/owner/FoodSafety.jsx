import { useEffect, useState, useCallback, Fragment } from 'react'
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
  const [selectedCell,  setSelectedCell]  = useState(null) // { standardId, branchId }

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

  function cellStatus(std, branchId) {
    if (std.branch_id !== null && std.branch_id !== branchId) return 'none'
    const sub = fsSubmissions.find(s => s.standard_id === std.id && s.branch_id === branchId)
    if (!sub) return 'pending'
    return sub.result === 'pass' ? 'done' : 'missed'
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
              <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
                <div style={{ overflowX:'auto', width:'100%' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth: Math.max(500, branches.length * 120 + 220) }}>
                    <thead>
                      <tr style={{ background:'#F9FAFB', borderBottom:'1px solid #E5E7EB' }}>
                        <th style={{ padding:'10px 16px', textAlign: isAr ? 'right' : 'left', fontSize:11, fontWeight:700, color:'#6B7280', whiteSpace:'nowrap', minWidth:180, position:'sticky', left:0, background:'#F9FAFB', zIndex:2, borderRight:'0.5px solid #E5E7EB' }}>
                          {isAr ? 'المعيار' : 'Standard'}
                        </th>
                        {branches.map(b => (
                          <th key={b.id} style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:600, color:'#111827', minWidth:100, whiteSpace:'nowrap', background:'#F9FAFB', borderBottom:'0.5px solid #E5E7EB' }}>
                            {isAr ? b.name_ar || b.name : b.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {standards.map(std => {
                        const isNumericStd = std.standard_type !== 'compliance'
                        const typeBadge = std.standard_type==='weight' ? { bg:'#FFFBEB', color:'#B45309', label:isAr?'وزن':'Weight' }
                                        : isNumericStd                 ? { bg:'#EFF6FF', color:'#1D4ED8', label:isAr?'حرارة':'Temp' }
                                        :                                 { bg:'#F0FDF4', color:'#166534', label:isAr?'امتثال':'Check' }
                        const isExpRow = selectedCell?.standardId === std.id
                        const expSub   = isExpRow ? fsSubmissions.find(s => s.standard_id === std.id && s.branch_id === selectedCell.branchId) : null
                        return (
                          <Fragment key={std.id}>
                            <tr style={{ borderBottom: isExpRow ? 'none' : '0.5px solid #F3F4F6' }}>
                              <td style={{ padding:'9px 16px', fontSize:13, fontWeight:500, color:'#111827', position:'sticky', left:0, background:'#fff', zIndex:1, borderRight:'0.5px solid #E5E7EB', minWidth:180 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>
                                      {isAr ? std.name_ar || std.name : std.name}
                                    </div>
                                    <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                                      <span style={{ fontSize:9, fontWeight:600, padding:'1px 6px', borderRadius:20, background:typeBadge.bg, color:typeBadge.color }}>
                                        {typeBadge.label}
                                      </span>
                                      <span style={{ fontSize:10, color:'#9CA3AF' }}>
                                        {isNumericStd ? getRangeLabel(std, isAr) : (isAr?'فحص امتثال':'Compliance check')}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDelete(std.id)}
                                    style={{ background:'none', border:'none', cursor:'pointer', color:'#D1D5DB', fontSize:10, padding:'2px 4px', fontFamily:'inherit', flexShrink:0, lineHeight:1 }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#F43F5E'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}
                                    title={isAr ? 'حذف' : 'Delete'}
                                  >✕</button>
                                </div>
                              </td>

                              {branches.map(branch => {
                                const status   = cellStatus(std, branch.id)
                                const isActive = selectedCell?.standardId === std.id && selectedCell?.branchId === branch.id
                                const sub       = (status === 'done' || status === 'missed')
                                  ? fsSubmissions.find(s => s.standard_id === std.id && s.branch_id === branch.id)
                                  : null
                                const CELL_CFG = {
                                  done:    { bg:'#F0FDF4', border:'#BBF7D0', color:'#1B4332', tablerIcon:'ti-check',     cursor:'pointer' },
                                  missed:  { bg:'#FEF2F2', border:'#FECACA', color:'#DC2626', tablerIcon:'ti-x',         cursor:'pointer' },
                                  pending: { bg:'#FFFBEB', border:'#FDE68A', color:'#92400E', tablerIcon:'ti-hourglass', cursor:'default' },
                                  none:    { bg:'#F3F4F6', border:'#E5E7EB', color:'#D1D5DB', tablerIcon:null,           cursor:'default' },
                                }
                                const cfg       = CELL_CFG[status] || CELL_CFG.none
                                const clickable = status === 'done' || status === 'missed'
                                const valueText = sub?.actual_value != null ? formatActualValue(std, sub.actual_value) : null
                                return (
                                  <td key={branch.id} style={{ padding:'6px', textAlign:'center' }}>
                                    <span
                                      onClick={clickable ? () => setSelectedCell(prev =>
                                        prev?.standardId === std.id && prev?.branchId === branch.id
                                          ? null
                                          : { standardId: std.id, branchId: branch.id }
                                      ) : undefined}
                                      style={{
                                        display:'inline-flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                                        width:40, height:44, borderRadius:8, fontSize:14, lineHeight:1.2,
                                        background: isActive ? cfg.color : cfg.bg,
                                        color:      isActive ? '#fff'    : cfg.color,
                                        cursor:     cfg.cursor,
                                        border:     `0.5px solid ${isActive ? cfg.color : cfg.border}`,
                                        transition: 'all 0.15s',
                                      }}
                                    >
                                      {cfg.tablerIcon ? <i className={`ti ${cfg.tablerIcon}`} /> : '—'}
                                      {valueText && (
                                        <span style={{ fontSize:10, color: isActive ? '#fff' : cfg.color, marginTop:2 }}>{valueText}</span>
                                      )}
                                    </span>
                                  </td>
                                )
                              })}
                            </tr>
                            {isExpRow && expSub && (
                              <tr>
                                <td colSpan={branches.length + 1} style={{ padding:'12px 16px', background: expSub.result==='pass'?'#F0FDF4':'#FFF1F2', borderBottom:'1px solid #E5E7EB', borderTop: expSub.result==='pass'?'1px solid #BBF7D0':'1px solid #FECDD3' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                    <span style={{ fontSize:11, fontWeight:600, color: expSub.result==='pass'?'#1B4332':'#9F1239' }}>
                                      {isAr ? expSub.users?.name_ar || expSub.users?.name : expSub.users?.name || '—'}
                                    </span>
                                    <span style={{ fontSize:11, color:'#9CA3AF' }}>
                                      · {new Date(expSub.submitted_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })}
                                    </span>
                                    {expSub.actual_value != null && (
                                      <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:10, background: expSub.result==='pass'?'#D1FAE5':'#FEE2E2', color: expSub.result==='pass'?'#065F46':'#991B1B' }}>
                                        {std.standard_type==='weight'?'⚖️':'🌡'} {formatActualValue(std, expSub.actual_value)}
                                      </span>
                                    )}
                                    {expSub.corrective_note && (
                                      <span style={{ fontSize:11, color:'#374151', fontStyle:'italic' }}>"{expSub.corrective_note}"</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div style={{ padding:'10px 16px', borderTop:'1px solid #F3F4F6', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                  {[
                    { tablerIcon:'ti-check',     bg:'#F0FDF4', color:'#1B4332', label:'Pass',           labelAr:'ناجح'      },
                    { tablerIcon:'ti-hourglass', bg:'#FFFBEB', color:'#92400E', label:'Not submitted',  labelAr:'لم يُرسل'  },
                    { tablerIcon:'ti-x',         bg:'#FEF2F2', color:'#DC2626', label:'Fail',           labelAr:'فاشل'      },
                    { tablerIcon:null,           bg:'#F3F4F6', color:'#D1D5DB', label:'Not applicable', labelAr:'غير مطبق'  },
                  ].map(l => (
                    <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:22, height:22, borderRadius:6, background:l.bg, color:l.color, fontSize:12, display:'inline-flex', alignItems:'center', justifyContent:'center', border:'1px solid #E5E7EB' }}>
                        {l.tablerIcon ? <i className={`ti ${l.tablerIcon}`} /> : '—'}
                      </span>
                      <span style={{ fontSize:11, color:'#6B7280' }}>{isAr ? l.labelAr : l.label}</span>
                    </div>
                  ))}
                </div>
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
