import { useLanguage } from '../context/LanguageContext'

/** Temporary page body while features are rebuilt slice-by-slice. */
export default function RebuildPlaceholder({ title, titleAr, description, descriptionAr }) {
  const { isAr } = useLanguage()

  return (
    <div className="animate-fadeIn" style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 16,
      padding: '40px 28px',
      textAlign: 'center',
      maxWidth: 520,
      margin: '40px auto',
    }}>
      <div style={{
        display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#166534', background: '#F0FDF4',
        border: '1px solid #BBF7D0', borderRadius: 20, padding: '4px 12px', marginBottom: 16,
      }}>
        {isAr ? 'إعادة البناء' : 'Rebuild in progress'}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        {isAr ? (titleAr || title) : title}
      </h2>
      <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
        {isAr
          ? (descriptionAr || 'هذه الصفحة تُعاد بناؤها من الصفر. البنية الأساسية والمصادقة جاهزتان.')
          : (description || 'This page is being rebuilt from scratch. Core shell and auth are live.')}
      </p>
    </div>
  )
}
