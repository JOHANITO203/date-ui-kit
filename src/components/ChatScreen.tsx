import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Image,
  MoreVertical,
  Send,
  Smile,
  Languages,
} from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";

interface ChatScreenProps {
  onBack: () => void;
}

const mockMessages = [
  {
    id: 1,
    from: "them",
    text: "Hey! Nice to meet you.",
    translated: "Salut ! Ravie de te rencontrer.",
    time: "10:32",
    read: true,
  },
  {
    id: 2,
    from: "me",
    text: "Hi Alina! Loved your profile. How is Paris?",
    translated: "Salut Alina ! J ai adore ton profil. Comment est Paris ?",
    time: "10:34",
    read: true,
  },
  {
    id: 3,
    from: "them",
    text: "It is beautiful right now. Spring vibes everywhere!",
    translated: "C est magnifique en ce moment. L ambiance de printemps partout.",
    time: "10:35",
    read: true,
  },
  {
    id: 4,
    from: "me",
    text: "I have always wanted to visit in spring.",
    translated: "J ai toujours voulu venir au printemps.",
    time: "10:36",
    read: true,
  },
  {
    id: 5,
    from: "them",
    text: "You should come. I can show you the best hidden spots in Le Marais.",
    translated: "Tu devrais venir. Je peux te montrer les meilleurs endroits caches du Marais.",
    time: "10:38",
    read: true,
  },
  {
    id: 6,
    from: "me",
    text: "That sounds amazing. I would love that.",
    translated: "Ca a l air genial. J aimerais beaucoup.",
    time: "10:39",
    read: false,
  },
];

const ChatScreen = ({ onBack }: ChatScreenProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(mockMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessages((m) => [
      ...m,
      {
        id: m.length + 1,
        from: "me",
        text: message,
        translated: "Traduction automatique en attente",
        time: "Now",
        read: false,
      },
    ]);
    setMessage("");

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((m) => [
        ...m,
        {
          id: m.length + 2,
          from: "them",
          text: "That is so sweet!",
          translated: "C est adorable.",
          time: "Now",
          read: true,
        },
      ]);
    }, 2000);
  };

  const groupedMessages = messages.reduce<{ date: string; msgs: typeof messages }[]>((acc, msg) => {
    const date = "Today";
    const last = acc[acc.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      acc.push({ date, msgs: [msg] });
    }
    return acc;
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col animate-slide-left overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-elevated/80 backdrop-blur-xl border-b border-border/30 shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/10">
              <img src={profile1} alt="Alina" className="w-full h-full object-cover" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-blue rounded-full border-2 border-surface-elevated" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-body font-semibold text-foreground leading-tight">Alina</h3>
            <span className="text-[11px] text-muted-foreground font-body">Active now · FR / EN</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTranslation((v) => !v)}
            className={`px-2.5 h-9 rounded-full border transition-colors text-[11px] font-semibold tracking-[0.25em] uppercase ${
              showTranslation
                ? "border-white/20 text-white/80 bg-white/5"
                : "border-white/10 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Languages className="w-3.5 h-3.5 inline-block -mt-0.5 mr-2 text-accent-blue" />
            Tr
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
            <MoreVertical className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex items-center justify-center my-4">
              <span className="text-[11px] font-body text-muted-foreground bg-white/5 px-3 py-1 rounded-full">
                {group.date}
              </span>
            </div>

            {group.msgs.map((msg, idx) => {
              const isMe = msg.from === "me";
              const prevSame = idx > 0 && group.msgs[idx - 1].from === msg.from;
              const nextSame = idx < group.msgs.length - 1 && group.msgs[idx + 1].from === msg.from;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"} ${prevSame ? "mt-0.5" : "mt-3"} animate-fade-in`}
                >
                  {!isMe && !nextSame && (
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mb-0.5">
                      <img src={profile1} alt="Alina" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {!isMe && nextSame && <div className="w-7 shrink-0" />}

                  <div
                    className={`max-w-[75%] px-4 py-2.5 text-[14px] font-body leading-relaxed shadow-sm ${
                      isMe
                        ? `bg-gradient-love text-white ${nextSame ? "rounded-2xl rounded-br-lg" : "rounded-2xl rounded-br-md"}`
                        : `bg-surface-elevated/95 text-foreground ${nextSame ? "rounded-2xl rounded-bl-lg" : "rounded-2xl rounded-bl-md"}`
                    }`}
                  >
                    <p className="text-[14px]">{msg.text}</p>
                    {showTranslation && msg.translated && (
                      <div className="mt-2 border-t border-white/10 pt-2">
                        <span className={`text-[10px] uppercase tracking-[0.25em] ${
                          isMe ? "text-white/70" : "text-muted-foreground"
                        }`}>
                          Traduction
                        </span>
                        <p className={`text-[13px] ${
                          isMe ? "text-white/80" : "text-muted-foreground"
                        }`}>
                          {msg.translated}
                        </p>
                      </div>
                    )}
                    <div className={`flex items-center gap-1 mt-2 ${isMe ? "justify-end" : ""}`}>
                      <span className={`text-[10px] ${
                        isMe ? "text-white/60" : "text-muted-foreground"
                      }`}>
                        {msg.time}
                      </span>
                      {isMe && (
                        msg.read
                          ? <CheckCheck className="w-3 h-3 text-white/60" strokeWidth={2} />
                          : <Check className="w-3 h-3 text-white/50" strokeWidth={2} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-end gap-2 mt-3 animate-fade-in">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
              <img src={profile1} alt="Alina" className="w-full h-full object-cover" />
            </div>
            <div className="bg-surface-elevated/90 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-surface-elevated/70 backdrop-blur-xl border-t border-border/30 px-4 py-3">
        <div className="flex items-end gap-2 max-w-lg mx-auto">
          <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors shrink-0">
            <Image className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message..."
              className="w-full bg-white/5 text-foreground text-sm font-body px-4 py-3 pr-10 rounded-2xl border border-white/10 focus:outline-none focus:border-accent-blue/60 focus:bg-white/10 placeholder:text-muted-foreground/60 transition-all"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2">
              <Smile className="w-5 h-5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" strokeWidth={1.5} />
            </button>
          </div>
          <button
            onClick={handleSend}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 ${
              message.trim()
                ? "bg-gradient-love shadow-lg hover:shadow-xl active:scale-95"
                : "bg-white/5"
            }`}
          >
            <Send className={`w-4 h-4 ${message.trim() ? "text-white" : "text-muted-foreground/50"}`} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;
