import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../../lib/supabase'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { AdminSidebar } from '../../components/AdminLayout'
import { formatDateTime } from '../../lib/adminHelpers'

const FILTERS = [
  { key:'all',           en:'All',            ar:'الكل'           },
  { key:'subscriptions', en:'Subscriptions',  ar:'الاشتراكات'     },
  { key:'owners',        en:'Owners',         ar:'الملاك'         },
  { key:'admin',         en:'Admin Actions',  ar:'إجراءات الإدارة' },
]

function dotColor(action) {
  if (action.includes('unblocked') || action.includes('created') || action.includes('activated')) return '#22C55E'
  if (action.includes('expired') || action.includes('blocked') || action.includes('deactivated'))   return '#EF4444'
  if (action.includes('extended'))                                                                  return '#F59E0B'
  return '#378ADD'
}

export default function AdminActivityLog() {
  const navigate             = useNavigate()
  const { profile, signOut } = useAdminAuth()
  const { isAr, toggleLang } = useLanguage()

  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [filter,  setFilter]  = useState('all')

  const fetchLogs = useCallback(async () => {
    setError('')
    try {
      let query = supabaseAdmin
        .from('activity_log')
        .select('id, action, description, actor_id, target_type, metadata, created_at, users(name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter === 'subscriptions') query = query.or('action.ilike.%subscription%,action.ilike.%trial%')
      else if (filter === 'owners')   query = query.or('action.ilike.%owner%,action.ilike.%manager%,action.ilike.%password_reset%')
      else if (filter === 'admin')    query = query.or('action.ilike.%settings%,action.ilike.%notification%')

      const { data, error: err } = await query
      if (err) throw err
      setLogs(data || [])

    } catch (err) {
      console.error('Activity log fetch error:', err)
      setError(isAr ? 'فشل تحميل سجل النشاط' : 'Failed to load activity log.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!profile) return
    const channel = supabaseAdmin
      .channel(`admin-activity-log-${profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'activity_log' }, () => { fetchLogs() })
      .subscribe()
    return () => supabaseAdmin.removeChannel(channel)
  }, [profile, fetchLogs])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  if (loading) return (
    <div dir={isAr?'rtl':'ltr'} style={{ display:'flex', height:'100vh', background:'#F0FDF4', fontFamily:"'Inter',sans-serif" }}>
      <div style={{ width:200, background:'#fff', borderRight:'0.5px solid #E5E7EB', flexShrink:0 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ height:56, background:'#fff', borderBottom:'0.5px solid #E5E7EB', flexShrink:0 }} />
        <div style={{ flex:1, padding:'20px 24px', overflowY:'auto' }}>
          <div className="skeleton" style={{ height:420 }} />
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} .skeleton{background:#E5E7EB;border-radius:12px;animation:pulse 1.5s ease-in-out infinite}`}</style>
    </div>
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ display:'flex', height:'100vh', minHeight:700, overflow:'hidden', background:'#F0FDF4', fontFamily: isAr ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif" }}>

      <AdminSidebar currentPath="/admin/activity-log" profile={profile} isAr={isAr} handleSignOut={handleSignOut} />

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        <div style={{ background:'#fff', borderBottom:'0.5px solid #E5E7EB', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{isAr ? 'سجل النشاط' : 'Activity Log'}</span>
          <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
            {isAr ? 'EN' : 'ع'}
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {error && (
            <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#9F1239', fontSize:13 }}>{error}</div>
          )}

          {/* Filter tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                fontSize:12, fontWeight:600, padding:'7px 16px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', border:'0.5px solid #E5E7EB',
                background: filter === f.key ? '#1B4332' : '#fff',
                color:      filter === f.key ? '#fff'    : '#374151',
              }}>
                {isAr ? f.ar : f.en}
              </button>
            ))}
          </div>

          {/* Timeline */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
            {logs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 0', color:'#9CA3AF' }}>
                <i className="ti ti-list" style={{ fontSize:40, marginBottom:12, display:'block' }} />
                <div style={{ fontSize:14 }}>{isAr ? 'لا يوجد نشاط مطابق' : 'No matching activity'}</div>
              </div>
            ) : (
              logs.map(log => {
                const actor = Array.isArray(log.users) ? log.users[0] : log.users
                const meta  = log.metadata
                return (
                  <div key={log.id} style={{ display:'flex', gap:12, padding:'12px 0', borderBottom:'0.5px solid #F3F4F6' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:dotColor(log.action || ''), marginTop:4, flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:'#111827', fontWeight:600 }}>{log.description}</div>
                      <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>
                        {actor?.name || (isAr ? 'النظام' : 'System')} · {formatDateTime(log.created_at, isAr)}
                      </div>
                      {meta && Object.keys(meta).length > 0 && (
                        <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                          {Object.entries(meta).map(([k, v]) => (
                            <span key={k} style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#F9FAFB', color:'#6B7280', border:'0.5px solid #E5E7EB' }}>
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap');
        a { text-decoration: none; }
      `}</style>
    </div>
  )
}
