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
  const [catalogView, setCatalogView] = useState<'instant' | 'passes' | 'bundles'>('instant');
  const hour = new Date().getHours();
  const isPeakNow = hour >= 20 || hour <= 1;
  const profileViewsToday = 18;
  const weeklyLikes = 2;
  const baseViews = 12;
  const projectedViewsMin = 35;
  const projectedViewsMax = 50;
  const projectedLikesMin = 3;
  const projectedLikesMax = 6;

  const instantProducts = [
    {
      id: 'boost',
      label: 'Boost Visibilite',
      desc: 'Plus de vues et plus de matches pendant 30 min.',
      price: '3,99 EUR',
      unit: '1 activation',
      tag: 'Impact immediat',
      accent: 'orange',
      icon: ICONS.Boost,
    },
    {
      id: 'premium',
      label: 'Premium Verified',
      desc: 'Badge verified + conversations sans restriction.',
      price: '9,99 EUR',
      unit: 'mensuel',
      tag: 'Statut + confort',
      accent: 'pink',
      icon: ICONS.CheckCircle2,
    },
    {
      id: 'superlike',
      label: 'SuperLike Tokens',
      desc: 'Passe en top conversation avec message prioritaire.',
      price: '4,99 EUR',
      unit: '5 tokens',
      tag: 'Top conversation',
      accent: 'blue',
      icon: ICONS.Star,
    },
    {
      id: 'rewind',
      label: 'Rewind Tokens',
      desc: 'Annule un swipe. Inclus Premium, vendable separement.',
      price: '2,99 EUR',
      unit: '5 tokens',
      tag: 'Filet de securite',
      accent: 'neutral',
      icon: ICONS.Rewind,
    },
  ];

  const timePacks = [
    { id: 'day', label: 'Pass Jour', desc: 'Mini premium + 1 boost', price: '5,99 EUR', tag: '24h' },
    { id: 'week', label: 'Pass Semaine', desc: 'Premium temporaire + tokens', price: '14,99 EUR', tag: '7 jours' },
    { id: 'month', label: 'Pass Mois', desc: 'Premium complet + dotation incluse', price: '29,99 EUR', tag: '30 jours' },
  ];

  const bundles = [
    { id: 'starter', label: 'Starter', desc: '1 Boost + 5 SuperLikes', price: '7,99 EUR', tag: 'Premier achat' },
    { id: 'pro', label: 'Dating Pro', desc: '5 Boosts + 20 SuperLikes + 10 Rewinds', price: '24,99 EUR', tag: 'Meilleur rapport' },
    { id: 'premiumplus', label: 'Premium+', desc: 'Premium mensuel + 4 boosts + tokens mensuels', price: '39,99 EUR', tag: 'Valeur maximale' },
  ];

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

  const liveStats = useMemo(() => {
    const elapsed = Math.max(0, BOOST_DURATION - timeLeft);
    return {
      views: isBoostActive ? Math.max(1, Math.floor(elapsed / 12)) : 0,
      likes: isBoostActive ? Math.floor(elapsed / 70) : 0,
      matches: isBoostActive ? Math.floor(elapsed / 180) : 0,
      visits: isBoostActive ? Math.max(1, Math.floor(elapsed / 25)) : 0,
    };
  }, [isBoostActive, timeLeft]);

  const activateBoost = () => {
    setIsBoostActive(true);
    setTimeLeft((prev) => (prev > 0 ? prev + BOOST_DURATION : BOOST_DURATION));
  };

  const jumpToSection = (index: number) => {
    const node = sectionRefs.current[index];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cardBaseClass =
    'rounded-[var(--card-radius)] border border-[var(--menu-premium-border)] bg-[var(--menu-premium-gray)]/85 backdrop-blur-xl';
  const getAccentClass = (accent: string) => {
    if (accent === 'orange') return 'border-orange-400/35 bg-orange-500/10';
    if (accent === 'pink') return 'border-pink-400/35 bg-pink-500/10';
    if (accent === 'blue') return 'border-blue-400/35 bg-blue-500/10';
    return 'border-[var(--menu-premium-border)] bg-[var(--menu-premium-gray)]/85';
  };

  return (
    <div ref={scrollRef} className="relative group/boost h-full overflow-y-auto no-scrollbar py-[var(--boost-page-y)]">
      <div className={`${isLarge ? 'screen-template-commerce container-commerce' : 'container-content flex flex-col gap-[var(--boost-mobile-section-gap)]'} px-[var(--page-x)]`}>
        <section className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[clamp(2rem,3.2vw,3rem)] leading-none font-black tracking-tight">Boost</h1>
            <p className="text-[10px] uppercase tracking-[0.24em] text-secondary font-black mt-2">Visibilite & Conversion</p>
          </div>
          {!isBoostActive && (
            <span className="mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] border border-orange-300/35 text-orange-200 bg-orange-500/12">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-300" />
              {isPeakNow ? 'Heure active' : 'Pic ce soir'}
            </span>
          )}
        </section>

        <section
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          className={`${cardBaseClass} ${isLarge ? 'p-6 md:p-8 lg:p-10' : 'p-[var(--boost-hero-pad)]'} border-orange-500/30 transition-all ${isBoostActive ? 'shadow-[0_0_40px_rgba(251,146,60,0.22)]' : ''}`}
        >
          <div className={`flex ${isLarge ? 'flex-col md:flex-row md:items-center md:justify-between gap-6' : 'flex-col gap-4'}`}>
            <div className={`flex ${isLarge ? 'items-start gap-4' : 'flex-col items-start gap-3'}`}>
              <div className={`${isLarge ? 'w-20 h-20 md:w-24 md:h-24 rounded-[28px]' : 'w-[var(--boost-hero-icon-box)] h-[var(--boost-hero-icon-box)] rounded-[1.25rem]'} gradient-boost flex items-center justify-center shadow-2xl shadow-orange-500/30 shrink-0 ${isBoostActive ? 'animate-pulse' : 'animate-float'}`}>
                <ICONS.Boost size={isLarge ? 42 : 30} className="text-black" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">Visibilite acceleree</p>
                <h2 className={`${isLarge ? 'fluid-title' : 'text-[length:var(--boost-title-size)] leading-[1.04]'} font-bold`}>
                  {isBoostActive ? 'Votre profil performe en direct' : 'Multipliez votre visibilite au bon moment'}
                </h2>
                <p className={`text-secondary ${isLarge ? 'fluid-subtitle max-w-lg' : 'text-[length:var(--boost-desc-size)] leading-relaxed max-w-none'}`}>
                  {isBoostActive
                    ? 'Votre profil est prioritaire dans votre zone. Continuez pour capter plus de likes, matchs et conversations.'
                    : 'Jusqu a 3x plus de vues pendant les heures actives. Les profils boostes obtiennent generalement plus de likes et de matchs.'}
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
                {!isBoostActive && (
                  <p className="text-xs text-orange-200/90">
                    {isPeakNow ? 'Forte activite dans votre zone maintenant.' : 'Pic estime ce soir entre 20h et 23h.'}
                  </p>
                )}
              </div>
            </div>
            <GlassButton onClick={activateBoost} variant="boost" className={`w-full md:w-auto min-w-[14rem] ${isLarge ? 'h-[var(--cta-height)] text-base md:text-lg' : 'h-[var(--boost-cta-h)] text-[1.1rem]'} font-bold animate-[pulse_3s_ease-in-out_infinite]`}>
              {isBoostActive ? 'Ajouter 30 min' : 'Activer le Boost'}
            </GlassButton>
          </div>
        </section>

        <section
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-[var(--grid-gap)]"
        >
          <div className={`${cardBaseClass} surface-card md:col-span-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Situation actuelle</p>
            <p className="text-3xl font-black tracking-tight mb-1">{profileViewsToday} vues</p>
            <p className="text-secondary text-sm">{weeklyLikes} likes cette semaine, activite locale faible</p>
          </div>
          <div className={`${cardBaseClass} surface-card md:col-span-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Projection boost</p>
            <p className="text-3xl font-black tracking-tight mb-1">{projectedViewsMin}-{projectedViewsMax} vues</p>
            <p className="text-secondary text-sm">Vs {baseViews}/jour habituellement, selon activite locale</p>
          </div>
          <div className={`${cardBaseClass} surface-card md:col-span-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Likes attendus</p>
            <p className="text-3xl font-black tracking-tight mb-1">{projectedLikesMin}-{projectedLikesMax} likes</p>
            <p className="text-secondary text-sm">{isPeakNow ? 'Fenetre active en cours' : 'Plus haut potentiel ce soir'}</p>
          </div>
        </section>

        <section
          ref={(el) => {
            sectionRefs.current[2] = el;
          }}
          className="flex flex-col gap-4"
        >
          <div className="w-fit rounded-full p-1 border border-[var(--menu-premium-border)] bg-[var(--menu-premium-gray)]/85 backdrop-blur-xl flex flex-wrap gap-1">
            {[
              { id: 'instant', label: 'Items instantanes' },
              { id: 'passes', label: 'Packs temps' },
              { id: 'bundles', label: 'Bundles' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCatalogView(item.id as 'instant' | 'passes' | 'bundles')}
                className={`h-9 px-4 rounded-full text-xs font-bold transition-all ${catalogView === item.id ? 'gradient-premium text-white shadow-[0_8px_24px_rgba(236,72,153,0.25)]' : 'text-secondary hover:bg-white/8'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {catalogView === 'instant' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--grid-gap)]">
              {instantProducts.map((item) => (
                <div key={item.id} className={`${cardBaseClass} ${getAccentClass(item.accent)} p-6 flex flex-col gap-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-black/35 border border-white/10 flex items-center justify-center">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <p className="font-bold">{item.label}</p>
                        <p className="text-xs text-secondary">{item.desc}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold whitespace-nowrap">{item.price}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-secondary">{item.unit}</span>
                    <span className="text-[10px] uppercase tracking-widest text-secondary">{item.tag}</span>
                  </div>
                  <button className="w-full h-11 rounded-full font-bold border border-white/20 bg-white/8 hover:bg-white/12 transition-colors">
                    Acheter
                  </button>
                </div>
              ))}
            </div>
          )}

          {catalogView === 'passes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--grid-gap)]">
              {timePacks.map((item) => (
                <div key={item.id} className={`${cardBaseClass} p-6 flex flex-col gap-3`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{item.label}</p>
                    <span className="text-xs px-2 py-1 rounded-full border border-white/15 bg-white/5">{item.tag}</span>
                  </div>
                  <p className="text-sm text-secondary">{item.desc}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold">{item.price}</p>
                    <button className="h-10 px-4 rounded-full gradient-premium text-white text-sm font-bold">Choisir</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {catalogView === 'bundles' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--grid-gap)]">
              {bundles.map((item) => (
                <div key={item.id} className={`${cardBaseClass} p-6 grid grid-rows-[auto_1fr_auto] gap-3 min-h-[19rem] ${item.id === 'pro' ? 'border-pink-500/35 bg-pink-500/10' : ''}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{item.label}</p>
                    <span className={`whitespace-nowrap text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${item.id === 'pro' ? 'bg-pink-500/20 text-pink-200 border border-pink-300/30' : 'bg-white/5 border border-white/15 text-secondary'}`}>
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-sm text-secondary">{item.desc}</p>
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-[clamp(1.9rem,2vw,2.25rem)] leading-none font-black whitespace-nowrap">{item.price}</p>
                    <button className={`h-10 w-full px-5 rounded-full text-sm font-bold ${item.id === 'pro' ? 'gradient-premium text-white' : 'border border-white/20 bg-white/8 hover:bg-white/12'}`}>
                      Prendre ce bundle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${cardBaseClass} p-5 flex flex-col gap-3`}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Reassurance</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-secondary">
            <span>Paiement securise</span>
            <span>Activation immediate</span>
            <span>Aucun renouvellement auto sur les packs</span>
            <span>Boosts non utilises conserves</span>
          </div>
          {isBoostActive && (
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-2xl bg-white/5 px-3 py-2">
                <p className="text-[10px] text-secondary uppercase tracking-widest">Vues</p>
                <p className="text-lg font-bold">{liveStats.views}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-2">
                <p className="text-[10px] text-secondary uppercase tracking-widest">Likes</p>
                <p className="text-lg font-bold">{liveStats.likes}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-2">
                <p className="text-[10px] text-secondary uppercase tracking-widest">Visites</p>
                <p className="text-lg font-bold">{liveStats.visits}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-2">
                <p className="text-[10px] text-secondary uppercase tracking-widest">Matchs</p>
                <p className="text-lg font-bold">{liveStats.matches}</p>
              </div>
            </div>
          )}
        </section>
      </div>
      {isLarge && (
        <div className="fixed right-0 top-0 bottom-0 w-20 z-30 pointer-events-none">
          <div className="group/boost-rail h-full w-full flex items-center justify-center pointer-events-auto">
            <div className="flex items-center opacity-0 transition-opacity duration-200 group-hover/boost:opacity-100 group-focus-within/boost:opacity-100 group-hover/boost-rail:opacity-100">
              <div className="rounded-full p-[1px] bg-gradient-to-b from-orange-500 via-amber-400 to-yellow-300 shadow-[0_0_14px_rgba(251,146,60,0.33)]">
                <div className="relative w-3 h-48 rounded-full bg-[#120a02]/95 overflow-hidden">
                  <div
                    className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-orange-400 via-amber-300 to-yellow-200"
                    style={{
                      height: `${scrollThumb}%`,
                      top: `${scrollProgress * (100 - scrollThumb)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="ml-2 flex flex-col gap-2.5">
                {[0, 1, 2].map((index) => (
                  <button
                    key={`boost-jump-${index}`}
                    onClick={() => jumpToSection(index)}
                    className="w-3 h-3 rounded-full bg-white/35 hover:bg-orange-300 transition-colors"
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
