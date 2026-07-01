import { useEffect, useState, useCallback } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { supabaseOwner } from '../../lib/supabase'
import { useOwnerAuth } from '../../context/OwnerAuthContext'
import { useSubscription } from '../../hooks/useSubscription'
import { useLanguage } from '../../context/LanguageContext'
import SubscriptionGuard from '../../components/SubscriptionGuard'
import NotificationBell from '../../components/NotificationBell'
import OwnerLayout from '../../components/OwnerLayout'

// ── CATEGORIES ─────────────────────────────────────────────────
const CATS = [
  { key: 'inspection', en: 'Inspection', ar: 'تفتيش',  color: '#378ADD', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'training',   en: 'Training',   ar: 'تدريب',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { key: 'safety',     en: 'Safety',     ar: 'سلامة',  color: '#059669', bg: '#F0FDF4', border: '#A7F3D0' },
  { key: 'audit',      en: 'Audit',      ar: 'مراجعة', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
]

// ── CALENDAR CONSTANTS ──────────────────────────────────────────
const HOUR_PX  = 60          // pixels per hour
const START_H  = 8           // 8 AM
const END_H    = 20          // 8 PM
const SLOT_N   = END_H - START_H   // 12 slots
const GRID_H   = SLOT_N * HOUR_PX  // 720 px

const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

// ── HELPERS ────────────────────────────────────────────────────
function toDateStr(d)  { return d.toISOString().split('T')[0] }

function getWeekDates(anchor) {
  const d   = new Date(anchor)
  const sun = new Date(d)
  sun.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sun)
    dd.setDate(sun.getDate() + i)
    return dd
  })
}

