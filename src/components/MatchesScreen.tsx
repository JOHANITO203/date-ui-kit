import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Star, Ghost, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDevice } from '../hooks/useDevice';
import { useI18n } from '../i18n/I18nProvider';
import { appApi } from '../services';
import { buildResponsiveImageAttrs } from '../utils/imageDelivery';

type CardVariant =
  | 'locked_standard'
  | 'locked_ghost'
  | 'unlockable_icebreaker'
  | 'unlocked'
  | 'visible_by_entitlement';

const MatchesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDesktop, isTablet } = useDevice();
  const { t } = useI18n();
  const isLarge = isDesktop || isTablet;
  const showDesktopRail = isLarge && isDesktop;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollThumb, setScrollThumb] = useState(28);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [remoteState, setRemoteState] = useState<'loading' | 'empty' | 'locked' | 'unlocked'>(
    'loading',
  );
  const [likesCards, setLikesCards] = useState<
    Array<{
      id: string;
      profileId: string;
      receivedAtIso: string;
      name: string;
      age: number;
      ageMasked: boolean;
      city: string;
      photo: string;
      wasSuperLike: boolean;
      state: 'pending_incoming_like' | 'matched' | 'refused';
      hiddenByShadowGhost: boolean;
      blurredLocked: boolean;
      online: boolean;
    }>
  >([]);
  const [hiddenLikesCount, setHiddenLikesCount] = useState(0);
  const [iceBreakerEligibleCount, setIceBreakerEligibleCount] = useState(0);
  const [iceBreakerOwnedCount, setIceBreakerOwnedCount] = useState(0);
  const [iceBreakerUnlockedCount, setIceBreakerUnlockedCount] = useState(0);
  const [iceBreakerCanUse, setIceBreakerCanUse] = useState(false);
  const [isPremiumPreviewUnlocked, setIsPremiumPreviewUnlocked] = useState(false);
  const [actionLikeId, setActionLikeId] = useState<string | null>(null);
  const [iceBreakerBusy, setIceBreakerBusy] = useState(false);
  const [iceBreakerBusyLikeId, setIceBreakerBusyLikeId] = useState<string | null>(null);
  const [iceBreakerFeedback, setIceBreakerFeedback] = useState<string | null>(null);

  const mapLikesCards = (
    visibleLikes: Array<{
      id: string;
      profile: {
        id: string;
        name: string;
        age: number;
        city: string;
        photos: string[];
        flags: { hideAge: boolean };
        online: boolean;
      };
      receivedAtIso: string;
      wasSuperLike: boolean;
      state: 'pending_incoming_like' | 'matched' | 'refused';
      hiddenByShadowGhost: boolean;
      blurredLocked: boolean;
    }>,
  ) =>
    visibleLikes
      .map((entry) => ({
        id: entry.id,
        profileId: entry.profile.id,
        receivedAtIso: entry.receivedAtIso,
        name: entry.profile.name,
        age: entry.profile.age,
        ageMasked: entry.profile.flags.hideAge,
        city: entry.profile.city,
        photo: entry.profile.photos[0] ?? '',
        wasSuperLike: entry.wasSuperLike,
        state: entry.state,
        hiddenByShadowGhost: entry.hiddenByShadowGhost,
        blurredLocked: entry.blurredLocked,
        online: entry.profile.online,
      }))
      .sort((a, b) => {
        // Keep unlocked cards visible/prioritized even when new locked likes arrive.
        if (a.blurredLocked !== b.blurredLocked) return a.blurredLocked ? 1 : -1;
        return new Date(b.receivedAtIso).getTime() - new Date(a.receivedAtIso).getTime();
      });

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    appApi
      .getLikes()
      .then((response) => {
        setRemoteState(response.state);
        setHiddenLikesCount(response.inventory.hiddenCount);
        setIceBreakerEligibleCount(response.inventory.iceBreaker.eligibleLikesHiddenCount);
        setIceBreakerOwnedCount(response.inventory.iceBreaker.ownedCount);
        setIceBreakerCanUse(response.inventory.iceBreaker.canUse);
        setIceBreakerUnlockedCount(response.inventory.iceBreaker.unlockedCount);
        setLikesCards(mapLikesCards(response.inventory.visibleLikes));
        if (response.state === 'locked') {
          appApi.trackLikesPaywallView();
        }
      })
      .catch(() => {
        setHasError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [reloadNonce]);

  useEffect(() => {
    let isCancelled = false;
    let inFlight = false;

    const refreshLive = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await appApi.getLikes();
        if (isCancelled) return;
        setRemoteState(response.state);
        setHiddenLikesCount(response.inventory.hiddenCount);
        setIceBreakerEligibleCount(response.inventory.iceBreaker.eligibleLikesHiddenCount);
        setIceBreakerOwnedCount(response.inventory.iceBreaker.ownedCount);
        setIceBreakerCanUse(response.inventory.iceBreaker.canUse);
        setIceBreakerUnlockedCount(response.inventory.iceBreaker.unlockedCount);
        setLikesCards(mapLikesCards(response.inventory.visibleLikes));
      } catch {
        // Keep existing state and retry on next tick.
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => {
      void refreshLive();
    }, 4000);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!showDesktopRail || !node) return;

    const updateScroll = () => {
      const max = node.scrollHeight - node.clientHeight;
      const progress = max <= 0 ? 0 : node.scrollTop / max;
      const size = node.scrollHeight <= 0 ? 100 : (node.clientHeight / node.scrollHeight) * 100;
      setScrollProgress(Math.min(1, Math.max(0, progress)));
      setScrollThumb(Math.max(20, Math.min(100, size)));
    };

    updateScroll();
    node.addEventListener('scroll', updateScroll);
    window.addEventListener('resize', updateScroll);

    return () => {
      node.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [showDesktopRail]);

  const jumpToSection = (index: number) => {
    const node = sectionRefs.current[index];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasLikes = likesCards.length > 0;
  const baseState: 'loading' | 'empty' | 'locked' | 'unlocked' | 'error' = isLoading
    ? 'loading'
    : hasError
      ? 'error'
      : remoteState;
  const screenState: 'loading' | 'empty' | 'locked' | 'unlocked' | 'error' =
    baseState === 'locked' && isPremiumPreviewUnlocked ? 'unlocked' : baseState;
  const totalLikesCount = likesCards.length + hiddenLikesCount;
  const unlockedCardsCount = likesCards.filter(
    (entry) => !entry.blurredLocked && !entry.hiddenByShadowGhost,
  ).length;
  const lockedCardsCount = likesCards.filter((entry) => entry.blurredLocked).length;
  const ghostCardsCount = likesCards.filter((entry) => entry.hiddenByShadowGhost).length;
  const summaryLine = `${totalLikesCount} ${t('likes.title').toLowerCase()} • ${unlockedCardsCount} ${t('likes.unlocked').toLowerCase()} • ${ghostCardsCount} ${t('likes.shadowGhostTag').toLowerCase()}`;

  const resolveCardVariant = (like: (typeof likesCards)[number]): CardVariant => {
    if (like.hiddenByShadowGhost) return 'locked_ghost';
    if (!like.blurredLocked) {
      return remoteState === 'unlocked' ? 'visible_by_entitlement' : 'unlocked';
    }
    if (iceBreakerOwnedCount > 0) return 'unlockable_icebreaker';
    return 'locked_standard';
  };

  const handleLikeDecision = async (
    like: (typeof likesCards)[number],
    action: 'like_back' | 'pass',
  ) => {
    setActionLikeId(like.id);
    try {
      const response = await appApi.decideIncomingLike({
        likeId: like.id,
        action,
      });
      setLikesCards((prev) =>
        prev
          .map((entry) =>
            entry.id === like.id
              ? {
                  ...entry,
                  state: response.status,
                }
              : entry,
          )
          .filter((entry) => entry.state !== 'refused'),
      );
      if (response.matched) {
        if (like.profileId && response.conversationId) {
          navigate(`/chat/${like.profileId}`);
          return;
        }
        navigate('/messages');
      }
    } finally {
      setActionLikeId(null);
    }
  };

  const handleUseIceBreaker = async (likeId: string) => {
    if (iceBreakerBusy || !iceBreakerCanUse) return;
    setIceBreakerBusy(true);
    setIceBreakerBusyLikeId(likeId);
    setIceBreakerFeedback(null);
    try {
      const response = await appApi.useLikesIceBreaker(likeId);
      if (!response.ok) {
        setIceBreakerFeedback(t('likes.iceBreakerActivationFailed'));
        return;
      }
      setRemoteState(response.state === 'error' ? 'locked' : response.state);
      setHiddenLikesCount(response.inventory.hiddenCount);
      setIceBreakerEligibleCount(response.inventory.iceBreaker.eligibleLikesHiddenCount);
      setIceBreakerOwnedCount(response.inventory.iceBreaker.ownedCount);
      setIceBreakerCanUse(response.inventory.iceBreaker.canUse);
      setIceBreakerUnlockedCount(response.inventory.iceBreaker.unlockedCount);
      setLikesCards(mapLikesCards(response.inventory.visibleLikes));
      const targetAfterUnlock = response.inventory.visibleLikes.find((entry) => entry.id === likeId);
      const unlockedTarget = Boolean(targetAfterUnlock && !targetAfterUnlock.blurredLocked);
      setIceBreakerFeedback(
        unlockedTarget ? t('likes.iceBreakerActivatedSingle') : t('likes.iceBreakerActivationFailed'),
      );
    } catch {
      setIceBreakerFeedback(t('likes.iceBreakerActivationFailed'));
    } finally {
      setIceBreakerBusy(false);
      setIceBreakerBusyLikeId(null);
    }
  };

  const renderCardContent = (like: (typeof likesCards)[number], compact = false) => {
    const isBusy = actionLikeId === like.id;
    const isIceBreakerBusyForCard = iceBreakerBusyLikeId === like.id;
    const variant = resolveCardVariant(like);
    const senderIdentityMasked = variant === 'locked_ghost';
    const displayName = senderIdentityMasked ? t('likes.shadowGhostMaskedName') : like.name;
    const displayAgeMasked = senderIdentityMasked ? true : like.ageMasked;
    const showIdentity = variant === 'unlocked' || variant === 'visible_by_entitlement';
    const showUnlockAction = variant === 'unlockable_icebreaker';
    const badgeToneClass =
      variant === 'locked_ghost'
        ? 'text-fuchsia-100 border-fuchsia-300/35 bg-fuchsia-500/12'
        : variant === 'unlockable_icebreaker'
          ? 'text-cyan-100 border-cyan-300/35 bg-cyan-500/12'
          : variant === 'locked_standard'
            ? 'text-white/82 border-white/20 bg-white/8'
            : 'text-cyan-100 border-cyan-300/35 bg-cyan-500/12';
    const badgeLabel =
      variant === 'locked_ghost'
        ? t('likes.shadowGhostTag')
        : variant === 'unlockable_icebreaker' || variant === 'locked_standard'
          ? t('likes.unlock.locked')
          : variant === 'visible_by_entitlement'
            ? t('likes.states.unlocked')
            : t('likes.unlocked');

    if (showIdentity) {
      return (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/22 to-transparent" />
        <div
          className={`absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-panel-soft text-[9px] font-black uppercase tracking-[0.14em] border ${badgeToneClass}`}
        >
          {variant === 'visible_by_entitlement' ? <Star size={10} /> : null}
          <span>{badgeLabel}</span>
          </div>
          {like.wasSuperLike ? (
            <div className="absolute top-3 right-3 w-6 h-6 rounded-full border border-fuchsia-300/35 bg-fuchsia-500/12 text-fuchsia-100 inline-flex items-center justify-center">
              <Star size={10} />
            </div>
          ) : null}
          <div className={`absolute left-3 right-3 ${compact ? 'bottom-3' : 'bottom-4'} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={`${compact ? 'text-sm' : 'text-base'} font-black text-white`}>
                {displayAgeMasked ? displayName : `${displayName}, ${like.age}`}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{t('chat.online')}</span>
              </div>
            </div>
            {like.state === 'matched' && (
              <button
                onClick={() => {
                  void appApi.openChat(like.profileId, like.wasSuperLike).then(() => {
                    navigate(`/chat/${like.profileId}`);
                  });
                }}
                className="w-full h-9 rounded-xl gradient-premium text-white text-[10px] font-black uppercase tracking-[0.14em]"
              >
                {t('likes.openChat')}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={isBusy || like.state === 'matched'}
                onClick={() => {
                  void handleLikeDecision(like, 'like_back');
                }}
                className="h-8 rounded-lg gradient-premium text-white inline-flex items-center justify-center gap-1 disabled:opacity-50"
                aria-label={t('likes.likeBack')}
              >
                {like.state === 'matched' ? (
                  <span className="text-[10px] font-black uppercase tracking-[0.12em]">{t('likes.matched')}</span>
                ) : (
                  <>
                    <Heart size={14} />
                    <span className="sr-only">{t('likes.likeBack')}</span>
                  </>
                )}
              </button>
              <button
                disabled={isBusy || like.state === 'matched'}
                onClick={() => {
                  void handleLikeDecision(like, 'pass');
                }}
                className="h-8 rounded-lg border border-white/20 bg-black/35 text-white/80 inline-flex items-center justify-center disabled:opacity-50"
                aria-label={t('likes.pass')}
              >
                <X size={14} />
                <span className="sr-only">{t('likes.pass')}</span>
              </button>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="absolute inset-0 bg-black/44" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/52 to-black/14" />

        <div
          className={`absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-panel-soft text-[9px] font-black uppercase tracking-[0.14em] border ${badgeToneClass}`}
        >
          {variant === 'locked_ghost' ? <Ghost size={10} /> : null}
          <span>{badgeLabel}</span>
        </div>
        {showUnlockAction && (
          <div className="absolute left-3 right-3 bottom-10">
            <button
              disabled={iceBreakerBusy || !like.blurredLocked || iceBreakerOwnedCount <= 0}
              onClick={() => {
                void handleUseIceBreaker(like.id);
              }}
              className="w-full h-8 rounded-lg border border-cyan-300/35 bg-cyan-500/15 text-cyan-100 text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-50"
            >
              {isIceBreakerBusyForCard ? '...' : `${t('likes.iceBreakerUse')} x${iceBreakerOwnedCount}`}
            </button>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 text-white/70">
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-white/72`}>
            {displayAgeMasked ? displayName : `${displayName}, ${like.age}`}
          </span>
        </div>
      </>
    );
  };

  return (
    <div ref={scrollRef} className="relative group/likes h-full overflow-y-auto no-scrollbar py-6 pb-nav">
      <div className="container-wide px-[var(--page-x)] layout-stack">
        <header
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          className="flex items-end justify-between gap-4"
        >
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">{t('likes.eyebrow')}</p>
            <h1 className="text-[length:var(--discover-title-size)] font-black italic tracking-tight text-white leading-none uppercase">
              {t('likes.title')}
            </h1>
            <p className="text-[11px] text-white/50">{summaryLine}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5">
            <Heart size={12} fill="currentColor" className="text-pink-400" />
            <span className="text-[10px] font-black text-white/75">{t('likes.newLikes', { count: totalLikesCount })}</span>
          </div>
        </header>

        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/75">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            <span>{t(`likes.states.${screenState}`)}</span>
          </div>
          <button
            onClick={() => {
              const firstLockedLike = likesCards.find(
                (entry) => entry.blurredLocked && !entry.hiddenByShadowGhost,
              );
              if (iceBreakerCanUse && firstLockedLike) {
                void handleUseIceBreaker(firstLockedLike.id);
                return;
              }
              if (iceBreakerOwnedCount <= 0) {
                appApi.clickLikesPaywall();
                navigate('/boost');
              }
            }}
            disabled={iceBreakerBusy || (iceBreakerOwnedCount <= 0 && screenState !== 'locked')}
            className={`h-9 px-3 rounded-xl border text-[10px] font-black uppercase tracking-[0.12em] inline-flex items-center gap-1.5 transition-colors ${
              iceBreakerCanUse
                ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100'
                : 'border-white/20 bg-white/5 text-white/70'
            } disabled:opacity-60`}
          >
            <Star size={12} className="text-cyan-200" />
            <span>{t('likes.iceBreakerTitle')}</span>
            <span className="text-white/85">x{iceBreakerOwnedCount}</span>
            {iceBreakerUnlockedCount > 0 && (
              <span className="text-cyan-200">+{iceBreakerUnlockedCount}</span>
            )}
          </button>
        </div>

        {iceBreakerFeedback && (
          <p className="text-xs text-cyan-200 font-bold">{iceBreakerFeedback}</p>
        )}

        {screenState === 'loading' && (
          <section className="glass-panel rounded-[var(--card-radius)] p-7 text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-white/20 border-t-white/75 animate-spin" />
            <p className="mt-4 text-lg font-black text-white">{t('likes.loadingTitle')}</p>
            <p className="mt-2 text-sm text-white/50">{t('likes.loadingSubtitle')}</p>
          </section>
        )}

        {screenState === 'empty' && (
          <section className="glass-panel rounded-[var(--card-radius)] p-8 text-center">
            <Heart size={28} className="mx-auto text-white/40" />
            <p className="mt-4 text-lg font-black text-white">{t('likes.emptyTitle')}</p>
            <p className="mt-2 text-sm text-white/50">{t('likes.emptySubtitle')}</p>
          </section>
        )}

        {screenState === 'error' && (
          <section className="glass-panel rounded-[var(--card-radius)] p-8 text-center border border-red-400/35 bg-red-500/5">
            <Heart size={28} className="mx-auto text-red-200" />
            <p className="mt-4 text-lg font-black text-white">{t('likes.errorTitle')}</p>
            <p className="mt-2 text-sm text-white/60">{t('likes.errorSubtitle')}</p>
            <button
              onClick={() => setReloadNonce((prev) => prev + 1)}
              className="mt-4 h-10 px-4 rounded-xl border border-white/20 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black"
            >
              {t('discover.retry')}
            </button>
          </section>
        )}

        {(screenState === 'locked' || screenState === 'unlocked') && isLarge ? (
          <div
            ref={(el) => {
              sectionRefs.current[1] = el;
            }}
            className="grid grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_22rem] gap-5 items-start"
          >
            <section className="grid grid-cols-2 xl:grid-cols-3 gap-[var(--grid-gap)]">
              {likesCards.map((like, index) => (
                <motion.article
                  key={like.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="relative overflow-hidden rounded-[var(--card-radius)] glass-panel glass-panel-float aspect-[3/4]"
                >
                  {(() => {
                    const imageAttrs = buildResponsiveImageAttrs(
                      like.hiddenByShadowGhost ? '/placeholder.svg' : like.photo,
                      'card',
                      '(max-width: 1024px) 50vw, 360px',
                    );
                    return (
                      <img
                        src={imageAttrs.src}
                        srcSet={imageAttrs.srcSet}
                        sizes={imageAttrs.sizes}
                        alt={like.name}
                        className="absolute inset-0 w-full h-full object-cover object-center scale-105"
                        referrerPolicy="no-referrer"
                        loading={index < 2 ? 'eager' : 'lazy'}
                        fetchPriority={index < 2 ? 'high' : 'auto'}
                        decoding="async"
                      />
                    );
                  })()}
                  {renderCardContent(like, false)}
                </motion.article>
              ))}
            </section>

            <aside
              ref={(el) => {
                sectionRefs.current[2] = el;
              }}
              className="layout-stack"
            >
              <section className="glass-panel rounded-[var(--card-radius)] p-4 border border-white/10">
                <div className="inline-flex p-2 rounded-xl bg-white/5 mb-3">
                  <Star className="text-[#FFD166]" fill="#FFD166" size={18} />
                </div>
                <h2 className="text-lg font-black tracking-tight mb-2">{t('likes.premium.title')}</h2>
                <p className="text-secondary text-sm leading-relaxed mb-4">
                  {t('likes.premium.subtitle')}
                </p>
                <button
                  onClick={() => {
                    appApi.clickLikesPaywall();
                    navigate('/boost');
                  }}
                  className="w-full h-11 rounded-xl gradient-premium text-white font-black uppercase tracking-[0.14em] text-[10px]"
                >
                  {t('likes.premium.buttonLarge')}
                </button>
              </section>
            </aside>
          </div>
        ) : (screenState === 'locked' || screenState === 'unlocked') ? (
          <>
            <section className="grid grid-cols-2 gap-[var(--grid-gap)]">
              {likesCards.map((like, index) => (
                <motion.article
                  key={like.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative overflow-hidden rounded-[var(--card-radius)] glass-panel glass-panel-float aspect-[3/4]"
                >
                  {(() => {
                    const imageAttrs = buildResponsiveImageAttrs(
                      like.hiddenByShadowGhost ? '/placeholder.svg' : like.photo,
                      'card',
                      '(max-width: 1024px) 50vw, 360px',
                    );
                    return (
                      <img
                        src={imageAttrs.src}
                        srcSet={imageAttrs.srcSet}
                        sizes={imageAttrs.sizes}
                        alt={like.name}
                        className="absolute inset-0 w-full h-full object-cover object-center scale-105"
                        referrerPolicy="no-referrer"
                        loading={index < 2 ? 'eager' : 'lazy'}
                        fetchPriority={index < 2 ? 'high' : 'auto'}
                        decoding="async"
                      />
                    );
                  })()}
                  {renderCardContent(like, true)}
                </motion.article>
              ))}
            </section>

            <section className="glass-panel p-6 rounded-[var(--card-radius)] text-center">
              <div className="inline-flex p-3 rounded-2xl bg-white/5 mb-4">
                <Star className="text-[#FFD166]" fill="#FFD166" />
              </div>
              <h2 className="text-xl font-black mb-2">{t('likes.premium.title')}</h2>
              <p className="text-secondary text-sm mb-6">{t('likes.premium.subtitle')}</p>
              <button
                onClick={() => {
                  appApi.clickLikesPaywall();
                  navigate('/boost');
                }}
                className="w-full h-[var(--cta-height)] rounded-2xl gradient-premium text-white font-black uppercase tracking-[0.15em] text-[11px]"
              >
                {t('likes.premium.button')}
              </button>
              <button
                onClick={() => setIsPremiumPreviewUnlocked((prev) => !prev)}
                className="w-full mt-3 h-10 rounded-2xl border border-white/15 bg-white/5 text-white/75 text-[10px] font-black uppercase tracking-[0.15em]"
              >
                {isPremiumPreviewUnlocked ? t('likes.previewLocked') : t('likes.previewUnlocked')}
              </button>
            </section>
          </>
        ) : null}
      </div>
      {showDesktopRail && (
        <div className="fixed right-0 top-0 bottom-0 w-14 z-30 pointer-events-none">
          <div className="group/likes-rail h-full w-full flex items-center justify-center pointer-events-auto">
            <div className="flex items-center opacity-0 transition-opacity duration-300 group-hover/likes-rail:opacity-100">
              <div className="rounded-full p-[1px] bg-gradient-to-b from-pink-500 via-fuchsia-500 to-blue-500 shadow-[0_0_14px_rgba(217,70,239,0.33)]">
                <div className="relative w-2.5 h-40 rounded-full bg-[#09090c]/95 overflow-hidden">
                  <div
                    className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-pink-400 via-fuchsia-400 to-blue-400"
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
                    key={`likes-jump-${index}`}
                    onClick={() => jumpToSection(index)}
                    className="w-2 h-2 rounded-full bg-white/35 hover:bg-pink-300 transition-colors"
                    aria-label={t('likes.jumpSection', { index: index + 1 })}
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

export default MatchesScreen;
