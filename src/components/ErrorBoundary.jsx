import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('ErrorBoundary caught:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', minHeight: '100vh', background: '#EEF2EE', padding: 24,
        }}>
          <div style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16,
            padding: '32px 28px', maxWidth: 360, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
              Something went wrong. Please refresh the page.
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
              حدث خطأ غير متوقع. يرجى تحديث الصفحة.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#1B4332', color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
