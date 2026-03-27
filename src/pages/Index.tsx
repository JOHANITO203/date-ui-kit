import { useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import OnboardingScreen from "@/components/OnboardingScreen";
import ProfileSetupScreen from "@/components/ProfileSetupScreen";
import SwipeScreen from "@/components/SwipeScreen";
import MatchOverlay from "@/components/MatchOverlay";
import MatchesScreen from "@/components/MatchesScreen";
import ChatScreen from "@/components/ChatScreen";
import ProfileScreen from "@/components/ProfileScreen";
import BottomNav from "@/components/BottomNav";

type Screen = "splash" | "onboarding" | "profileSetup" | "discover" | "matches" | "messages" | "profile" | "chat";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("splash");
  const [showMatch, setShowMatch] = useState(false);

  const handleMatch = () => setShowMatch(true);

  if (screen === "splash") {
    return <SplashScreen onContinue={() => setScreen("onboarding")} />;
  }

  if (screen === "onboarding") {
    return <OnboardingScreen onComplete={() => setScreen("profileSetup")} />;
  }

  if (screen === "profileSetup") {
    return <ProfileSetupScreen onComplete={() => setScreen("discover")} />;
  }

  if (screen === "chat") {
    return <ChatScreen onBack={() => setScreen("messages")} />;
  }

  return (
    <>
      {screen === "discover" && <SwipeScreen onMatch={handleMatch} />}
      {screen === "matches" && <MatchesScreen onOpenChat={() => setScreen("chat")} />}
      {screen === "messages" && <MatchesScreen onOpenChat={() => setScreen("chat")} />}
      {screen === "profile" && <ProfileScreen onReset={() => setScreen("splash")} />}

      {showMatch && (
        <MatchOverlay onClose={() => setShowMatch(false)} />
      )}

      <BottomNav
        active={screen}
        onNavigate={(s) => setScreen(s as Screen)}
      />
    </>
  );
};

export default Index;
