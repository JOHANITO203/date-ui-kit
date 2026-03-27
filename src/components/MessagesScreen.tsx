import profile1 from "@/assets/profile-1.jpg";
import profile3 from "@/assets/profile-3.jpg";
import profile2 from "@/assets/profile-2.jpg";
import { CheckCheck, Search, SlidersHorizontal } from "lucide-react";

interface MessagesScreenProps {
  onOpenChat: () => void;
}

const conversations = [
  {
    name: "Alina",
    age: 28,
    image: profile1,
    lastMsg: "You should definitely come! I could show you the best spots.",
    time: "10:38",
    online: true,
    unread: 2,
    read: false,
  },
  {
    name: "Sofia",
    age: 26,
    image: profile3,
    lastMsg: "Let's meet sometime!",
    time: "Yesterday",
    online: false,
    unread: 0,
    read: true,
  },
  {
    name: "Marco",
    age: 31,
    image: profile2,
    lastMsg: "Great taste in architecture.",
    time: "Mon",
    online: false,
    unread: 0,
    read: true,
  },
];

const newMatches = [
  { name: "Alina", image: profile1, online: true },
  { name: "Sofia", image: profile3, online: false },
  { name: "Marco", image: profile2, online: false },
];

const MessagesScreen = ({ onOpenChat }: MessagesScreenProps) => {
  return (
    <div className="min-h-screen bg-background px-5 pt-10 pb-28 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-love shadow-md" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Inbox</p>
              <h2 className="text-2xl font-semibold text-foreground">Messages</h2>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-surface-elevated border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full bg-surface-elevated text-foreground text-sm font-body pl-11 pr-4 py-3 rounded-2xl border border-border/50 focus:outline-none focus:border-accent-blue/60 placeholder:text-muted-foreground/60 transition-all shadow-sm"
          />
        </div>

        {/* New Matches horizontal scroll */}
        <div className="space-y-3">
          <span className="text-xs text-muted-foreground font-body tracking-[0.4em] uppercase">
            Nouveaux Matches
          </span>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {newMatches.map((m) => (
              <button
                key={m.name}
                onClick={onOpenChat}
                className="flex flex-col items-center gap-2 shrink-0 group"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-accent-blue/50 transition-all shadow-sm">
                    <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                  {m.online && (
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-accent-blue rounded-full border-2 border-background" />
                  )}
                </div>
                <span className="text-xs font-body text-muted-foreground group-hover:text-foreground transition-colors">
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* CTA Card */}
        <div className="rounded-3xl bg-surface-elevated border border-border/60 p-4 shadow-md bg-sheen">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
                Like en attente
              </p>
              <h3 className="text-lg font-semibold text-foreground">Camille attend ta réponse</h3>
              <p className="text-xs text-muted-foreground mt-1">Ne laisse pas filer le match.</p>
            </div>
            <button className="px-4 py-2 rounded-full bg-gradient-love text-white text-sm font-semibold shadow-lg">
              Voir
            </button>
          </div>
        </div>

        {/* Conversations */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-body tracking-[0.4em] uppercase">
            Messages
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
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-accent-blue rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-body text-foreground ${conv.unread > 0 ? "font-semibold" : "font-medium"}`}>
                      {conv.name}, {conv.age}
                    </h3>
                    <span className={`text-[11px] font-body ${conv.unread > 0 ? "text-accent-pink font-medium" : "text-muted-foreground"}`}>
                      {conv.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-[13px] font-body truncate pr-3 ${conv.unread > 0 ? "text-foreground" : "text-muted-foreground font-light"}`}>
                      {conv.lastMsg}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {conv.read && (
                        <CheckCheck className="w-4 h-4 text-accent-blue" strokeWidth={2} />
                      )}
                      {conv.unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-accent-red text-white text-[10px] font-body font-semibold flex items-center justify-center">
                          {conv.unread}
                        </span>
                      )}
                    </div>
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
