import { useNavigate } from "react-router-dom";
import ChatScreen from "@/components/ChatScreen";

const ChatPage = () => {
  const navigate = useNavigate();

  return <ChatScreen onBack={() => navigate("/messages")} />;
};

export default ChatPage;
