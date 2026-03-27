import { Compass, Heart, MessageCircle, User } from "lucide-react";

interface BottomNavProps {
  active: string;
  onNavigate: (screen: string) => void;
}

const BottomNav = ({ active, onNavigate }: BottomNavProps) => {
  const items = [
    { id: "discover", icon: Compass, label: "Discovery" },
    { id: "matches", icon: Heart, label: "Matches" },
    { id: "messages", icon: MessageCircle, label: "Messages" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-3 px-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-1 transition-colors ${
              active === item.id ? "text-gold" : "text-muted-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[10px] tracking-wider uppercase font-light">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
