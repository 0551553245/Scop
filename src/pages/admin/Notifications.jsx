import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../../lib/supabase'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import AdminLayout from '../../components/AdminLayout'
import ErrorBanner from '../../components/ErrorBanner'
import { formatDateTime } from '../../lib/adminHelpers'

const TARGETS = [
  { key:'all',     en:'All Owners',    ar:'كل الملاك'        },
  { key:'trial',   en:'Trial Only',    ar:'تجربة فقط'        },
  { key:'starter', en:'Starter Plan',  ar:'خطة Starter'      },
  { key:'growth',  en:'Growth Plan',   ar:'خطة Growth'       },
  { key:'pro',     en:'Pro Plan',      ar:'خطة Pro'          },
]

const inputStyle = {
  width:'100%', padding:'9px 12px', fontSize:13,
  border:'0.5px solid #E5E7EB', borderRadius:8, outline:'none',
  color:'#111827', fontFamily:'inherit', background:'#fff',
  boxSizing:'border-box',
}

const labelStyle = {
  display:'block', fontSize:11, fontWeight:600, color:'#6B7280',
  marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px',
}

export default function AdminNotifications() {
  const navigate             = useNavigate()
  const { profile, signOut } = useAdminAuth()
  const { isAr, toggleLang } = useLanguage()
  const isMobile = useIsMobile()

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [target,      setTarget]      = useState('all')
  const [titleEn,      setTitleEn]      = useState('')
  const [titleAr,      setTitleAr]      = useState('')
  const [messageEn,    setMessageEn]    = useState('')
  const [messageAr,    setMessageAr]    = useState('')
  const [sending,      setSending]      = useState(false)
  const [sendErr,      setSendErr]      = useState('')
  const [sendSuccess,  setSendSuccess]  = useState('')

  async function logAction(action, description, targetId, targetType, metadata) {
    await supabaseAdmin.from('activity_log').insert({
      action, description,
      actor_id: profile.id,
      target_id: targetId || null,
      target_type: targetType || null,
      metadata: metadata || null,
    })
  }

  const fetchHistory = useCallback(async () => {
    setError('')
    try {
      const { data, error: err } = await supabaseAdmin
        .from('notifications')
        .select('id, title, title_ar, message, message_ar, target, sent_by, created_at')
        .order('created_at', { ascending: false })
        .limit(20)

      if (err) throw err
      setHistory(data || [])

    } catch (err) {
      console.error('Notifications fetch error:', err)
      setError(isAr ? 'فشل تحميل سجل الإشعارات' : 'Failed to load notification history.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  useEffect(() => {
    if (!profile) return
    const channel = supabaseAdmin
      .channel(`admin-notifications-${profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'notifications' }, () => { fetchHistory() })
      .subscribe()
    return () => supabaseAdmin.removeChannel(channel)
  }, [profile, fetchHistory])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  async function handleSend(e) {
    e.preventDefault()
    setSendErr('')
    setSendSuccess('')

    if (!titleEn.trim())   { setSendErr(isAr ? 'العنوان (EN) مطلوب' : 'Title (EN) is required.'); return }
    if (!messageEn.trim()) { setSendErr(isAr ? 'الرسالة (EN) مطلوبة' : 'Message (EN) is required.'); return }

    setSending(true)
    try {
      const { error: err } = await supabaseAdmin
        .from('notifications')
        .insert({
          title:      titleEn.trim(),
          title_ar:   titleAr.trim() || titleEn.trim(),
          message:    messageEn.trim(),
          message_ar: messageAr.trim() || messageEn.trim(),
          target,
          sent_by:    profile.id,
        })

      if (err) throw err

      await logAction('notification_sent', `Sent notification "${titleEn.trim()}" to ${target}`, null, 'notification', { target })

      setSendSuccess(isAr ? 'تم إرسال الإشعار بنجاح' : 'Notification sent successfully.')
      setTitleEn(''); setTitleAr(''); setMessageEn(''); setMessageAr(''); setTarget('all')
      await fetchHistory()

    } catch (err) {
      console.error('Send notification error:', err)
      setSendErr(isAr ? 'حدث خطأ أثناء الإرسال' : 'Something went wrong while sending.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <AdminLayout currentPath="/admin/notifications" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Notifications" titleAr="الإشعارات">
      <div style={{ padding:'20px 24px' }}>
        <div className="skeleton" style={{ height:420 }} />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout currentPath="/admin/notifications" profile={profile} isAr={isAr} handleSignOut={handleSignOut} title="Notifications" titleAr="الإشعارات" topbarRight={
      <button onClick={toggleLang} style={{ fontSize:12, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit' }}>
        {isAr ? 'EN' : 'ع'}
      </button>
    }>
      <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>

          <ErrorBanner message={error} isAr={isAr} />

          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 16 : 20 }}>

            {/* Send form */}
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'إرسال إشعار جديد' : 'Send New Notification'}</div>

              {sendErr && (
                <div style={{ background:'#FFF1F2', border:'0.5px solid #FECDD3', borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:12, color:'#9F1239' }}>{sendErr}</div>
              )}
              {sendSuccess && (
                <div style={{ background:'#F0FDF4', border:'0.5px solid #BBF7D0', borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:12, color:'#166534' }}>{sendSuccess}</div>
              )}

              <form onSubmit={handleSend} noValidate>
                <div style={{ marginBottom:12 }}>
                  <label style={labelStyle}>{isAr ? 'الجمهور المستهدف' : 'Target'}</label>
                  <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
                    {TARGETS.map(t => (
                      <option key={t.key} value={t.key}>{isAr ? t.ar : t.en}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={labelStyle}>{isAr ? 'العنوان (EN)' : 'Title (EN)'}</label>
                  <input type="text" value={titleEn} onChange={e => setTitleEn(e.target.value)} style={inputStyle} />
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={labelStyle}>{isAr ? 'العنوان (AR)' : 'Title (AR)'}</label>
                  <input type="text" value={titleAr} onChange={e => setTitleAr(e.target.value)} style={{ ...inputStyle, direction:'rtl' }} />
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={labelStyle}>{isAr ? 'الرسالة (EN)' : 'Message (EN)'}</label>
                  <textarea value={messageEn} onChange={e => setMessageEn(e.target.value)} rows={3} style={{ ...inputStyle, resize:'vertical' }} />
                </div>

                <div style={{ marginBottom:20 }}>
                  <label style={labelStyle}>{isAr ? 'الرسالة (AR)' : 'Message (AR)'}</label>
                  <textarea value={messageAr} onChange={e => setMessageAr(e.target.value)} rows={3} style={{ ...inputStyle, resize:'vertical', direction:'rtl' }} />
                </div>

                <button type="submit" disabled={sending}
                  style={{ width:'100%', padding:'10px', borderRadius:10, fontSize:13, fontWeight:600, cursor: sending ? 'not-allowed' : 'pointer', background: sending ? '#6B9E83' : '#1B4332', color:'#fff', border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {sending && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
                  {sending ? (isAr ? 'جارٍ الإرسال…' : 'Sending…') : (isAr ? 'إرسال' : 'Send')}
                </button>
              </form>
            </div>

            {/* History */}
            <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>{isAr ? 'السجل' : 'History'}</div>
              {history.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 0', color:'#9CA3AF', fontSize:13 }}>{isAr ? 'لا توجد إشعارات مرسلة' : 'No notifications sent yet'}</div>
              ) : (
                history.map(n => {
                  const targetLabel = TARGETS.find(t => t.key === n.target)
                  return (
                    <div key={n.id} style={{ padding:'12px 0', borderBottom:'0.5px solid #F3F4F6' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{isAr ? n.title_ar || n.title : n.title}</span>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#EFF6FF', color:'#1D4ED8', whiteSpace:'nowrap' }}>
                          {targetLabel ? (isAr ? targetLabel.ar : targetLabel.en) : n.target}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:'#6B7280', marginBottom:4 }}>{isAr ? n.message_ar || n.message : n.message}</div>
                      <div style={{ fontSize:11, color:'#9CA3AF' }}>{formatDateTime(n.created_at, isAr)}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
      </div>
    </AdminLayout>
  )
}
