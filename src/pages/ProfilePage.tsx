import { useNavigate } from "react-router-dom";
import ProfileScreen from "@/components/ProfileScreen";

const ProfilePage = () => {
  const navigate = useNavigate();

  return <ProfileScreen onReset={() => navigate("/")} />;
};

export default ProfilePage;
