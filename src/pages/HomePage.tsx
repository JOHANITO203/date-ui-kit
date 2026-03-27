import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";

const HomePage = () => {
  const navigate = useNavigate();

  return <SplashScreen onContinue={() => navigate("/onboarding")} />;
};

export default HomePage;