function toMins(t)    { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function evTop(t)     { return Math.max(0, toMins(t) - START_H * 60) }
function evHeight(s, e) {
  const sm = Math.max(toMins(s), START_H * 60)
  const em = Math.min(toMins(e), END_H * 60)
  return Math.max(em - sm, 28)
}
function fmtHr(h) {
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}
function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
function getNowY() {
  const n = new Date()
  const h = n.getHours(), m = n.getMinutes()
  if (h < START_H || h >= END_H) return -1
  return (h - START_H) * HOUR_PX + (m / 60) * HOUR_PX
}
function todayISO() { return toDateStr(new Date()) }

// ── COMPONENT ──────────────────────────────────────────────────
export default function OwnerSchedule() {
  const { profile } = useOwnerAuth()
  const { isExpired } = useSubscription()
  const { isAr, toggleLang } = useLanguage()

  const [branches, setBranches] = useState([])
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const [anchor, setAnchor] = useState(new Date())
  const weekDates = getWeekDates(anchor)
  const today     = todayISO()

  const [nowY, setNowY] = useState(getNowY())
  useEffect(() => {
    const id = setInterval(() => setNowY(getNowY()), 60_000)
    return () => clearInterval(id)
  }, [])

  const isMobile = useIsMobile()
  const [showMobileForm, setShowMobileForm] = useState(false)

  const [form, setForm] = useState({
    title: '', title_ar: '', description: '',
    event_date: todayISO(),
    start_time: '09:00', end_time: '10:00',
    category: 'inspection', branch_id: 'private',
  })
  const [formErr, setFormErr] = useState('')

  // ── FETCH ─────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!profile) return
    setError('')
    try {
      const { data: bData, error: bErr } = await supabaseOwner
        .from('branches')
        .select('id, name, name_ar')
        .eq('owner_id', profile.id)
        .eq('is_active', true)
      if (bErr) throw bErr
      setBranches(bData || [])

      const wk = getWeekDates(anchor)
      const { data: eData, error: eErr } = await supabaseOwner
        .from('schedule_events')
        .select('id, title, title_ar, description, event_date, start_time, end_time, category, branch_id, created_by, is_private')
        .eq('created_by', profile.id)
        .gte('event_date', toDateStr(wk[0]))
        .lte('event_date', toDateStr(wk[6]))
        .order('start_time', { ascending: true })
      if (eErr) throw eErr
      setEvents(eData || [])
    } catch (err) {
      console.error('Schedule fetch error:', err)
      setError(isAr ? 'فشل تحميل الجدول' : 'Failed to load schedule.')
    } finally {
      setLoading(false)
    }
  }, [profile, anchor])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!profile) return
    const ch = supabaseOwner
      .channel(`owner-schedule-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_events' }, () => fetchData())
      .subscribe()
    return () => supabaseOwner.removeChannel(ch)
  }, [profile?.id, fetchData])

  // ── CREATE ────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault()
    setFormErr('')
    if (!form.title.trim()) {
      setFormErr(isAr ? 'العنوان مطلوب' : 'Title is required.')
      return
    }
    if (form.start_time >= form.end_time) {
      setFormErr(isAr ? 'وقت البداية يجب أن يسبق وقت النهاية' : 'Start time must be before end time.')
      return
    }
    setSaving(true)
    try {
      const { error: insErr } = await supabaseOwner
        .from('schedule_events')
        .insert({
          title:       form.title.trim(),
          title_ar:    form.title_ar.trim() || form.title.trim(),
          description: form.description.trim(),
          event_date:  form.event_date,
          start_time:  form.start_time,
          end_time:    form.end_time,
          category:    form.category,
          branch_id:   form.branch_id === 'private' ? null : (form.branch_id || null),
          is_private:  form.branch_id === 'private',
          created_by:  profile.id,
        })
      if (insErr) throw insErr
      setForm(f => ({ ...f, title: '', title_ar: '', description: '' }))
      await fetchData()
    } catch (err) {
      console.error('Create event error:', err)
      setFormErr(isAr ? 'فشل إنشاء الحدث' : 'Failed to create event.')
    } finally {
      setSaving(false)
    }
  }

  // ── DELETE ────────────────────────────────────────────────────
  async function handleDelete(ev) {
    try {
      setEvents(prev => prev.filter(e => e.id !== ev.id))
      const { error: delErr } = await supabaseOwner
        .from('schedule_events')
        .delete()
        .eq('id', ev.id)
        .eq('created_by', profile.id)
      if (delErr) throw delErr
    } catch (err) {
      console.error('Delete event error:', err)
      setError(isAr ? 'فشل حذف الحدث' : 'Failed to delete event.')
    }
  }

  const initials = (profile?.name || 'O').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const scheduleTopbarRight = (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'1px solid #E5E7EB', padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
      <NotificationBell isAr={isAr} />
      <div style={{ width:34, height:34, borderRadius:'50%', background:'#1B4332', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>
        {initials}
      </div>
    </div>
  )

  // ── LOADING ───────────────────────────────────────────────────
  if (loading) return (
    <OwnerLayout activePath="/owner/schedule" title="Schedule" titleAr="الجدول"
      topbarRight={scheduleTopbarRight} branches={branches}>
      <div style={{ padding:'0 24px', height:'100%' }}>
        <div className="skeleton" style={{ height:'calc(100% - 32px)', margin:'16px 0' }} />
      </div>
    </OwnerLayout>
  )

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <OwnerLayout activePath="/owner/schedule" title="Schedule" titleAr="الجدول"
      topbarRight={scheduleTopbarRight} branches={branches}>

      {/* Error banner */}
        {error && (
          <div style={{ margin: '10px 20px 0', padding: '10px 16px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, fontSize: 13, color: '#E24B4A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {error}
            <button onClick={fetchData} style={{ fontSize: 12, color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {isAr ? 'إعادة' : 'Retry'}
            </button>
          </div>
        )}

      {/* Content: calendar + form */}
      <div style={{ height: '100%', overflow: 'hidden', padding: isMobile ? 0 : '16px 20px', display: 'flex', gap: isMobile ? 0 : 14, minHeight: 0 }}>

          {/* ─── CALENDAR SECTION ─────────────────────────────── */}
          {(!isMobile || !showMobileForm) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', border: isMobile ? 'none' : '1px solid #E5E7EB', borderRadius: isMobile ? 0 : 16, minHeight: 0 }}>

            {/* Week navigation */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <button
                onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d) }}
                style={{ width: 30, height: 30, border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >‹</button>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                {weekDates[0].toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                {' — '}
                {weekDates[6].toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <button
                onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d) }}
                style={{ width: 30, height: 30, border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >›</button>
            </div>

            {/* Mobile: Create Event button between nav and day headers */}
            {isMobile && (
              <button
                onClick={() => setShowMobileForm(true)}
                style={{ margin: '0 16px 12px', padding: '12px', background: '#1B4332', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                + {isAr ? 'إضافة حدث' : 'Create Event'}
              </button>
            )}

            {/* Day headers (always LTR — time flows left→right) */}
            <div dir="ltr" style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
              <div /> {/* time column corner */}
              {weekDates.map((d) => {
                const ds      = toDateStr(d)
                const isToday = ds === today
                return (
                  <div key={ds} style={{ padding: '8px 0', textAlign: 'center', borderLeft: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isToday ? '#1B4332' : '#9CA3AF' }}>
                      {isAr ? DAY_AR[d.getDay()] : DAY_EN[d.getDay()]}
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 800,
                      color: isToday ? '#fff' : '#111827',
                      width: 28, height: 28, borderRadius: '50%',
                      background: isToday ? '#1B4332' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '3px auto 0',
                    }}>
                      {d.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Scrollable hourly grid */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <div dir="ltr" style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', height: GRID_H, position: 'relative' }}>

                {/* Time labels */}
                <div style={{ position: 'relative', borderRight: '1px solid #F3F4F6' }}>
                  {Array.from({ length: SLOT_N + 1 }, (_, i) => i + START_H).map(h => (
                    <div
                      key={h}
                      style={{
                        position: 'absolute',
                        top: (h - START_H) * HOUR_PX - 8,
                        right: 8, left: 0,
                        textAlign: 'right',
                        fontSize: 10,
                        color: '#9CA3AF',
                        pointerEvents: 'none',
                        lineHeight: 1,
                      }}
                    >
                      {fmtHr(h)}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDates.map((d, colIdx) => {
                  const ds      = toDateStr(d)
                  const isToday = ds === today
                  const dayEvs  = events.filter(e => e.event_date === ds)

                  return (
                    <div
                      key={colIdx}
                      style={{
                        position: 'relative',
                        borderLeft: '1px solid #F3F4F6',
                        background: isToday ? 'rgba(27,67,50,0.015)' : 'transparent',
                        height: GRID_H,
                      }}
                    >
                      {/* Hour gridlines */}
                      {Array.from({ length: SLOT_N + 1 }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute', top: i * HOUR_PX,
                            left: 0, right: 0, height: 0,
                            borderTop: i === 0 ? 'none' : '1px solid #F3F4F6',
                            pointerEvents: 'none',
                          }}
                        />
                      ))}
                      {/* Half-hour lines */}
                      {Array.from({ length: SLOT_N }, (_, i) => (
                        <div
                          key={`h${i}`}
                          style={{
                            position: 'absolute', top: (i + 0.5) * HOUR_PX,
                            left: 0, right: 0, height: 0,
                            borderTop: '1px dashed #F9FAFB',
                            pointerEvents: 'none',
                          }}
                        />
                      ))}

                      {/* Current time indicator */}
                      {isToday && nowY >= 0 && (
                        <div style={{ position: 'absolute', top: nowY, left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}>
                          <div style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: '#E24B4A' }} />
                          <div style={{ height: 2, background: '#E24B4A', marginLeft: 4 }} />
                        </div>
                      )}

                      {/* Events */}
                      {dayEvs.map(ev => {
                        const cat = CATS.find(c => c.key === ev.category) || CATS[0]
                        const top = evTop(ev.start_time)
                        const h   = evHeight(ev.start_time, ev.end_time)
                        return (
                          <div
                            key={ev.id}
                            onClick={() => handleDelete(ev)}
                            title={`${isAr ? ev.title_ar || ev.title : ev.title}\n${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}\n${isAr ? 'انقر للحذف' : 'Click to delete'}`}
                            style={{
                              position: 'absolute', top, left: 3, right: 3, height: h,
                              background: cat.bg,
                              borderTop:    `1px solid ${cat.border}`,
                              borderRight:  `1px solid ${cat.border}`,
                              borderBottom: `1px solid ${cat.border}`,
                              borderLeft:   `3px solid ${cat.color}`,
                              borderRadius: 6,
                              padding: '3px 6px',
                              overflow: 'hidden', cursor: 'pointer', zIndex: 5,
                              transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: cat.color, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.is_private && '🔒 '}{isAr ? ev.title_ar || ev.title : ev.title}
                            </div>
                            {h >= 38 && (
                              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                                {fmtTime(ev.start_time)} – {fmtTime(ev.end_time)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          )}

          {/* ─── FORM PANEL ───────────────────────────────────── */}
          {(!isMobile || showMobileForm) && (
          <div style={{ width: isMobile ? '100%' : 272, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, padding: isMobile ? '16px' : 0, boxSizing: 'border-box' }}>

            {/* Mobile: Back button */}
            {isMobile && (
              <button
                onClick={() => setShowMobileForm(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151', fontFamily: 'inherit', padding: '4px 0', marginBottom: 4, minHeight: 44 }}
              >
                {isAr ? 'رجوع →' : '← Back'}
              </button>
            )}

            {/* Create event card */}
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
                {isAr ? 'إضافة حدث جديد' : 'New Event'}
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>

                <Field label={isAr ? 'العنوان (EN)' : 'Title'} required>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Event title"
                    style={inp}
                  />
                </Field>

                <Field label={isAr ? 'العنوان (AR)' : 'Title (Arabic)'}>
                  <input
                    dir="rtl"
                    value={form.title_ar}
                    onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))}
                    placeholder="عنوان الحدث"
                    style={{ ...inp, fontFamily: "'Cairo',sans-serif" }}
                  />
                </Field>

                <Field label={isAr ? 'التاريخ' : 'Date'}>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                    style={inp}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label={isAr ? 'من' : 'Start'}>
                    <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inp} />
                  </Field>
                  <Field label={isAr ? 'إلى' : 'End'}>
                    <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={inp} />
                  </Field>
                </div>

                <Field label={isAr ? 'الفئة' : 'Category'}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 2 }}>
                    {CATS.map(c => (
                      <button
                        key={c.key} type="button"
                        onClick={() => setForm(f => ({ ...f, category: c.key }))}
                        style={{
                          padding: '7px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                          border: `1.5px solid ${form.category === c.key ? c.color : '#E5E7EB'}`,
                          background: form.category === c.key ? c.bg : '#F9FAFB',
                          color: form.category === c.key ? c.color : '#9CA3AF',
                          transition: 'all 0.15s',
                        }}
                      >
                        {isAr ? c.ar : c.en}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label={isAr ? 'الفرع' : 'Branch'}>
                  <select
                    value={form.branch_id}
                    onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                    style={{ ...inp, background: '#fff' }}
                  >
                    <option value="private">{isAr ? '🔒 أنا فقط' : '🔒 Only me'}</option>
                    <option value="">{isAr ? 'جميع الفروع' : 'All branches'}</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{isAr ? b.name_ar || b.name : b.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label={isAr ? 'ملاحظات' : 'Description'}>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder={isAr ? 'وصف اختياري' : 'Optional notes…'}
                    rows={3}
                    style={{ ...inp, resize: 'none' }}
                  />
                </Field>

                {formErr && (
                  <div style={{ fontSize: 12, color: '#E24B4A', background: '#FFF1F2', padding: '8px 12px', borderRadius: 8 }}>
                    {formErr}
                  </div>
                )}

                <SubscriptionGuard isExpired={isExpired} isAr={isAr}>
                  <button
                    type="submit" disabled={saving}
                    style={{
                      padding: '10px 0', background: saving ? '#9CA3AF' : '#1B4332', color: '#fff',
                      border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 2, width: '100%',
                    }}
                  >
                    {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إنشاء الحدث' : 'Create Event')}
                  </button>
                </SubscriptionGuard>
              </form>
            </div>

            {/* Category legend */}
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                {isAr ? 'الفئات' : 'Categories'}
              </div>
              {CATS.map(c => (
                <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{isAr ? c.ar : c.en}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F3F4F6', fontSize: 11, color: '#9CA3AF' }}>
                {isAr ? 'انقر على الحدث لحذفه' : 'Click an event to delete it'}
              </div>
            </div>
          </div>
          )}
        </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus, textarea:focus, select:focus { border-color: #1B4332 !important; outline: none; box-shadow: 0 0 0 2px rgba(27,67,50,0.08); }
      `}</style>
    </OwnerLayout>
  )
}

// ── SMALL HELPERS ──────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#E24B4A', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inp = {
  width: '100%', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8,
  fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', transition: 'border-color 0.15s',
}
