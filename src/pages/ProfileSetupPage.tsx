import { useNavigate } from "react-router-dom";
import ProfileSetupScreen from "@/components/ProfileSetupScreen";

const ProfileSetupPage = () => {
  const navigate = useNavigate();

  return <ProfileSetupScreen onComplete={() => navigate("/discover")} />;
};

export default ProfileSetupPage;
