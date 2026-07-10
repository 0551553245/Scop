import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabaseAdmin, supabaseTemp } from '../../lib/supabase'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { getPlatformSettings, getPerBranchPricing } from '../../lib/platformSettings'
import { getCached, setCached, invalidateCache } from '../../lib/cache'
import AdminLayout from '../../components/AdminLayout'
import ErrorBanner from '../../components/ErrorBanner'
import { formatDate, daysLeft, calculateExpiry } from '../../lib/adminHelpers'

function formatWhatsAppPhone(phone) {
  let digits = phone.replace(/[\s\-+]/g, '')
  digits = digits.replace(/^0+/, '')
  if (!digits.startsWith('966')) digits = '966' + digits
  return digits
}

const PLAN_BADGE = {
  per_branch: { bg:'#EFF6FF', color:'#1D4ED8' },
  starter: { bg:'#EFF6FF', color:'#1D4ED8' },
  growth:  { bg:'#F0FDF4', color:'#166534' },
  pro:     { bg:'#FDF4FF', color:'#7E22CE' },
  trial:   { bg:'#FFFBEB', color:'#92400E' },
}

const STATUS_BADGE = {
  active:  { bg:'#DCFCE7', color:'#166534', text:'Active',  textAr:'نشط'   },
  trial:   { bg:'#FEF3C7', color:'#D97706', text:'Trial',   textAr:'تجربة' },
  expired: { bg:'#FEE2E2', color:'#DC2626', text:'Expired', textAr:'منتهي' },
  blocked: { bg:'#F3F4F6', color:'#6B7280', text:'Blocked', textAr:'محظور' },
}

function rowBg(sub) {
  if (!sub) return '#fff'
  if (sub.status === 'expired' || sub.status === 'blocked') return '#FFF1F2'
  const d = daysLeft(sub.expires_at)
  if (sub.status === 'trial' && d !== null && d >= 0 && d <= 7) return '#FFFBEB'
  return '#fff'
}

const inputStyle = {
  width:'100%', padding:'9px 12px', fontSize:13,
  border:'0.5px solid #E5E7EB', borderRadius:8, outline:'none',
  color:'#111827', fontFamily:'inherit', background:'#fff',
  boxSizing:'border-box', transition:'border-color 0.15s',
}

const labelStyle = {
  display:'block', fontSize:11, fontWeight:600, color:'#6B7280',
  marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px',
}

