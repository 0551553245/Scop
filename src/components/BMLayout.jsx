import { useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { useNavigate, Link } from 'react-router-dom'
import { useBranchManagerAuth } from '../context/BranchManagerAuthContext'
import { useLanguage } from '../context/LanguageContext'
import { prefetchBMDailyTasks } from '../lib/prefetch'

const DVH = window.CSS?.supports('height', '100dvh') ? '100dvh' : '100vh'

const NAV = [
  { icon:'⊞', label:'Dashboard',      labelAr:'لوحة التحكم',      path:'/branch-manager/dashboard'     },
  { icon:'✓',  label:"Today's Tasks", labelAr:'مهام اليوم',       path:'/branch-manager/daily-tasks'   },
  { icon:'📆', label:'Weekly Tasks',  labelAr:'المهام الأسبوعية', path:'/branch-manager/weekly-tasks'  },
  { icon:'🗓', label:'Monthly Tasks', labelAr:'المهام الشهرية',   path:'/branch-manager/monthly-tasks' },
  { icon:'🛡', label:'Food Safety',   labelAr:'سلامة الغذاء',     path:'/branch-manager/food-safety'   },
  { icon:'📅', label:'Schedule',      labelAr:'الجدول',            path:'/branch-manager/schedule'      },
]

export default function BMLayout({ activePath, title, titleAr, subtitle, branchName, topbarLeft, children }) {
  const navigate = useNavigate()
  const { profile, signOut } = useBranchManagerAuth()
  const { isAr, toggleLang } = useLanguage()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()

  const name     = isAr ? profile?.name_ar || profile?.name : profile?.name || '—'
  const initials = (profile?.name || 'M').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const displayBranch = branchName || '—'


  const sidebarStyle = {
    width: 200,
    background: '#fff',
    borderRight: isAr ? 'none' : '0.5px solid #E5E7EB',
    borderLeft: isAr ? '0.5px solid #E5E7EB' : 'none',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    ...(isMobile ? {
      position: 'fixed',
      top: 0,
      [isAr ? 'right' : 'left']: 0,
      height: DVH,
      zIndex: 1000,
      transform: `translateX(${isAr ? (sidebarOpen ? 0 : 220) : (sidebarOpen ? 0 : -220)}px)`,
      transition: 'transform 0.3s ease',
      boxShadow: sidebarOpen ? (isAr ? '-4px 0 20px rgba(0,0,0,0.15)' : '4px 0 20px rgba(0,0,0,0.15)') : 'none',
    } : {}),
  }

  return (
    <div dir={isAr?'rtl':'ltr'} style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F3F4F6', fontFamily: isAr?"'Cairo','Segoe UI',sans-serif":"'Inter','Segoe UI',sans-serif" }}>

      {/* Overlay — closes sidebar on tap outside */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999 }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div style={sidebarStyle}>
        <div style={{ padding:16, borderBottom:'0.5px solid #E5E7EB' }}>
          <div style={{ fontSize:18, fontWeight:500, color:'#1B4332' }}>Scop</div>
          <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2, textTransform:'uppercase', letterSpacing:'0.5px' }}>Restaurant Ops</div>
        </div>
        <div style={{ padding:'12px 10px 4px' }}>
          <div style={{ fontSize:9, fontWeight:500, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'1px', padding:'0 6px 6px' }}>
            {isAr?'الرئيسية':'Main'}
          </div>
          {NAV.map(item => {
            const isActive = item.path === activePath
            return (
              <Link key={item.path} to={item.path}
                onClick={() => { if (isMobile) setSidebarOpen(false) }}
                onMouseEnter={item.path === '/branch-manager/daily-tasks' ? () => prefetchBMDailyTasks(profile?.branch_id, profile?.id) : undefined}
                style={{ textDecoration:'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, fontSize:12, marginBottom:2, background: isActive?'#F0FDF4':'transparent', color: isActive?'#1B4332':'#6B7280', fontWeight: isActive?500:400 }}>
                  <span style={{ fontSize:14, width:18, textAlign:'center' }}>{item.icon}</span>
                  {isAr?item.labelAr:item.label}
                </div>
              </Link>
            )
          })}
        </div>
        <div style={{ marginTop:'auto', padding:14, borderTop:'0.5px solid #E5E7EB' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#F0FDF4', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#4ADE80', flexShrink:0 }} />
            <div style={{ fontSize:11, fontWeight:500, color:'#1B4332', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayBranch}</div>
            <div style={{ fontSize:9, color:'#4ADE80', fontWeight:700, textTransform:'uppercase' }}>Live</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'#1B4332', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:500, color:'#fff', flexShrink:0 }}>{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:500, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
              <div style={{ fontSize:10, color:'#9CA3AF' }}>{isAr?'مدير الفرع':'Branch Manager'}</div>
            </div>
            <button onClick={async () => { await signOut(); navigate('/branch-manager/login') }} style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:15, padding:0, minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center' }}>↪</button>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid #E5E7EB', padding:'0 20px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(p => !p)}
                style={{ background:'none', border:'none', cursor:'pointer', padding:'8px', fontSize:20, color:'#111827', display:'flex', alignItems:'center', minWidth:44, minHeight:44, justifyContent:'center' }}
              >
                ☰
              </button>
            )}
            {topbarLeft || (
              <>
                <div style={{ fontSize:14, fontWeight:500, color:'#111827' }}>{isAr ? titleAr || title : title}</div>
                {subtitle != null && <div style={{ fontSize:11, color:'#9CA3AF' }}>{subtitle}</div>}
              </>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={toggleLang} style={{ fontSize:11, color:'#6B7280', background:'#F9FAFB', border:'0.5px solid #E5E7EB', padding:'4px 10px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', minHeight:44, display:'flex', alignItems:'center' }}>
              {isAr?'EN':'EN / ع'}
            </button>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#F9FAFB', border:'0.5px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
              🔔
              <div style={{ position:'absolute', top:6, right:6, width:6, height:6, background:'#E24B4A', borderRadius:'50%', border:'1.5px solid #fff' }} />
            </div>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#1B4332', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'#fff' }}>{initials}</div>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {children}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .skeleton { background:#E5E7EB; border-radius:12px; animation:pulse 1.5s ease-in-out infinite }
        a { text-decoration: none; }
      `}</style>
    </div>
  )
}
