import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { LanguageProvider } from './context/LanguageContext'
import { OwnerAuthProvider, useOwnerAuth } from './context/OwnerAuthContext'
import { BranchManagerAuthProvider, useBranchManagerAuth } from './context/BranchManagerAuthContext'
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext'
import ProtectedRoute from './components/ProtectedRoute'

const Landing               = lazy(() => import('./pages/Landing'))
const OwnerLogin            = lazy(() => import('./pages/owner/Login'))
const OwnerRegister         = lazy(() => import('./pages/owner/Register'))
const OwnerForgotPassword   = lazy(() => import('./pages/owner/ForgotPassword'))
const OwnerResetPassword    = lazy(() => import('./pages/owner/ResetPassword'))
const OwnerEmailVerify      = lazy(() => import('./pages/owner/EmailVerify'))
const OwnerDashboard        = lazy(() => import('./pages/owner/Dashboard'))
const OwnerBranches         = lazy(() => import('./pages/owner/Branches'))
const OwnerManagers         = lazy(() => import('./pages/owner/Managers'))
const OwnerTaskManagement   = lazy(() => import('./pages/owner/TaskManagement'))
const OwnerFoodSafety       = lazy(() => import('./pages/owner/FoodSafety'))
const OwnerSchedule         = lazy(() => import('./pages/owner/Schedule'))
const OwnerReports          = lazy(() => import('./pages/owner/Reports'))
const OwnerSubscription     = lazy(() => import('./pages/owner/Subscription'))

const BranchManagerLogin        = lazy(() => import('./pages/branch-manager/Login'))
const BranchManagerDashboard    = lazy(() => import('./pages/branch-manager/Dashboard'))
const BranchManagerDailyTasks   = lazy(() => import('./pages/branch-manager/DailyTasks'))
const BranchManagerWeeklyTasks  = lazy(() => import('./pages/branch-manager/WeeklyTasks'))
const BranchManagerMonthlyTasks = lazy(() => import('./pages/branch-manager/MonthlyTasks'))
const BranchManagerFoodSafety   = lazy(() => import('./pages/branch-manager/FoodSafety'))
const BranchManagerSchedule     = lazy(() => import('./pages/branch-manager/Schedule'))

const AdminLogin         = lazy(() => import('./pages/admin/Login'))
const AdminDashboard     = lazy(() => import('./pages/admin/Dashboard'))
const AdminRestaurants   = lazy(() => import('./pages/admin/Restaurants'))
const AdminSubscriptions = lazy(() => import('./pages/admin/Subscriptions'))
const AdminAnalytics     = lazy(() => import('./pages/admin/Analytics'))
const AdminNotifications = lazy(() => import('./pages/admin/Notifications'))
const AdminSettings      = lazy(() => import('./pages/admin/Settings'))
const AdminActivityLog   = lazy(() => import('./pages/admin/ActivityLog'))

function PageLoader() {
  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#F7F5F0' }}>
      <div style={{ width:32, height:32, border:'3px solid #E5E7EB', borderTopColor:'#1B4332', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function OwnerLayout() {
  return (
    <OwnerAuthProvider>
      <Outlet />
    </OwnerAuthProvider>
  )
}

function BranchManagerLayout() {
  return (
    <BranchManagerAuthProvider>
      <Outlet />
    </BranchManagerAuthProvider>
  )
}

function AdminLayout() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/verify" element={<OwnerEmailVerify />} />

          <Route path="/owner" element={<OwnerLayout />}>
            <Route path="login" element={<OwnerLogin />} />
            <Route path="register" element={<OwnerRegister />} />
            <Route path="forgot-password" element={<OwnerForgotPassword />} />
            <Route path="reset-password" element={<OwnerResetPassword />} />
            <Route element={<ProtectedRoute useAuthHook={useOwnerAuth} loginPath="/owner/login" />}>
              <Route path="dashboard" element={<OwnerDashboard />} />
              <Route path="branches" element={<OwnerBranches />} />
              <Route path="managers" element={<OwnerManagers />} />
              <Route path="tasks" element={<OwnerTaskManagement />} />
              <Route path="food-safety" element={<OwnerFoodSafety />} />
              <Route path="schedule" element={<OwnerSchedule />} />
              <Route path="reports" element={<OwnerReports />} />
              <Route path="subscription" element={<OwnerSubscription />} />
            </Route>
          </Route>

          <Route path="/branch-manager" element={<BranchManagerLayout />}>
            <Route path="login" element={<BranchManagerLogin />} />
            <Route element={<ProtectedRoute useAuthHook={useBranchManagerAuth} loginPath="/branch-manager/login" />}>
              <Route path="dashboard" element={<BranchManagerDashboard />} />
              <Route path="daily-tasks" element={<BranchManagerDailyTasks />} />
              <Route path="weekly-tasks" element={<BranchManagerWeeklyTasks />} />
              <Route path="monthly-tasks" element={<BranchManagerMonthlyTasks />} />
              <Route path="food-safety" element={<BranchManagerFoodSafety />} />
              <Route path="schedule" element={<BranchManagerSchedule />} />
            </Route>
          </Route>

          <Route path="/admin" element={<AdminLayout />}>
            <Route path="login" element={<AdminLogin />} />
            <Route element={<ProtectedRoute useAuthHook={useAdminAuth} loginPath="/admin/login" />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="restaurants" element={<AdminRestaurants />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="trials" element={<Navigate to="/admin/subscriptions" replace />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="users" element={<Navigate to="/admin/restaurants" replace />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="activity-log" element={<AdminActivityLog />} />
            </Route>
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </LanguageProvider>
  )
}
