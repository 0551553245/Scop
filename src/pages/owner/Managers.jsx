import { useEffect, useState, useCallback } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Link } from 'react-router-dom'
import { supabaseOwner } from '../../lib/supabase'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { getExpectedForBranch, calcRate } from '../../lib/stats'
import { useSubscription } from '../../hooks/useSubscription'
import { getCached, setCached, invalidateCache } from '../../lib/cache'
import SubscriptionGuard from '../../components/SubscriptionGuard'
import NotificationBell from '../../components/NotificationBell'
import { useLanguage } from '../../context/LanguageContext'
import OwnerLayout from '../../components/OwnerLayout'
import ErrorBanner from '../../components/ErrorBanner'

const AVATAR_COLORS = ['#1B4332','#3B82F6','#7C3AED','#F59E0B','#EF4444','#0891B2','#059669','#DC2626']

function getColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function perfColor(score) {
  if (score >= 85) return '#1B4332'
  if (score >= 65) return '#F59E0B'
  return '#F43F5E'
}

export default function OwnerManagers() {
  const { profile } = useOwnerAuth()
  const { isAr, toggleLang } = useLanguage()
  const { subscription, isExpired } = useSubscription()

  // ── DATA ──────────────────────────────────────────────────
  const [managers,  setManagers]  = useState([])
  const [branches,  setBranches]  = useState([])
  const [perfMap,   setPerfMap]   = useState({})
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  // ── ADD MANAGER MODAL ─────────────────────────────────────
  const [showModal,    setShowModal]    = useState(false)
  const [mName,        setMName]        = useState('')
  const [mNameAr,      setMNameAr]      = useState('')
  const [mEmail,       setMEmail]       = useState('')
  const [mPhone,       setMPhone]       = useState('')
  const [mPassword,    setMPassword]    = useState('')
  const [mBranchId,    setMBranchId]    = useState('')
  const [mShowPass,    setMShowPass]    = useState(false)
  const [modalErr,     setModalErr]     = useState('')
  const [modalSaving,  setModalSaving]  = useState(false)
  const [modalSuccess, setModalSuccess] = useState('')

  const isMobile = useIsMobile()

  // ── FETCH ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!profile) return
    setError('')

    const cacheKey = `owner-managers-${profile.id}`
    const cached   = getCached(cacheKey)
    if (cached) {
      setBranches(cached.branches)
      setManagers(cached.managers)
      setPerfMap(cached.perfMap)
      setLoading(false)
    }

    try {
      const today = new Date().toISOString().split('T')[0]

      // Owner's branches
      const { data: branchData, error: bErr } = await supabaseOwner
        .from('branches')
        .select('id, name, name_ar, manager_id')
        .eq('owner_id', profile.id)
        .eq('is_active', true)

      if (bErr) throw bErr
      const allBranches = branchData || []
      setBranches(allBranches)

      const managerIds = allBranches.filter(b => b.manager_id).map(b => b.manager_id)
      const branchIds  = allBranches.map(b => b.id)

      if (managerIds.length === 0) {
        setManagers([])
        setPerfMap({})
        setCached(cacheKey, { branches: allBranches, managers: [], perfMap: {} }, 30000)
        setLoading(false)
        return
      }

      const [mgrRes, taskSubsRes, fsSubsRes, taskDefsRes, fsStdsRes] = await Promise.all([
        supabaseOwner.from('users').select('id, name, name_ar, email, phone, is_active').in('id', managerIds).eq('role', 'branch_manager'),
        supabaseOwner.from('task_submissions').select('branch_id, status').in('branch_id', branchIds).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(1000),
        supabaseOwner.from('food_safety_submissions').select('branch_id, result').in('branch_id', branchIds).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`),
        Promise.all([
          supabaseOwner.from('tasks').select('id, branch_id').in('branch_id', branchIds).eq('is_active', true).eq('frequency', 'daily'),
          supabaseOwner.from('tasks').select('id, branch_id').is('branch_id', null).eq('created_by', profile.id).eq('is_active', true).eq('frequency', 'daily'),
        ]).then(([bRes, gRes]) => ({ data: [...(bRes.data||[]), ...(gRes.data||[])], error: bRes.error || gRes.error })),
        supabaseOwner.from('food_safety_standards').select('id, branch_id').eq('created_by', profile.id).eq('is_active', true),
      ])

      if (mgrRes.error)      throw mgrRes.error
      if (taskDefsRes.error) throw taskDefsRes.error
      if (taskSubsRes.error) console.error('Task submissions fetch error:', taskSubsRes.error)
      if (fsSubsRes.error)   console.error('Food safety submissions fetch error:', fsSubsRes.error)
      if (fsStdsRes.error)   console.error('Food safety standards fetch error:', fsStdsRes.error)
      const allManagers = mgrRes.data      || []
      const taskSubs    = taskSubsRes.data  || []
      const fsSubs      = fsSubsRes.data    || []
      const taskDefs    = taskDefsRes.data  || []
      const fsStds      = fsStdsRes.data    || []

      // Build performance per manager (via their branch)
      const perf = {}
      allManagers.forEach(mgr => {
        const branch = allBranches.find(b => b.manager_id === mgr.id)
        if (!branch) return

        const bTasks    = (taskSubs || []).filter(t => t.branch_id === branch.id)
        const bFs       = (fsSubs   || []).filter(f => f.branch_id === branch.id)
        const done      = bTasks.filter(t => t.status === 'completed').length
        const bExpected = getExpectedForBranch(branch.id, taskDefs)
        const taskPct   = bExpected > 0 ? calcRate(done, bExpected) : null
        const fsPassed = bFs.filter(f => f.result === 'pass').length
        const bStds    = fsStds.filter(s => s.branch_id === branch.id || s.branch_id === null)
        const fsTotal  = bStds.length
        const fsPct    = fsTotal > 0 ? calcRate(fsPassed, fsTotal) : null
        const score    = taskPct !== null || fsPct !== null
          ? Math.round((taskPct ?? 50) * 0.6 + (fsPct ?? 50) * 0.4)
          : null

        perf[mgr.id] = {
          score,
          branchName:   isAr ? branch.name_ar || branch.name : branch.name,
          branchId:     branch.id,
        }
      })
      setPerfMap(perf)

      // Attach branch info to managers
      const enriched = allManagers.map(mgr => ({
        ...mgr,
        branch: allBranches.find(b => b.manager_id === mgr.id) || null,
      }))
      setManagers(enriched)
      setCached(cacheKey, { branches: allBranches, managers: enriched, perfMap: perf }, 30000)

    } catch (err) {
      console.error('Managers fetch error:', err)
      setError(isAr ? 'فشل تحميل المديرين' : 'Failed to load managers.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // ── REAL-TIME ─────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    const ch = supabaseOwner.channel(`managers-${profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'branches' }, () => { invalidateCache(`owner-managers-${profile.id}`); fetchData() })
      .on('postgres_changes', { event:'*', schema:'public', table:'task_submissions' }, () => { invalidateCache(`owner-managers-${profile.id}`); fetchData() })
      .on('postgres_changes', { event:'*', schema:'public', table:'users' }, () => { invalidateCache(`owner-managers-${profile.id}`); fetchData() })
      .subscribe()
    return () => supabaseOwner.removeChannel(ch)
  }, [profile?.id, fetchData])

  // ── CREATE MANAGER ACCOUNT ────────────────────────────────
  // Owner creates manager account — manager CANNOT self-register
  async function handleAddManager(e) {
    e.preventDefault()
    setModalErr('')
    setModalSuccess('')

    if (!mName.trim())     { setModalErr(isAr ? 'الاسم مطلوب'             : 'Name is required.');          return }
    if (!mEmail.trim())    { setModalErr(isAr ? 'البريد الإلكتروني مطلوب' : 'Email is required.');         return }
    if (!mBranchId)        { setModalErr(isAr ? 'اختر فرعاً'              : 'Please select a branch.');     return }
    if (mPassword.length < 8) { setModalErr(isAr ? 'كلمة المرور ٨ أحرف على الأقل' : 'Password must be at least 8 characters.'); return }

    if (subscription && managers.length >= subscription.managers_limit) {
      setModalErr(isAr
        ? `وصلت إلى الحد الأقصى (${subscription.managers_limit} مديرين). قم بالترقية لإضافة المزيد.`
        : `Manager limit reached (${subscription.managers_limit} managers). Upgrade to add more.`)
      return
    }

    // Check branch doesn't already have a manager
    const branch = branches.find(b => b.id === mBranchId)
    if (branch?.manager_id) {
      setModalErr(isAr ? 'هذا الفرع لديه مدير بالفعل' : 'This branch already has a manager.')
      return
    }

    setModalSaving(true)

    try {
      const { data, error } = await supabaseOwner.functions.invoke(
        'create-manager',
        {
          body: {
            email:    mEmail.trim(),
            password: mPassword,
            name:     mName.trim(),
            nameAr:   mNameAr.trim() || mName.trim(),
            phone:    mPhone.trim() || null,
            branchId: mBranchId,
            ownerId:  profile.id,
          },
        }
      )

      if (error || data?.error) {
        const msg = data?.error || error?.message || 'Failed to create manager'
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          setModalErr(isAr ? 'هذا البريد الإلكتروني مسجل بالفعل' : 'This email is already registered')
        } else {
          setModalErr(isAr ? 'حدث خطأ أثناء إنشاء الحساب' : msg)
        }
        return
      }

      // Success — reset form and refresh list
      setMName(''); setMNameAr(''); setMEmail('')
      setMPhone(''); setMPassword(''); setMBranchId('')
      setModalSuccess(isAr ? 'تم إضافة المدير بنجاح' : 'Manager added successfully')
      invalidateCache(`owner-managers-${profile.id}`)
      await fetchData()

    } catch (err) {
      console.error('Managers action error:', err)
      setModalErr(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.')
    } finally {
      setModalSaving(false)
    }
  }

  function closeModal() {
    setShowModal(false)
    setMName(''); setMNameAr(''); setMEmail('')
    setMPhone(''); setMPassword(''); setMBranchId('')
    setModalErr(''); setModalSuccess('')
  }

  // Available branches (no manager yet)
  const availableBranches = branches.filter(b => !b.manager_id)

  const atManagerLimit = !!(
    subscription &&
    subscription.managers_limit != null &&
    managers.length >= subscription.managers_limit
  )

  const managersTopbarLeft = (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{isAr ? 'المديرون' : 'Managers'}</span>
      <span style={{ fontSize:12, fontWeight:500, color:'#9CA3AF' }}>{managers.length} {isAr ? 'نشط' : 'active'}</span>
    </div>
  )
  const managersTopbarRight = (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'1px solid #E5E7EB', padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
      <NotificationBell isAr={isAr} />
      <SubscriptionGuard isExpired={isExpired} isAr={isAr}>
        <button
          onClick={() => { setShowModal(true); setModalErr(''); setModalSuccess('') }}
          disabled={atManagerLimit}
          aria-label={isAr ? 'إضافة مدير' : 'Add manager'}
          title={atManagerLimit ? (isAr ? `وصلت إلى الحد الأقصى (${subscription.managers_limit} مديرين)` : `Manager limit reached (${subscription.managers_limit} managers)`) : undefined}
          style={{ background: atManagerLimit ? '#9CA3AF' : '#1B4332', color:'#fff', border:'none', padding: isMobile ? '8px' : '8px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor: atManagerLimit ? 'not-allowed' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', minWidth: isMobile ? 44 : 'auto', minHeight: isMobile ? 44 : 'auto' }}
        >
          {isMobile ? '+' : (isAr ? '+ إضافة مدير' : '+ Add Manager')}
        </button>
      </SubscriptionGuard>
    </div>
  )

  const inputStyle = {
    width:'100%', padding:'9px 12px', fontSize:13,
    border:'1px solid #E5E7EB', borderRadius:8, outline:'none',
    color:'#111827', fontFamily:'inherit', background:'#fff',
    boxSizing:'border-box', transition:'border-color 0.15s',
  }
  const labelStyle = {
    display:'block', fontSize:11, fontWeight:600, color:'#6B7280',
    marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px',
  }

  if (loading) return (
    <OwnerLayout activePath="/owner/managers" title="Managers" titleAr="المديرون"
      topbarLeft={managersTopbarLeft} topbarRight={managersTopbarRight}>
      <div style={{ padding:'20px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 8 : 14 }}>
          {['a','b','c','d','e','f'].map(k => <div key={k} className="skeleton" style={{ height: isMobile ? 68 : 160 }} />)}
        </div>
      </div>
    </OwnerLayout>
  )

  return (
    <OwnerLayout activePath="/owner/managers" title="Managers" titleAr="المديرون"
      topbarLeft={managersTopbarLeft} topbarRight={managersTopbarRight}>

      {/* Content */}
      <div style={{ padding:'20px 24px' }}>

          <ErrorBanner message={error} isAr={isAr} onRetry={fetchData} />

          {/* No branches warning */}
          {branches.length === 0 && (
            <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:14, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>⚠️</span>
              <div style={{ fontSize:13, color:'#92400E' }}>
                {isAr ? 'أضف فرعاً أولاً قبل إنشاء حسابات المديرين.' : 'Add a branch first before creating manager accounts.'}
                {' '}<Link to="/owner/branches" style={{ color:'#1B4332', fontWeight:600 }}>{isAr?'إضافة فرع →':'Add Branch →'}</Link>
              </div>
            </div>
          )}

          {/* Empty state */}
          {managers.length === 0 && branches.length > 0 ? (
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:48, textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:14 }}>👥</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#111827', marginBottom:6 }}>{isAr?'لا يوجد مديرون بعد':'No managers yet'}</div>
              <div style={{ fontSize:13, color:'#6B7280', marginBottom:24 }}>{isAr?'أنشئ حسابات المديرين وعيّنهم في الفروع':'Create manager accounts and assign them to branches'}</div>
              <SubscriptionGuard isExpired={isExpired} isAr={isAr}>
                <button onClick={()=>setShowModal(true)} style={{ padding:'10px 28px', background:'#1B4332', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  + {isAr?'إضافة مدير':'Add Manager'}
                </button>
              </SubscriptionGuard>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 8 : 12 }}>
              {managers.map(mgr => {
                const p     = perfMap[mgr.id] || {}
                const score = p.score ?? null
                const color = getColor(mgr.name)
                const init  = getInitials(mgr.name)
                const bName = isAr ? mgr.branch?.name_ar || mgr.branch?.name : mgr.branch?.name

                if (isMobile) return (
                  <div key={mgr.id}
                    style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}
                  >
                    {/* Avatar */}
                    <div style={{ width:44, height:44, borderRadius:12, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff', flexShrink:0, position:'relative' }}>
                      {init}
                      <div style={{ position:'absolute', bottom:-2, right:-2, width:10, height:10, borderRadius:'50%', border:'2px solid #fff', background: mgr.is_active ? '#10B981' : '#D1D5DB' }} />
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {isAr ? mgr.name_ar || mgr.name : mgr.name}
                      </div>
                      <div style={{ fontSize:11, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mgr.email}</div>
                      {bName && (
                        <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#F0FDF4', color:'#166534', fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, marginTop:4 }}>
                          🏪 {bName}
                        </div>
                      )}
                    </div>

                    {/* Performance */}
                    <div style={{ flexShrink:0, textAlign:'right', minWidth:52 }}>
                      <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-0.5px', color: score !== null ? perfColor(score) : '#D1D5DB' }}>
                        {score !== null ? score : '—'}
                      </div>
                      <div style={{ height:4, background:'#F3F4F6', borderRadius:20, overflow:'hidden', width:52, marginTop:4 }}>
                        <div style={{ height:'100%', width:`${score ?? 0}%`, background: score !== null ? perfColor(score) : '#E5E7EB', borderRadius:20 }} />
                      </div>
                      {score === null && (
                        <div style={{ fontSize:9, color:'#9CA3AF', marginTop:4 }}>{isAr?'لا بيانات':'No data'}</div>
                      )}
                    </div>
                  </div>
                )

                return (
                  <div key={mgr.id}
                    style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:18, padding:20, transition:'all 0.2s', cursor:'default' }}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(27,67,50,0.08)';e.currentTarget.style.transform='translateY(-2px)'}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='translateY(0)'}}
                  >
                    {/* Header */}
                    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                      <div style={{ width:48, height:48, borderRadius:16, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff', flexShrink:0, position:'relative' }}>
                        {init}
                        <div style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderRadius:'50%', border:'2px solid #fff', background: mgr.is_active ? '#10B981' : '#D1D5DB' }} />
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {isAr ? mgr.name_ar || mgr.name : mgr.name}
                        </div>
                        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mgr.email}</div>
                      </div>
                    </div>

                    {/* Branch tag */}
                    {bName && (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#F0FDF4', color:'#166534', fontSize:11, fontWeight:600, padding:'5px 12px', borderRadius:20, marginBottom:14 }}>
                        🏪 {bName}
                      </div>
                    )}

                    {/* Performance score */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ fontSize:12, color:'#9CA3AF' }}>{isAr?'الأداء':'Performance'}</div>
                      <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.5px', color: score !== null ? perfColor(score) : '#D1D5DB' }}>
                        {score !== null ? score : '—'}
                      </div>
                    </div>
                    <div style={{ height:6, background:'#F3F4F6', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${score ?? 0}%`, background: score !== null ? perfColor(score) : '#E5E7EB', borderRadius:20, transition:'width 0.5s ease' }} />
                    </div>

                    {/* No data hint */}
                    {score === null && (
                      <div style={{ fontSize:11, color:'#9CA3AF', marginTop:6, textAlign:'center' }}>
                        {isAr?'لا توجد بيانات اليوم بعد':'No submissions today yet'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      {/* ── ADD MANAGER MODAL ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}
          onClick={e=>{ if(e.target===e.currentTarget) closeModal() }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, width:'100%', maxWidth:500, boxShadow:'0 8px 32px rgba(0,0,0,0.12)', maxHeight:'90vh', overflowY:'auto' }}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#111827' }}>{isAr?'إضافة مدير جديد':'Add New Manager'}</div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{isAr?'سيتلقى المدير بيانات تسجيل الدخول':'Manager will receive login credentials'}</div>
              </div>
              <button onClick={closeModal} style={{ background:'none', border:'none', fontSize:18, color:'#9CA3AF', cursor:'pointer', padding:4 }}>✕</button>
            </div>

            {/* Error */}
            {modalErr && (
              <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#9F1239', display:'flex', alignItems:'center', gap:8 }}>
                <span>⚠</span>{modalErr}
              </div>
            )}

            {/* Success */}
            {modalSuccess && (
              <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#166534', display:'flex', alignItems:'center', gap:8 }}>
                <span>✓</span>{modalSuccess}
              </div>
            )}

            <form onSubmit={handleAddManager} noValidate>

              {/* Name row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={labelStyle}>{isAr?'الاسم (EN) *':'Full Name (EN) *'}</label>
                  <input type="text" value={mName} onChange={e=>{setMName(e.target.value);setModalErr('')}}
                    placeholder="Ahmed Hassan" style={inputStyle}
                    onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
                </div>
                <div>
                  <label style={labelStyle}>{isAr?'الاسم (AR)':'Full Name (AR)'}</label>
                  <input type="text" value={mNameAr} onChange={e=>setMNameAr(e.target.value)}
                    placeholder="أحمد حسن" style={{ ...inputStyle, direction:'rtl' }}
                    onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom:12 }}>
                <label style={labelStyle}>{isAr?'البريد الإلكتروني *':'Email Address *'}</label>
                <input type="email" value={mEmail} onChange={e=>{setMEmail(e.target.value);setModalErr('')}}
                  placeholder="manager@restaurant.com" style={{ ...inputStyle, direction:'ltr' }}
                  onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
              </div>

              {/* Phone */}
              <div style={{ marginBottom:12 }}>
                <label style={labelStyle}>{isAr?'رقم الهاتف':'Phone Number'}</label>
                <input type="tel" value={mPhone} onChange={e=>setMPhone(e.target.value)}
                  placeholder="+966 5X XXX XXXX" style={{ ...inputStyle, direction:'ltr' }}
                  onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
              </div>

              {/* Branch */}
              <div style={{ marginBottom:12 }}>
                <label style={labelStyle}>{isAr?'الفرع *':'Assign to Branch *'}</label>
                <select value={mBranchId} onChange={e=>{setMBranchId(e.target.value);setModalErr('')}}
                  style={{ ...inputStyle, cursor:'pointer' }}>
                  <option value="">{isAr?'— اختر فرعاً —':'— Select a branch —'}</option>
                  {availableBranches.map(b => (
                    <option key={b.id} value={b.id}>{isAr ? b.name_ar || b.name : b.name}</option>
                  ))}
                </select>
                {availableBranches.length === 0 && (
                  <div style={{ fontSize:11, color:'#F59E0B', marginTop:4 }}>
                    {isAr?'جميع الفروع لديها مديرون بالفعل':'All branches already have managers assigned.'}
                  </div>
                )}
              </div>

              {/* Password */}
              <div style={{ marginBottom:24 }}>
                <label style={labelStyle}>{isAr?'كلمة المرور *':'Password *'}</label>
                <div style={{ position:'relative' }}>
                  <input type={mShowPass?'text':'password'} value={mPassword} onChange={e=>{setMPassword(e.target.value);setModalErr('')}}
                    placeholder={isAr?'٨ أحرف على الأقل':'Min. 8 characters'}
                    style={{ ...inputStyle, paddingRight:36 }}
                    onFocus={e=>e.target.style.borderColor='#1B4332'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
                  <button type="button" onClick={()=>setMShowPass(p=>!p)}
                    style={{ position:'absolute', top:'50%', right:10, transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:0, display:'flex', alignItems:'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      {mShowPass
                        ? <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></>
                      }
                    </svg>
                  </button>
                </div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>
                  {isAr?'شارك كلمة المرور مع المدير بشكل آمن':'Share this password with the manager securely'}
                </div>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={closeModal}
                  style={{ flex:1, padding:10, borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', background:'#F9FAFB', color:'#374151', border:'1px solid #E5E7EB', fontFamily:'inherit' }}>
                  {isAr?'إلغاء':'Cancel'}
                </button>
                <button type="submit" disabled={modalSaving || availableBranches.length===0}
                  style={{ flex:2, padding:10, borderRadius:10, fontSize:13, fontWeight:600, cursor: modalSaving?'not-allowed':'pointer', background: modalSaving?'#6B9E83':'#1B4332', color:'#fff', border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {modalSaving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                  {modalSaving ? (isAr?'جارٍ الإنشاء…':'Creating…') : (isAr?'إنشاء الحساب':'Create Account')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select { appearance: auto; }
      `}</style>
    </OwnerLayout>
  )
}
