import { useEffect, useMemo, useRef, useState } from 'react';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';

const BoostScreen = () => {
  const { isDesktop, isTablet } = useDevice();
  const isLarge = isDesktop || isTablet;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollThumb, setScrollThumb] = useState(32);
  const BOOST_DURATION = 30 * 60;
  const [isBoostActive, setIsBoostActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!isBoostActive) return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsBoostActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isBoostActive]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!isLarge || !node) return;

    const updateScroll = () => {
      const max = node.scrollHeight - node.clientHeight;
      const progress = max <= 0 ? 0 : node.scrollTop / max;
      const size = node.scrollHeight <= 0 ? 100 : (node.clientHeight / node.scrollHeight) * 100;
      setScrollProgress(Math.min(1, Math.max(0, progress)));
      setScrollThumb(Math.max(22, Math.min(100, size)));
    };

    updateScroll();
    node.addEventListener('scroll', updateScroll);
    window.addEventListener('resize', updateScroll);

    return () => {
      node.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [isLarge]);

  const timer = useMemo(() => {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, [timeLeft]);

  const activateBoost = () => {
    setIsBoostActive(true);
    setTimeLeft((prev) => (prev > 0 ? prev + BOOST_DURATION : BOOST_DURATION));
  };

  const jumpToSection = (index: number) => {
    const node = sectionRefs.current[index];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={scrollRef} className="relative group/boost h-full overflow-y-auto no-scrollbar py-6 pb-nav">
      <div className={`${isLarge ? 'screen-template-commerce container-commerce' : 'container-content layout-stack'} px-[var(--page-x)]`}>
        <section
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          className={`glass rounded-[var(--card-radius)] p-6 md:p-8 lg:p-10 border-orange-500/30 transition-all ${isBoostActive ? 'bg-orange-500/10 shadow-[0_0_40px_rgba(251,146,60,0.22)]' : 'bg-orange-500/5'}`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`w-20 h-20 md:w-24 md:h-24 gradient-boost rounded-[28px] flex items-center justify-center shadow-2xl shadow-orange-500/30 shrink-0 ${isBoostActive ? 'animate-pulse' : 'animate-float'}`}>
                <ICONS.Boost size={42} className="text-black" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">Visibilite acceleree</p>
                <h2 className="fluid-title font-bold">{isBoostActive ? 'Vous etes en avant maintenant' : 'Boostez votre profil maintenant'}</h2>
                <p className="text-secondary fluid-subtitle max-w-lg">
                  {isBoostActive
                    ? 'Votre profil passe en priorite dans votre zone. Le rythme des vues augmente pendant toute la session.'
                    : 'Mettez votre profil en tete des decouvertes pendant 30 minutes et captez plus de vues immediates.'}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${isBoostActive ? 'border-green-400/40 text-green-300 bg-green-500/10' : 'border-white/15 text-secondary bg-white/5'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isBoostActive ? 'bg-green-300 animate-pulse' : 'bg-white/40'}`} />
                    {isBoostActive ? 'Boost actif' : 'Boost inactif'}
                  </span>
                  {isBoostActive && (
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border border-orange-300/40 text-orange-200 bg-orange-500/15">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-300 animate-pulse" />
                      {timer} restant
                    </span>
                  )}
                </div>
              </div>
            </div>
            <GlassButton onClick={activateBoost} variant="boost" className="w-full md:w-auto min-w-[14rem] h-[var(--cta-height)] text-base md:text-lg font-bold animate-[pulse_3s_ease-in-out_infinite]">
              {isBoostActive ? 'Ajouter 30 min' : 'Activer le Boost'}
            </GlassButton>
          </div>
        </section>

        <section
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
          className="layout-autofit"
        >
          <div className="glass surface-card rounded-[var(--card-radius)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Dernieres 24h</p>
            <p className="text-3xl font-black tracking-tight mb-1">{isBoostActive ? '+74%' : '+68%'}</p>
            <p className="text-secondary text-sm">Vues de profil apres activation</p>
          </div>
          <div className="glass surface-card rounded-[var(--card-radius)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Moyenne Boost</p>
            <p className="text-3xl font-black tracking-tight mb-1">{isBoostActive ? '14 matchs' : '12 matchs'}</p>
            <p className="text-secondary text-sm">Obtenus pendant une session boostee</p>
          </div>
          <div className="glass surface-card rounded-[var(--card-radius)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Activite en cours</p>
            <p className="text-3xl font-black tracking-tight mb-1">{isBoostActive ? 'Elevee' : 'Normale'}</p>
            <p className="text-secondary text-sm">{isBoostActive ? 'Vous etes actuellement mis en avant' : 'Activez un boost pour accelerer la visibilite'}</p>
          </div>
        </section>

        <section
          ref={(el) => {
            sectionRefs.current[2] = el;
          }}
          className="layout-grid"
        >
          <div className="glass p-6 rounded-[var(--card-radius)] border-orange-500/35 bg-orange-500/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <span className="inline-flex mb-2 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] font-black bg-orange-500/20 text-orange-200 border border-orange-300/30">Recommande</span>
                <span className="block text-orange-300 font-bold">10 Boosts</span>
                <span className="text-sm text-secondary">Economisez 40% et gardez du stock</span>
              </div>
              <span className="text-xl font-bold">19,99 EUR</span>
            </div>
            <button className="w-full h-11 rounded-full font-bold gradient-boost text-black transition-transform hover:scale-[1.01] active:scale-[0.99]">
              Choisir ce pack
            </button>
          </div>
          <div className="glass p-6 rounded-[var(--card-radius)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <span className="block font-bold">1 Boost</span>
                <span className="text-sm text-secondary">Ideal pour tester maintenant</span>
              </div>
              <span className="text-xl font-bold">3,99 EUR</span>
            </div>
            <button className="w-full h-11 rounded-full border border-white/15 bg-white/5 font-bold transition-colors hover:bg-white/10">
              Choisir ce pack
            </button>
          </div>
        </section>
      </div>
      {isLarge && (
        <div className="fixed right-0 top-0 bottom-0 w-14 z-30 pointer-events-none">
          <div className="group/boost-rail h-full w-full flex items-center justify-center pointer-events-auto">
            <div className="flex items-center opacity-0 transition-opacity duration-300 group-hover/boost-rail:opacity-100">
              <div className="rounded-full p-[1px] bg-gradient-to-b from-orange-500 via-amber-400 to-yellow-300 shadow-[0_0_14px_rgba(251,146,60,0.33)]">
                <div className="relative w-2.5 h-40 rounded-full bg-[#120a02]/95 overflow-hidden">
                  <div
                    className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-orange-400 via-amber-300 to-yellow-200"
                    style={{
                      height: `${scrollThumb}%`,
                      top: `${scrollProgress * (100 - scrollThumb)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="ml-2 flex flex-col gap-2">
                {[0, 1, 2].map((index) => (
                  <button
                    key={`boost-jump-${index}`}
                    onClick={() => jumpToSection(index)}
                    className="w-2 h-2 rounded-full bg-white/35 hover:bg-orange-300 transition-colors"
                    aria-label={`Aller a la section boost ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoostScreen;
