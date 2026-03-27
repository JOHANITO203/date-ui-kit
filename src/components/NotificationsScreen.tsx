import { ArrowLeft, Bell, ChevronRight, Heart, MessageCircle, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const NotificationsScreen = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    messages: true,
    matches: true,
    superlikes: true,
    promotions: false,
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="min-h-screen bg-gradient-to-b from-[#261030] via-[#0b0b10] to-black px-5 pt-10 pb-28">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white/80 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="uppercase tracking-[0.25em] text-[11px]">Notifications</span>
            </button>
            <button className="text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white transition-colors">
              Enregistrer
            </button>
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-4">
            {[
              { label: "Messages", key: "messages", icon: MessageCircle },
              { label: "Nouveaux matchs", key: "matches", icon: Heart },
              { label: "Superlikes", key: "superlikes", icon: Star },
              { label: "Promotions", key: "promotions", icon: Bell },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-3 py-3 rounded-2xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white">{item.label}</span>
                </div>
                <button
                  onClick={() => toggle(item.key as keyof typeof settings)}
                  className={`relative w-11 h-6 rounded-full transition-all ${
                    settings[item.key as keyof typeof settings] ? "bg-accent-pink" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                      settings[item.key as keyof typeof settings] ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-3">
            {[
              { label: "Son et vibrations", icon: Bell },
              { label: "Resume quotidien", icon: ChevronRight },
            ].map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center justify-between px-3 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsScreen;
