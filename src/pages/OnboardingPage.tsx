import { useNavigate } from "react-router-dom";
import OnboardingScreen from "@/components/OnboardingScreen";

const OnboardingPage = () => {
  const navigate = useNavigate();

  return <OnboardingScreen onComplete={() => navigate("/profile-setup")} />;
};

export default OnboardingPage;
