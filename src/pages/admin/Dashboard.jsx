import PanelShell from '../../components/PanelShell'
import RebuildPlaceholder from '../../components/RebuildPlaceholder'
import { useAdminAuth } from '../../context/AdminAuthContext'

const NAV = [
  { label: 'Dashboard', labelAr: 'لوحة التحكم', path: '/admin/dashboard', section: 'main' },
  { label: 'Restaurants', labelAr: 'المطاعم', path: '/admin/restaurants', section: 'main' },
  { label: 'Subscriptions', labelAr: 'الاشتراكات', path: '/admin/subscriptions', section: 'main' },
  { label: 'Analytics', labelAr: 'التحليلات', path: '/admin/analytics', section: 'ops' },
  { label: 'Notifications', labelAr: 'الإشعارات', path: '/admin/notifications', section: 'ops' },
  { label: 'Settings', labelAr: 'الإعدادات', path: '/admin/settings', section: 'ops' },
  { label: 'Activity Log', labelAr: 'سجل النشاط', path: '/admin/activity-log', section: 'ops' },
]

const SECTIONS = {
  main: { en: 'Main', ar: 'الرئيسية' },
  ops: { en: 'Platform', ar: 'المنصة' },
}

export function AdminPage({ path, title, titleAr, children }) {
  const { profile, signOut } = useAdminAuth()
  const name = profile?.name || profile?.email || 'Admin'

  return (
    <PanelShell
      brandSub="Super Admin"
      brandSubAr="المشرف العام"
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

export default function AdminDashboard() {
  return <AdminPage path="/admin/dashboard" title="Dashboard" titleAr="لوحة التحكم" />
}
