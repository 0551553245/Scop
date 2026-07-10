import { supabaseOwner } from './supabase'

let _settingsCache = null
let _settingsCacheTime = 0
const SETTINGS_TTL = 5 * 60 * 1000

export async function getPlatformSettings(client = supabaseOwner) {
  const now = Date.now()
  if (_settingsCache && (now - _settingsCacheTime) < SETTINGS_TTL) {
    return _settingsCache
  }
  const { data } = await client
    .from('platform_settings')
    .select('key, value')
  if (data) {
    _settingsCache = Object.fromEntries(data.map(s => [s.key, s.value]))
    _settingsCacheTime = now
  }
  return _settingsCache || {}
}

export function invalidateSettingsCache() {
  _settingsCache = null
  _settingsCacheTime = 0
}

export const DEFAULT_SETTINGS = {
  trial_duration_days: '14',
  support_whatsapp: null,
}

/** Per-branch pricing — never hardcode limits/prices in components. */
export function getPerBranchPricing(settings = {}) {
  const pricePerBranch = parseInt(settings.price_per_branch ?? '50', 10)
  const managersPerBranch = parseInt(settings.managers_per_branch ?? '2', 10)
  const enterpriseThreshold = parseInt(settings.enterprise_branch_threshold ?? '10', 10)

  return {
    pricePerBranch,
    managersPerBranch,
    enterpriseThreshold,
    calculateMonthlyAmount: (branchCount) => branchCount * pricePerBranch,
    calculateManagersLimit: (branchCount) => branchCount * managersPerBranch,
    isEnterprise: (branchCount) => branchCount >= enterpriseThreshold,
  }
}
