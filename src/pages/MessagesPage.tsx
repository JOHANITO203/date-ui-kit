import { useNavigate } from "react-router-dom";
import MessagesScreen from "@/components/MessagesScreen";

const MessagesPage = () => {
  const navigate = useNavigate();

  return <MessagesScreen onOpenChat={() => navigate("/chat")} />;
};

export default MessagesPage;
