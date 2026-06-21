import { useEffect, useState, useCallback } from 'react'
import { supabaseBranchManager } from '../../lib/supabase'
import { useBranchManagerAuth } from '../../context/BranchManagerAuthContext'
import { getCached, setCached } from '../../lib/cache'
import { useLanguage } from '../../context/LanguageContext'
import BMLayout from '../../components/BMLayout'

const DAYS_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAYS_AR = ['إث','ثل','أر','خم','جم','سب','أح']
const HOURS   = ['12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM','7 AM','8 AM','9 AM','10 AM','11 AM','12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM','11 PM']

const CAT_STYLES = {
  inspection: { bg:'#DCFCE7', color:'#166534', border:'#166534', label:'Inspection', labelAr:'تفتيش'   },
  training:   { bg:'#EDE9FE', color:'#5B21B6', border:'#5B21B6', label:'Training',   labelAr:'تدريب'   },
  safety:     { bg:'#FFEDD5', color:'#9A3412', border:'#9A3412', label:'Safety',     labelAr:'سلامة'   },
  audit:      { bg:'#F3F4F6', color:'#6B7280', border:'#E5E7EB', label:'Audit',      labelAr:'تدقيق'   },
  other:      { bg:'#F3F4F6', color:'#6B7280', border:'#E5E7EB', label:'Other',      labelAr:'أخرى'    },
}

function getCatStyle(category) {
  return CAT_STYLES[category] || CAT_STYLES.other
}

