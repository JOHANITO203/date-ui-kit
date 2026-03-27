import profile1 from "@/assets/profile-1.jpg";
import profile3 from "@/assets/profile-3.jpg";
import profile2 from "@/assets/profile-2.jpg";
import { Search } from "lucide-react";

interface MessagesScreenProps {
  onOpenChat: () => void;
}

const conversations = [
  {
    name: "Alina",
    age: 28,
    image: profile1,
    lastMsg: "You should definitely come! I could show you the best spots 🌸",
    time: "10:38",
    online: true,
    unread: 2,
  },
  {
    name: "Sofia",
    age: 26,
    image: profile3,
    lastMsg: "Let's meet sometime!",
    time: "Yesterday",
    online: false,
    unread: 0,
  },
  {
    name: "Marco",
    age: 31,
    image: profile2,
    lastMsg: "Great taste in architecture 👏",
    time: "Mon",
    online: false,
    unread: 0,
  },
];

const newMatches = [
  { name: "Alina", image: profile1, online: true },
  { name: "Sofia", image: profile3, online: false },
  { name: "Marco", image: profile2, online: false },
];

const MessagesScreen = ({ onOpenChat }: MessagesScreenProps) => {
  return (
    <div className="min-h-screen bg-background px-5 pt-14 pb-28 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-3xl font-display font-light text-foreground">
          Messages
        </h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full bg-surface-elevated text-foreground text-sm font-body pl-11 pr-4 py-3 rounded-2xl border border-border/30 focus:outline-none focus:border-primary/30 placeholder:text-muted-foreground/50 transition-all shadow-sm"
          />
        </div>

        {/* New Matches horizontal scroll */}
        <div className="space-y-3">
          <span className="text-xs text-muted-foreground font-body tracking-widest uppercase">
            New Matches
          </span>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {newMatches.map((m) => (
              <button
                key={m.name}
                onClick={onOpenChat}
                className="flex flex-col items-center gap-2 shrink-0 group"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all shadow-sm">
                    <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                  {m.online && (
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <span className="text-xs font-body text-muted-foreground group-hover:text-foreground transition-colors">
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Conversations */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-body tracking-widest uppercase">
            Recent
          </span>
          <div className="space-y-1 mt-2">
            {conversations.map((conv) => (
              <button
                key={conv.name}
                onClick={onOpenChat}
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-surface-elevated/80 transition-all text-left active:scale-[0.98]"
              >
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden shadow-sm">
                    <img src={conv.image} alt={conv.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  {conv.online && (
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-body text-foreground ${conv.unread > 0 ? "font-semibold" : "font-medium"}`}>
                      {conv.name}, {conv.age}
                    </h3>
                    <span className={`text-[11px] font-body ${conv.unread > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {conv.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-[13px] font-body truncate pr-3 ${conv.unread > 0 ? "text-foreground" : "text-muted-foreground font-light"}`}>
                      {conv.lastMsg}
                    </p>
                    {conv.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-body font-semibold flex items-center justify-center shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesScreen;
