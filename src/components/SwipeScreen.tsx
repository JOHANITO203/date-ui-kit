import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';
import NameWithBadge from './ui/NameWithBadge';
import { useI18n } from '../i18n/I18nProvider';
import Logo from './ui/Logo';
import { appApi, authApi } from '../services';
import { useRuntimeSelector } from '../state';
import type { FeedCandidate, FeedQuickFilter, PlanTier } from '../contracts';
import { hasSubscriptionBenefit } from '../domain/subscriptionBenefits';
import { buildOptimizedImageUrl, buildResponsiveImageAttrs } from '../utils/imageDelivery';

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

const reshuffleCandidates = (candidates: FeedCandidate[]): FeedCandidate[] => {
  const unique = new Map<string, FeedCandidate>();
  for (const candidate of candidates) {
    if (!candidate?.id) continue;
    if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }

  return [...unique.values()].sort((a, b) => {
    const scoreA =
      (typeof a.rankScore === 'number' ? a.rankScore : a.compatibility) +
      (a.online ? 2 : 0) +
      (a.flags.verifiedIdentity ? 1 : 0) +
      (Math.random() * 10 - 5);
    const scoreB =
      (typeof b.rankScore === 'number' ? b.rankScore : b.compatibility) +
      (b.online ? 2 : 0) +
      (b.flags.verifiedIdentity ? 1 : 0) +
      (Math.random() * 10 - 5);
    return scoreB - scoreA;
  });
};

type DiscoverImageProps = {
  attrs: ReturnType<typeof buildResponsiveImageAttrs> | null | undefined;
  className: string;
  label: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
};

const DiscoverImage = ({
  attrs,
  className,
  label,
  loading = 'lazy',
  fetchPriority = 'auto',
}: DiscoverImageProps) => {
  const src = typeof attrs?.src === 'string' && attrs.src.trim().length > 0 ? attrs.src.trim() : '/placeholder.svg';
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError) {
    return (
      <div
        className="w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),rgba(20,20,20,0.96))] flex items-center justify-center"
        aria-label={label}
        role="img"
      >
        <div className="w-14 h-14 rounded-full border border-white/20 bg-black/45 backdrop-blur-md flex items-center justify-center">
          <ICONS.Profile size={24} className="text-white/75" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      srcSet={attrs?.srcSet}
      sizes={attrs?.sizes}
      className={className}
      alt=""
      aria-label={label}
      referrerPolicy="no-referrer"
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onError={() => setHasError(true)}
    />
  );
};

