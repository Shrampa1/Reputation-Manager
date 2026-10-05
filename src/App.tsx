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
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="flex min-h-screen bg-slate-50">
              <Sidebar />
              <div className="flex-1 min-w-0 flex flex-col">
                <MobileHeader />
                <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/reviews" element={<ReviewsPage />} />
                    <Route path="/seo" element={<SeoPage />} />
                    <Route path="/social" element={<SocialPage />} />
                    <Route path="/leads" element={<LeadsPage />} />
                    <Route path="/integrations" element={<AdminRoute><IntegrationsPage /></AdminRoute>} />
                    <Route path="/activity" element={<AdminRoute><ActivityPage /></AdminRoute>} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/team" element={<TeamPage />} />
                  </Routes>
                </main>
              </div>
              <BottomNav />
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
