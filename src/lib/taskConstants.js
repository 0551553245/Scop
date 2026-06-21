export const CATEGORY_ORDER = ['opening', 'food_safety', 'cleaning', 'maintenance', 'closing', 'custom']

export const CATEGORY_LABELS = {
  opening:     { label: 'Opening',     labelAr: 'الفتح',        emoji: '🌅' },
  food_safety: { label: 'Food Safety', labelAr: 'سلامة الغذاء', emoji: '🌡' },
  cleaning:    { label: 'Cleaning',    labelAr: 'التنظيف',      emoji: '🧹' },
  maintenance: { label: 'Maintenance', labelAr: 'الصيانة',      emoji: '🔧' },
  closing:     { label: 'Closing',     labelAr: 'الإغلاق',      emoji: '🌙' },
  custom:      { label: 'Custom',      labelAr: 'مخصص',         emoji: '⚡' },
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
