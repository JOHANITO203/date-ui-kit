import { Compass, Heart, MessageCircle, User, Zap } from "lucide-react";

interface BottomNavProps {
  active: string;
  onNavigate: (screen: string) => void;
  badges?: Record<
    string,
    {
      count?: number;
      dot?: boolean;
    }
  >;
}

const BottomNav = ({ active, onNavigate, badges = {} }: BottomNavProps) => {
  const items = [
    { id: "discover", icon: Compass, label: "Découvrir" },
    { id: "likes", icon: Heart, label: "Likes" },
    { id: "messages", icon: MessageCircle, label: "Chats" },
    { id: "boost", icon: Zap, label: "Boost" },
    { id: "profile", icon: User, label: "Profil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-elevated/90 backdrop-blur-xl border-t border-border/40 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-3 px-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`relative flex flex-col items-center gap-1.5 transition-all duration-200 ${
              active === item.id
                ? "text-accent-pink scale-105"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="relative">
              <item.icon
                className={`w-5 h-5 transition-colors ${
                  active === item.id ? "fill-current" : ""
                }`}
                strokeWidth={active === item.id ? 2 : 1.5}
              />
              {badges[item.id]?.dot && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-red" />
              )}
              {typeof badges[item.id]?.count === "number" && (
                <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent-red text-[10px] font-semibold text-white flex items-center justify-center">
                  {badges[item.id]?.count}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-wider font-body font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
