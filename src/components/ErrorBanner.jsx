export default function ErrorBanner({ message, isAr, onRetry }) {
  if (!message) return null

  return (
    <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:12, padding:'12px 16px', marginBottom:16, color:'#E24B4A', fontSize:13, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ background:'none', border:'1px solid #FECDD3', borderRadius:8, padding:'4px 10px', color:'#E24B4A', fontSize:12, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
          {isAr ? 'إعادة المحاولة' : 'Retry'}
        </button>
      )}
    </div>
  )
}
