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
  price_starter:        '199',
  price_growth:         '499',
  price_pro:            '999',
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
  return {
    trial:   { branches: 1,                            managers: 1,                            price: 0                          },
    starter: { branches: parseInt(s.starter_branches), managers: parseInt(s.starter_managers), price: parseInt(s.price_starter)  },
    growth:  { branches: parseInt(s.growth_branches),  managers: parseInt(s.growth_managers),  price: parseInt(s.price_growth)   },
    pro:     { branches: parseInt(s.pro_branches),     managers: parseInt(s.pro_managers),     price: parseInt(s.price_pro)      },
  }
}