const SwipeScreen = () => {
  const navigate = useNavigate();
  const { isDesktop, isTablet } = useDevice();
  const { t } = useI18n();
  const isLarge = isDesktop || isTablet;
  const balances = useRuntimeSelector((payload) => payload.balances);
  const planTier = useRuntimeSelector((payload) => payload.planTier);
  const boostActiveUntilIso = useRuntimeSelector((payload) => payload.boost.activeUntilIso);
  const likedCount = useRuntimeSelector((payload) => payload.likedProfileIds.length);
  const matchCount = useRuntimeSelector((payload) => payload.conversations.length);
  const [selfPrimaryPhotoUrl, setSelfPrimaryPhotoUrl] = useState('');
  const [boostTick, setBoostTick] = useState(() => Date.now());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedUser, setMatchedUser] = useState<FeedCandidate | null>(null);
  const [showSuperLikeComposer, setShowSuperLikeComposer] = useState(false);
  const [superLikeTarget, setSuperLikeTarget] = useState<FeedCandidate | null>(null);
  const [superLikeDraft, setSuperLikeDraft] = useState('');
  const [superLikeComposerError, setSuperLikeComposerError] = useState('');
  const [isSuperLikeSending, setIsSuperLikeSending] = useState(false);
  const [showSuperLikeSentConfirmation, setShowSuperLikeSentConfirmation] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [feedStatus, setFeedStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [feedCandidates, setFeedCandidates] = useState<FeedCandidate[]>([]);
  const [feedCursor, setFeedCursor] = useState('');
  const [dismissedCandidates, setDismissedCandidates] = useState<FeedCandidate[]>([]);
  const [matchedProfileIds, setMatchedProfileIds] = useState<string[]>([]);
  const [isSwipePending, setIsSwipePending] = useState(false);
  const [isFeedResetPending, setIsFeedResetPending] = useState(false);
  const [swipeError, setSwipeError] = useState(false);
  const swipeErrorTimerRef = useRef<number | null>(null);
  const superLikeConfirmationTimerRef = useRef<number | null>(null);
  const imagePreloadCacheRef = useRef<Set<string>>(new Set());
  const showTransientSwipeError = () => {
    setSwipeError(true);
    if (swipeErrorTimerRef.current) {
      window.clearTimeout(swipeErrorTimerRef.current);
    }
    swipeErrorTimerRef.current = window.setTimeout(() => {
      setSwipeError(false);
      swipeErrorTimerRef.current = null;
    }, 2800);
  };
  const quickFilters = [
    { id: 'all', labelKey: 'discover.quickFilters.all' },
    { id: 'nearby', labelKey: 'discover.quickFilters.nearby' },
    { id: 'new', labelKey: 'discover.quickFilters.new' },
    { id: 'online', labelKey: 'discover.quickFilters.online' },
    { id: 'verified', labelKey: 'discover.quickFilters.verified' },
  ] as const;
  const [activeFilterIds, setActiveFilterIds] = useState<FeedQuickFilter[]>(['all']);
  const hasAdvancedFilters = hasSubscriptionBenefit(planTier, 'discover_advanced_filters');

  const filteredUsers = useMemo(() => {
    return feedCandidates.map((candidate) => ({
      ...candidate,
      verified: candidate.flags.verifiedIdentity,
      premiumTier: resolveDisplayPremiumTier(candidate.flags.premiumTier, candidate.flags.shortPassTier),
      ageMasked: candidate.flags.hideAge,
      distanceMasked: candidate.flags.hideDistance,
      distanceLabel:
        candidate.flags.hideDistance || candidate.distanceKm < 0
          ? t('discover.hiddenDistance')
          : t('discover.distanceKm', { value: candidate.distanceKm }),
    }));
  }, [feedCandidates, t]);

  const preloadImage = (url: string | undefined | null) => {
    const normalized = buildOptimizedImageUrl(url, 'card');
    if (!normalized || normalized === '/placeholder.svg' || imagePreloadCacheRef.current.has(normalized))
      return;
    imagePreloadCacheRef.current.add(normalized);
    const image = new Image();
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.src = normalized;
  };

  useEffect(() => {
    let cancelled = false;
    authApi
      .getProfilePhotos()
      .then((response) => {
        if (cancelled || response.ok !== true) return;
        const photos = response.data?.photos ?? [];
        const primary =
          photos.find((photo) => photo.is_primary && typeof photo.url === 'string' && photo.url.trim().length > 0) ??
          photos.find((photo) => typeof photo.url === 'string' && photo.url.trim().length > 0);
        if (primary?.url) setSelfPrimaryPhotoUrl(primary.url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (swipeErrorTimerRef.current) {
        window.clearTimeout(swipeErrorTimerRef.current);
      }
      if (superLikeConfirmationTimerRef.current) {
        window.clearTimeout(superLikeConfirmationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setFeedStatus('loading');
    appApi
      .getFeed(activeFilterIds)
      .then((response) => {
        if (isCancelled) return;
        setFeedCandidates(
          response.window.candidates.filter((candidate) => !matchedProfileIds.includes(candidate.id)),
        );
        setFeedCursor(response.window.cursor);
        setDismissedCandidates((prev) => prev.filter((candidate) => !matchedProfileIds.includes(candidate.id)));
        setSwipeError(false);
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
  }, [activeFilterIds, matchedProfileIds]);

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

  useEffect(() => {
    if (!hasUsers) return;
    const warmup = filteredUsers.slice(0, 4);
    for (const candidate of warmup) {
      preloadImage(candidate.photos?.[0]);
    }
  }, [filteredUsers, hasUsers]);

  useEffect(() => {
    if (!user) return;
    preloadImage(user.photos?.[photoIndex]);
    preloadImage(user.photos?.[photoIndex + 1]);
    preloadImage(nextUser?.photos?.[0]);
  }, [nextUser?.id, photoIndex, user?.id]);
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
  const currentPhotoAttrs = user
    ? buildResponsiveImageAttrs(user.photos[photoIndex], 'card', '(max-width: 1024px) 100vw, 720px')
    : null;
  const nextPhotoAttrs = nextUser
    ? buildResponsiveImageAttrs(nextUser.photos[0], 'card', '(max-width: 1024px) 100vw, 720px')
    : null;
  const matchSelfPhotoAttrs = buildResponsiveImageAttrs(
    selfPrimaryPhotoUrl || '/placeholder.svg',
    'profile',
    '144px',
  );
  const matchPeerPhotoAttrs = buildResponsiveImageAttrs(
    matchedUser?.photos?.[0] || '/placeholder.svg',
    'profile',
    '144px',
  );

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
      openSuperLikeComposer();
    }
  };

  const buildSuperLikeIdempotencyKey = () => {
    try {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `superlike:${crypto.randomUUID()}`;
      }
    } catch {
      // ignore and fallback to timestamp-based key
    }
    return `superlike:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  };

  const openSuperLikeComposer = () => {
    if (!hasUsers || !user || isSwipePending || isSuperLikeSending) return;
    setSuperLikeTarget(user);
    setSuperLikeDraft('');
    setSuperLikeComposerError('');
    setShowSuperLikeComposer(true);
    x.set(0);
    y.set(0);
  };

  const closeSuperLikeComposer = () => {
    if (isSuperLikeSending) return;
    setShowSuperLikeComposer(false);
    setSuperLikeTarget(null);
    setSuperLikeDraft('');
    setSuperLikeComposerError('');
    x.set(0);
    y.set(0);
  };

  const sendSuperLikeDirect = async (target: FeedCandidate, text: string) => {
    return appApi.sendSuperLikeDirectMessage({
      profileId: target.id,
      text,
      feedCursor: feedCursor || undefined,
      idempotencyKey: buildSuperLikeIdempotencyKey(),
    });
  };

  const submitSuperLike = () => {
    if (!superLikeTarget || isSuperLikeSending) return;
    const text = superLikeDraft.trim();
    if (!text) {
      setSuperLikeComposerError(t('discover.superLikeComposerMessageRequired'));
      return;
    }

    setIsSuperLikeSending(true);
    setSuperLikeComposerError('');
    void sendSuperLikeDirect(superLikeTarget, text)
      .then((response) => {
        if (response.status !== 'sent') {
          setSuperLikeComposerError(
            response.status === 'no_stock'
              ? t('discover.superLikeComposerNoStock')
              : t('discover.superLikeComposerError'),
          );
          return;
        }
        setFeedCandidates((prev) => prev.filter((candidate) => candidate.id !== superLikeTarget.id));
        setCurrentIndex(0);
        setPhotoIndex(0);
        setSwipeError(false);
        x.set(0);
        y.set(0);
        setShowSuperLikeComposer(false);
        setSuperLikeTarget(null);
        setSuperLikeDraft('');
        setShowSuperLikeSentConfirmation(true);
        if (superLikeConfirmationTimerRef.current) {
          window.clearTimeout(superLikeConfirmationTimerRef.current);
        }
        superLikeConfirmationTimerRef.current = window.setTimeout(() => {
          setShowSuperLikeSentConfirmation(false);
          superLikeConfirmationTimerRef.current = null;
        }, 1800);
      })
      .catch(() => {
        setSuperLikeComposerError(t('discover.superLikeComposerError'));
      })
      .finally(() => {
        setIsSuperLikeSending(false);
      });
  };

  const swipe = (dir: 'left' | 'right') => {
    if (!hasUsers || !user || isSwipePending) return;
    setIsSwipePending(true);
    const decision = dir === 'left' ? 'dislike' : 'like';

    void appApi
      .swipe(user.id, decision, feedCursor)
      .then((response) => {
        if (response.matched) {
          setMatchedUser(user);
          setMatchedProfileIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
          setShowMatch(true);
        }
        setDismissedCandidates((prev) => [...prev, user]);
        setFeedCandidates((prev) => prev.filter((candidate) => candidate.id !== user.id));
        setCurrentIndex(0);
        setPhotoIndex(0);
        setSwipeError(false);
        x.set(0);
        y.set(0);
      })
      .catch(() => {
        showTransientSwipeError();
      })
      .finally(() => {
        setIsSwipePending(false);
      });
  };

  const rewindLastSwipe = () => {
    void appApi
      .rewind(feedCursor)
      .then((response) => {
        if (!response.restoredProfileId) return;
        const restoredCandidate = dismissedCandidates.find(
          (candidate) => candidate.id === response.restoredProfileId,
        );
        if (!restoredCandidate) {
          // Local dismissed cache can be stale after refresh/navigation while backend rewind history persists.
          void appApi
            .getFeed(activeFilterIds)
            .then((nextFeed) => {
              const candidates = nextFeed.window.candidates.filter(
                (candidate) => !matchedProfileIds.includes(candidate.id),
              );
              const restoredFromFeed = candidates.find(
                (candidate) => candidate.id === response.restoredProfileId,
              );
              const nextCandidates = restoredFromFeed
                ? [restoredFromFeed, ...candidates.filter((candidate) => candidate.id !== restoredFromFeed.id)]
                : candidates;
              setFeedCandidates(nextCandidates);
              setFeedCursor(nextFeed.window.cursor);
              setCurrentIndex(0);
              setPhotoIndex(0);
              setSwipeError(false);
              setFeedStatus('success');
              x.set(0);
              y.set(0);
            })
            .catch(() => {
              showTransientSwipeError();
            });
          return;
        }
        setDismissedCandidates((prev) =>
          prev.filter((candidate) => candidate.id !== response.restoredProfileId),
        );
        setFeedCandidates((prev) => [
          restoredCandidate,
          ...prev.filter((candidate) => candidate.id !== response.restoredProfileId),
        ]);
        setCurrentIndex(0);
        setPhotoIndex(0);
        x.set(0);
        y.set(0);
        setSwipeError(false);
      })
      .catch(() => {
        showTransientSwipeError();
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
    if (!hasAdvancedFilters && id !== 'all') {
      navigate('/boost');
      return;
    }
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
        disabled={!user || isSwipePending || showSuperLikeComposer || isSuperLikeSending}
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
        disabled={!user || isSwipePending || showSuperLikeComposer || isSuperLikeSending}
        animate={{ boxShadow: ['0 0 18px rgba(255, 20, 147, 0.2)', '0 0 34px rgba(255, 20, 147, 0.35)', '0 0 18px rgba(255, 20, 147, 0.2)'] }}
        transition={{ boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
        onClick={(e) => {
          e.stopPropagation();
          openSuperLikeComposer();
        }}
        className={`${isLarge ? 'w-[var(--discover-action-main-size)] h-[var(--discover-action-main-size)] rounded-full' : 'w-[var(--discover-action-mobile-main-w)] h-[var(--discover-action-mobile-main-h)] rounded-[var(--discover-action-mobile-main-radius)]'} flex items-center justify-center text-white gradient-premium opacity-90 shadow-[0_15px_35px_rgba(255,20,147,0.3)] transition-all duration-300 relative overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ICONS.Star size={isLarge ? 20 : 18} fill="currentColor" className="relative z-10" />
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.9 }}
        disabled={!user || isSwipePending || showSuperLikeComposer || isSuperLikeSending}
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
        onClick={() => {
          if (isFeedResetPending) return;
          const reshuffled = reshuffleCandidates(
            [...feedCandidates, ...dismissedCandidates].filter(
              (candidate) => !matchedProfileIds.includes(candidate.id),
            ),
          );
          if (reshuffled.length > 0) {
            setFeedCandidates(reshuffled);
            setDismissedCandidates([]);
            setCurrentIndex(0);
            setPhotoIndex(0);
            setSwipeError(false);
          } else {
            setActiveFilterIds(['all']);
          }

          setIsFeedResetPending(true);
          void appApi
            .resetFeed(activeFilterIds)
            .then((response) => {
              const nextCandidates = response.window.candidates.filter(
                (candidate) => !matchedProfileIds.includes(candidate.id),
              );
              setFeedCandidates(nextCandidates);
              setFeedCursor(response.window.cursor);
              setDismissedCandidates((prev) =>
                prev.filter((candidate) => !matchedProfileIds.includes(candidate.id)),
              );
              setCurrentIndex(0);
              setPhotoIndex(0);
              setFeedStatus('success');
              setSwipeError(false);
              x.set(0);
              y.set(0);
            })
            .catch(() => {
              showTransientSwipeError();
            })
            .finally(() => {
              setIsFeedResetPending(false);
            });
        }}
        disabled={isFeedResetPending}
        className="mt-5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.18em] border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        {swipeError && (
          <div className="mb-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-100">
            {t('discover.errorSubtitle')}
          </div>
        )}
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
              disabled={!hasAdvancedFilters && filter.id !== 'all'}
              className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.14em] whitespace-nowrap transition-all ${
                activeFilterIds.includes(filter.id)
                  ? 'bg-white text-[#090909] border border-white shadow-[0_8px_24px_rgba(255,255,255,0.16)]'
                  : 'bg-[#0E1116]/90 border border-white/10 text-white/68 hover:text-white hover:border-white/25'
              } ${!hasAdvancedFilters && filter.id !== 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  <DiscoverImage
                    attrs={nextPhotoAttrs}
                    className="w-full h-full object-cover object-[center_18%] grayscale-[0.3]"
                    label="Next candidate"
                    loading="lazy"
                  />
                </motion.div>
              )}

            <motion.div
              key={user.id}
              drag={!showSuperLikeComposer}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotate, opacity, zIndex: 10 }}
              className="absolute inset-0 rounded-[36px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing border border-white/5 bg-zinc-900"
              onClick={handlePhotoNav}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={photoIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full pointer-events-none"
                >
                  <DiscoverImage
                    attrs={currentPhotoAttrs}
                    className="w-full h-full object-cover object-[center_18%] pointer-events-none"
                    label={user.name}
                    loading="eager"
                    fetchPriority="high"
                  />
                </motion.div>
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
                  <DiscoverImage
                    attrs={nextPhotoAttrs}
                    className="w-full h-full object-cover object-[center_22%] grayscale-[0.3]"
                    label="Next candidate"
                    loading="lazy"
                  />
                </motion.div>
              )}

            <motion.div
              key={user.id}
              drag={!showSuperLikeComposer}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotate, opacity, zIndex: 10 }}
              className="absolute inset-0 rounded-[36px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing border border-white/5 bg-zinc-900"
              onClick={handlePhotoNav}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={photoIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full pointer-events-none"
                >
                  <DiscoverImage
                    attrs={currentPhotoAttrs}
                    className="w-full h-full object-cover object-[center_22%] pointer-events-none"
                    label={user.name}
                    loading="eager"
                    fetchPriority="high"
                  />
                </motion.div>
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
        {showSuperLikeComposer && superLikeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-end justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 28, opacity: 0.9 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0.95 }}
              className="w-full max-w-2xl rounded-3xl border border-fuchsia-300/30 bg-[#101015]/95 shadow-[0_30px_80px_rgba(0,0,0,0.6)] p-5 sm:p-6 space-y-4"
            >
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.24em] font-black text-fuchsia-300/85">
                  {t('discover.superLikeComposerEyebrow')}
                </p>
                <h3 className="text-white text-xl sm:text-2xl font-black tracking-tight">
                  {t('discover.superLikeComposerTitle', { name: superLikeTarget.name })}
                </h3>
                <p className="text-white/55 text-sm">
                  {t('discover.superLikeComposerSubtitle')}
                </p>
              </div>

              <textarea
                value={superLikeDraft}
                onChange={(event) => {
                  setSuperLikeDraft(event.target.value);
                  if (superLikeComposerError) setSuperLikeComposerError('');
                }}
                placeholder={t('discover.superLikeComposerPlaceholder')}
                maxLength={280}
                className="w-full min-h-[132px] rounded-2xl border border-white/15 bg-black/45 text-white text-sm leading-relaxed p-4 outline-none focus:border-fuchsia-300/50 focus:ring-2 focus:ring-fuchsia-400/20 resize-none"
              />

              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className={`${superLikeComposerError ? 'text-red-300' : 'text-white/40'}`}>
                  {superLikeComposerError || t('discover.superLikeComposerHint')}
                </span>
                <span className="text-white/35 font-semibold">{superLikeDraft.trim().length}/280</span>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeSuperLikeComposer}
                  disabled={isSuperLikeSending}
                  className="px-4 py-2 rounded-full border border-white/20 text-white/70 text-xs font-bold uppercase tracking-wider hover:text-white hover:border-white/35 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('discover.superLikeComposerCancel')}
                </button>
                <button
                  type="button"
                  onClick={submitSuperLike}
                  disabled={isSuperLikeSending}
                  className="px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-[0.18em] text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSuperLikeSending ? t('discover.superLikeComposerSending') : t('discover.superLikeComposerSend')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuperLikeSentConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute top-4 right-4 z-[120] rounded-full border border-emerald-300/30 bg-emerald-500/15 text-emerald-100 text-xs font-bold uppercase tracking-[0.16em] px-4 py-2 backdrop-blur-sm"
          >
            {t('discover.superLikeSent')}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMatch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm text-center space-y-10">
              <div className="relative h-56 flex justify-center items-center">
                <div className="flex -space-x-8 relative z-10">
                  <motion.div initial={{ x: -50, rotate: -15 }} animate={{ x: 0, rotate: -10 }} className="w-36 h-36 rounded-[32px] border-4 border-white/10 overflow-hidden shadow-2xl">
                    <img
                      src={matchSelfPhotoAttrs.src}
                      srcSet={matchSelfPhotoAttrs.srcSet}
                      sizes={matchSelfPhotoAttrs.sizes}
                      className="w-full h-full object-cover"
                      alt="Me"
                      loading="lazy"
                      decoding="async"
                    />
                  </motion.div>
                  <motion.div initial={{ x: 50, rotate: 15 }} animate={{ x: 0, rotate: 10 }} className="w-36 h-36 rounded-[32px] border-4 border-white/10 overflow-hidden shadow-2xl">
                    <img
                      src={matchPeerPhotoAttrs.src}
                      srcSet={matchPeerPhotoAttrs.srcSet}
                      sizes={matchPeerPhotoAttrs.sizes}
                      className="w-full h-full object-cover"
                      alt="Match"
                      loading="lazy"
                      decoding="async"
                    />
                  </motion.div>
                </div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }} className="absolute bottom-0 z-20 bg-white text-black px-8 py-3 rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-2xl">
                  {t('discover.itsAMatch')}
                </motion.div>
              </div>

              <div className="space-y-3">
                <h2 className="text-4xl font-bold text-white tracking-tight">{t('discover.matchPair', { name: matchedUser?.name ?? '' })}</h2>
                <p className="text-white/40 text-sm max-w-[240px] mx-auto leading-relaxed">{t('discover.matchSubtitle')}</p>
              </div>

              <div className="space-y-4">
                <GlassButton
                  variant="premium"
                  onClick={() => {
                    if (!matchedUser) return;
                    void appApi
                      .openChat(matchedUser.id)
                      .then(() => navigate(`/chat/${matchedUser.id}`))
                      .catch(() => navigate(`/chat/${matchedUser.id}`));
                  }}
                  className="w-full py-5 text-sm font-bold uppercase tracking-widest"
                >
                  {t('discover.sendMessage')}
                </GlassButton>
                <button
                  onClick={() => {
                    setShowMatch(false);
                    setMatchedUser(null);
                  }}
                  className="w-full py-2 text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                >
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

