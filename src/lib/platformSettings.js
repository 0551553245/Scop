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
  trial_duration_days:  '14',
  price_starter:        '99',
  price_growth:         '199',
  price_pro:            '399',
  support_whatsapp:     null,
  starter_branches:     '1',
  starter_managers:     '1',
  growth_branches:      '5',
  growth_managers:      '5',
  pro_branches:         '15',
  pro_managers:         '99',
}

export function getPlanLimits(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings }
  const starter = { branches: parseInt(s.starter_branches), managers: parseInt(s.starter_managers), price: parseInt(s.price_starter) }
  return {
    // Trial mirrors starter's configured limits — never a separate hardcoded value.
    trial:   { branches: starter.branches,             managers: starter.managers,             price: 0                          },
    starter,
    growth:  { branches: parseInt(s.growth_branches),  managers: parseInt(s.growth_managers),  price: parseInt(s.price_growth)   },
    pro:     { branches: parseInt(s.pro_branches),     managers: parseInt(s.pro_managers),     price: parseInt(s.price_pro)      },
  }
}

// Per-branch pricing model — additive, does not replace getPlanLimits().
// Existing tier-based subscriptions keep working via getPlanLimits() until
// every consumer is migrated per the pricing migration plan.
export function getPerBranchPricing(settings = {}) {
  const pricePerBranch      = parseInt(settings.price_per_branch ?? '50', 10)
  const managersPerBranch   = parseInt(settings.managers_per_branch ?? '2', 10)
  const enterpriseThreshold = parseInt(settings.enterprise_branch_threshold ?? '10', 10)

  return {
    pricePerBranch,
    managersPerBranch,
    enterpriseThreshold,
    calculateMonthlyAmount: (branchCount) => branchCount * pricePerBranch,
    calculateManagersLimit: (branchCount) => branchCount * managersPerBranch,
    isEnterprise:           (branchCount) => branchCount >= enterpriseThreshold,
  }
}
