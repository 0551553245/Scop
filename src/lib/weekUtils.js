export function getWeekStart() {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Saturday = 6, so days since last Saturday:
  const daysSinceSat = day === 6 ? 0 : day + 1
  const sat = new Date(now)
  sat.setDate(now.getDate() - daysSinceSat)
  sat.setHours(0, 0, 0, 0)
  return sat
}

export function getWeekEnd() {
  const start = getWeekStart()
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Friday
  end.setHours(23, 59, 59, 999)
  return end
}

export function getWeekStartStr() {
  return getWeekStart().toISOString().split('T')[0]
}

