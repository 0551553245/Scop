function Icon({ size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-36 -36 104 104"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <circle cx="0" cy="0" r="28" fill="#F0FDF4" stroke="#1B4332" strokeWidth="5" />
      <polyline
        points="-18,3 -5,16 20,-15"
        stroke="#1B4332"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="35" y1="35" x2="52" y2="52" stroke="#1B4332" strokeWidth="7" strokeLinecap="round" />
      <circle cx="52" cy="52" r="7" fill="#1B4332" />
      <circle cx="52" cy="52" r="3.5" fill="#4ADE80" />
    </svg>
  )
}

export default function ScopLogo({ variant = 'sidebar', className }) {
  if (variant === 'sidebar') {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr' }}>
        <Icon size={28} />
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1B4332', letterSpacing: '0.5px' }}>
          Scop
        </span>
      </div>
    )
  }

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 10, direction: 'ltr' }}>
      <Icon size={36} />
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1B4332', letterSpacing: '0.5px' }}>Scop</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1B4332', fontFamily: 'Cairo, sans-serif' }}>سكوب</span>
        </div>
        <div style={{
          fontSize: 9, fontWeight: 600, color: '#9CA3AF', letterSpacing: '1.5px',
          textTransform: 'uppercase', marginTop: 1,
        }}>
          Restaurant Operations
        </div>
      </div>
    </div>
  )
}
