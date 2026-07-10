import PanelShell from '../../components/PanelShell'
import RebuildPlaceholder from '../../components/RebuildPlaceholder'
import { useOwnerAuth } from '../../context/OwnerAuthContext'

const NAV = [
  { label: 'Dashboard', labelAr: 'لوحة التحكم', path: '/owner/dashboard', section: 'main' },
  { label: 'Branches', labelAr: 'الفروع', path: '/owner/branches', section: 'main' },
  { label: 'Managers', labelAr: 'المديرون', path: '/owner/managers', section: 'main' },
  { label: 'Tasks', labelAr: 'المهام', path: '/owner/tasks', section: 'ops' },
  { label: 'Food Safety', labelAr: 'سلامة الغذاء', path: '/owner/food-safety', section: 'ops' },
  { label: 'Schedule', labelAr: 'الجدول', path: '/owner/schedule', section: 'ops' },
  { label: 'Reports', labelAr: 'التقارير', path: '/owner/reports', section: 'rep' },
  { label: 'Subscription', labelAr: 'الاشتراك', path: '/owner/subscription', section: 'rep' },
]

const SECTIONS = {
  main: { en: 'Main', ar: 'الرئيسية' },
  ops: { en: 'Operations', ar: 'العمليات' },
  rep: { en: 'Reports', ar: 'التقارير' },
}

export function OwnerPage({ path, title, titleAr, children }) {
  const { profile, signOut } = useOwnerAuth()
  const name = profile?.name || profile?.email || 'Owner'

  return (
    <PanelShell
      brandSub="Restaurant Operations"
      brandSubAr="عمليات المطاعم"
      navItems={NAV}
      sections={SECTIONS}
      activePath={path}
      title={title}
      titleAr={titleAr}
      profileName={name}
      onSignOut={signOut}
    >
      {children || <RebuildPlaceholder title={title} titleAr={titleAr} />}
    </PanelShell>
  )
}

export default function OwnerDashboard() {
  return <OwnerPage path="/owner/dashboard" title="Dashboard" titleAr="لوحة التحكم" />
}
