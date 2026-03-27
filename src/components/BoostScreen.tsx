import { Bolt, Crown, Flame, Timer } from "lucide-react";

const boostPacks = [
  { label: "1 Boost", price: "3,99 €", bonus: "Visibilité x5" },
  { label: "5 Boosts", price: "12,99 €", bonus: "Économie 35%" },
  { label: "10 Boosts", price: "21,99 €", bonus: "Économie 45%" },
];

const BoostScreen = () => {
  return (
    <div className="min-h-screen bg-background px-5 pt-10 pb-28 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-boost shadow-md" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Boost</p>
              <h2 className="text-2xl font-semibold text-foreground">Active ta visibilité</h2>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-surface-elevated border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Crown className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-[32px] p-5 bg-gradient-boost shadow-2xl text-ink relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.55),transparent_50%)] opacity-70" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bolt className="w-4 h-4" />
              Boost instantané
            </div>
            <h3 className="text-2xl font-semibold">
              Passe en haut des profils pendant 30 min
            </h3>
            <div className="flex items-center gap-4 text-sm font-medium">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70">
                <Timer className="w-4 h-4" />
                30 min
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70">
                <Flame className="w-4 h-4" />
                Priorité locale
              </span>
            </div>
            <button className="w-full py-3 rounded-2xl bg-black text-white font-semibold shadow-lg">
              Activer le Boost
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-elevated border border-border/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Aujourd'hui</p>
            <p className="text-2xl font-semibold text-foreground mt-2">2 340</p>
            <p className="text-xs text-muted-foreground">Vues potentielles</p>
          </div>
          <div className="rounded-2xl bg-surface-elevated border border-border/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Moyenne</p>
            <p className="text-2xl font-semibold text-foreground mt-2">+320%</p>
            <p className="text-xs text-muted-foreground">Taux de match</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground tracking-[0.35em] uppercase">Packs Boost</p>
          {boostPacks.map((pack) => (
            <div
              key={pack.label}
              className="flex items-center justify-between gap-4 rounded-2xl bg-surface-elevated border border-border/60 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{pack.label}</p>
                <p className="text-xs text-muted-foreground">{pack.bonus}</p>
              </div>
              <button className="px-4 py-2 rounded-full bg-gradient-love text-white text-xs font-semibold shadow-md">
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
