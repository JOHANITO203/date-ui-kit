import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Star, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDevice } from '../hooks/useDevice';
import { useI18n } from '../i18n/I18nProvider';
import { appApi } from '../services';

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
  const [isPremiumPreviewUnlocked, setIsPremiumPreviewUnlocked] = useState(false);
  const [actionLikeId, setActionLikeId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    appApi
      .getLikes()
      .then((response) => {
        setRemoteState(response.state);
        setHiddenLikesCount(response.inventory.hiddenCount);
        setIceBreakerEligibleCount(response.inventory.iceBreaker.eligibleLikesHiddenCount);
        setLikesCards(
          response.inventory.visibleLikes.map((entry) => ({
            id: entry.id,
            profileId: entry.profile.id,
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
          })),
        );
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
        setLikesCards(
          response.inventory.visibleLikes.map((entry) => ({
            id: entry.id,
            profileId: entry.profile.id,
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
          })),
        );
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

  const renderCardContent = (like: (typeof likesCards)[number], compact = false) => {
    const isBusy = actionLikeId === like.id;
    const senderIdentityMasked = like.hiddenByShadowGhost;
    const displayName = senderIdentityMasked ? t('likes.shadowGhostMaskedName') : like.name;
    const displayAgeMasked = senderIdentityMasked ? true : like.ageMasked;

    if (screenState === 'unlocked') {
      return (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full glass-panel-soft text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200">
            {t('likes.unlocked')}
          </div>
          <div className={`absolute left-3 right-3 ${compact ? 'bottom-3' : 'bottom-4'} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={`${compact ? 'text-sm' : 'text-base'} font-black text-white`}>
                {displayAgeMasked ? displayName : `${displayName}, ${like.age}`}
              </span>
              <div className="flex items-center gap-1.5">
                {like.wasSuperLike && (
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.12em] text-fuchsia-200 border border-fuchsia-300/35 bg-fuchsia-500/10">
                    SuperLike
                  </span>
                )}
                {like.hiddenByShadowGhost && (
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.12em] text-fuchsia-100 border border-fuchsia-300/35 bg-fuchsia-500/10">
                    {t('likes.shadowGhostTag')}
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{t('chat.online')}</span>
              </div>
            </div>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-white/75 leading-snug`}>
              {t('likes.unlockedSubtitle', { city: like.city })}
            </p>
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
                className="h-8 rounded-lg gradient-premium text-white text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-50"
              >
                {like.state === 'matched' ? t('likes.matched') : t('likes.likeBack')}
              </button>
              <button
                disabled={isBusy || like.state === 'matched'}
                onClick={() => {
                  void handleLikeDecision(like, 'pass');
                }}
                className="h-8 rounded-lg border border-white/20 bg-black/35 text-white/80 text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-50"
              >
                {t('likes.pass')}
              </button>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="absolute inset-0 bg-black/36 premium-blur-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/20" />

        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full glass-panel-soft text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
          {t('likes.unlock.locked')}
        </div>

        <div className={`absolute ${compact ? 'top-12' : 'top-14'} left-1/2 -translate-x-1/2`}>
          <div className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} rounded-full bg-gradient-to-r from-[#FF1493] to-[#00BFFF] flex items-center justify-center shadow-[0_0_26px_rgba(236,72,153,0.34)]`}>
            <Heart size={compact ? 22 : 24} fill="white" />
          </div>
        </div>

        <div className={`absolute ${compact ? 'inset-x-3 top-[45%]' : 'inset-x-4 top-[46%]'} text-center`}>
          <p className={`mx-auto ${compact ? 'max-w-[9.5ch] text-[0.76rem]' : 'max-w-[11ch] text-[clamp(0.88rem,1.05vw,1rem)]'} leading-[1.16] font-black text-white`}>
            {t('likes.unlock.cta')}
          </p>
          <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-white/62 mt-1.5`}>
            {t('likes.unlock.city', { city: like.city })}
          </p>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white/70">
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-bold premium-blur-text`}>
            {displayAgeMasked ? displayName : `${displayName}, ${like.age}`}
          </span>
          <Eye size={compact ? 14 : 16} className="text-white/50" />
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
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-pink-500/35 bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.12)]">
            <Heart size={12} fill="currentColor" className="text-pink-400" />
            <span className="text-[10px] font-black text-pink-300">{t('likes.newLikes', { count: totalLikesCount })}</span>
          </div>
        </header>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/75">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
          <span>{t(`likes.states.${screenState}`)}</span>
        </div>

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
                  <img src={like.hiddenByShadowGhost ? '/placeholder.svg' : like.photo} alt={like.name} className="absolute inset-0 w-full h-full object-cover object-center scale-105" referrerPolicy="no-referrer" />
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
              <section className="glass-panel rounded-[var(--card-radius)] p-5">
                <div className="inline-flex p-2 rounded-xl bg-white/5 mb-3">
                  <Star className="text-[#FFD166]" fill="#FFD166" size={18} />
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-2">{t('likes.premium.title')}</h2>
                <p className="text-secondary text-sm leading-relaxed mb-5">
                  {t('likes.premium.subtitle')}
                </p>
                <button
                  onClick={() => {
                    appApi.clickLikesPaywall();
                    navigate('/boost');
                  }}
                  className="w-full h-[var(--cta-height)] rounded-2xl gradient-premium text-white font-black uppercase tracking-[0.15em] text-[11px]"
                >
                  {t('likes.premium.buttonLarge')}
                </button>
                <button
                  onClick={() => setIsPremiumPreviewUnlocked((prev) => !prev)}
                  className="w-full mt-3 h-10 rounded-2xl border border-white/15 bg-white/5 text-white/75 text-[10px] font-black uppercase tracking-[0.15em]"
                >
                  {isPremiumPreviewUnlocked ? t('likes.previewLocked') : t('likes.previewUnlocked')}
                </button>
              </section>

              <section className="glass-panel rounded-[var(--card-radius)] p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black">{t('likes.premium.includes')}</p>
                {[
                  t('likes.includes.likesReceived'),
                  t('likes.includes.unlimitedLikes'),
                  t('likes.includes.advancedFilters'),
                  t('likes.includes.weeklyBoost'),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-white/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </section>
            </aside>
          </div>
        ) : (screenState === 'locked' || screenState === 'unlocked') ? (
          <>
            <section className="grid grid-cols-2 gap-[var(--grid-gap)]">
              {likesCards.slice(0, 4).map((like, index) => (
                <motion.article
                  key={like.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative overflow-hidden rounded-[var(--card-radius)] glass-panel glass-panel-float aspect-[3/4]"
                >
                  <img src={like.hiddenByShadowGhost ? '/placeholder.svg' : like.photo} alt={like.name} className="absolute inset-0 w-full h-full object-cover object-center scale-105" referrerPolicy="no-referrer" />
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
        {screenState === 'locked' && iceBreakerEligibleCount >= 3 && (
          <section className="glass-panel rounded-[var(--card-radius)] p-5 flex items-center justify-between gap-4 border border-fuchsia-400/25 bg-fuchsia-500/5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-200 font-black">{t('likes.iceBreakerTitle')}</p>
              <p className="text-sm text-white/75 mt-1">
                {t('likes.iceBreakerSubtitle', { count: iceBreakerEligibleCount })}
              </p>
            </div>
            <button
              onClick={() => {
                appApi.clickLikesPaywall();
                navigate('/boost');
              }}
              className="h-10 px-4 rounded-xl border border-fuchsia-300/35 bg-fuchsia-500/15 text-fuchsia-100 text-[10px] font-black uppercase tracking-[0.14em]"
            >
              {t('likes.iceBreakerCta')}
            </button>
          </section>
        )}
        {(screenState === 'locked' || screenState === 'unlocked') && (
          <section className="glass-panel rounded-[var(--card-radius)] p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-black">{t('likes.matchFlowLabel')}</p>
              <p className="text-sm text-white/75 mt-1">{t('likes.matchFlowHint')}</p>
            </div>
            <button
              onClick={() => navigate('/messages')}
              className="h-10 px-4 rounded-xl border border-white/20 bg-white/5 text-white/80 text-[10px] font-black uppercase tracking-[0.14em]"
            >
              {t('likes.goMessages')}
            </button>
          </section>
        )}
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
