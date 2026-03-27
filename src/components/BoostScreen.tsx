import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';

const BoostScreen = () => {
  return (
    <div className="h-full overflow-y-auto no-scrollbar py-6 pb-nav">
      <div className="container-content layout-stack px-[var(--page-x)]">
        <section className="glass rounded-[var(--card-radius)] p-6 md:p-8 lg:p-10 border-orange-500/30 bg-orange-500/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 md:w-24 md:h-24 gradient-boost rounded-[28px] flex items-center justify-center shadow-2xl shadow-orange-500/30 animate-float shrink-0">
                <ICONS.Boost size={42} className="text-black" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">Visibilite acceleree</p>
                <h2 className="fluid-title font-bold">Boostez votre profil maintenant</h2>
                <p className="text-secondary fluid-subtitle max-w-lg">Mettez votre profil en tete des decouvertes pendant 30 minutes et captez plus de vues immediates.</p>
              </div>
            </div>
            <GlassButton variant="boost" className="w-full md:w-auto min-w-[14rem] h-[var(--cta-height)] text-base md:text-lg font-bold">
              Activer le Boost
            </GlassButton>
          </div>
        </section>

        <section className="layout-autofit">
          <div className="glass surface-card rounded-[var(--card-radius)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Impact 24h</p>
            <p className="text-3xl font-black tracking-tight mb-1">+68%</p>
            <p className="text-secondary text-sm">Vues de profil apres activation</p>
          </div>
          <div className="glass surface-card rounded-[var(--card-radius)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Moyenne</p>
            <p className="text-3xl font-black tracking-tight mb-1">12 matchs</p>
            <p className="text-secondary text-sm">Obtenus en periode boostee</p>
          </div>
        </section>

        <section className="layout-grid">
          <div className="glass p-6 rounded-[var(--card-radius)] border-orange-500/30 bg-orange-500/5 flex items-center justify-between">
            <div className="text-left">
              <span className="block text-orange-400 font-bold">10 Boosts</span>
              <span className="text-sm text-secondary">Economisez 40%</span>
            </div>
            <span className="text-xl font-bold">19,99 EUR</span>
          </div>
          <div className="glass p-6 rounded-[var(--card-radius)] flex items-center justify-between">
            <div className="text-left">
              <span className="block font-bold">1 Boost</span>
              <span className="text-sm text-secondary">Populaire</span>
            </div>
            <span className="text-xl font-bold">3,99 EUR</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BoostScreen;
