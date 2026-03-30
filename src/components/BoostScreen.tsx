import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';
import { useI18n } from '../i18n/I18nProvider';

type CatalogView = 'instant' | 'passes' | 'bundles';
type TierId = 'essential' | 'gold' | 'platinum';
type GlowToken = '--glow-silver' | '--glow-gold' | '--glow-blue' | '--glow-pink' | '--glow-orange' | '--glow-cyan';

type TierDef = {
  id: TierId;
  nameKey: string;
  tierTagKey: string;
  priceKey: string;
  periodKey: string;
  featureKeys: string[];
  hasStar?: boolean;
  tagClass: string;
  bulletClass: string;
  glowToken: GlowToken;
  ctaButtonClass: string;
};

const tiers: TierDef[] = [
  {
    id: 'essential',
    nameKey: 'boost.tiers.essential.name',
    tierTagKey: 'boost.tiers.essential.tag',
    priceKey: 'boost.tiers.essential.price',
    periodKey: 'boost.tiers.periodMonth',
    featureKeys: ['boost.tiers.essential.features.0', 'boost.tiers.essential.features.1', 'boost.tiers.essential.features.2', 'boost.tiers.essential.features.3'],
    tagClass: 'bg-slate-300 text-black',
    bulletClass: 'bg-slate-400',
    glowToken: '--glow-silver',
    ctaButtonClass: 'bg-gradient-to-r from-slate-400 to-slate-600 text-black',
  },
  {
    id: 'gold',
    nameKey: 'boost.tiers.gold.name',
    tierTagKey: 'boost.tiers.gold.tag',
    priceKey: 'boost.tiers.gold.price',
    periodKey: 'boost.tiers.periodMonth',
    featureKeys: ['boost.tiers.gold.features.0', 'boost.tiers.gold.features.1', 'boost.tiers.gold.features.2', 'boost.tiers.gold.features.3', 'boost.tiers.gold.features.4'],
    hasStar: true,
    tagClass: 'bg-amber-400 text-black',
    bulletClass: 'bg-amber-400',
    glowToken: '--glow-gold',
    ctaButtonClass: 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-black',
  },
  {
    id: 'platinum',
    nameKey: 'boost.tiers.platinum.name',
    tierTagKey: 'boost.tiers.platinum.tag',
    priceKey: 'boost.tiers.platinum.price',
    periodKey: 'boost.tiers.periodMonth',
    featureKeys: ['boost.tiers.platinum.features.0', 'boost.tiers.platinum.features.1', 'boost.tiers.platinum.features.2', 'boost.tiers.platinum.features.3', 'boost.tiers.platinum.features.4'],
    tagClass: 'bg-cyan-400 text-black',
    bulletClass: 'bg-blue-400',
    glowToken: '--glow-blue',
    ctaButtonClass: 'bg-gradient-to-r from-indigo-400 via-blue-500 to-cyan-400 text-white',
  },
];

const instantProducts = [
  {
    id: 'boost',
    labelKey: 'boost.instant.boost.label',
    descKey: 'boost.instant.boost.desc',
    detailKeys: ['boost.instant.boost.details.0', 'boost.instant.boost.details.1'],
    priceKey: 'boost.instant.boost.price',
    metaKey: 'boost.instant.boost.meta',
    glowToken: '--glow-orange' as GlowToken,
  },
  {
    id: 'premium',
    labelKey: 'boost.instant.premium.label',
    descKey: 'boost.instant.premium.desc',
    detailKeys: ['boost.instant.premium.details.0', 'boost.instant.premium.details.1'],
    priceKey: 'boost.instant.premium.price',
    metaKey: 'boost.instant.premium.meta',
    glowToken: '--glow-pink' as GlowToken,
  },
  {
    id: 'superlike',
    labelKey: 'boost.instant.superlike.label',
    descKey: 'boost.instant.superlike.desc',
    detailKeys: ['boost.instant.superlike.details.0', 'boost.instant.superlike.details.1'],
    priceKey: 'boost.instant.superlike.price',
    metaKey: 'boost.instant.superlike.meta',
    glowToken: '--glow-blue' as GlowToken,
  },
  {
    id: 'rewind',
    labelKey: 'boost.instant.rewind.label',
    descKey: 'boost.instant.rewind.desc',
    detailKeys: ['boost.instant.rewind.details.0', 'boost.instant.rewind.details.1'],
    priceKey: 'boost.instant.rewind.price',
    metaKey: 'boost.instant.rewind.meta',
    glowToken: '--glow-silver' as GlowToken,
  },
];

