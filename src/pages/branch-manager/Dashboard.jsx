import PanelShell from '../../components/PanelShell'
import RebuildPlaceholder from '../../components/RebuildPlaceholder'
import { useBranchManagerAuth } from '../../context/BranchManagerAuthContext'
import { useLanguage } from '../../context/LanguageContext'

const NAV = [
  { label: 'Dashboard', labelAr: 'لوحة التحكم', path: '/branch-manager/dashboard' },
  { label: 'Daily Tasks', labelAr: 'المهام اليومية', path: '/branch-manager/daily-tasks' },
  { label: 'Weekly Tasks', labelAr: 'المهام الأسبوعية', path: '/branch-manager/weekly-tasks' },
  { label: 'Monthly Tasks', labelAr: 'المهام الشهرية', path: '/branch-manager/monthly-tasks' },
  { label: 'Food Safety', labelAr: 'سلامة الغذاء', path: '/branch-manager/food-safety' },
  { label: 'Schedule', labelAr: 'الجدول', path: '/branch-manager/schedule' },
]

export function BMPage({ path, title, titleAr, children }) {
  const { profile, signOut, ownerHasAccess } = useBranchManagerAuth()
  const { isAr } = useLanguage()
  const name = profile?.name || profile?.email || 'Manager'

  return (
    <PanelShell
      brandSub="Branch Manager"
      brandSubAr="مدير الفرع"
      navItems={NAV}
      activePath={path}
      title={title}
      titleAr={titleAr}
      profileName={name}
      onSignOut={signOut}
    >
      {ownerHasAccess === false && (
        <div style={{
          background: '#FFF1F2', border: '1px solid #FECACA', color: '#9F1239',
          borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13,
        }}>
          {isAr
            ? 'اشتراك المطعم منتهٍ أو غير نشط. لا يمكن إرسال المهام.'
            : 'Restaurant subscription is inactive or expired. Submissions are blocked.'}
        </div>
      )}
      {children || <RebuildPlaceholder title={title} titleAr={titleAr} />}
    </PanelShell>
  )
}

export default function BranchManagerDashboard() {
  return <BMPage path="/branch-manager/dashboard" title="Dashboard" titleAr="لوحة التحكم" />
}