export default function AdminRestaurants() {
  const navigate              = useNavigate()
  const [searchParams]        = useSearchParams()
  const { profile, signOut }  = useAdminAuth()
  const { isAr, toggleLang }  = useLanguage()
  const isMobile = useIsMobile()

  const [activeTab, setActiveTab] = useState('owners')

  // ── OWNERS STATE ──────────────────────────────────────────
  const [owners,      setOwners]     = useState([])
  const [totalCount,  setTotalCount] = useState(0)
  const [page,        setPage]       = useState(0)
  const [pricing,     setPricing]    = useState(getPerBranchPricing({}))
  const [loading,     setLoading]    = useState(true)
  const [error,       setError]      = useState('')
  const [search,        setSearch]       = useState('')
  const [statusFilter,  setStatusFilter] = useState('all')
  const [planFilter,    setPlanFilter]   = useState('all')

  const PAGE_SIZE = 15

  // ── MANAGERS STATE ────────────────────────────────────────
  const [managers,       setManagers]      = useState([])
  const [mgLoading,      setMgLoading]     = useState(true)
  const [mgError,        setMgError]       = useState('')
  const [mgSearch,       setMgSearch]      = useState('')
  const [mgStatusFilter, setMgStatusFilter] = useState('all')

  // ── DRAWER STATE ──────────────────────────────────────────
  const [drawerOwner,    setDrawerOwner]    = useState(null)
  const [actBranchCount, setActBranchCount] = useState(1)
  const [actDuration,    setActDuration]    = useState(1)
  const [actAmount,      setActAmount]      = useState(getPerBranchPricing({}).calculateMonthlyAmount(1))
  const [actNote,        setActNote]        = useState('')
  const [actBranchesLim, setActBranchesLim] = useState(1)
  const [actManagersLim, setActManagersLim] = useState(getPerBranchPricing({}).calculateManagersLimit(1))
  const [actErr,         setActErr]         = useState('')
  const [actSaving,      setActSaving]      = useState(false)
  const [drawerMsg,      setDrawerMsg]      = useState('')
  const [drawerBusy,     setDrawerBusy]     = useState(false)

  // ── CREATE OWNER MODAL STATE ──────────────────────────────
  const [showCreate,    setShowCreate]    = useState(false)
  const [cName,         setCName]         = useState('')
  const [cNameAr,       setCNameAr]       = useState('')
  const [cEmail,        setCEmail]        = useState('')
  const [cPhone,        setCPhone]        = useState('')
  const [cPassword,     setCPassword]     = useState('')
  const [createErr,     setCreateErr]     = useState('')
  const [createSaving,  setCreateSaving]  = useState(false)
  const [createSuccess, setCreateSuccess] = useState('')

  async function logAction(action, description, targetId, targetType, metadata) {
    await supabaseAdmin.from('activity_log').insert({
      action, description,
      actor_id: profile.id,
      target_id: targetId || null,
      target_type: targetType || null,
      metadata: metadata || null,
    })
  }

  // ── FETCH OWNERS ──────────────────────────────────────────
  const fetchOwners = useCallback(async () => {
    setError('')

    const cacheKey = `admin-restaurants-${profile.id}`
    const cached   = getCached(cacheKey)
    if (cached) {
      setOwners(cached.owners)
      setTotalCount(cached.totalCount)
      setPricing(cached.pricing)
      setLoading(false)
    }

    try {
      const settings = await getPlatformSettings(supabaseAdmin)
      const branchPricing = getPerBranchPricing(settings)
      setPricing(branchPricing)

      const { data: ownersData, error: ownersErr, count } = await supabaseAdmin
        .from('users')
        .select('id, name, name_ar, email, phone, created_at, is_active', { count: 'exact' })
        .eq('role', 'owner')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (ownersErr) {
        console.error('Owners query error:', JSON.stringify(ownersErr))
        throw ownersErr
      }

      setTotalCount(count || 0)

      const ownerIds = (ownersData || []).map(o => o.id)

      const [branchesRes, managersRes, { data: subsData }] = await Promise.all([
        supabaseAdmin.from('branches').select('id, name, name_ar, owner_id').in('owner_id', ownerIds).eq('is_active', true),
        supabaseAdmin.from('users').select('id, branch_id').eq('role', 'branch_manager').eq('is_active', true),
        supabaseAdmin.from('subscriptions').select('id, owner_id, plan, status, branches_limit, managers_limit, expires_at, trial_ends_at').in('owner_id', ownerIds),
      ])

      if (branchesRes.error) throw branchesRes.error
      if (managersRes.error) throw managersRes.error

      const subsMap     = Object.fromEntries((subsData || []).map(s => [s.owner_id, s]))
      const allBranches = branchesRes.data || []
      const allManagers = managersRes.data || []

      let adminCreatedIds = new Set()
      if (ownerIds.length > 0) {
        const { data: logEntries } = await supabaseAdmin
          .from('activity_log')
          .select('target_id')
          .eq('action', 'owner_created')
          .in('target_id', ownerIds)
        adminCreatedIds = new Set((logEntries || []).map(l => l.target_id))
      }

      const combined = (ownersData || []).map(owner => {
        const subscription    = subsMap[owner.id] || null
        const ownerBranches   = allBranches.filter(b => b.owner_id === owner.id)
        const branchIds       = new Set(ownerBranches.map(b => b.id))
        const managersUsed    = allManagers.filter(m => branchIds.has(m.branch_id)).length
        const source          = adminCreatedIds.has(owner.id) ? 'admin' : 'self'
        const firstBranch     = ownerBranches[0] || null
        const extraBranchCount = Math.max(0, ownerBranches.length - 1)
        return { ...owner, subscription, branchesUsed: ownerBranches.length, managersUsed, source, firstBranch, extraBranchCount }
      })

      setOwners(combined)
      setCached(cacheKey, { owners: combined, totalCount: count || 0, pricing: branchPricing }, 60000)
    } catch (err) {
      console.error('Restaurants fetch error:', err)
      setError('Failed to load restaurants.')
    } finally {
      setLoading(false)
    }
  }, [page, profile?.id])

  // ── FETCH MANAGERS ────────────────────────────────────────
  const fetchManagers = useCallback(async () => {
    setMgError('')
    try {
      const { data, error: err } = await supabaseAdmin
        .from('users')
        .select('id, name, name_ar, email, phone, is_active, created_at, branches!branches_manager_id_fkey(name, name_ar, owner_id, users!branches_owner_id_fkey(name))')
        .eq('role', 'branch_manager')
        .order('created_at', { ascending: false })

      if (err) throw err

      const enriched = (data || []).map(m => {
        const branch = Array.isArray(m.branches) ? m.branches[0] : m.branches
        const owner  = branch ? (Array.isArray(branch.users) ? branch.users[0] : branch.users) : null
        return { ...m, branch, owner }
      })

      setManagers(enriched)
    } catch (err) {
      console.error('Managers fetch error:', err)
      setMgError('Failed to load managers.')
    } finally {
      setMgLoading(false)
    }
  }, [])

  useEffect(() => { fetchOwners() }, [fetchOwners])
  useEffect(() => { fetchManagers() }, [fetchManagers])

  // ── REAL-TIME ─────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    const channel = supabaseAdmin
      .channel(`admin-restaurants-${profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'users' },         () => { invalidateCache(`admin-restaurants-${profile.id}`); fetchOwners(); fetchManagers() })
      .on('postgres_changes', { event:'*', schema:'public', table:'subscriptions' },  () => { invalidateCache(`admin-restaurants-${profile.id}`); fetchOwners() })
      .on('postgres_changes', { event:'*', schema:'public', table:'branches' },       () => { invalidateCache(`admin-restaurants-${profile.id}`); fetchOwners(); fetchManagers() })
      .subscribe()
    return () => supabaseAdmin.removeChannel(channel)
  }, [profile, fetchOwners, fetchManagers])

  // Deep link: /admin/restaurants?owner=<id>
  useEffect(() => {
    const ownerId = searchParams.get('owner')
    if (ownerId && owners.length > 0) {
      const target = owners.find(o => o.id === ownerId)
      if (target) openDrawer(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, owners.length])

  function openDrawer(owner) {
    const existingBranches = owner.subscription?.branches_limit ?? 1
    setDrawerOwner(owner)
    setActBranchCount(existingBranches)
    setActDuration(1)
    setActAmount(owner.subscription?.monthly_amount ?? pricing.calculateMonthlyAmount(existingBranches))
    setActNote('')
    setActBranchesLim(existingBranches)
    setActManagersLim(owner.subscription?.managers_limit ?? pricing.calculateManagersLimit(existingBranches))
    setActErr('')
    setDrawerMsg('')
  }

  function closeDrawer() {
    setDrawerOwner(null)
    setActErr('')
    setDrawerMsg('')
  }

  function handleBranchCountChange(n) {
    setActBranchCount(n)
    if (pricing.isEnterprise(n)) return // enterprise = manual override, no formula
    setActAmount(pricing.calculateMonthlyAmount(n))
    setActBranchesLim(n)
    setActManagersLim(pricing.calculateManagersLimit(n))
  }

  async function handleSaveActivation(e) {
    e.preventDefault()
    setActErr('')
    if (!actBranchesLim || actBranchesLim < 1) { setActErr(isAr ? 'حد الفروع غير صالح' : 'Invalid branches limit.'); return }
    if (!actManagersLim || actManagersLim < 1) { setActErr(isAr ? 'حد المديرين غير صالح' : 'Invalid managers limit.'); return }
    if (actAmount < 0) { setActErr(isAr ? 'المبلغ غير صالح' : 'Invalid amount.'); return }

    setActSaving(true)
    try {
      const expiresAt = calculateExpiry(actDuration)

      const { error: subErr } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          owner_id:       drawerOwner.id,
          plan:           'per_branch',
          status:         'active',
          branches_limit: Number(actBranchesLim),
          managers_limit: Number(actManagersLim),
          monthly_amount: Number(actAmount),
          expires_at:     expiresAt,
        }, { onConflict: 'owner_id' })

      if (subErr) throw subErr

      const { error: billErr } = await supabaseAdmin
        .from('billing_history')
        .insert({
          owner_id: drawerOwner.id,
          plan:     'per_branch',
          amount:   Number(actAmount),
          currency: 'SAR',
          status:   'paid',
          note:     actNote.trim() || null,
          paid_at:  new Date().toISOString(),
        })

      if (billErr) throw billErr

      await logAction('subscription_activated', `Activated per-branch plan (${actBranchesLim} branches) for ${drawerOwner.name}`, drawerOwner.id, 'subscription', { plan: 'per_branch', branches: Number(actBranchesLim), amount: Number(actAmount) })

      invalidateCache(`admin-restaurants-${profile.id}`)
      closeDrawer()
      await fetchOwners()
    } catch (err) {
      console.error('Activation save error:', err)
      setActErr(isAr ? 'حدث خطأ أثناء الحفظ' : 'Something went wrong while saving.')
    } finally {
      setActSaving(false)
    }
  }

  async function handleExtendTrial() {
    if (!drawerOwner?.subscription) return
    setDrawerBusy(true)
    setDrawerMsg('')
    try {
      const base      = drawerOwner.subscription.expires_at ? new Date(drawerOwner.subscription.expires_at) : new Date()
      const newExpiry = new Date(Math.max(base.getTime(), Date.now()) + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { error: err } = await supabaseAdmin
        .from('subscriptions')
        .update({ expires_at: newExpiry, trial_ends_at: newExpiry })
        .eq('owner_id', drawerOwner.id)

      if (err) throw err

      await logAction('trial_extended', `Extended trial by 7 days for ${drawerOwner.name}`, drawerOwner.id, 'subscription')
      invalidateCache(`admin-restaurants-${profile.id}`)
      setDrawerMsg(isAr ? 'تم تمديد التجربة 7 أيام' : 'Trial extended by 7 days.')
      await fetchOwners()
    } catch (err) {
      console.error('Extend trial error:', err)
      setDrawerMsg(isAr ? 'فشل التمديد' : 'Failed to extend trial.')
    } finally {
      setDrawerBusy(false)
    }
  }

  async function handleResetPassword() {
    if (!drawerOwner) return
    setDrawerBusy(true)
    setDrawerMsg('')
    try {
      const { error: err } = await supabaseAdmin.auth.resetPasswordForEmail(drawerOwner.email)
      if (err) throw err

      await logAction('password_reset_sent', `Password reset email sent to ${drawerOwner.name}`, drawerOwner.id, 'user')
      setDrawerMsg(isAr ? 'تم إرسال رابط إعادة التعيين' : 'Reset link sent.')
    } catch (err) {
      console.error('Reset password error:', err)
      setDrawerMsg(isAr ? 'فشل إرسال الرابط' : 'Failed to send reset link.')
    } finally {
      setDrawerBusy(false)
    }
  }

  async function handleToggleBlock(owner) {
    const isBlocked  = owner.subscription?.status === 'blocked'
    const nextStatus = isBlocked ? 'active' : 'blocked'

    setOwners(prev => prev.map(o => o.id === owner.id
      ? { ...o, subscription: o.subscription ? { ...o.subscription, status: nextStatus } : o.subscription }
      : o
    ))
    if (drawerOwner?.id === owner.id) {
      setDrawerOwner(prev => prev ? { ...prev, subscription: { ...prev.subscription, status: nextStatus } } : prev)
    }

    try {
      const [subRes, userRes] = await Promise.all([
        supabaseAdmin.from('subscriptions').update({ status: nextStatus }).eq('owner_id', owner.id),
        supabaseAdmin.from('users').update({ is_active: isBlocked }).eq('id', owner.id),
      ])
      if (subRes.error) throw subRes.error
      if (userRes.error) throw userRes.error

      invalidateCache(`admin-restaurants-${profile.id}`)
      await logAction(isBlocked ? 'owner_unblocked' : 'owner_blocked', `${isBlocked ? 'Unblocked' : 'Blocked'} ${owner.name}`, owner.id, 'user')
    } catch (err) {
      console.error('Block/unblock error:', err)
      setError(isAr ? 'فشل تحديث الحالة' : 'Failed to update status.')
      await fetchOwners()
    }
  }

  async function handleCreateOwner(e) {
    e.preventDefault()
    setCreateErr('')
    setCreateSuccess('')

    if (!cName.trim())        { setCreateErr(isAr ? 'الاسم مطلوب' : 'Name is required.'); return }
    if (!cEmail.trim())       { setCreateErr(isAr ? 'البريد الإلكتروني مطلوب' : 'Email is required.'); return }
    if (cPassword.length < 8) { setCreateErr(isAr ? 'كلمة المرور ٨ أحرف على الأقل' : 'Password must be at least 8 characters.'); return }

    setCreateSaving(true)
    try {
      const { data: authData, error: authErr } = await supabaseTemp.auth.signUp({
        email:    cEmail.trim(),
        password: cPassword,
        options: { data: { role: 'owner', name: cName.trim() } },
      })

      if (authErr) {
        setCreateErr(authErr.message?.toLowerCase().includes('already')
          ? (isAr ? 'البريد الإلكتروني مستخدم بالفعل' : 'Email already in use.')
          : (authErr.message || (isAr ? 'حدث خطأ' : 'Something went wrong.')))
        setCreateSaving(false)
        return
      }

      const ownerId = authData.user?.id
      if (!ownerId) {
        setCreateErr(isAr ? 'حدث خطأ أثناء إنشاء الحساب' : 'Failed to create account.')
        setCreateSaving(false)
        return
      }

      try {
        const { error: usersErr } = await supabaseAdmin
          .from('users')
          .upsert({
            id:        ownerId,
            email:     cEmail.trim(),
            name:      cName.trim(),
            name_ar:   cNameAr.trim() || cName.trim(),
            phone:     cPhone.trim() || null,
            role:      'owner',
            is_active: true,
          })
        if (usersErr) throw usersErr

        const trialExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

        const { error: subErr } = await supabaseAdmin
          .from('subscriptions')
          .insert({
            owner_id:       ownerId,
            plan:           'trial',
            status:         'trial',
            branches_limit: 1,
            managers_limit: 1,
            expires_at:     trialExpiry,
            trial_ends_at:  trialExpiry,
          })
        if (subErr) throw subErr

        await logAction('owner_created', 'New owner account created: ' + cName.trim(), ownerId, 'user')

        setCreateSuccess(isAr
          ? `تم إنشاء حساب ${cName} بنجاح — البريد: ${cEmail}`
          : `${cName}'s account created — email: ${cEmail}`)
        setCName(''); setCNameAr(''); setCEmail(''); setCPhone(''); setCPassword('')
        invalidateCache(`admin-restaurants-${profile.id}`)
        await fetchOwners()
      } catch (innerErr) {
        console.error('Owner creation partial failure:', ownerId, innerErr)
        setCreateErr(isAr
          ? 'تم إنشاء الحساب ولكن فشل حفظ البيانات. تواصل مع الدعم.'
          : 'Account created but profile save failed. Contact support.')
      }
    } catch (err) {
      console.error('Create owner error:', err)
      setCreateErr(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.')
    } finally {
      setCreateSaving(false)
    }
  }

  function closeCreateModal() {
    setShowCreate(false)
    setCName(''); setCNameAr(''); setCEmail(''); setCPhone(''); setCPassword('')
    setCreateErr(''); setCreateSuccess('')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  const filteredOwners = owners.filter(o => {
    if (statusFilter !== 'all' && o.subscription?.status !== statusFilter) return false
    if (planFilter   !== 'all' && o.subscription?.plan   !== planFilter)   return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!(o.name || '').toLowerCase().includes(q) && !(o.email || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const filteredManagers = managers.filter(m => {
    if (mgStatusFilter === 'active'   && !m.is_active) return false
    if (mgStatusFilter === 'inactive' && m.is_active)  return false
    if (mgSearch.trim()) {
      const q = mgSearch.trim().toLowerCase()
      if (!(m.name || '').toLowerCase().includes(q) && !(m.email || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  if (loading && mgLoading) return (
    <AdminLayout currentPath="/admin/restaurants" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Restaurants" titleAr="المطاعم">
      <div style={{ padding:'20px 24px' }}>
        <div className="skeleton" style={{ height:420 }} />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout currentPath="/admin/restaurants" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Restaurants" titleAr="المطاعم" topbarRight={
      isMobile ? (
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'4px 11px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
            {isAr ? 'EN' : 'ع'}
          </button>
          {activeTab === 'owners' && (
            <button onClick={() => setShowCreate(true)}
              aria-label={isAr ? 'مالك جديد' : 'New Owner'}
              style={{ background:'#1B4332', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', minWidth:44, minHeight:44 }}>
              +
            </button>
          )}
        </div>
      ) : (
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {activeTab === 'owners' ? (
              <>
                <input
                  value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                  placeholder={isAr ? 'بحث بالاسم أو البريد...' : 'Search name or email...'}
                  style={{ fontSize:12, padding:'6px 12px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', width:180, fontFamily:'inherit' }}
                />
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }} style={{ fontSize:12, padding:'6px 10px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
                  <option value="all">{isAr ? 'كل الحالات' : 'All Status'}</option>
                  <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                  <option value="trial">{isAr ? 'تجربة' : 'Trial'}</option>
                  <option value="expired">{isAr ? 'منتهي' : 'Expired'}</option>
                  <option value="blocked">{isAr ? 'محظور' : 'Blocked'}</option>
                </select>
                <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0) }} style={{ fontSize:12, padding:'6px 10px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
                  <option value="all">{isAr ? 'كل الخطط' : 'All Plans'}</option>
                  <option value="per_branch">{isAr ? 'لكل فرع' : 'Per-Branch'}</option>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="pro">Pro</option>
                </select>
                <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
                  {isAr ? 'EN' : 'ع'}
                </button>
                <button onClick={() => setShowCreate(true)} style={{ background:'#1B4332', color:'#fff', border:'none', padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  + {isAr ? 'مالك جديد' : 'New Owner'}
                </button>
              </>
            ) : (
              <>
                <input
                  value={mgSearch} onChange={e => setMgSearch(e.target.value)}
                  placeholder={isAr ? 'بحث بالاسم أو البريد...' : 'Search name or email...'}
                  style={{ fontSize:12, padding:'6px 12px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', width:180, fontFamily:'inherit' }}
                />
                <select value={mgStatusFilter} onChange={e => setMgStatusFilter(e.target.value)} style={{ fontSize:12, padding:'6px 10px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
                  <option value="all">{isAr ? 'الكل' : 'All'}</option>
                  <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                  <option value="inactive">{isAr ? 'غير نشط' : 'Inactive'}</option>
                </select>
                <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
                  {isAr ? 'EN' : 'ع'}
                </button>
              </>
            )}
      </div>
      )
    }>
      <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>

          {/* Mobile-only: search + filters moved out of the topbar */}
          {isMobile && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {activeTab === 'owners' ? (
                <>
                  <input
                    value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                    placeholder={isAr ? 'بحث بالاسم أو البريد...' : 'Search name or email...'}
                    style={{ fontSize:13, padding:'9px 12px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }}
                  />
                  <div style={{ display:'flex', gap:8 }}>
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }} style={{ flex:1, fontSize:12, padding:'8px 10px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
                      <option value="all">{isAr ? 'كل الحالات' : 'All Status'}</option>
                      <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                      <option value="trial">{isAr ? 'تجربة' : 'Trial'}</option>
                      <option value="expired">{isAr ? 'منتهي' : 'Expired'}</option>
                      <option value="blocked">{isAr ? 'محظور' : 'Blocked'}</option>
                    </select>
                    <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0) }} style={{ flex:1, fontSize:12, padding:'8px 10px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
                      <option value="all">{isAr ? 'كل الخطط' : 'All Plans'}</option>
                      <option value="per_branch">{isAr ? 'لكل فرع' : 'Per-Branch'}</option>
                      <option value="starter">Starter</option>
                      <option value="growth">Growth</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <input
                    value={mgSearch} onChange={e => setMgSearch(e.target.value)}
                    placeholder={isAr ? 'بحث بالاسم أو البريد...' : 'Search name or email...'}
                    style={{ fontSize:13, padding:'9px 12px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }}
                  />
                  <select value={mgStatusFilter} onChange={e => setMgStatusFilter(e.target.value)} style={{ fontSize:12, padding:'8px 10px', borderRadius:20, border:'0.5px solid #E5E7EB', outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
                    <option value="all">{isAr ? 'الكل' : 'All'}</option>
                    <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                    <option value="inactive">{isAr ? 'غير نشط' : 'Inactive'}</option>
                  </select>
                </>
              )}
            </div>
          )}

          {/* Tab strip */}
          <div style={{ display:'flex', marginBottom:20, borderBottom:'0.5px solid #E5E7EB' }}>
            {[
              { key:'owners',   label: isAr ? 'الملاك' : 'Owners',    count: totalCount      },
              { key:'managers', label: isAr ? 'المديرون' : 'Managers', count: managers.length },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                background:'none', border:'none', cursor:'pointer', padding:'10px 16px',
                fontSize:13, fontWeight: activeTab === tab.key ? 500 : 400,
                color: activeTab === tab.key ? '#1B4332' : '#6B7280',
                borderBottom: activeTab === tab.key ? '2px solid #1B4332' : '2px solid transparent',
                marginBottom:-1, fontFamily:'inherit',
              }}>
                {tab.label}
                <span style={{ marginLeft: isAr ? 0 : 6, marginRight: isAr ? 6 : 0, fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:10, background: activeTab === tab.key ? '#F0FDF4' : '#F3F4F6', color: activeTab === tab.key ? '#1B4332' : '#9CA3AF' }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── OWNERS TAB ── */}
          {activeTab === 'owners' && (
            <>
              <ErrorBanner message={error} isAr={isAr} />

              <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20, marginBottom:16 }}>
                {loading ? (
                  <div className="skeleton" style={{ height:200 }} />
                ) : filteredOwners.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'48px 0', color:'#9CA3AF' }}>
                    <i className="ti ti-building-store" style={{ fontSize:40, marginBottom:12, display:'block' }} />
                    <div style={{ fontSize:14 }}>{isAr ? 'لا توجد مطاعم مطابقة' : 'No matching restaurants'}</div>
                  </div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ borderBottom:'0.5px solid #E5E7EB' }}>
                          {[
                            isAr?'المطعم':'Restaurant', isAr?'الخطة':'Plan',
                            isAr?'الحالة':'Status', isAr?'الفروع':'Branches',
                            isAr?'تاريخ الانضمام':'Joined', isAr?'إجراء':'Action',
                          ].map(h => (
                            <th key={h} style={{ textAlign: isAr?'right':'left', padding:'8px 6px', color:'#9CA3AF', fontWeight:600, fontSize:11, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOwners.map(o => {
                          const sub         = o.subscription
                          const planKey     = sub?.plan || 'trial'
                          const statusKey   = sub?.status || 'trial'
                          const planBadge   = PLAN_BADGE[planKey]    || PLAN_BADGE.trial
                          const statusBadge = STATUS_BADGE[statusKey] || STATUS_BADGE.trial
                          return (
                            <tr key={o.id} style={{ borderBottom:'0.5px solid #F3F4F6', background: rowBg(sub) }}>
                              <td style={{ padding:'10px 6px' }}>
                                {o.firstBranch ? (
                                  <>
                                    <div style={{ color:'#111827', fontWeight:600, fontSize:13 }}>
                                      {isAr ? o.firstBranch.name_ar || o.firstBranch.name : o.firstBranch.name}
                                      {o.extraBranchCount > 0 && (
                                        <span style={{ fontSize:11, color:'#9CA3AF', fontWeight:400, marginLeft: isAr?0:4, marginRight: isAr?4:0 }}>
                                          (+{o.extraBranchCount} {isAr ? 'أكثر' : 'more'})
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ color:'#9CA3AF', fontSize:11, marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
                                      <span>{isAr ? o.name_ar || o.name : o.name} · {o.email}</span>
                                      {o.phone && (
                                        <a
                                          href={`https://wa.me/${formatWhatsAppPhone(o.phone)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          aria-label="Contact on WhatsApp"
                                          onClick={e => e.stopPropagation()}
                                          style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#25D366', fontSize:14, flexShrink:0 }}
                                        >
                                          <i className="ti ti-brand-whatsapp" />
                                        </a>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ color:'#6B7280', fontSize:13, fontStyle:'italic' }}>{isAr ? '(لا يوجد فرع بعد)' : '(No branch yet)'}</div>
                                    <div style={{ color:'#9CA3AF', fontSize:11, marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
                                      <span>{isAr ? o.name_ar || o.name : o.name} · {o.email}</span>
                                      {o.phone && (
                                        <a
                                          href={`https://wa.me/${formatWhatsAppPhone(o.phone)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          aria-label="Contact on WhatsApp"
                                          onClick={e => e.stopPropagation()}
                                          style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#25D366', fontSize:14, flexShrink:0 }}
                                        >
                                          <i className="ti ti-brand-whatsapp" />
                                        </a>
                                      )}
                                    </div>
                                  </>
                                )}
                              </td>
                              <td style={{ padding:'10px 6px' }}>
                                <span style={{ background: planBadge.bg, color: planBadge.color, fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, textTransform: planKey === 'per_branch' ? 'none' : 'capitalize' }}>
                                  {planKey === 'per_branch'
                                    ? `${sub?.branches_limit ?? '—'} ${isAr ? 'فروع' : 'branches'}`
                                    : (sub?.plan || 'trial')}
                                </span>
                              </td>
                              <td style={{ padding:'10px 6px' }}>
                                <span style={{ background: statusBadge.bg, color: statusBadge.color, fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:20 }}>
                                  ● {isAr ? statusBadge.textAr : statusBadge.text}
                                </span>
                              </td>
                              <td style={{ padding:'10px 6px', color:'#374151' }}>{o.branchesUsed} / {sub?.branches_limit ?? '—'}</td>
                              <td style={{ padding:'10px 6px', color:'#374151', whiteSpace:'nowrap' }}>{formatDate(o.created_at, isAr)}</td>
                              <td style={{ padding:'10px 6px' }}>
                                <button onClick={() => openDrawer(o)}
                                  style={{ fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:8, background:'#F0FDF4', color:'#1B4332', border:'0.5px solid #BBF7D0', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                                  {isAr ? '← إدارة' : 'Manage →'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {totalCount > PAGE_SIZE && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 4px' }}>
                  <div style={{ fontSize:12, color:'#6B7280' }}>
                    {isAr
                      ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} من ${totalCount} مطعم`
                      : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount} restaurants`}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      style={{ fontSize:12, fontWeight:600, padding:'6px 14px', borderRadius:8, border:'0.5px solid #E5E7EB', background: page === 0 ? '#F9FAFB' : '#fff', color: page === 0 ? '#9CA3AF' : '#374151', cursor: page === 0 ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                      {isAr ? 'السابق' : 'Previous'}
                    </button>
                    <span style={{ fontSize:12, color:'#374151', display:'flex', alignItems:'center', padding:'0 8px' }}>
                      {isAr ? `صفحة ${page + 1} من ${Math.ceil(totalCount / PAGE_SIZE)}` : `Page ${page + 1} of ${Math.ceil(totalCount / PAGE_SIZE)}`}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= totalCount}
                      style={{ fontSize:12, fontWeight:600, padding:'6px 14px', borderRadius:8, border:'0.5px solid #E5E7EB', background: (page + 1) * PAGE_SIZE >= totalCount ? '#F9FAFB' : '#1B4332', color: (page + 1) * PAGE_SIZE >= totalCount ? '#9CA3AF' : '#fff', cursor: (page + 1) * PAGE_SIZE >= totalCount ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                      {isAr ? 'التالي' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── MANAGERS TAB ── */}
          {activeTab === 'managers' && (
            <>
              {mgError && (
                <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#9F1239', fontSize:13 }}>{mgError}</div>
              )}

              <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
                {mgLoading ? (
                  <div className="skeleton" style={{ height:200 }} />
                ) : filteredManagers.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'48px 0', color:'#9CA3AF' }}>
                    <i className="ti ti-users" style={{ fontSize:40, marginBottom:12, display:'block' }} />
                    <div style={{ fontSize:14 }}>{isAr ? 'لا يوجد مديرون مطابقون' : 'No matching managers'}</div>
                  </div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ borderBottom:'0.5px solid #E5E7EB' }}>
                          {[
                            isAr?'المدير':'Manager', isAr?'الفرع':'Branch',
                            isAr?'المطعم':'Restaurant', isAr?'الحالة':'Status',
                            isAr?'تاريخ الانضمام':'Joined', isAr?'الهاتف':'Phone',
                          ].map(h => (
                            <th key={h} style={{ textAlign: isAr?'right':'left', padding:'8px 6px', color:'#9CA3AF', fontWeight:600, fontSize:11, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredManagers.map(m => (
                          <tr key={m.id} style={{ borderBottom:'0.5px solid #F3F4F6', background: m.is_active ? '#fff' : '#FFF1F2' }}>
                            <td style={{ padding:'10px 6px' }}>
                              <div style={{ color:'#111827', fontWeight:600 }}>{isAr ? m.name_ar || m.name : m.name}</div>
                              <div style={{ color:'#9CA3AF', fontSize:11 }}>{m.email}</div>
                            </td>
                            <td style={{ padding:'10px 6px', color:'#374151', whiteSpace:'nowrap' }}>
                              {m.branch ? (isAr ? m.branch.name_ar || m.branch.name : m.branch.name) : '—'}
                            </td>
                            <td style={{ padding:'10px 6px', color:'#374151', whiteSpace:'nowrap' }}>{m.owner?.name || '—'}</td>
                            <td style={{ padding:'10px 6px' }}>
                              <span style={{ fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:20, background: m.is_active ? '#DCFCE7' : '#F3F4F6', color: m.is_active ? '#166534' : '#6B7280' }}>
                                ● {m.is_active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                              </span>
                            </td>
                            <td style={{ padding:'10px 6px', color:'#374151', whiteSpace:'nowrap' }}>{formatDate(m.created_at, isAr)}</td>
                            <td style={{ padding:'10px 6px', color:'#374151' }}>{m.phone || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
      </div>

    {/* ── MANAGE DRAWER ── */}
      {drawerOwner && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', justifyContent: isAr ? 'flex-start' : 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) closeDrawer() }}>
          <div style={{ background:'#fff', width:'100%', maxWidth:380, height:'100%', overflowY:'auto', padding:24, boxShadow:'-8px 0 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#111827' }}>{isAr ? drawerOwner.name_ar || drawerOwner.name : drawerOwner.name}</div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{drawerOwner.email}</div>
              </div>
              <button onClick={closeDrawer} style={{ background:'none', border:'none', fontSize:18, color:'#9CA3AF', cursor:'pointer', padding:4 }}>✕</button>
            </div>

            {drawerMsg && (
              <div style={{ background:'#F0FDF4', border:'0.5px solid #BBF7D0', borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:12, color:'#166534' }}>{drawerMsg}</div>
            )}

            <div style={{ background:'#F9FAFB', borderRadius:10, padding:14, marginBottom:16, fontSize:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ color:'#9CA3AF' }}>{isAr ? 'الهاتف' : 'Phone'}</span>
                <span style={{ color:'#111827', fontWeight:600 }}>{drawerOwner.phone || '—'}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ color:'#9CA3AF' }}>{isAr ? 'تاريخ الانضمام' : 'Joined'}</span>
                <span style={{ color:'#111827', fontWeight:600 }}>{formatDate(drawerOwner.created_at, isAr)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ color:'#9CA3AF' }}>{isAr ? 'الفروع' : 'Branches'}</span>
                <span style={{ color:'#111827', fontWeight:600 }}>{drawerOwner.branchesUsed} / {drawerOwner.subscription?.branches_limit ?? '—'}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'#9CA3AF' }}>{isAr ? 'المديرون' : 'Managers'}</span>
                <span style={{ color:'#111827', fontWeight:600 }}>{drawerOwner.managersUsed} / {drawerOwner.subscription?.managers_limit ?? '—'}</span>
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {drawerOwner.subscription?.status === 'trial' && (
                <button onClick={handleExtendTrial} disabled={drawerBusy}
                  style={{ flex:1, fontSize:11, fontWeight:600, padding:'8px 6px', borderRadius:8, background:'#EFF6FF', color:'#1D4ED8', border:'none', cursor: drawerBusy ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                  {isAr ? '+ 7 أيام' : '+7 Days'}
                </button>
              )}
              <button onClick={handleResetPassword} disabled={drawerBusy}
                style={{ flex:1, fontSize:11, fontWeight:600, padding:'8px 6px', borderRadius:8, background:'#F9FAFB', color:'#374151', border:'0.5px solid #E5E7EB', cursor: drawerBusy ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                {isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
              </button>
              <button onClick={() => handleToggleBlock(drawerOwner)}
                style={{ flex:1, fontSize:11, fontWeight:600, padding:'8px 6px', borderRadius:8, background: drawerOwner.subscription?.status === 'blocked' ? '#F0FDF4' : '#FEE2E2', color: drawerOwner.subscription?.status === 'blocked' ? '#166534' : '#991B1B', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                {drawerOwner.subscription?.status === 'blocked' ? (isAr ? 'إلغاء الحظر' : 'Unblock') : (isAr ? 'حظر' : 'Block')}
              </button>
            </div>

            <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:12 }}>{isAr ? 'تفعيل الاشتراك' : 'Activate Subscription'}</div>

            {actErr && (
              <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:12, color:'#9F1239' }}>{actErr}</div>
            )}

            <form onSubmit={handleSaveActivation} noValidate>
              <div style={{ marginBottom:12 }}>
                <label style={labelStyle}>{isAr ? 'عدد الفروع' : 'Branch Count'}</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6, marginBottom:6 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <button key={n} type="button" onClick={() => handleBranchCountChange(n)}
                      style={{
                        padding:'8px 0', fontSize:13, fontWeight:600,
                        background: !pricing.isEnterprise(actBranchCount) && actBranchCount === n ? '#1B4332' : '#fff',
                        color:      !pricing.isEnterprise(actBranchCount) && actBranchCount === n ? '#fff'    : '#111827',
                        border: !pricing.isEnterprise(actBranchCount) && actBranchCount === n ? '1.5px solid #1B4332' : '0.5px solid #E5E7EB',
                        borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => handleBranchCountChange(10)}
                  style={{
                    width:'100%', padding:'8px 0', fontSize:12, fontWeight:600,
                    background: pricing.isEnterprise(actBranchCount) ? '#1B4332' : '#fff',
                    color:      pricing.isEnterprise(actBranchCount) ? '#fff'    : '#111827',
                    border: pricing.isEnterprise(actBranchCount) ? '1.5px solid #1B4332' : '0.5px solid #E5E7EB',
                    borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                  }}>
                  {isAr ? '١٠+ (مؤسسات)' : '10+ (Enterprise)'}
                </button>
                {pricing.isEnterprise(actBranchCount) && (
                  <div style={{ fontSize:11, color:'#92400E', marginTop:6 }}>
                    {isAr ? 'مؤسسات — عدّل الفروع والمديرين والمبلغ يدوياً أدناه' : 'Enterprise — set branches, managers, and amount manually below'}
                  </div>
                )}
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={labelStyle}>{isAr ? 'المدة' : 'Duration'}</label>
                <select value={actDuration} onChange={e => setActDuration(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
                  <option value={1}>{isAr ? '1 شهر' : '1 month'}</option>
                  <option value={3}>{isAr ? '3 أشهر' : '3 months'}</option>
                  <option value={6}>{isAr ? '6 أشهر' : '6 months'}</option>
                  <option value={12}>{isAr ? '1 سنة' : '1 year'}</option>
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={labelStyle}>{isAr ? 'المبلغ (ريال)' : 'Amount (SAR)'}</label>
                <input type="number" min="0" value={actAmount} onChange={e => setActAmount(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label style={labelStyle}>{isAr ? 'حد الفروع' : 'Branches Limit'}</label>
                  <input type="number" min="1" value={actBranchesLim} onChange={e => setActBranchesLim(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
                <div>
                  <label style={labelStyle}>{isAr ? 'حد المديرين' : 'Managers Limit'}</label>
                  <input type="number" min="1" value={actManagersLim} onChange={e => setActManagersLim(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={labelStyle}>{isAr ? 'ملاحظة' : 'Note'}</label>
                <input type="text" value={actNote} onChange={e => setActNote(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
              <button type="submit" disabled={actSaving}
                style={{ width:'100%', padding:'10px', borderRadius:10, fontSize:13, fontWeight:600, cursor: actSaving ? 'not-allowed' : 'pointer', background: actSaving ? '#6B9E83' : '#1B4332', color:'#fff', border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {actSaving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                {actSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE OWNER MODAL ── */}
      {showCreate && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) closeCreateModal() }}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, width:'100%', maxWidth:480, boxShadow:'0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#111827' }}>{isAr ? 'إضافة مالك جديد' : 'Add New Owner'}</div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{isAr ? 'سيبدأ الحساب بفترة تجربة 14 يوماً' : 'Account starts on a 14-day trial'}</div>
              </div>
              <button onClick={closeCreateModal} style={{ background:'none', border:'none', fontSize:18, color:'#9CA3AF', cursor:'pointer', padding:4 }}>✕</button>
            </div>

            {createErr && (
              <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#9F1239' }}>{createErr}</div>
            )}
            {createSuccess && (
              <div style={{ background:'#F0FDF4', border:'0.5px solid #BBF7D0', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#166534' }}>{createSuccess}</div>
            )}

            <form onSubmit={handleCreateOwner} noValidate>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={labelStyle}>{isAr ? 'الاسم (EN) *' : 'Name (EN) *'}</label>
                  <input type="text" value={cName} onChange={e => { setCName(e.target.value); setCreateErr('') }}
                    placeholder="Mohammed Al-Saud" style={inputStyle}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
                <div>
                  <label style={labelStyle}>{isAr ? 'الاسم (AR)' : 'Name (AR)'}</label>
                  <input type="text" value={cNameAr} onChange={e => setCNameAr(e.target.value)}
                    placeholder="محمد آل سعود" style={{ ...inputStyle, direction:'rtl' }}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={labelStyle}>{isAr ? 'البريد الإلكتروني *' : 'Email *'}</label>
                <input type="email" value={cEmail} onChange={e => { setCEmail(e.target.value); setCreateErr('') }}
                  placeholder="owner@example.com" style={{ ...inputStyle, direction:'ltr' }}
                  onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
                <div>
                  <label style={labelStyle}>{isAr ? 'الهاتف' : 'Phone'}</label>
                  <input type="tel" value={cPhone} onChange={e => setCPhone(e.target.value)}
                    placeholder="+966 5x xxx xxxx" style={{ ...inputStyle, direction:'ltr' }}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
                <div>
                  <label style={labelStyle}>{isAr ? 'كلمة المرور *' : 'Password *'}</label>
                  <input type="text" value={cPassword} onChange={e => { setCPassword(e.target.value); setCreateErr('') }}
                    placeholder={isAr ? '٨ أحرف على الأقل' : 'Min 8 characters'} style={{ ...inputStyle, direction:'ltr' }}
                    onFocus={e => e.target.style.borderColor='#1B4332'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={closeCreateModal}
                  style={{ flex:1, padding:'10px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', background:'#F9FAFB', color:'#374151', border:'0.5px solid #E5E7EB', fontFamily:'inherit' }}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" disabled={createSaving}
                  style={{ flex:2, padding:'10px', borderRadius:10, fontSize:13, fontWeight:600, cursor: createSaving ? 'not-allowed' : 'pointer', background: createSaving ? '#6B9E83' : '#1B4332', color:'#fff', border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {createSaving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                  {createSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إضافة المالك' : 'Add Owner')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

  </AdminLayout>
  )
}