const timePacks = [
  {
    id: 'day',
    labelKey: 'boost.passes.day.label',
    descKey: 'boost.passes.day.desc',
    detailKeys: ['boost.passes.day.details.0', 'boost.passes.day.details.1'],
    priceKey: 'boost.passes.day.price',
    tagKey: 'boost.passes.day.tag',
    glowToken: '--glow-silver' as GlowToken,
  },
  {
    id: 'week',
    labelKey: 'boost.passes.week.label',
    descKey: 'boost.passes.week.desc',
    detailKeys: ['boost.passes.week.details.0', 'boost.passes.week.details.1'],
    priceKey: 'boost.passes.week.price',
    tagKey: 'boost.passes.week.tag',
    glowToken: '--glow-gold' as GlowToken,
  },
  {
    id: 'month',
    labelKey: 'boost.passes.month.label',
    descKey: 'boost.passes.month.desc',
    detailKeys: ['boost.passes.month.details.0', 'boost.passes.month.details.1'],
    priceKey: 'boost.passes.month.price',
    tagKey: 'boost.passes.month.tag',
    glowToken: '--glow-blue' as GlowToken,
  },
];

const bundles = [
  {
    id: 'starter',
    labelKey: 'boost.bundles.starter.label',
    descKey: 'boost.bundles.starter.desc',
    detailKeys: ['boost.bundles.starter.details.0', 'boost.bundles.starter.details.1'],
    priceKey: 'boost.bundles.starter.price',
    tagKey: 'boost.bundles.starter.tag',
    glowToken: '--glow-silver' as GlowToken,
  },
  {
    id: 'pro',
    labelKey: 'boost.bundles.pro.label',
    descKey: 'boost.bundles.pro.desc',
    detailKeys: ['boost.bundles.pro.details.0', 'boost.bundles.pro.details.1'],
    priceKey: 'boost.bundles.pro.price',
    tagKey: 'boost.bundles.pro.tag',
    glowToken: '--glow-pink' as GlowToken,
  },
  {
    id: 'premiumplus',
    labelKey: 'boost.bundles.premiumplus.label',
    descKey: 'boost.bundles.premiumplus.desc',
    detailKeys: ['boost.bundles.premiumplus.details.0', 'boost.bundles.premiumplus.details.1'],
    priceKey: 'boost.bundles.premiumplus.price',
    tagKey: 'boost.bundles.premiumplus.tag',
    glowToken: '--glow-cyan' as GlowToken,
  },
];

const glowRgbMap: Record<GlowToken, [number, number, number]> = {
  '--glow-silver': [148, 163, 184],
  '--glow-gold': [251, 191, 36],
  '--glow-blue': [59, 130, 246],
  '--glow-pink': [236, 72, 153],
  '--glow-orange': [249, 115, 22],
  '--glow-cyan': [34, 211, 238],
};

