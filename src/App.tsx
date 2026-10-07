import { Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav, MobileHeader } from '@/components/layout/BottomNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardPage } from '@/pages/DashboardPage';
import { ReviewsPage } from '@/pages/ReviewsPage';
import { SeoPage } from '@/pages/SeoPage';
import { SocialPage } from '@/pages/SocialPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TeamPage } from '@/pages/TeamPage';
import { ActivityPage } from '@/pages/ActivityPage';
import { AdminRoute } from '@/components/AdminRoute';
import { BusinessGate } from '@/components/BusinessGate';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { ReviewLandingPage } from '@/pages/ReviewLandingPage';
import { ReportPage } from '@/pages/ReportPage';
import { BillingPage } from '@/pages/BillingPage';
import { PlatformAdminPage } from '@/pages/PlatformAdminPage';
import { LegalPage } from '@/pages/LegalPage';
import { RoleAccessPage } from '@/pages/RoleAccessPage';
import { useLocationContext } from '@/context/LocationContext';

/** Page routes, remounted when the user switches business so no page shows the old one's data. */
function AppRoutes() {
  const { organization } = useLocationContext();
  return (
    <Routes key={organization?.id ?? 'none'}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/seo" element={<SeoPage />} />
      <Route path="/social" element={<SocialPage />} />
      <Route path="/leads" element={<LeadsPage />} />
      <Route path="/integrations" element={<AdminRoute permission="integrations.manage"><IntegrationsPage /></AdminRoute>} />
      <Route path="/activity" element={<AdminRoute permission="activity.view"><ActivityPage /></AdminRoute>} />
      <Route path="/access" element={<RoleAccessPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/team" element={<TeamPage />} />
      <Route path="/billing" element={<BillingPage />} />
      <Route path="/admin" element={<PlatformAdminPage />} />
    </Routes>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      {/* Public: customers open this from a review-request email */}
      <Route path="/r/:token" element={<ReviewLandingPage />} />
      {/* Public legal pages (linked from the landing page footer) */}
      <Route path="/terms" element={<LegalPage page="terms" />} />
      <Route path="/privacy" element={<LegalPage page="privacy" />} />
      <Route path="/refunds" element={<LegalPage page="refunds" />} />
      {/* Print-ready report, without the app's sidebar */}
      <Route
        path="/report"
        element={
          <ProtectedRoute>
            <BusinessGate>
              <ReportPage />
            </BusinessGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <BusinessGate>
              <div className="flex min-h-screen bg-slate-50">
                <Sidebar />
                <div className="flex-1 min-w-0 flex flex-col">
                  <MobileHeader />
                  <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
                    <AppRoutes />
                  </main>
                </div>
                <BottomNav />
              </div>
            </BusinessGate>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
