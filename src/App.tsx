import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "./pages/AppShell.tsx";
import BoostPage from "./pages/BoostPage.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import DiscoverPage from "./pages/DiscoverPage.tsx";
import HomePage from "./pages/HomePage.tsx";
import LikesPage from "./pages/LikesPage.tsx";
import MessagesPage from "./pages/MessagesPage.tsx";
import OnboardingPage from "./pages/OnboardingPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import ProfileSetupPage from "./pages/ProfileSetupPage.tsx";
import AccountSettingsPage from "./pages/AccountSettingsPage.tsx";
import PrivacyPage from "./pages/PrivacyPage.tsx";
import NotificationsPage from "./pages/NotificationsPage.tsx";
import PreferencesPage from "./pages/PreferencesPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState<"fade-in" | "fade-out">("fade-in");
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== previousPath.current) {
      setStage("fade-out");
      const timeout = window.setTimeout(() => {
        previousPath.current = location.pathname;
        setDisplayLocation(location);
        setStage("fade-in");
      }, 180);

      return () => window.clearTimeout(timeout);
    }

    setDisplayLocation(location);
  }, [location]);

  return (
    <div
      className={`transition-all duration-200 ease-out ${
        stage === "fade-in" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <Routes location={displayLocation}>
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/profile-setup" element={<ProfileSetupPage />} />
        <Route element={<AppShell />}>
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/likes" element={<LikesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/boost" element={<BoostPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings/account" element={<AccountSettingsPage />} />
        <Route path="/settings/privacy" element={<PrivacyPage />} />
        <Route path="/settings/notifications" element={<NotificationsPage />} />
        <Route path="/settings/preferences" element={<PreferencesPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
