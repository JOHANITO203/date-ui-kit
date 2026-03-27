import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import './App.css';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import LoginMethodsPage from './pages/LoginMethodsPage';
import OnboardingPage from './pages/OnboardingPage';
import DiscoverPage from './pages/DiscoverPage';
import LikesPage from './pages/LikesPage';
import MessagesPage from './pages/MessagesPage';
import ChatPage from './pages/ChatPage';
import BoostPage from './pages/BoostPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import AppShell from './pages/AppShell';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Router>
      <div className="h-screen w-full bg-black overflow-hidden relative">
        <AnimatePresence mode="wait">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/splash" element={<Navigate to="/" replace />} />
            <Route path="/entry" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/methods" element={<LoginMethodsPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/onboarding/*" element={<OnboardingPage />} />
            <Route path="/setup" element={<Navigate to="/onboarding" replace />} />
            <Route path="/profile-setup" element={<Navigate to="/onboarding" replace />} />

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

            {/* Fallback */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
    </Router>
  );
}
