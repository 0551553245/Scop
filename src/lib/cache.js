const CACHE = {}
const TTL = 30000
const MAX_ENTRIES = 100

export function getCached(key) {
  const entry = CACHE[key]
  if (!entry) return null
  if (Date.now() - entry.time > TTL) {
    delete CACHE[key]
    return null
  }
  return entry.data
}

export function setCached(key, data) {
  const keys = Object.keys(CACHE)
  if (keys.length >= MAX_ENTRIES) {
    const oldest = keys.sort((a, b) => CACHE[a].time - CACHE[b].time)[0]
    delete CACHE[oldest]
  }
  CACHE[key] = { data, time: Date.now() }
}

export function invalidateCache(key) {
  delete CACHE[key]
}

export function invalidateAll() {
  Object.keys(CACHE).forEach(k => delete CACHE[k])
}

export function debounce(fn, ms) {
  let timer
  const debounced = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
  debounced.cancel = () => clearTimeout(timer)
  return debounced
}