const glowColor = (token: GlowToken, alpha = 1) => {
  const [r, g, b] = glowRgbMap[token];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const BoostScreen = () => {
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { t } = useI18n();
  const normalizeCurrencySpacing = (value: string) => value.replace(/\s+(?=[₽€$£¥₹₩₺])/gu, '');
  const price = (key: string) => normalizeCurrencySpacing(t(key, { currency: t('boost.currency') }));
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
    boxShadow: `0 0 ${blur}px ${glowColor(token, alpha)}`,
  });
  const glowBg = (token: GlowToken, alpha = 0.2) => ({
    backgroundColor: glowColor(token, alpha),
  });
  const radialTone = (token: GlowToken, alpha = 0.16) => ({
    backgroundImage: `radial-gradient(circle at 86% 0%, ${glowColor(token, alpha)} 0%, transparent 56%)`,
  });
  const glowCardStyle = (token: GlowToken, shadowAlpha = 0.18, bgAlpha = 0.06, borderAlpha = 0.22) => ({
    ...glowShadow(token, shadowAlpha, 24),
    backgroundColor: glowColor(token, bgAlpha),
    borderColor: glowColor(token, borderAlpha),
  });
  const dotPalette: GlowToken[] = ['--glow-pink', '--glow-blue', '--glow-gold', '--glow-cyan', '--glow-orange', '--glow-silver'];
  const dotTokenAt = (seed: number): GlowToken => dotPalette[seed % dotPalette.length];
  const dotStyle = (token: GlowToken) => ({ backgroundColor: glowColor(token, 0.95) });
  const tapGlow = (token: GlowToken, alpha = 0.42, scale = 0.97) => ({
    scale,
    borderColor: glowColor(token, 0.45),
    boxShadow: `0 0 28px ${glowColor(token, alpha)}`,
    transition: { type: 'spring', stiffness: 560, damping: 24 },
  });
  const buyBtnBase =
    'h-10 px-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.26em] transition-all';

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
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">{t('boost.badge')}</span>
            </div>
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <h1 className="text-[clamp(2rem,4vw,3.2rem)] italic uppercase font-black tracking-tighter leading-[0.95]">
                  {t('boost.heroLead')}{' '}
                  <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">{t('boost.heroAccent')}</span>
                </h1>
                <p className="mt-3 text-sm md:text-base text-secondary max-w-xl">
                  {t('boost.heroSubtitle')}
                </p>
              </div>
              <motion.div whileTap={{ scale: 0.95 }} className="w-full md:w-auto">
                <GlassButton
                  onClick={activateBoost}
                  variant="glass"
                  className={`w-full md:w-auto min-w-[14rem] h-[var(--boost-cta-h)] md:h-[var(--cta-height)] text-sm md:text-base font-black uppercase tracking-[0.18em] transition-[background,box-shadow,color] duration-500 ease-in-out border-0 ${selectedTier.ctaButtonClass}`}
                  style={glowShadow(selectedTier.glowToken, 0.3, 36)}
                >
                  {isBoostActive ? t('boost.boostActive', { timer }) : t('boost.activateBoost')}
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
                  whileTap={tapGlow(tier.glowToken, 0.5, 0.95)}
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
                        {t(tier.tierTagKey)}
                      </span>
                      {tier.hasStar && (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl glass-panel-soft border-amber-300/20">
                          <ICONS.Star size={14} className="text-amber-400" />
                        </span>
                      )}
                    </div>
                    <p className={`font-black italic text-[length:var(--boost-tier-title-size)] leading-none tracking-tighter ${isActive ? 'text-white' : 'text-white/65'}`}>{t(tier.nameKey)}</p>
                    <div className="flex items-end gap-1.5">
                      <p className={`font-mono text-[length:var(--boost-tier-price-size)] leading-none font-black tracking-tighter whitespace-nowrap ${isActive ? 'text-white' : 'text-white/78'}`}>{price(tier.priceKey)}</p>
                      <p className="text-[length:var(--boost-tier-period-size)] font-black uppercase tracking-[0.18em] text-white/45 whitespace-nowrap leading-none shrink-0 self-end pb-[0.15em]">
                        {t(tier.periodKey)}
                      </p>
                    </div>
                    <ul className="mt-1 space-y-2.5">
                      {tier.featureKeys.map((featureKey) => (
                        <li key={featureKey} className={`flex items-center gap-2.5 text-[length:var(--boost-tier-feature-size)] ${isActive ? 'text-white/86' : 'text-white/52'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tier.bulletClass}`} />
                          <span>{t(featureKey)}</span>
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
              {`${t('boost.subscribePrefix')}${t(`boost.tiers.${activeTier}.ctaName`)}`}
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
              {t('boost.secureHint')}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-[var(--grid-gap)]">
          <motion.div
            whileTap={tapGlow('--glow-orange', 0.42)}
            whileHover={{ ...glowShadow('--glow-orange', 0.32, 34), scale: 1.01 }}
            className="rounded-[var(--glass-card-radius-soft)] glass-panel glass-panel-float p-[var(--glass-card-pad)] border-orange-400/30 bg-orange-500/10"
            style={glowShadow('--glow-orange', 0.22, 28)}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-[0_10px_24px_rgba(234,88,12,0.35)]">
                <ICONS.Boost size={24} className="text-black" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-orange-200">{t('boost.flash.title')}</p>
                <p className="font-bold">{t('boost.flash.subtitle')}</p>
              </div>
            </div>
            <p className="text-sm text-secondary">{t('boost.flash.body')}</p>
            <ul className="mt-3 space-y-2">
              {['boost.flash.points.0', 'boost.flash.points.1'].map((lineKey, idx) => (
                <li key={lineKey} className="flex items-center gap-2 text-sm text-white/78">
                  <span className="w-1.5 h-1.5 rounded-full" style={dotStyle(dotTokenAt(idx + 1))} />
                  <span>{t(lineKey)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <motion.div whileTap={tapGlow('--glow-pink', 0.38)} whileHover={{ ...glowShadow('--glow-pink', 0.3, 30), scale: 1.01 }} className="rounded-3xl glass-panel glass-panel-float p-4" style={glowShadow('--glow-pink', 0.16, 24)}>
              <ICONS.Heart size={18} className="text-pink-500 mb-2" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black">{t('boost.metrics.matches.title')}</p>
              <p className="text-sm text-secondary mt-1">{t('boost.metrics.matches.desc')}</p>
            </motion.div>
            <motion.div whileTap={tapGlow('--glow-blue', 0.38)} whileHover={{ ...glowShadow('--glow-blue', 0.3, 30), scale: 1.01 }} className="rounded-3xl glass-panel glass-panel-float p-4" style={glowShadow('--glow-blue', 0.16, 24)}>
              <ICONS.Shield size={18} className="text-blue-500 mb-2" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black">{t('boost.metrics.security.title')}</p>
              <p className="text-sm text-secondary mt-1">{t('boost.metrics.security.desc')}</p>
            </motion.div>
            <motion.div whileTap={tapGlow('--glow-gold', 0.38)} whileHover={{ ...glowShadow('--glow-gold', 0.3, 30), scale: 1.01 }} className="rounded-3xl glass-panel glass-panel-float p-4" style={glowShadow('--glow-gold', 0.16, 24)}>
              <ICONS.Zap size={18} className="text-amber-500 mb-2" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black">{t('boost.metrics.rhythm.title')}</p>
              <p className="text-sm text-secondary mt-1">{t('boost.metrics.rhythm.desc')}</p>
            </motion.div>
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
              { id: 'instant', label: t('boost.catalog.instant') },
              { id: 'passes', label: t('boost.catalog.passes') },
              { id: 'bundles', label: t('boost.catalog.bundles') },
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
                  whileTap={tapGlow(item.glowToken, 0.42)}
                  whileHover={{ ...glowShadow(item.glowToken, 0.34, 34), scale: 1.01 }}
                  key={item.id}
                  className="rounded-[var(--glass-card-radius-soft)] glass-panel glass-panel-float p-[var(--glass-card-pad)] transition-colors"
                  style={glowCardStyle(item.glowToken, 0.18, 0.06, 0.24)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-lg">{t(item.labelKey)}</p>
                      <p className="text-sm text-secondary mt-1">{t(item.descKey)}</p>
                      <ul className="mt-2 space-y-1.5">
                        {item.detailKeys.map((detailKey, detailIdx) => (
                          <li key={detailKey} className="flex items-center gap-2 text-[0.86rem] text-white/76">
                            <span className="w-1.5 h-1.5 rounded-full" style={dotStyle(dotTokenAt(detailIdx + 2))} />
                            <span>{t(detailKey)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="font-mono text-xl font-black whitespace-nowrap">{price(item.priceKey)}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-black">{t(item.metaKey)}</span>
                    <button className={`${buyBtnBase} border border-white/20 bg-white/8 hover:bg-white/12`}>
                      {t('boost.buy.buy')}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {catalogView === 'passes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--grid-gap)]">
              {timePacks.map((item) => (
                <motion.div whileTap={tapGlow(item.glowToken, 0.4)} whileHover={{ ...glowShadow(item.glowToken, 0.32, 32), scale: 1.01 }} key={item.id} className="rounded-[var(--glass-card-radius-soft)] glass-panel glass-panel-float p-[var(--glass-card-pad)]" style={glowCardStyle(item.glowToken, 0.16, 0.05, 0.2)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-lg">{t(item.labelKey)}</p>
                    <span className="text-[10px] uppercase tracking-[0.18em] rounded-full px-2 py-1 border border-white/15 text-secondary">{t(item.tagKey)}</span>
                  </div>
                  <p className="text-sm text-secondary mt-2">{t(item.descKey)}</p>
                  <ul className="mt-2 space-y-1.5">
                    {item.detailKeys.map((detailKey, detailIdx) => (
                      <li key={detailKey} className="flex items-center gap-2 text-[0.86rem] text-white/76">
                        <span className="w-1.5 h-1.5 rounded-full" style={dotStyle(dotTokenAt(detailIdx + 3))} />
                        <span>{t(detailKey)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="font-mono text-2xl font-black whitespace-nowrap">{price(item.priceKey)}</p>
                    <button className={`${buyBtnBase} bg-gradient-to-r from-pink-500 to-violet-500 text-white`}>
                      {t('boost.buy.choose')}
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
                  whileTap={tapGlow(item.glowToken, item.id === 'pro' ? 0.48 : 0.4)}
                  whileHover={{ ...glowShadow(item.glowToken, item.id === 'pro' ? 0.38 : 0.3, 34), scale: 1.01 }}
                  key={item.id}
                  className="rounded-[var(--glass-card-radius-soft)] glass-panel glass-panel-float p-[var(--glass-card-pad)] grid grid-rows-[auto_1fr_auto] min-h-[19rem]"
                  style={glowCardStyle(item.glowToken, item.id === 'pro' ? 0.24 : 0.16, item.id === 'pro' ? 0.1 : 0.05, item.id === 'pro' ? 0.32 : 0.2)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-xl">{t(item.labelKey)}</p>
                    <span className={`text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full ${item.id === 'pro' ? 'bg-pink-500/20 text-pink-200 border border-pink-300/30' : 'bg-white/5 border border-white/15 text-secondary'}`}>
                      {t(item.tagKey)}
                    </span>
                  </div>
                  <div className="text-secondary text-sm mt-2">
                    <p>{t(item.descKey)}</p>
                    <ul className="mt-2 space-y-1.5">
                      {item.detailKeys.map((detailKey, detailIdx) => (
                        <li key={detailKey} className="flex items-center gap-2 text-[0.86rem] text-white/76">
                          <span className="w-1.5 h-1.5 rounded-full" style={dotStyle(dotTokenAt(detailIdx + 4))} />
                          <span>{t(detailKey)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-auto flex flex-col gap-3">
                    <p className="font-mono text-[clamp(1.9rem,2vw,2.25rem)] leading-none font-black whitespace-nowrap">{price(item.priceKey)}</p>
                    <button className={`${buyBtnBase} w-full ${item.id === 'pro' ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-[0_10px_24px_rgba(236,72,153,0.28)]' : 'border border-white/20 bg-white/8 hover:bg-white/12'}`}>
                      {t('boost.buy.bundle')}
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
                    aria-label={t('boost.jumpSection', { index: index + 1 })}
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
