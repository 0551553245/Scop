/** Saudi week starts Saturday. */
export function getSaudiWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun … 6=Sat
  const diff = (day + 1) % 7 // days since Saturday
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - diff)
  return d
}

export function toDateKey(date) {
  return date.toISOString().split('T')[0]
}

export function todayKey() {
  return toDateKey(new Date())
}
