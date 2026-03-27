import { useNavigate } from "react-router-dom";
import MatchesScreen from "@/components/MatchesScreen";

const LikesPage = () => {
  const navigate = useNavigate();

  return <MatchesScreen onOpenChat={() => navigate("/chat")} />;
};

export default LikesPage;
