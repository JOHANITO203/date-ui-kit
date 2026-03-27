import { Compass, Heart, MessageCircle, User } from "lucide-react";

interface BottomNavProps {
  active: string;
  onNavigate: (screen: string) => void;
}

const BottomNav = ({ active, onNavigate }: BottomNavProps) => {
  const items = [
    { id: "discover", icon: Compass, label: "Discover" },
    { id: "matches", icon: Heart, label: "Matches" },
    { id: "messages", icon: MessageCircle, label: "Chat" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-elevated/80 backdrop-blur-lg border-t border-border/50 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-3 px-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${
              active === item.id
                ? "text-primary scale-105"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" strokeWidth={active === item.id ? 2 : 1.5} />
            <span className="text-[10px] tracking-wider font-body font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
