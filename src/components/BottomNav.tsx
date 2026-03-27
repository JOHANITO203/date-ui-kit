import { NavLink } from "react-router-dom";
import { Compass, Heart, MessageCircle, User, Zap } from "lucide-react";

interface BottomNavProps {
  badges?: Record<
    string,
    {
      count?: number;
      dot?: boolean;
    }
  >;
}

const BottomNav = ({ badges = {} }: BottomNavProps) => {
  const items = [
    { id: "discover", to: "/discover", icon: Compass, label: "Découvrir" },
    { id: "likes", to: "/likes", icon: Heart, label: "Likes" },
    { id: "messages", to: "/messages", icon: MessageCircle, label: "Chats" },
    { id: "boost", to: "/boost", icon: Zap, label: "Boost" },
    { id: "profile", to: "/profile", icon: User, label: "Profil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-elevated/70 backdrop-blur-3xl border-t border-white/10 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-4 px-4">
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-1.5 transition-all duration-200 ${
                isActive ? "text-accent-pink scale-105" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon
                    className={`w-6 h-6 transition-colors ${isActive ? "fill-current" : ""}`}
                    strokeWidth={isActive ? 2 : 1.5}
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
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
