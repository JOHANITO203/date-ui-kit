import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';

type CatalogView = 'instant' | 'passes' | 'bundles';
type TierId = 'essential' | 'gold' | 'platinum';
type GlowToken = '--glow-silver' | '--glow-gold' | '--glow-blue' | '--glow-pink' | '--glow-orange' | '--glow-cyan';

type TierDef = {
  id: TierId;
  name: string;
  tierTag: string;
  price: string;
  period: string;
  features: string[];
  hasStar?: boolean;
  tagClass: string;
  bulletClass: string;
  glowToken: GlowToken;
  ctaButtonClass: string;
};

const tiers: TierDef[] = [
  {
    id: 'essential',
    name: 'VIBE Essential',
    tierTag: 'BASIQUE',
    price: '9.99\u20AC',
    period: '/ MOIS',
    features: ['Voir qui vous a like', '5 Super Likes par jour', 'Likes illimites', 'Zero publicite'],
    tagClass: 'bg-slate-300 text-black',
    bulletClass: 'bg-slate-400',
    glowToken: '--glow-silver',
    ctaButtonClass: 'bg-gradient-to-r from-slate-400 to-slate-600 text-black',
  },
  {
    id: 'gold',
    name: 'VIBE Gold',
    tierTag: 'POPULAIRE',
    price: '19.99\u20AC',
    period: '/ MOIS',
    features: ['Tout de Essential', 'Passeport (Monde entier)', 'Rewind illimite', '1 Boost gratuit par mois', 'Cacher son age/distance'],
    hasStar: true,
    tagClass: 'bg-amber-400 text-black',
    bulletClass: 'bg-amber-400',
    glowToken: '--glow-gold',
    ctaButtonClass: 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-black',
  },
  {
    id: 'platinum',
    name: 'VIBE Platinum',
    tierTag: 'ELITE',
    price: '34.99\u20AC',
    period: '/ MOIS',
    features: ['Tout de Gold', 'Priorite sur les Likes', 'Message avant le match', 'Voir qui est en ligne', '2 Boosts gratuits par mois'],
    tagClass: 'bg-cyan-400 text-black',
    bulletClass: 'bg-blue-400',
    glowToken: '--glow-blue',
    ctaButtonClass: 'bg-gradient-to-r from-indigo-400 via-blue-500 to-cyan-400 text-white',
  },
];

const instantProducts = [
  { id: 'boost', label: 'Boost visibilite', desc: 'Passe devant plus de profils actifs pendant 30 minutes.', price: '3,99 EUR', meta: 'Impact immediat', glowToken: '--glow-orange' as GlowToken },
  { id: 'premium', label: 'Premium verified', desc: 'Badge verified + conversations sans restriction.', price: '9,99 EUR', meta: 'Mensuel', glowToken: '--glow-pink' as GlowToken },
  { id: 'superlike', label: 'SuperLike tokens', desc: 'Apparition top conversation avec message prioritaire.', price: '4,99 EUR', meta: '5 tokens', glowToken: '--glow-blue' as GlowToken },
  { id: 'rewind', label: 'Rewind tokens', desc: 'Annule un swipe. Inclus premium, vendable separement.', price: '2,99 EUR', meta: '5 tokens', glowToken: '--glow-silver' as GlowToken },
];

const timePacks = [
  { id: 'day', label: 'Pass Jour', desc: 'Mini premium + 1 boost', price: '5,99 EUR', tag: '24h', glowToken: '--glow-silver' as GlowToken },
  { id: 'week', label: 'Pass Semaine', desc: 'Premium temporaire + tokens', price: '14,99 EUR', tag: '7 jours', glowToken: '--glow-gold' as GlowToken },
  { id: 'month', label: 'Pass Mois', desc: 'Premium complet + dotation incluse', price: '29,99 EUR', tag: '30 jours', glowToken: '--glow-blue' as GlowToken },
];

const bundles = [
  { id: 'starter', label: 'Starter', desc: '1 Boost + 5 SuperLikes', price: '7,99 EUR', tag: 'Premier achat', glowToken: '--glow-silver' as GlowToken },
  { id: 'pro', label: 'Dating Pro', desc: '5 Boosts + 20 SuperLikes + 10 Rewinds', price: '24,99 EUR', tag: 'Meilleur rapport', glowToken: '--glow-pink' as GlowToken },
  { id: 'premiumplus', label: 'Premium+', desc: 'Premium mensuel + 4 boosts + tokens mensuels', price: '39,99 EUR', tag: 'Valeur maximale', glowToken: '--glow-cyan' as GlowToken },
];

