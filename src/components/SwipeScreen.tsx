import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';
import NameWithBadge from './ui/NameWithBadge';
import { useI18n } from '../i18n/I18nProvider';
import Logo from './ui/Logo';
import { appApi } from '../services';
import { useRuntimeSelector } from '../state';
import type { FeedCandidate, FeedQuickFilter, PlanTier, SwipeDecision } from '../contracts';

const resolveDisplayPremiumTier = (tier: PlanTier, shortPassTier?: 'day' | 'week'): PlanTier => {
  if (tier !== 'free') return tier;
  return shortPassTier ? 'essential' : 'free';
};

const formatBoostTimer = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
};

const SwipeScreen = () => {
  const navigate = useNavigate();
  const { isDesktop, isTablet } = useDevice();
  const { t } = useI18n();
  const isLarge = isDesktop || isTablet;
  const balances = useRuntimeSelector((payload) => payload.balances);
  const boostActiveUntilIso = useRuntimeSelector((payload) => payload.boost.activeUntilIso);
  const likedCount = useRuntimeSelector((payload) => payload.likedProfileIds.length);
  const matchCount = useRuntimeSelector((payload) => payload.conversations.length);
  const selfPreviewPhoto = useRuntimeSelector(
    (payload) => payload.feedSource[0]?.photos?.[1] ?? payload.feedSource[0]?.photos?.[0] ?? '',
  );
  const [boostTick, setBoostTick] = useState(() => Date.now());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [feedStatus, setFeedStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [feedCandidates, setFeedCandidates] = useState<FeedCandidate[]>([]);
  const [isSwipePending, setIsSwipePending] = useState(false);
  const quickFilters = [
    { id: 'all', labelKey: 'discover.quickFilters.all' },
    { id: 'nearby', labelKey: 'discover.quickFilters.nearby' },
    { id: 'new', labelKey: 'discover.quickFilters.new' },
    { id: 'online', labelKey: 'discover.quickFilters.online' },
    { id: 'verified', labelKey: 'discover.quickFilters.verified' },
  ] as const;
  const [activeFilterIds, setActiveFilterIds] = useState<FeedQuickFilter[]>(['all']);

  const filteredUsers = useMemo(() => {
    return feedCandidates.map((candidate) => ({
      ...candidate,
      verified: candidate.flags.verifiedIdentity,
      premiumTier: resolveDisplayPremiumTier(candidate.flags.premiumTier, candidate.flags.shortPassTier),
      ageMasked: candidate.age <= 0,
      distanceMasked: candidate.distanceKm < 0,
      distanceLabel:
        candidate.distanceKm < 0
          ? t('discover.hiddenDistance')
          : t('discover.distanceKm', { value: candidate.distanceKm }),
    }));
  }, [feedCandidates, t]);

  useEffect(() => {
    let isCancelled = false;
    setFeedStatus('loading');
    appApi
      .getFeed(activeFilterIds)
      .then((response) => {
        if (isCancelled) return;
        setFeedCandidates(response.window.candidates);
        setFeedStatus('success');
      })
      .catch(() => {
        if (isCancelled) return;
        setFeedCandidates([]);
        setFeedStatus('error');
      });

    return () => {
      isCancelled = true;
    };
  }, [activeFilterIds]);

  useEffect(() => {
    setCurrentIndex(0);
    setPhotoIndex(0);
  }, [activeFilterIds, feedCandidates.length]);

  useEffect(() => {
    if (!isFiltering) return;
    const timer = window.setTimeout(() => setIsFiltering(false), 220);
    return () => window.clearTimeout(timer);
  }, [isFiltering]);

  useEffect(() => {
    if (!boostActiveUntilIso) return;
    const activeUntilMs = new Date(boostActiveUntilIso).getTime();
    if (activeUntilMs <= Date.now()) return;
    setBoostTick(Date.now());
    const interval = window.setInterval(() => {
      const now = Date.now();
      setBoostTick(now);
      if (now >= activeUntilMs) {
        window.clearInterval(interval);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [boostActiveUntilIso]);

  const hasUsers = filteredUsers.length > 0;
  const user = hasUsers ? filteredUsers[currentIndex % filteredUsers.length] : null;
  const nextUser = hasUsers ? filteredUsers[(currentIndex + 1) % filteredUsers.length] : null;
  const boostRemainingSeconds = useMemo(() => {
    if (!boostActiveUntilIso) return 0;
    return Math.max(0, Math.ceil((new Date(boostActiveUntilIso).getTime() - boostTick) / 1000));
  }, [boostActiveUntilIso, boostTick]);
  const boostState = boostRemainingSeconds > 0 ? 'active' : balances.boostsLeft > 0 ? 'available' : 'out_of_tokens';
  const boostFullLabel =
    boostState === 'active'
      ? t('discover.boostActive', { timer: formatBoostTimer(boostRemainingSeconds) })
      : boostState === 'available'
        ? t('discover.boostReady', { count: balances.boostsLeft })
        : t('discover.boost');
  const boostCompactLabel =
    boostState === 'active'
      ? formatBoostTimer(boostRemainingSeconds)
      : boostState === 'available'
        ? `x${balances.boostsLeft}`
        : t('discover.boost');

  useEffect(() => {
    if (!user) return;
    appApi.markProfileImpression(user.id);
  }, [user?.id]);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0.8, 1, 1, 1, 0.8]);

  const likeOpacity = useTransform(x, [40, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-40, -120], [0, 1]);
  const superLikeOpacity = useTransform(y, [-40, -120], [0, 1]);
  const likeScale = useTransform(x, [0, 150], [0.5, 1.2]);
  const nopeScale = useTransform(x, [0, -150], [0.5, 1.2]);
  const superLikeScale = useTransform(y, [0, -150], [0.5, 1.2]);

  const handleDragEnd = (_: any, info: any) => {
    const threshold = 80;
    if (info.offset.x > threshold) {
      swipe('right');
    } else if (info.offset.x < -threshold) {
      swipe('left');
    } else if (info.offset.y < -threshold) {
      swipe('up');
    }
  };

  const swipe = (dir: 'left' | 'right' | 'up') => {
    if (!hasUsers || !user || isSwipePending) return;
    setIsSwipePending(true);
    const decision: SwipeDecision =
      dir === 'left' ? 'dislike' : dir === 'right' ? 'like' : 'superlike';

    window.setTimeout(() => {
      void appApi
        .swipe(user.id, decision)
        .then((response) => {
          if (response.matched) setShowMatch(true);
        })
        .finally(() => {
          setCurrentIndex((prev) => prev + 1);
          setPhotoIndex(0);
          x.set(0);
          y.set(0);
          setIsSwipePending(false);
        });
    }, 100);
  };

  const rewindLastSwipe = () => {
    void appApi.rewind().then((response) => {
      if (!response.restoredProfileId) return;
      setCurrentIndex((prev) => Math.max(0, prev - 1));
      setPhotoIndex(0);
      x.set(0);
      y.set(0);
    });
  };

  const handlePhotoNav = (e: React.MouseEvent) => {
    if (!user) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 3) {
      if (photoIndex > 0) setPhotoIndex((prev) => prev - 1);
    } else if (clickX > (rect.width * 2) / 3) {
      if (photoIndex < user.photos.length - 1) setPhotoIndex((prev) => prev + 1);
    }
  };

  const toggleFilter = (id: FeedQuickFilter) => {
    setIsFiltering(true);
    setActiveFilterIds((prev) => {
      if (id === 'all') return ['all'];
      const withoutAll = prev.filter((entry) => entry !== 'all');
      const next = withoutAll.includes(id)
        ? withoutAll.filter((entry) => entry !== id)
        : [...withoutAll, id];
      return next.length === 0 ? ['all'] : next;
    });
  };

  const handleBoostTap = () => {
    if (boostState === 'active') return;
    if (boostState === 'available') {
      void appApi.activateBoost().then((response) => {
        if (response.status === 'no_tokens') {
          navigate('/boost');
        }
      });
      return;
    }
    navigate('/boost');
  };

  const actionButtons = (
    <>
      <motion.button
        whileTap={{ scale: 0.85 }}
        disabled={!user || isSwipePending}
        onClick={(e) => {
          e.stopPropagation();
          swipe('left');
        }}
        className={`${isLarge ? 'w-[var(--discover-action-size)] h-[var(--discover-action-size)] rounded-full' : 'w-[var(--discover-action-mobile-w)] h-[var(--discover-action-mobile-h)] rounded-[var(--discover-action-mobile-radius)]'} flex items-center justify-center text-red-500 border-2 border-red-500/20 bg-black/50 backdrop-blur-xl shadow-[0_10px_25px_rgba(239,68,68,0.15)] hover:bg-red-500/10 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ICONS.X size={isLarge ? 26 : 22} />
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.9, rotate: 12 }}
        disabled={!user || isSwipePending}
        animate={{ boxShadow: ['0 0 18px rgba(255, 20, 147, 0.2)', '0 0 34px rgba(255, 20, 147, 0.35)', '0 0 18px rgba(255, 20, 147, 0.2)'] }}
        transition={{ boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
        onClick={(e) => {
          e.stopPropagation();
          swipe('up');
        }}
        className={`${isLarge ? 'w-[var(--discover-action-main-size)] h-[var(--discover-action-main-size)] rounded-full' : 'w-[var(--discover-action-mobile-main-w)] h-[var(--discover-action-mobile-main-h)] rounded-[var(--discover-action-mobile-main-radius)]'} flex items-center justify-center text-white gradient-premium opacity-90 shadow-[0_15px_35px_rgba(255,20,147,0.3)] transition-all duration-300 relative overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ICONS.Star size={isLarge ? 20 : 18} fill="currentColor" className="relative z-10" />
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.9 }}
        disabled={!user || isSwipePending}
        onClick={(e) => {
          e.stopPropagation();
          swipe('right');
        }}
        className={`${isLarge ? 'w-[var(--discover-action-size)] h-[var(--discover-action-size)] rounded-full' : 'w-[var(--discover-action-mobile-w)] h-[var(--discover-action-mobile-h)] rounded-[var(--discover-action-mobile-radius)]'} flex items-center justify-center text-blue-400 border-2 border-blue-400/20 bg-black/50 backdrop-blur-xl shadow-[0_10px_25px_rgba(59,130,246,0.15)] hover:bg-blue-400/10 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ICONS.Likes size={isLarge ? 26 : 22} fill="currentColor" />
      </motion.button>
    </>
  );

  const emptyDeck = (
    <div className="h-full w-full rounded-[36px] border border-white/10 bg-white/[0.03] backdrop-blur-xl flex flex-col items-center justify-center text-center px-6">
      <ICONS.Discover size={28} className="text-white/40 mb-4" />
      <p className="text-white text-lg font-black tracking-tight">{t('discover.emptyTitle')}</p>
      <p className="text-white/50 text-sm mt-2 max-w-[24ch]">{t('discover.emptySubtitle')}</p>
      <button
        onClick={() => setActiveFilterIds(['all'])}
        className="mt-5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.18em] border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
      >
        {t('discover.resetFilters')}
      </button>
    </div>
  );

  const loadingDeck = (
    <div className="h-full w-full rounded-[36px] border border-white/10 bg-white/[0.03] backdrop-blur-xl flex flex-col items-center justify-center text-center px-6">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin mb-4" />
      <p className="text-white text-lg font-black tracking-tight">{t('discover.loadingTitle')}</p>
      <p className="text-white/50 text-sm mt-2 max-w-[24ch]">{t('discover.loadingSubtitle')}</p>
    </div>
  );

  const errorDeck = (
    <div className="h-full w-full rounded-[36px] border border-red-400/30 bg-red-500/5 backdrop-blur-xl flex flex-col items-center justify-center text-center px-6">
      <ICONS.Info size={24} className="text-red-300 mb-4" />
      <p className="text-white text-lg font-black tracking-tight">{t('discover.errorTitle')}</p>
      <p className="text-white/60 text-sm mt-2 max-w-[24ch]">{t('discover.errorSubtitle')}</p>
      <button
        onClick={() => setActiveFilterIds((prev) => [...prev])}
        className="mt-5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.18em] border border-red-300/35 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition-colors"
      >
        {t('discover.retry')}
      </button>
    </div>
  );

  return (
    <div className={`h-full flex flex-col bg-[#050505] relative font-sans ${isLarge ? 'overflow-y-auto no-scrollbar pb-safe' : 'overflow-y-auto no-scrollbar'}`}>
      <div className="flex items-end justify-between px-[var(--page-x)] pt-[var(--discover-header-top)] md:pt-7 lg:pt-8 pb-3 shrink-0 z-20">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">{t('discover.eyebrow')}</p>
          <Logo size={30} showText />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            onClick={rewindLastSwipe}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 active:scale-95 transition-all group shrink-0"
          >
            <ICONS.Rewind size={13} className="text-cyan-300" />
            <span className="hidden min-[390px]:inline text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
              {balances.rewindsLeft}
            </span>
            <span className="inline min-[390px]:hidden text-[10px] font-black uppercase tracking-[0.06em] text-cyan-200">
              R{balances.rewindsLeft}
            </span>
          </button>
          <motion.button
            onClick={handleBoostTap}
            animate={
              boostState === 'active'
                ? {
                    scale: [1, 1.03, 1],
                    boxShadow: [
                      '0 0 10px rgba(249,115,22,0.22)',
                      '0 0 22px rgba(249,115,22,0.4)',
                      '0 0 10px rgba(249,115,22,0.22)',
                    ],
                  }
                : undefined
            }
            transition={
              boostState === 'active' ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : undefined
            }
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 min-[390px]:px-3 sm:px-4 py-2 rounded-full border active:scale-95 transition-all group min-w-0 max-w-[9.75rem] min-[390px]:max-w-[12rem] ${
              boostState === 'active'
                ? 'border-orange-300/70 bg-orange-500/20'
                : boostState === 'available'
                  ? 'border-orange-300/70 bg-orange-500 text-black shadow-[0_0_18px_rgba(249,115,22,0.28)]'
                  : 'border-orange-500/30 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
            }`}
          >
            <ICONS.Boost
              size={14}
              className={`${
                boostState === 'available'
                  ? 'text-black'
                  : boostState === 'active'
                    ? 'text-orange-100'
                    : 'text-orange-400'
              }`}
            />
            <span
              className={`hidden min-[390px]:inline truncate text-[10px] font-black uppercase tracking-[0.12em] ${
                boostState === 'available'
                  ? 'text-black'
                  : boostState === 'active'
                    ? 'text-orange-100'
                    : 'text-orange-400/90'
              }`}
            >
              {boostFullLabel}
            </span>
            <span
              className={`inline min-[390px]:hidden truncate text-[10px] font-black uppercase tracking-[0.08em] ${
                boostState === 'available'
                  ? 'text-black'
                  : boostState === 'active'
                    ? 'text-orange-100'
                    : 'text-orange-400/90'
              }`}
            >
              {boostCompactLabel}
            </span>
          </motion.button>
        </div>
      </div>

      <div className="px-[var(--page-x)] pb-2 shrink-0">
        <div className="pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="px-2.5 py-1 rounded-full border border-pink-400/30 bg-pink-500/10 text-[9px] font-black uppercase tracking-[0.14em] text-pink-200">
            S {balances.superlikesLeft}
          </span>
          <span className="px-2.5 py-1 rounded-full border border-orange-400/30 bg-orange-500/10 text-[9px] font-black uppercase tracking-[0.14em] text-orange-200">
            B {balances.boostsLeft}
          </span>
          <span className="px-2.5 py-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200">
            R {balances.rewindsLeft}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {quickFilters.map((filter) => (
            <button
              key={`filter-${filter.id}`}
              onClick={() => toggleFilter(filter.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.14em] whitespace-nowrap transition-all ${
                activeFilterIds.includes(filter.id)
                  ? 'bg-white text-[#090909] border border-white shadow-[0_8px_24px_rgba(255,255,255,0.16)]'
                  : 'bg-[#0E1116]/90 border border-white/10 text-white/68 hover:text-white hover:border-white/25'
              }`}
            >
              {t(filter.labelKey)}
            </button>
          ))}
        </div>
        {!isLarge && (
          <div className="pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35 shrink-0">
              {t('discover.activeFilters')}
            </span>
            <div className="flex gap-1.5">
              {activeFilterIds.length > 0 ? (
                activeFilterIds.map((id) => (
                  <span
                    key={`mobile-active-${id}`}
                    className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.14em] bg-white/10 border border-white/15 text-white/80 shrink-0"
                  >
                    {t(`discover.quickFilters.${id}`)}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-white/45">{t('discover.noActiveFilters')}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {isLarge ? (
        <div className={`flex-1 min-h-0 px-[var(--page-x)] pt-2 ${isDesktop ? 'pb-2' : 'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1.25rem)]'}`}>
          <div className="container-immersive screen-template-immersive density-immersive h-full">
          <div
            className="h-full grid gap-[var(--grid-gap)] items-start"
            style={{ gridTemplateColumns: `${isDesktop ? 'var(--panel-width-md)' : 'var(--panel-width-sm)'} minmax(0, 1fr)` }}
          >
            <aside className={`rounded-[28px] border border-[var(--menu-premium-border)] bg-[var(--filters-stack-bg)] backdrop-blur-2xl ${isTablet ? 'p-4 space-y-4' : 'p-5 space-y-5'} h-fit`}>
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/settings/preferences')}
                  aria-label="Ouvrir les reglages de decouverte"
                  className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <ICONS.Settings size={18} className="text-white/80" />
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black">{t('discover.activeFilters')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeFilterIds.map((id) => (
                    <span
                      key={`active-${id}`}
                      className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.14em] bg-white/10 border border-white/15 text-white/80"
                    >
                      {t(`discover.quickFilters.${id}`)}
                    </span>
                  ))}
                  {activeFilterIds.length === 0 && (
                    <span className="text-[11px] text-white/45">{t('discover.noActiveFilters')}</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black">{t('discover.activity')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-2xl bg-white/5 border border-white/10 ${isTablet ? 'p-2.5' : 'p-3'}`}>
                    <p className={`${isTablet ? 'text-base' : 'text-lg'} font-black`}>{likedCount}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/45">{t('discover.likesRecent')}</p>
                  </div>
                  <div className={`rounded-2xl bg-white/5 border border-white/10 ${isTablet ? 'p-2.5' : 'p-3'}`}>
                    <p className={`${isTablet ? 'text-base' : 'text-lg'} font-black`}>{matchCount}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/45">{t('discover.matches')}</p>
                  </div>
                </div>
              </div>
            </aside>

            <div className="w-full flex flex-col items-center density-comfortable min-h-0">
            <div className={`container-deck relative w-full ${isDesktop ? 'h-[min(68vh,40rem)]' : 'h-[min(62vh,35rem)]'}`}>
          {feedStatus === 'loading' || isFiltering ? (
            loadingDeck
          ) : feedStatus === 'error' ? (
            errorDeck
          ) : user ? (
            <AnimatePresence>
              {nextUser && (
                <motion.div
                  key={`next-${nextUser.id}`}
                  className="absolute inset-0 rounded-[36px] overflow-hidden bg-zinc-900"
                  style={{ scale: 0.96, y: 8, opacity: 0.4, zIndex: 0 }}
                >
                  <img src={nextUser.photos[0]} className="w-full h-full object-cover object-[center_22%] grayscale-[0.3]" alt="next" referrerPolicy="no-referrer" />
                </motion.div>
              )}

            <motion.div
              key={user.id}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotate, opacity, zIndex: 10 }}
              className="absolute inset-0 rounded-[36px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing border border-white/5 bg-zinc-900"
              onClick={handlePhotoNav}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={photoIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  src={user.photos[photoIndex]}
                  className="w-full h-full object-cover object-[center_22%] pointer-events-none"
                  alt={user.name}
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              <motion.div style={{ opacity: likeOpacity, scale: likeScale }} className="absolute top-20 left-10 w-16 h-16 rounded-full rotate-[-12deg] pointer-events-none z-30 flex items-center justify-center border-2 border-blue-400/70 shadow-[0_0_20px_rgba(59,130,246,0.35)]">
                <ICONS.Likes size={26} fill="currentColor" className="text-blue-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.7)]" />
              </motion.div>
              <motion.div style={{ opacity: nopeOpacity, scale: nopeScale }} className="absolute top-20 right-10 w-16 h-16 rounded-full rotate-[12deg] pointer-events-none z-30 flex items-center justify-center border-2 border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.35)]">
                <ICONS.X size={28} className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.7)]" />
              </motion.div>
              <motion.div style={{ opacity: superLikeOpacity, scale: superLikeScale }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full pointer-events-none z-30 flex items-center justify-center border-2 border-fuchsia-300/80 shadow-[0_0_22px_rgba(217,70,239,0.4)]">
                <ICONS.Star size={24} fill="currentColor" className="text-white drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
              </motion.div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/5 pointer-events-none" />

              <div className="absolute top-4 left-6 right-6 flex gap-1.5 z-20">
                {user.photos.map((_, i) => (
                  <div key={i} className="h-[2px] flex-1 rounded-full bg-white/20 overflow-hidden">
                    <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: i === photoIndex ? '100%' : i < photoIndex ? '100%' : '0%' }} transition={{ duration: 0.3 }} />
                  </div>
                ))}
              </div>

              <div className={`absolute bottom-0 left-0 right-0 p-6 pt-24 ${isDesktop ? 'pb-24' : 'pb-20'} bg-gradient-to-t from-black/80 via-black/45 to-transparent pointer-events-none`}>
                <div className="flex items-end justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className={`inline-flex gap-2 ${isLarge ? 'items-center' : 'items-start'}`}>
                      <NameWithBadge
                        name={user.name}
                        age={user.age}
                        ageMasked={user.ageMasked}
                        verified={user.verified}
                        premiumTier={user.premiumTier}
                        size={isDesktop ? 'xl' : 'lg'}
                        textClassName={isLarge ? '' : 'max-w-[75%]'}
                        badgeClassName={isLarge ? '' : 'mt-0.5'}
                      />
                    </div>

                    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-white/60 font-bold uppercase tracking-wider ${isTablet ? 'text-[10px]' : 'text-[11px]'}`}>
                      <div className="flex items-center gap-1.5">
                        <ICONS.MapPin size={12} className="text-pink-500" />
                        {user.distanceLabel}
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1.5">
                        <ICONS.Languages size={12} className="text-blue-400" />
                        {user.languages[0]}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {user.interests.slice(0, 2).map((interest) => (
                        <span key={interest} className="px-2.5 py-1 rounded-full bg-white/10 border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/80">
                          {interest}
                        </span>
                      ))}
                      {user.interests.length > 2 && <span className="px-2 py-1 rounded-full bg-white/5 text-[9px] font-black text-white/30">+{user.interests.length - 2}</span>}
                    </div>
                  </div>
                  <div className="relative w-[var(--discover-compat-size)] h-[var(--discover-compat-size)] flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
                      <motion.circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray="175.9"
                        initial={{ strokeDashoffset: 175.9 }}
                        animate={{ strokeDashoffset: 175.9 - (175.9 * user.compatibility) / 100 }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                        className="text-pink-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[length:var(--discover-compat-value-size)] font-black text-white leading-none">{user.compatibility}%</span>
                      <span className="text-[length:var(--discover-compat-label-size)] font-bold uppercase tracking-widest text-white/40">{t('discover.match')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-[var(--discover-action-gap)] z-40 pointer-events-auto">
                {actionButtons}
              </div>
            </motion.div>
            </AnimatePresence>
          ) : (
            emptyDeck
          )}
            </div>

            </div>
          </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-[var(--page-x)] pt-2 pb-1 flex flex-col items-center gap-2 overflow-y-auto no-scrollbar">
          <div className={`relative w-full max-w-[26rem] sm:max-w-[28rem] h-[var(--discover-card-h)] ${isLarge ? 'md:max-w-[32rem] lg:max-w-[34rem] xl:max-w-[36rem]' : ''}`}>
          {feedStatus === 'loading' || isFiltering ? (
            loadingDeck
          ) : feedStatus === 'error' ? (
            errorDeck
          ) : user ? (
            <AnimatePresence>
              {nextUser && (
                <motion.div
                  key={`next-${nextUser.id}`}
                  className="absolute inset-0 rounded-[36px] overflow-hidden bg-zinc-900"
                  style={{ scale: 0.96, y: 8, opacity: 0.4, zIndex: 0 }}
                >
                  <img src={nextUser.photos[0]} className="w-full h-full object-cover object-[center_22%] grayscale-[0.3]" alt="next" referrerPolicy="no-referrer" />
                </motion.div>
              )}

            <motion.div
              key={user.id}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotate, opacity, zIndex: 10 }}
              className="absolute inset-0 rounded-[36px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing border border-white/5 bg-zinc-900"
              onClick={handlePhotoNav}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={photoIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  src={user.photos[photoIndex]}
                  className="w-full h-full object-cover object-[center_22%] pointer-events-none"
                  alt={user.name}
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              <motion.div style={{ opacity: likeOpacity, scale: likeScale }} className="absolute top-20 left-10 w-14 h-14 rounded-full rotate-[-12deg] pointer-events-none z-30 flex items-center justify-center border-2 border-blue-400/70 shadow-[0_0_18px_rgba(59,130,246,0.35)]">
                <ICONS.Likes size={22} fill="currentColor" className="text-blue-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.7)]" />
              </motion.div>
              <motion.div style={{ opacity: nopeOpacity, scale: nopeScale }} className="absolute top-20 right-10 w-14 h-14 rounded-full rotate-[12deg] pointer-events-none z-30 flex items-center justify-center border-2 border-red-500/70 shadow-[0_0_18px_rgba(239,68,68,0.35)]">
                <ICONS.X size={22} className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.7)]" />
              </motion.div>
              <motion.div style={{ opacity: superLikeOpacity, scale: superLikeScale }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full pointer-events-none z-30 flex items-center justify-center border-2 border-fuchsia-300/80 shadow-[0_0_20px_rgba(217,70,239,0.4)]">
                <ICONS.Star size={20} fill="currentColor" className="text-white drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
              </motion.div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/5 pointer-events-none" />

              <div className="absolute top-4 left-6 right-6 flex gap-1.5 z-20">
                {user.photos.map((_, i) => (
                  <div key={i} className="h-[2px] flex-1 rounded-full bg-white/20 overflow-hidden">
                    <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: i === photoIndex ? '100%' : i < photoIndex ? '100%' : '0%' }} transition={{ duration: 0.3 }} />
                  </div>
                ))}
              </div>

               <div className="absolute bottom-0 left-0 right-0 p-[var(--discover-overlay-pad)] pt-[var(--discover-overlay-top)] pb-16 bg-gradient-to-t from-black/80 via-black/45 to-transparent pointer-events-none">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <NameWithBadge
                      name={user.name}
                      age={user.age}
                      ageMasked={user.ageMasked}
                      verified={user.verified}
                      premiumTier={user.premiumTier}
                      size={isLarge ? 'xl' : 'lg'}
                      textClassName={isLarge ? '' : 'max-w-[75%]'}
                      badgeClassName={isLarge ? '' : 'mt-0.5'}
                    />

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-white/60 text-[11px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <ICONS.MapPin size={12} className="text-pink-500" />
                        {user.distanceLabel}
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1.5">
                        <ICONS.Languages size={12} className="text-blue-400" />
                        {user.languages[0]}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {user.interests.slice(0, 2).map((interest) => (
                        <span key={interest} className="px-2.5 py-1 rounded-full bg-white/10 border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/80">
                          {interest}
                        </span>
                      ))}
                      {user.interests.length > 2 && <span className="px-2 py-1 rounded-full bg-white/5 text-[9px] font-black text-white/30">+{user.interests.length - 2}</span>}
                    </div>
                  </div>

                  <div className="relative w-[var(--discover-compat-size)] h-[var(--discover-compat-size)] flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
                      <motion.circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray="175.9"
                        initial={{ strokeDashoffset: 175.9 }}
                        animate={{ strokeDashoffset: 175.9 - (175.9 * user.compatibility) / 100 }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                        className="text-pink-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[length:var(--discover-compat-value-size)] font-black text-white leading-none">{user.compatibility}%</span>
                      <span className="text-[length:var(--discover-compat-label-size)] font-bold uppercase tracking-widest text-white/40">{t('discover.match')}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex items-center gap-[var(--discover-action-gap)] z-40 pointer-events-auto">
                {actionButtons}
              </div>
            </motion.div>
            </AnimatePresence>
          ) : (
            emptyDeck
          )}
        </div>
        </div>
      )}

      <AnimatePresence>
        {showMatch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm text-center space-y-10">
              <div className="relative h-56 flex justify-center items-center">
                <div className="flex -space-x-8 relative z-10">
                  <motion.div initial={{ x: -50, rotate: -15 }} animate={{ x: 0, rotate: -10 }} className="w-36 h-36 rounded-[32px] border-4 border-white/10 overflow-hidden shadow-2xl">
                    <img src={selfPreviewPhoto || user?.photos?.[0]} className="w-full h-full object-cover" alt="Me" />
                  </motion.div>
                  <motion.div initial={{ x: 50, rotate: 15 }} animate={{ x: 0, rotate: 10 }} className="w-36 h-36 rounded-[32px] border-4 border-white/10 overflow-hidden shadow-2xl">
                    <img src={user?.photos?.[0]} className="w-full h-full object-cover" alt="Match" />
                  </motion.div>
                </div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }} className="absolute bottom-0 z-20 bg-white text-black px-8 py-3 rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-2xl">
                  {t('discover.itsAMatch')}
                </motion.div>
              </div>

              <div className="space-y-3">
                <h2 className="text-4xl font-bold text-white tracking-tight">{t('discover.matchPair', { name: user?.name ?? '' })}</h2>
                <p className="text-white/40 text-sm max-w-[240px] mx-auto leading-relaxed">{t('discover.matchSubtitle')}</p>
              </div>

              <div className="space-y-4">
                <GlassButton
                  variant="premium"
                  onClick={() => {
                    if (!user) return;
                    void appApi.openChat(user.id).then(() => navigate(`/chat/${user.id}`));
                  }}
                  className="w-full py-5 text-sm font-bold uppercase tracking-widest"
                >
                  {t('discover.sendMessage')}
                </GlassButton>
                <button onClick={() => setShowMatch(false)} className="w-full py-2 text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
                  {t('discover.continueSwiping')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SwipeScreen;

