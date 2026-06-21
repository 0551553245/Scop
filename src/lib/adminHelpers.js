export function formatDate(dateStr, isAr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(dateStr, isAr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function daysLeft(expiresAt) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

export function calculateExpiry(months) {
  const d = new Date()
  d.setMonth(d.getMonth() + Number(months))
  return d.toISOString()
}