const BoostScreen = () => {
  const { isDesktop, isTablet, isTouch } = useDevice();
  const isLarge = isDesktop || isTablet;
  const showDesktopRail = isLarge && !isTouch;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const glowTimerRef = useRef<number | null>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollThumb, setScrollThumb] = useState(32);
  const [catalogView, setCatalogView] = useState<CatalogView>('instant');
  const [activeTier, setActiveTier] = useState<TierId>('gold');
  const [glowPulseTier, setGlowPulseTier] = useState<TierId | null>(null);
  const [isBoostActive, setIsBoostActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const selectedTier = tiers.find((tier) => tier.id === activeTier) ?? tiers[1];
  const BOOST_DURATION = 30 * 60;
  const glowShadow = (token: GlowToken, alpha = 0.28, blur = 34) => ({
    boxShadow: `0 0 ${blur}px rgb(var(${token}) / ${alpha})`,
  });
  const glowBg = (token: GlowToken, alpha = 0.2) => ({
    backgroundColor: `rgb(var(${token}) / ${alpha})`,
  });
  const radialTone = (token: GlowToken, alpha = 0.16) => ({
    backgroundImage: `radial-gradient(circle at 86% 0%, rgb(var(${token}) / ${alpha}) 0%, transparent 56%)`,
  });
  const glowCardStyle = (token: GlowToken, shadowAlpha = 0.18, bgAlpha = 0.06, borderAlpha = 0.22) => ({
    ...glowShadow(token, shadowAlpha, 24),
    backgroundColor: `rgb(var(${token}) / ${bgAlpha})`,
    borderColor: `rgb(var(${token}) / ${borderAlpha})`,
  });

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

  useEffect(() => {
    return () => {
      if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
    };
  }, []);

  const timer = useMemo(() => {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, [timeLeft]);

  const activateBoost = () => {
    setIsBoostActive(true);
    setTimeLeft((prev) => (prev > 0 ? prev + BOOST_DURATION : BOOST_DURATION));
  };

  const handleSelectTier = (tierId: TierId) => {
    setActiveTier(tierId);
    setGlowPulseTier(tierId);
    if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
    glowTimerRef.current = window.setTimeout(() => setGlowPulseTier(null), 260);
  };

  const jumpToSection = (index: number) => {
    const node = sectionRefs.current[index];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={scrollRef} className="relative group/boost h-full overflow-y-auto no-scrollbar py-[var(--boost-page-y)]">
      <div className={`${isLarge ? 'screen-template-commerce container-commerce' : 'container-content flex flex-col gap-[var(--boost-mobile-section-gap)]'} px-[var(--page-x)]`}>
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          className="relative overflow-hidden rounded-[var(--card-radius)] border border-orange-400/30 bg-black p-[var(--boost-hero-pad)] md:p-8"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(58,21,16,0.9)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_80%,rgba(242,125,38,0.22)_0%,transparent_50%)]" />
          </div>
          <div className="relative z-10 flex flex-col gap-5 md:gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1">
              <ICONS.Star size={14} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Offres Premium</span>
            </div>
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <h1 className="text-[clamp(2rem,4vw,3.2rem)] italic uppercase font-black tracking-tighter leading-[0.95]">
                  Activez Votre <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">Potentiel</span>
                </h1>
                <p className="mt-3 text-sm md:text-base text-secondary max-w-xl">
                  Ne vendez pas un clic. Activez une fenetre de visibilite premium pour capter plus de likes, de matchs et de conversations.
                </p>
              </div>
              <motion.div whileTap={{ scale: 0.95 }} className="w-full md:w-auto">
                <GlassButton
                  onClick={activateBoost}
                  variant="glass"
                  className={`w-full md:w-auto min-w-[14rem] h-[var(--boost-cta-h)] md:h-[var(--cta-height)] text-sm md:text-base font-black uppercase tracking-[0.18em] transition-[background,box-shadow,color] duration-500 ease-in-out border-0 ${selectedTier.ctaButtonClass}`}
                  style={glowShadow(selectedTier.glowToken, 0.3, 36)}
                >
                  {isBoostActive ? `Boost actif ${timer}` : 'Activer Boost'}
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </motion.section>

        <section
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
          className="space-y-5"
        >
          <motion.div
            className={isLarge ? 'grid grid-cols-3 gap-[var(--grid-gap)]' : 'flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1'}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          >
            {tiers.map((tier) => {
              const isActive = tier.id === activeTier;
              const isPulse = glowPulseTier === tier.id;
              return (
                <motion.button
                  key={tier.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeInOut' } },
                  }}
                  whileTap={{
                    scale: 0.95,
                    borderColor: 'rgba(255,255,255,0.4)',
                    transition: { type: 'spring', stiffness: 560, damping: 24 },
                  }}
                  onClick={() => handleSelectTier(tier.id)}
                  className={`relative ${isLarge ? '' : 'snap-center shrink-0'} w-[var(--boost-tier-card-w)] md:w-full min-h-[var(--boost-tier-card-min-h)] rounded-[var(--boost-tier-card-radius)] p-[var(--boost-tier-pad)] text-left glass-panel-float ${
                    isActive ? 'scale-100 opacity-100 glass-panel glass-panel-active' : 'scale-95 opacity-60 glass-panel-soft'
                  } ${isPulse ? 'border-white/40' : ''}`}
                  style={isActive ? radialTone(tier.glowToken, 0.16) : undefined}
                  
                >
                  {(isActive || isPulse) && (
                    <motion.div
                      className="pointer-events-none absolute -z-10 w-40 h-40 right-[-10px] top-[-10px] rounded-full blur-[60px]"
                      initial={{ scale: 1, opacity: 0.2 }}
                      animate={{ scale: isPulse ? 1.14 : 1, opacity: isPulse ? 0.48 : 0.2 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      style={glowBg(tier.glowToken, isPulse ? 0.48 : 0.2)}
                    />
                  )}
                  <div className="h-full flex flex-col gap-4 rounded-[var(--boost-tier-inner-radius)] p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[length:var(--boost-tier-tag-size)] font-black uppercase tracking-[0.18em] ${tier.tagClass}`}>
                        {tier.tierTag}
                      </span>
                      {tier.hasStar && (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl glass-panel-soft border-amber-300/20">
                          <ICONS.Star size={14} className="text-amber-400" />
                        </span>
                      )}
                    </div>
                    <p className={`font-black italic text-[length:var(--boost-tier-title-size)] leading-none tracking-tighter ${isActive ? 'text-white' : 'text-white/65'}`}>{tier.name}</p>
                    <div className="flex items-end gap-2">
                      <p className={`text-[length:var(--boost-tier-price-size)] leading-none font-black tracking-tighter ${isActive ? 'text-white' : 'text-white/78'}`}>{tier.price}</p>
                      <p className="text-[length:var(--boost-tier-period-size)] font-black uppercase tracking-[0.18em] text-white/45 pb-1">{tier.period}</p>
                    </div>
                    <ul className="mt-1 space-y-2.5">
                      {tier.features.map((feature) => (
                        <li key={feature} className={`flex items-center gap-2.5 text-[length:var(--boost-tier-feature-size)] ${isActive ? 'text-white/86' : 'text-white/52'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tier.bulletClass}`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          <div className="relative pt-2">
            <button
              className="w-full h-[var(--boost-tier-cta-h)] rounded-[24px] border border-white/15 bg-black/65 text-[length:var(--boost-tier-cta-size)] font-black uppercase"
              style={{ letterSpacing: 'var(--boost-tier-cta-track)' }}
            >
              {`S'ABONNER A ${activeTier.toUpperCase()}`}
            </button>
            <div
              className="pointer-events-none absolute left-10 right-10"
              style={{
                height: 'var(--boost-tier-cta-glow-h)',
                bottom: 'var(--boost-tier-cta-glow-offset)',
                filter: 'blur(var(--boost-tier-cta-glow-blur))',
                background: `linear-gradient(90deg, transparent 0%, rgb(var(${selectedTier.glowToken}) / 0.34) 48%, transparent 100%)`,
              }}
            />
            <p className="mt-7 text-center text-[length:var(--boost-tier-disclaimer-size)] font-black uppercase tracking-[0.22em] text-white/35">
              Annulation possible a tout moment • Paiement securise
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-[var(--grid-gap)]">
          <div className="rounded-[var(--glass-card-radius-soft)] glass-panel p-[var(--glass-card-pad)] border-orange-400/30 bg-orange-500/10" style={glowShadow('--glow-orange', 0.22, 28)}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-[0_10px_24px_rgba(234,88,12,0.35)]">
                <ICONS.Boost size={24} className="text-black" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-orange-200">Boosts Flash</p>
                <p className="font-bold">Acceleration immediate</p>
              </div>
            </div>
            <p className="text-sm text-secondary">Un boost place votre profil dans les zones de decouverte les plus actives pour augmenter la traction.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-3xl glass-panel p-4" style={glowShadow('--glow-pink', 0.16, 24)}>
              <ICONS.Heart size={18} className="text-pink-500 mb-2" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black">Matches</p>
              <p className="text-sm text-secondary mt-1">Plus de rencontres qualifiees</p>
            </div>
            <div className="rounded-3xl glass-panel p-4" style={glowShadow('--glow-blue', 0.16, 24)}>
              <ICONS.Shield size={18} className="text-blue-500 mb-2" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black">Securite</p>
              <p className="text-sm text-secondary mt-1">Presence premium verifiee</p>
            </div>
            <div className="rounded-3xl glass-panel p-4" style={glowShadow('--glow-gold', 0.16, 24)}>
              <ICONS.Zap size={18} className="text-amber-500 mb-2" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black">Rythme</p>
              <p className="text-sm text-secondary mt-1">Decisions plus rapides</p>
            </div>
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
                onClick={() => setCatalogView(item.id as CatalogView)}
                className={`h-9 px-4 rounded-full text-xs font-black uppercase tracking-[0.16em] transition-all ${
                  catalogView === item.id ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-[0_10px_24px_rgba(236,72,153,0.28)]' : 'text-secondary hover:bg-white/8'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {catalogView === 'instant' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--grid-gap)]">
              {instantProducts.map((item) => (
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  key={item.id}
                  className="rounded-[var(--glass-card-radius-soft)] glass-panel glass-panel-float p-[var(--glass-card-pad)] transition-colors"
                  style={glowCardStyle(item.glowToken, 0.18, 0.06, 0.24)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-lg">{item.label}</p>
                      <p className="text-sm text-secondary mt-1">{item.desc}</p>
                    </div>
                    <p className="text-xl font-black whitespace-nowrap">{item.price}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black">{item.meta}</span>
                    <button className="h-10 px-5 rounded-[24px] border border-white/20 bg-white/8 text-sm font-black uppercase tracking-[0.2em] hover:bg-white/12">
                      Acheter
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {catalogView === 'passes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--grid-gap)]">
              {timePacks.map((item) => (
                <motion.div whileTap={{ scale: 0.98 }} key={item.id} className="rounded-[var(--glass-card-radius-soft)] glass-panel p-[var(--glass-card-pad)]" style={glowCardStyle(item.glowToken, 0.16, 0.05, 0.2)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-lg">{item.label}</p>
                    <span className="text-[10px] uppercase tracking-[0.18em] rounded-full px-2 py-1 border border-white/15 text-secondary">{item.tag}</span>
                  </div>
                  <p className="text-sm text-secondary mt-2">{item.desc}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-2xl font-black">{item.price}</p>
                    <button className="h-10 px-5 rounded-[24px] bg-gradient-to-r from-pink-500 to-violet-500 text-white text-sm font-black uppercase tracking-[0.18em]">
                      Choisir
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {catalogView === 'bundles' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--grid-gap)]">
              {bundles.map((item) => (
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  key={item.id}
                  className="rounded-[var(--glass-card-radius-soft)] glass-panel p-[var(--glass-card-pad)] grid grid-rows-[auto_1fr_auto] min-h-[19rem]"
                  style={glowCardStyle(item.glowToken, item.id === 'pro' ? 0.24 : 0.16, item.id === 'pro' ? 0.1 : 0.05, item.id === 'pro' ? 0.32 : 0.2)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-xl">{item.label}</p>
                    <span className={`text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full ${item.id === 'pro' ? 'bg-pink-500/20 text-pink-200 border border-pink-300/30' : 'bg-white/5 border border-white/15 text-secondary'}`}>
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-secondary text-sm mt-2">{item.desc}</p>
                  <div className="mt-auto flex flex-col gap-3">
                    <p className="text-[clamp(1.9rem,2vw,2.25rem)] leading-none font-black whitespace-nowrap">{item.price}</p>
                    <button className={`h-10 w-full rounded-[24px] text-sm font-black uppercase tracking-[0.2em] ${item.id === 'pro' ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-[0_10px_24px_rgba(236,72,153,0.28)]' : 'border border-white/20 bg-white/8 hover:bg-white/12'}`}>
                      Prendre ce bundle
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showDesktopRail && (
        <div className="fixed right-0 top-0 bottom-0 w-20 z-30 pointer-events-none">
          <div className="group/boost-rail h-full w-full flex items-center justify-center pointer-events-auto">
            <div className="flex items-center opacity-0 transition-opacity duration-200 group-hover/boost-rail:opacity-100 group-focus-within/boost-rail:opacity-100">
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
