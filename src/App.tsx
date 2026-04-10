import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const LoginMethodsPage = lazy(() => import('./pages/LoginMethodsPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const LikesPage = lazy(() => import('./pages/LikesPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const BoostPage = lazy(() => import('./pages/BoostPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));
const AppShell = lazy(() => import('./pages/AppShell'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
import { RequireAuth, RequireGuest } from './auth/RouteGuards';

const AppSuspenseFallback = () => (
  <div className="h-screen w-full bg-black" />
);

export default function App() {
  return (
    <Router>
      <div className="h-screen w-full bg-black overflow-hidden relative">
        <Suspense fallback={<AppSuspenseFallback />}>
          <AnimatePresence mode="wait">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/splash" element={<Navigate to="/" replace />} />
              <Route path="/entry" element={<Navigate to="/" replace />} />
              <Route element={<RequireGuest />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/login/methods" element={<LoginMethodsPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
              </Route>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/onboarding/*" element={<OnboardingPage />} />
              <Route path="/setup" element={<Navigate to="/onboarding" replace />} />
              <Route path="/profile-setup" element={<Navigate to="/onboarding" replace />} />

              <Route element={<RequireAuth />}>
                {/* App Shell with Adaptive Navigation */}
                <Route element={<AppShell />}>
                  <Route path="/discover" element={<DiscoverPage />} />
                  <Route path="/likes" element={<LikesPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/boost" element={<BoostPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  
                  {/* Settings within AppShell for Desktop Sidebar consistency */}
                  <Route path="/settings" element={<AccountSettingsPage />} />
                  <Route path="/settings/:category" element={<AccountSettingsPage />} />
                  <Route path="/settings/:category/:sub" element={<AccountSettingsPage />} />
                </Route>

                {/* Sub-screens / Full-screen views */}
                <Route path="/chat/:userId" element={<ChatPage />} />
                <Route path="/profile/edit" element={<EditProfilePage />} />
              </Route>

              {/* Fallback */}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
    </Router>
  );
}
