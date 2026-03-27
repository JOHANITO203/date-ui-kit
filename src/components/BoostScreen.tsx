import { useMemo, useState } from "react";
import { Bolt, Crown, Flame, Timer } from "lucide-react";

const boostPacks = [
  { label: "1 Boost", price: "3,99 €", bonus: "Visibilite x5", recommended: false },
  { label: "5 Boosts", price: "12,99 €", bonus: "Economie 35%", recommended: true },
  { label: "10 Boosts", price: "21,99 €", bonus: "Economie 45%", recommended: false },
];

const BoostScreen = () => {
  const [isActive, setIsActive] = useState(false);
  const [remaining] = useState(30);
  const remainingLabel = useMemo(() => `${remaining} min`, [remaining]);

  return (
    <div className="min-h-screen bg-background px-5 pt-10 pb-28 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-boost shadow-md" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Boost</p>
              <h2 className="text-2xl font-semibold text-foreground">Active ta visibilite</h2>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-surface-elevated border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Crown className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`rounded-[32px] p-5 shadow-2xl relative overflow-hidden transition-all ${
            isActive ? "bg-gradient-boost" : "bg-surface-elevated/90 border border-border/60"
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.35),transparent_55%)] opacity-70" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bolt className="w-4 h-4 text-accent-orange" />
                {isActive ? "Boost actif" : "Boost instantane"}
              </div>
              {isActive && (
                <span className="text-xs text-white/90 bg-black/30 px-3 py-1 rounded-full">
                  {remainingLabel}
                </span>
              )}
            </div>
            <h3 className={`text-2xl font-semibold ${isActive ? "text-ink" : "text-foreground"}`}>
              {isActive
                ? "Vous etes actuellement mis en avant."
                : "Gagnez plus de vues et de matchs des maintenant."}
            </h3>
            <div className="flex items-center gap-4 text-sm font-medium">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                isActive ? "bg-white/70" : "bg-white/5 text-foreground"
              }`}>
                <Timer className="w-4 h-4" />
                30 min
              </span>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                isActive ? "bg-white/70" : "bg-white/5 text-foreground"
              }`}>
                <Flame className="w-4 h-4" />
                Priorite locale
              </span>
            </div>
            <button
              onClick={() => setIsActive((v) => !v)}
              className={`w-full py-3 rounded-2xl font-semibold shadow-lg transition-all ${
                isActive
                  ? "bg-black text-white"
                  : "bg-gradient-boost text-ink hover:shadow-xl"
              }`}
            >
              {isActive ? "Desactiver le Boost" : "Activer le Boost"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-elevated border border-border/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Dernieres 24h</p>
            <p className="text-2xl font-semibold text-foreground mt-2">2 340</p>
            <p className="text-xs text-muted-foreground">Vues du profil</p>
          </div>
          <div className="rounded-2xl bg-surface-elevated border border-border/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Avec Boost</p>
            <p className="text-2xl font-semibold text-foreground mt-2">+320%</p>
            <p className="text-xs text-muted-foreground">Matches recents</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground tracking-[0.35em] uppercase">Packs Boost</p>
          {boostPacks.map((pack) => (
            <div
              key={pack.label}
              className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all ${
                pack.recommended
                  ? "bg-gradient-love text-white border-transparent shadow-lg"
                  : "bg-surface-elevated border-border/60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${pack.recommended ? "text-white" : "text-foreground"}`}>
                    {pack.label}
                  </p>
                  {pack.recommended && (
                    <span className="text-[10px] uppercase tracking-[0.2em] bg-white/20 text-white px-2 py-1 rounded-full">
                      Recommande
                    </span>
                  )}
                </div>
                <p className={`text-xs ${pack.recommended ? "text-white/70" : "text-muted-foreground"}`}>
                  {pack.bonus}
                </p>
              </div>
              <button className={`px-4 py-2 rounded-full text-xs font-semibold shadow-md ${
                pack.recommended ? "bg-black/40 text-white" : "bg-gradient-love text-white"
              }`}>
                {pack.price}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BoostScreen;
