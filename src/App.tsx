import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav, MobileHeader } from '@/components/layout/BottomNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminRoute } from '@/components/AdminRoute';
import { BusinessGate } from '@/components/BusinessGate';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { useLocationContext } from '@/context/LocationContext';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

// Pages are split into their own files and downloaded when first opened
const page = <K extends string, P extends object>(name: K, load: () => Promise<Record<K, React.ComponentType<P>>>) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const DashboardPage = page('DashboardPage', () => import('@/pages/DashboardPage'));
const ReviewsPage = page('ReviewsPage', () => import('@/pages/ReviewsPage'));
const SeoPage = page('SeoPage', () => import('@/pages/SeoPage'));
const SocialPage = page('SocialPage', () => import('@/pages/SocialPage'));
const LeadsPage = page('LeadsPage', () => import('@/pages/LeadsPage'));
const IntegrationsPage = page('IntegrationsPage', () => import('@/pages/IntegrationsPage'));
const SettingsPage = page('SettingsPage', () => import('@/pages/SettingsPage'));
const TeamPage = page('TeamPage', () => import('@/pages/TeamPage'));
const ActivityPage = page('ActivityPage', () => import('@/pages/ActivityPage'));
const ReviewLandingPage = page('ReviewLandingPage', () => import('@/pages/ReviewLandingPage'));
const ReportPage = page('ReportPage', () => import('@/pages/ReportPage'));
const ReviewPosterPage = page('ReviewPosterPage', () => import('@/pages/ReviewPosterPage'));
const BillingPage = page('BillingPage', () => import('@/pages/BillingPage'));
const PlatformAdminPage = page('PlatformAdminPage', () => import('@/pages/PlatformAdminPage'));
const LegalPage = page('LegalPage', () => import('@/pages/LegalPage'));
const RoleAccessPage = page('RoleAccessPage', () => import('@/pages/RoleAccessPage'));

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-20" role="status" aria-label="Loading">
      <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
    </div>
  );
}

/** Page routes, remounted when the user switches business so no page shows the old one's data. */
function AppRoutes() {
  const { organization } = useLocationContext();
  return (
    <Suspense fallback={<PageLoading />}>
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
    </Suspense>
  );
}

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/signup" element={<SignupPage />} />
      {/* Public: customers open this from a review-request email */}
      <Route path="/r/:token" element={<ReviewLandingPage />} />
      {/* Public: customers scan the business's counter QR code */}
      <Route path="/q/:key" element={<ReviewLandingPage mode="qr" />} />
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
      {/* Print-ready QR code poster */}
      <Route
        path="/review-poster"
        element={
          <ProtectedRoute>
            <BusinessGate>
              <ReviewPosterPage />
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
    </Suspense>
  );
}

export default App;