function getWeekDates(offsetWeeks = 0) {
  const now  = new Date()
  const day  = now.getDay() // 0=Sun
  // Monday of current week
  const mon  = new Date(now)
  mon.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offsetWeeks * 7)
  mon.setHours(0,0,0,0)
  return Array.from({ length:7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour  = h % 12 || 12
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`
}

function getCountdown(eventDate, startTime, isAr) {
  if (!eventDate || !startTime) return null
  const eventDt = new Date(`${eventDate}T${startTime}`)
  const diff    = eventDt - new Date()
  if (diff <= 0) return isAr ? 'انتهى' : 'Past'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Which hour row (0=12AM, 1=1AM…) does this event start at?
function getHourRow(startTime) {
  if (!startTime) return -1
  const [h] = startTime.split(':').map(Number)
  return h
}

export default function BMSchedule() {
  const { profile } = useBranchManagerAuth()
  const { isAr }    = useLanguage()

  const [weekOffset, setWeekOffset] = useState(0)
  const [events,     setEvents]     = useState([])
  const [branch,     setBranch]     = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [selectedEv, setSelectedEv] = useState(null)

  const weekDates = getWeekDates(weekOffset)
  const today     = new Date()
  today.setHours(0,0,0,0)

  const fetchEvents = useCallback(async () => {
    if (!profile?.branch_id) return
    setError('')

    const cacheKey = `bm-schedule-${profile.branch_id}-${weekOffset}`
    const cached = getCached(cacheKey)
    if (cached) {
      setBranch(cached.branch)
      setEvents(cached.events)
      setLoading(false)
      // fall through: refresh in background
    }

    try {
      const startDate = weekDates[0].toISOString().split('T')[0]
      const endDate   = weekDates[6].toISOString().split('T')[0]

      const [branchRes, evRes] = await Promise.all([
        supabaseBranchManager
          .from('branches')
          .select('id, name, name_ar')
          .eq('id', profile.branch_id)
          .single(),
        supabaseBranchManager
          .from('schedule_events')
          .select('id, title, title_ar, description, event_date, start_time, end_time, category, branch_id')
          .or(`branch_id.eq.${profile.branch_id},branch_id.is.null`)
          .eq('is_private', false)
          .gte('event_date', startDate)
          .lte('event_date', endDate)
          .order('event_date', { ascending: true })
          .order('start_time', { ascending: true }),
      ])

      if (evRes.error) throw evRes.error

      setBranch(branchRes.data)
      setEvents(evRes.data || [])
      setCached(cacheKey, { branch: branchRes.data, events: evRes.data || [] })
    } catch (err) {
      console.error(err)
      if (!cached) setError(isAr ? 'فشل تحميل الجدول' : 'Failed to load schedule.')
    } finally {
      if (!cached) setLoading(false)
    }
  }, [profile?.id, profile?.branch_id, weekOffset])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const branchName = isAr ? branch?.name_ar || branch?.name : branch?.name || '—'

  // Today's events
  const todayStr    = today.toISOString().split('T')[0]
  const todayEvents = events.filter(e => e.event_date === todayStr)

  // Get events for a specific day + hour
  function getEventsAt(dayIdx, hourIdx) {
    const dateStr = weekDates[dayIdx].toISOString().split('T')[0]
    return events.filter(e => {
      if (e.event_date !== dateStr) return false
      const row = getHourRow(e.start_time)
      return row === hourIdx
    })
  }

  // Week label
  const weekLabel = weekOffset === 0
    ? (isAr ? 'هذا الأسبوع' : 'This week')
    : `${weekDates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${weekDates[6].toLocaleDateString('en-US',{month:'short',day:'numeric'})}`

  if (loading) return (
    <BMLayout activePath="/branch-manager/schedule" title="Schedule" titleAr="الجدول"
      subtitle={weekLabel} branchName={branchName}>
      <div style={{ padding:'16px 20px' }}>
        <div className="skeleton" style={{ height:400 }} />
      </div>
    </BMLayout>
  )

  return (
    <BMLayout activePath="/branch-manager/schedule" title="Schedule" titleAr="الجدول"
      subtitle={weekLabel} branchName={branchName}>
      <div style={{ height:'100%', overflow:'hidden', padding:'16px 20px', display:'flex', gap:16 }}>

          {/* LEFT — week calendar */}
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:12 }}>

            {/* Week nav */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#111827' }}>{weekLabel}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div onClick={()=>setWeekOffset(0)}
                  style={{ fontSize:11, fontWeight:500, color:'#1B4332', background:'#F0FDF4', border:'0.5px solid #BBF7D0', padding:'4px 10px', borderRadius:20, cursor:'pointer' }}>
                  {isAr?'اليوم':'Today'}
                </div>
                <div onClick={()=>setWeekOffset(p=>p-1)}
                  style={{ width:28, height:28, borderRadius:8, border:'0.5px solid #E5E7EB', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#6B7280', fontSize:13 }}>‹</div>
                <div onClick={()=>setWeekOffset(p=>p+1)}
                  style={{ width:28, height:28, borderRadius:8, border:'0.5px solid #E5E7EB', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#6B7280', fontSize:13 }}>›</div>
              </div>
            </div>

            {/* Calendar grid — horizontal scroll on small screens */}
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden', flex:1, display:'flex', flexDirection:'column' }}>
              <div style={{ overflowX:'auto', flex:1, display:'flex', flexDirection:'column' }}>
              <div style={{ minWidth:600, display:'flex', flexDirection:'column', flex:1 }}>

              {/* Day headers */}
              <div style={{ display:'grid', gridTemplateColumns:'44px repeat(7,1fr)', borderBottom:'0.5px solid #E5E7EB', flexShrink:0 }}>
                <div />
                {weekDates.map((d, i) => {
                  const isToday = d.toISOString().split('T')[0] === todayStr
                  return (
                    <div key={d.toISOString().split('T')[0]} style={{ padding:'10px 4px', textAlign:'center' }}>
                      <div style={{ fontSize:11, fontWeight:500, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                        {isAr ? DAYS_AR[i] : DAYS_EN[i]}
                      </div>
                      <div style={{ marginTop:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {isToday ? (
                          <div style={{ width:26, height:26, background:'#1B4332', color:'#fff', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:500 }}>
                            {d.getDate()}
                          </div>
                        ) : (
                          <div style={{ fontSize:14, fontWeight:500, color:'#111827' }}>{d.getDate()}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Time grid */}
              <div style={{ overflowY:'auto', flex:1 }}>
                <div style={{ display:'grid', gridTemplateColumns:'44px repeat(7,1fr)' }}>
                  {HOURS.map((hour, hourIdx) => (
                    <>
                      {/* Time label */}
                      <div key={`lbl-${hourIdx}`} style={{ fontSize:11, color:'#9CA3AF', textAlign:'right', padding:'5px 6px 0', borderRight:'0.5px solid #E5E7EB', borderBottom:'0.5px solid #F3F4F6' }}>
                        {hour}
                      </div>
                      {/* Day cells */}
                      {weekDates.map((d, dayIdx) => {
                        const isToday = d.toISOString().split('T')[0] === todayStr
                        const cellEvents = getEventsAt(dayIdx, hourIdx)
                        return (
                          <div key={`cell-${hourIdx}-${dayIdx}`}
                            style={{ borderRight: dayIdx < 6 ? '0.5px solid #E5E7EB' : 'none', borderBottom:'0.5px solid #F3F4F6', minHeight:50, padding:2, background: isToday ? 'rgba(27,67,50,0.02)' : 'transparent' }}>
                            {cellEvents.map(ev => {
                              const cs = getCatStyle(ev.category)
                              return (
                                <div key={ev.id}
                                  onClick={() => setSelectedEv(selectedEv?.id === ev.id ? null : ev)}
                                  style={{ borderRadius:6, padding:'4px 7px', margin:1, cursor:'pointer', background:cs.bg, color:cs.color, transition:'all 0.15s' }}
                                  onMouseEnter={e=>e.currentTarget.style.filter='brightness(0.95)'}
                                  onMouseLeave={e=>e.currentTarget.style.filter='none'}
                                >
                                  <div style={{ fontSize:10, fontWeight:500, lineHeight:1.2 }}>
                                    {isAr ? ev.title_ar || ev.title : ev.title}
                                  </div>
                                  {ev.start_time && (
                                    <div style={{ fontSize:9, opacity:0.7, marginTop:1 }}>{formatTime(ev.start_time)}</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </>
                  ))}
                </div>
              </div>
            </div>
            </div>{/* minWidth wrapper */}
            </div>{/* overflowX scroll wrapper */}
          </div>

          {/* RIGHT panel */}
          <div style={{ width:220, flexShrink:0, display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>

            {/* Today's events */}
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 14px', borderBottom:'0.5px solid #E5E7EB' }}>
                <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>
                  {isAr ? `اليوم — ${new Date().toLocaleDateString('ar-SA',{weekday:'short',month:'short',day:'numeric'})}` : `Today — ${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}`}
                </div>
                <div style={{ fontSize:10, color:'#9CA3AF', marginTop:1 }}>
                  {todayEvents.length} {isAr ? 'أحداث مجدولة' : 'events scheduled'}
                </div>
              </div>

              {todayEvents.length === 0 ? (
                <div style={{ padding:'16px 14px', textAlign:'center', color:'#9CA3AF', fontSize:12 }}>
                  {isAr ? 'لا توجد أحداث اليوم' : 'No events today'}
                </div>
              ) : (
                todayEvents.map((ev, i) => {
                  const cs        = getCatStyle(ev.category)
                  const isActive  = selectedEv?.id === ev.id
                  const countdown = getCountdown(ev.event_date, ev.start_time, isAr)
                  return (
                    <div key={ev.id}
                      onClick={() => setSelectedEv(isActive ? null : ev)}
                      style={{ padding:'12px 14px', borderBottom: i < todayEvents.length-1 ? '0.5px solid #E5E7EB' : 'none', cursor:'pointer', background:isActive?'#F0FDF4':'#fff', transition:'background 0.15s' }}
                    >
                      <div style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:500, color:'#9CA3AF', marginBottom:4 }}>
                        🕐 {formatTime(ev.start_time)}
                      </div>
                      <div style={{ fontSize:12, fontWeight:500, color:'#111827' }}>
                        {isAr ? ev.title_ar || ev.title : ev.title}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, flexWrap:'wrap' }}>
                        <span style={{ fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:20, background:cs.bg, color:cs.color }}>
                          {isAr ? cs.labelAr : cs.label}
                        </span>
                        {countdown && countdown !== 'Past' && (
                          <span style={{ fontSize:10, fontWeight:500, color:'#1B4332', background:'#F0FDF4', padding:'2px 7px', borderRadius:20 }}>
                            {countdown}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Legend */}
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 14px', borderBottom:'0.5px solid #E5E7EB' }}>
                <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{isAr?'أنواع الأحداث':'Event types'}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'12px 14px' }}>
                {[
                  { bg:'#DCFCE7', border:'#166534', label:'Inspection', labelAr:'تفتيش'  },
                  { bg:'#EDE9FE', border:'#5B21B6', label:'Training',   labelAr:'تدريب'  },
                  { bg:'#FFEDD5', border:'#9A3412', label:'Safety',     labelAr:'سلامة'  },
                  { bg:'#F3F4F6', border:'#E5E7EB', label:'Audit',      labelAr:'تدقيق'  },
                ].map(leg => (
                  <div key={leg.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#6B7280' }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:leg.bg, border:`0.5px solid ${leg.border}`, flexShrink:0 }} />
                    {isAr ? leg.labelAr : leg.label}
                  </div>
                ))}
              </div>
            </div>

            {/* View only notice */}
            <div style={{ background:'#FFFBEB', border:'0.5px solid #FDE68A', borderRadius:12, padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:500, color:'#92400E', marginBottom:3 }}>
                ℹ {isAr?'عرض فقط':'View only'}
              </div>
              <div style={{ fontSize:11, color:'#B45309', lineHeight:1.4 }}>
                {isAr
                  ? 'يتم إنشاء الأحداث من قبل مالك المطعم. تواصل معهم لإضافة أو تغيير الأحداث.'
                  : "Events are created by your restaurant owner. Contact them to add or change events."}
              </div>
            </div>

          </div>
      </div>
    </BMLayout>
  )
}
