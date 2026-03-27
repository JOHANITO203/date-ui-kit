import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";

interface ChatScreenProps {
  onBack: () => void;
}

const mockMessages = [
  { id: 1, from: "them", text: "Hey! Nice to meet you 😊", time: "10:32" },
  { id: 2, from: "me", text: "Hi Alina! Loved your profile. How's Paris?", time: "10:34" },
  { id: 3, from: "them", text: "It's beautiful right now. Spring vibes everywhere!", time: "10:35" },
  { id: 4, from: "me", text: "I've always wanted to visit in spring", time: "10:36" },
];

const ChatScreen = ({ onBack }: ChatScreenProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(mockMessages);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessages((m) => [
      ...m,
      { id: m.length + 1, from: "me", text: message, time: "Now" },
    ]);
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col animate-slide-left">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border">
          <img src={profile1} alt="Alina" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-light tracking-wide text-foreground">Alina</h3>
          <span className="text-[10px] text-gold tracking-widest uppercase">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-24">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-light ${
                msg.from === "me"
                  ? "bg-gold-muted text-foreground rounded-br-md"
                  : "bg-surface-elevated text-foreground rounded-bl-md"
              }`}
            >
              <p>{msg.text}</p>
              <span className="text-[10px] text-muted-foreground mt-1 block text-right">
                {msg.time}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-5 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-surface-elevated text-foreground text-sm font-light px-4 py-2.5 rounded-full border border-border focus:outline-none focus:border-gold/50 placeholder:text-muted-foreground transition-colors"
          />
          <button
            onClick={handleSend}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
          >
            <Send className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;
