import { useState } from "react";
import { Heart, SlidersHorizontal, X } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";
import profile3 from "@/assets/profile-3.jpg";
import profile2 from "@/assets/profile-2.jpg";

interface MatchesScreenProps {
  onOpenChat: () => void;
}

const likes = [
  { name: "Alina", age: 28, image: profile1, distance: "3 km" },
  { name: "Sofia", age: 26, image: profile3, distance: "1 km" },
  { name: "Marco", age: 31, image: profile2, distance: "5 km" },
];

const MatchesScreen = ({ onOpenChat }: MatchesScreenProps) => {
  const [tab, setTab] = useState<"incoming" | "mine">("incoming");

  return (
    <div className="min-h-screen bg-background px-5 pt-10 pb-28 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-love shadow-md" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Likes</p>
              <h2 className="text-2xl font-semibold text-foreground">Gestion des Likes</h2>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-surface-elevated border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Control */}
        <div className="bg-surface-elevated rounded-full p-1 border border-border/60 flex items-center">
          <button
            onClick={() => setTab("incoming")}
            className={`flex-1 text-xs font-semibold py-2 rounded-full transition-all ${
              tab === "incoming"
                ? "bg-gradient-love text-white shadow-md"
                : "text-muted-foreground"
            }`}
          >
            Je plais à
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`flex-1 text-xs font-semibold py-2 rounded-full transition-all ${
              tab === "mine"
                ? "bg-gradient-love text-white shadow-md"
                : "text-muted-foreground"
            }`}
          >
            Mes likes
          </button>
        </div>

        {/* Paywall Card */}
        <div className="relative rounded-[32px] overflow-hidden bg-surface-elevated border border-border/60 shadow-xl">
          <img
            src={likes[0].image}
            alt="Locked profile"
            className="w-full h-64 object-cover blur-xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-center justify-end">
              <span className="text-xs text-white/80 bg-white/10 px-3 py-1 rounded-full">
                Profil flouté
              </span>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <X className="w-5 h-5" />
                </button>
                <button className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Heart className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <button className="w-full py-3 rounded-2xl bg-gradient-love text-white font-semibold shadow-lg">
                  Débloquer le profil
                </button>
                <button className="w-full py-3 rounded-2xl bg-gradient-boost text-ink font-semibold shadow-lg">
                  Passer Premium
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Visible likes list */}
        <div className="space-y-3">
          {likes.slice(1).map((like) => (
            <button
              key={like.name}
              onClick={onOpenChat}
              className="w-full flex items-center gap-4 p-4 bg-surface-elevated rounded-2xl shadow-sm hover:shadow-md transition-all text-left active:scale-[0.98] border border-border/60"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full overflow-hidden shadow-sm">
                  <img src={like.image} alt={like.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent-blue rounded-full border-2 border-surface-elevated" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-body font-semibold text-foreground">
                    {like.name}, {like.age}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-body">{like.distance}</span>
                </div>
                <p className="text-xs text-muted-foreground font-body font-light truncate mt-0.5">
                  A liké ton profil récemment
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatchesScreen;
