import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICONS } from '../types';
import { useDevice } from '../hooks/useDevice';
import ChatScreen from './ChatScreen';
import NameWithBadge from './ui/NameWithBadge';
import { useI18n } from '../i18n/I18nProvider';
import { appApi, subscribeConversationRelationChange } from '../services';
import { useRuntimeSelector } from '../state';
import type { ConversationSummary, PlanTier } from '../contracts';
import { hasSubscriptionBenefit } from '../domain/subscriptionBenefits';

const resolveDisplayPremiumTier = (tier: PlanTier, shortPassTier?: 'day' | 'week'): PlanTier => {
  if (tier !== 'free') return tier;
  return shortPassTier ? 'essential' : 'free';
};

const resolvePhotoUrl = (photos: string[] | undefined): string => {
  if (!Array.isArray(photos)) return '/placeholder.svg';
  const direct = photos.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return direct ?? '/placeholder.svg';
};

const isShadowGhostConversation = (conversation: ConversationSummary) =>
  Boolean(conversation.shadowGhostMasked || conversation.peer.flags.shadowGhost);

type AvatarImageProps = {
  src: string;
  name: string;
  className: string;
  imgClassName: string;
};

const AvatarImage = ({ src, name, className, imgClassName }: AvatarImageProps) => {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const canRenderImage = !failed && src !== '/placeholder.svg';

  return (
    <div className={`${className} overflow-hidden bg-white/5`}>
      {canRenderImage ? (
        <img
          src={src}
          className={imgClassName}
          alt={name}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-500/30 to-blue-500/30 text-white/85 font-black">
          {initial}
        </div>
      )}
    </div>
  );
};

const MessagesScreen = () => {
  const navigate = useNavigate();
  const { userId: urlUserId } = useParams();
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { t } = useI18n();
  const planTier = useRuntimeSelector((payload) => payload.planTier);
  const isLarge = isDesktop || isTablet;
  const canSeeOnlinePresence = hasSubscriptionBenefit(planTier, 'messages_see_online');
  const showDesktopRail =
    isDesktop &&
    !isTablet &&
    !isTouch &&
    (typeof window !== 'undefined' ? window.innerWidth >= 1280 : false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [conversationItems, setConversationItems] = useState<ConversationSummary[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [actionConversationId, setActionConversationId] = useState<string | null>(null);
  const [safetyFeedback, setSafetyFeedback] = useState<string>('');
  
  // For Master-Detail on large screens
  const [selectedUserId, setSelectedUserId] = useState<string | null>(urlUserId || null);
  const [matchesProgress, setMatchesProgress] = useState(0);
  const [matchesMaxScroll, setMatchesMaxScroll] = useState(0);
  const [conversationsProgress, setConversationsProgress] = useState(0);
  const [conversationsThumb, setConversationsThumb] = useState(30);
  const matchesRef = useRef<HTMLDivElement | null>(null);
  const conversationsRef = useRef<HTMLDivElement | null>(null);
  const conversationsRailTrackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (urlUserId) setSelectedUserId(urlUserId);
  }, [urlUserId]);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    Promise.all([appApi.getConversations(), appApi.getLikes()])
      .then(([items, likesResponse]) => {
        setConversationItems(items);
        setLikesCount(likesResponse.inventory.visibleLikes.length + likesResponse.inventory.hiddenCount);
        if (!urlUserId) {
          setSelectedUserId((prev) => prev ?? items[0]?.peer.id ?? null);
        }
      })
      .catch(() => {
        setHasError(true);
        setConversationItems([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [urlUserId, reloadNonce]);

  const newMatchItems = conversationItems.filter(
    (conversation) =>
      conversation.relationState === 'active' &&
      (conversation.unreadCount > 0 || Boolean(conversation.receivedSuperLikeTraceAtIso)),
  );
  const newMatchIds = new Set(newMatchItems.map((conversation) => conversation.id));
  const conversationListItems = conversationItems.filter((conversation) => !newMatchIds.has(conversation.id));

  useEffect(() => {
    let isCancelled = false;
    let inFlight = false;
    let failureCount = 0;
    let timerId: number | null = null;

    const refreshLive = async () => {
      if (isCancelled) return;
      if (inFlight) return;
      inFlight = true;
      try {
        const [items, likesResponse] = await Promise.all([
          appApi.getConversations(),
          appApi.getLikes(),
        ]);
        if (isCancelled) return;
        setConversationItems(items);
        setLikesCount(likesResponse.inventory.visibleLikes.length + likesResponse.inventory.hiddenCount);
        failureCount = 0;
      } catch {
        // Ignore transient live errors; manual retry keeps explicit recovery path.
        failureCount += 1;
      } finally {
        inFlight = false;
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const baseDelay = hidden ? 20000 : 5000;
        const nextDelay = Math.min(30000, baseDelay * Math.pow(2, Math.min(failureCount, 3)));
        timerId = window.setTimeout(() => {
          void refreshLive();
        }, nextDelay);
      }
    };

    timerId = window.setTimeout(() => {
      void refreshLive();
    }, 5000);

    return () => {
      isCancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const matchesNode = matchesRef.current;
    const convNode = conversationsRef.current;
    if (!showDesktopRail || !matchesNode || !convNode) return;

    const updateMatches = () => {
      const max = matchesNode.scrollWidth - matchesNode.clientWidth;
      const value = max <= 0 ? 0 : matchesNode.scrollLeft / max;
      setMatchesMaxScroll(Math.max(0, max));
      setMatchesProgress(Math.min(1, Math.max(0, value)));
    };

    const updateConversations = () => {
      const max = convNode.scrollHeight - convNode.clientHeight;
      const value = max <= 0 ? 0 : convNode.scrollTop / max;
      const size = convNode.scrollHeight <= 0 ? 100 : (convNode.clientHeight / convNode.scrollHeight) * 100;
      setConversationsProgress(Math.min(1, Math.max(0, value)));
      setConversationsThumb(Math.max(20, Math.min(100, size)));
    };

    updateMatches();
    updateConversations();

    matchesNode.addEventListener('scroll', updateMatches);
    convNode.addEventListener('scroll', updateConversations);
    window.addEventListener('resize', updateMatches);
    window.addEventListener('resize', updateConversations);

    return () => {
      matchesNode.removeEventListener('scroll', updateMatches);
      convNode.removeEventListener('scroll', updateConversations);
      window.removeEventListener('resize', updateMatches);
      window.removeEventListener('resize', updateConversations);
    };
  }, [showDesktopRail]);

  useEffect(() => {
    if (!showDesktopRail) return;
    const matchesNode = matchesRef.current;
    const convNode = conversationsRef.current;
    if (!matchesNode || !convNode) return;

    const matchesMax = Math.max(0, matchesNode.scrollWidth - matchesNode.clientWidth);
    const matchesValue = matchesMax <= 0 ? 0 : matchesNode.scrollLeft / matchesMax;
    setMatchesMaxScroll(matchesMax);
    setMatchesProgress(Math.min(1, Math.max(0, matchesValue)));

    const convMax = Math.max(0, convNode.scrollHeight - convNode.clientHeight);
    const convValue = convMax <= 0 ? 0 : convNode.scrollTop / convMax;
    const convSize = convNode.scrollHeight <= 0 ? 100 : (convNode.clientHeight / convNode.scrollHeight) * 100;
    setConversationsProgress(Math.min(1, Math.max(0, convValue)));
    setConversationsThumb(Math.max(20, Math.min(100, convSize)));
  }, [showDesktopRail, isLoading]);

  useEffect(() => {
    const node = matchesRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      if (!showDesktopRail) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (node.scrollWidth <= node.clientWidth) return;
      event.preventDefault();
      node.scrollLeft += event.deltaY;
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [showDesktopRail]);

  const handleUserSelect = (id: string) => {
    if (isLarge) {
      setSelectedUserId(id);
    } else {
      navigate(`/chat/${id}`);
    }
  };

  const scrollConversationsFromRail = (clientY: number) => {
    const convNode = conversationsRef.current;
    const railNode = conversationsRailTrackRef.current;
    if (!convNode || !railNode) return;
    const maxScroll = Math.max(0, convNode.scrollHeight - convNode.clientHeight);
    if (maxScroll <= 0) return;
    const bounds = railNode.getBoundingClientRect();
    if (bounds.height <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height));
    convNode.scrollTop = ratio * maxScroll;
  };

  const handleConversationsRailMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    scrollConversationsFromRail(event.clientY);
    const onMove = (moveEvent: MouseEvent) => {
      scrollConversationsFromRail(moveEvent.clientY);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const hasMatches = newMatchItems.length > 0;
  const hasConversations = conversationListItems.length > 0;
  const showContent = !isLoading && !hasError;

  const applyConversationRelationState = (conversationId: string, state: ConversationSummary['relationState']) => {
    setConversationItems((prev) =>
      prev.map((entry) =>
        entry.id === conversationId
          ? {
              ...entry,
              relationState: state,
            }
          : entry,
      ),
    );
  };

  useEffect(() => {
    const unsubscribe = subscribeConversationRelationChange(({ conversationId, state }) => {
      applyConversationRelationState(conversationId, state);
    });
    return unsubscribe;
  }, []);

  const handleQuickBlockToggle = async (conversation: ConversationSummary) => {
    const canToggleQuickBlock =
      conversation.relationState === 'active' || conversation.relationState === 'blocked_by_me';
    if (!canToggleQuickBlock) return;
    const nextState =
      conversation.relationState === 'blocked_by_me' ? 'active' : 'blocked_by_me';

    setActionConversationId(conversation.id);
    setSafetyFeedback('');
    try {
      if (nextState === 'blocked_by_me') {
        await appApi.blockUser(conversation.peer.id);
        await appApi.setConversationRelationState({
          conversationId: conversation.id,
          state: nextState,
        });
        applyConversationRelationState(conversation.id, nextState);
      } else {
        // UX-first unblock: recover relation state even if safety row is already absent.
        await appApi.setConversationRelationState({
          conversationId: conversation.id,
          state: nextState,
        });
        applyConversationRelationState(conversation.id, nextState);
        await appApi.unblockUser(conversation.peer.id).catch(() => undefined);
      }
    } catch {
      setSafetyFeedback(t('chat.actionFailed'));
    } finally {
      setActionConversationId(null);
    }
  };

  const handleQuickReport = async (conversation: ConversationSummary) => {
    setActionConversationId(conversation.id);
    setSafetyFeedback('');
    try {
      await appApi.reportUser({
        userId: conversation.peer.id,
        reason: 'other',
      });
      setSafetyFeedback(t('chat.reportSent'));
    } catch {
      setSafetyFeedback(t('chat.reportFailed'));
    } finally {
      setActionConversationId(null);
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* List Area (Master) */}
      <div className={`group/messages-pane relative flex flex-col ${isLarge ? (isTablet ? 'w-full md:w-[var(--messages-pane-width-md)] xl:w-[var(--messages-pane-width-lg)]' : 'w-full md:w-[var(--messages-pane-width-md)] xl:w-[var(--messages-pane-width-lg)]') + ' border-r border-white/5 overflow-hidden pb-6 pt-6' : 'w-full overflow-y-auto no-scrollbar pt-[var(--messages-header-top)]'} h-full px-[var(--messages-page-x)]`}>
        <div className={`flex items-center justify-between ${isLarge ? (isTablet ? 'mb-6' : 'mb-8') : 'mb-[var(--messages-header-gap)]'}`}>
          <h2 className={`${isLarge ? (isTablet ? 'text-[2.2rem]' : 'text-3xl') : 'text-[length:var(--messages-title-size)]'} font-bold tracking-tight`}>{t('messages.title')}</h2>
          <button onClick={() => navigate('/settings')} className={`glass rounded-full hover-effect flex items-center justify-center ${isLarge ? 'w-12 h-12' : 'w-11 h-11'}`}><ICONS.Settings size={isLarge ? 20 : 18} /></button>
        </div>
        {safetyFeedback && (
          <div className="mb-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center text-[10px] uppercase tracking-[0.12em] font-black text-white/80">
            {safetyFeedback}
          </div>
        )}

        {/* New Matches */}
        <div className={`${isLarge ? 'mb-10' : 'mb-[var(--messages-matches-section-gap)]'} group relative`}>
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">{t('messages.newMatches')}</h3>
          {isLoading ? (
            <div className="glass rounded-2xl border border-white/10 p-4 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
              <span className="text-sm text-white/70">{t('messages.loadingSubtitle')}</span>
            </div>
          ) : hasError ? (
            <div className="glass rounded-2xl border border-red-400/35 bg-red-500/5 p-5 text-center">
              <p className="text-white font-black">{t('messages.errorTitle')}</p>
              <p className="text-xs text-white/60 mt-1">{t('messages.errorSubtitle')}</p>
              <button
                onClick={() => setReloadNonce((prev) => prev + 1)}
                className="mt-3 h-9 px-4 rounded-lg border border-white/20 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black"
              >
                {t('discover.retry')}
              </button>
            </div>
          ) : !hasMatches ? (
            <div className="glass rounded-2xl border border-white/10 p-5 text-center">
              <p className="text-white font-black">{t('messages.emptyMatchesTitle')}</p>
              <p className="text-xs text-white/50 mt-1">{t('messages.emptyMatchesSubtitle')}</p>
            </div>
          ) : (
          <div
            ref={matchesRef}
            className={`flex ${isLarge ? (isTablet ? 'gap-3.5' : 'gap-5') : 'gap-[var(--messages-matches-gap)]'} overflow-x-auto no-scrollbar pb-2 touch-pan-x`}
            style={{ touchAction: 'pan-x' }}
          >
            <div onClick={() => navigate('/likes')} className={`flex flex-col items-center ${isLarge ? (isTablet ? 'gap-2' : 'gap-3') : 'gap-3'} cursor-pointer group`}>
              <div className={`${isLarge ? (isTablet ? 'w-14 h-14' : 'w-16 h-16') : 'w-[var(--messages-match-avatar)] h-[var(--messages-match-avatar)]'} rounded-full gradient-premium p-[2.5px] group-hover:scale-110 transition-transform`}>
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                  <ICONS.Likes size={isLarge ? 24 : 20} className="text-white" />
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t('messages.likesCounter', { count: likesCount })}
              </span>
            </div>
            {newMatchItems.map((conversation) => (
              <div 
                key={conversation.id}
                className={`flex flex-col items-center ${isLarge ? (isTablet ? 'gap-2' : 'gap-3') : 'gap-3'} cursor-pointer group`} 
                onClick={() => handleUserSelect(conversation.peer.id)}
              >
                <div className={`${isLarge ? (isTablet ? 'w-14 h-14' : 'w-20 h-20') : 'w-[var(--messages-match-avatar)] h-[var(--messages-match-avatar)]'} rounded-full overflow-hidden border-2 border-pink-500/30 group-hover:border-pink-500 group-hover:scale-110 transition-all`}>
                  <AvatarImage
                    src={isShadowGhostConversation(conversation) ? '/placeholder.svg' : resolvePhotoUrl(conversation.peer.photos)}
                    name={isShadowGhostConversation(conversation) ? t('likes.shadowGhostMaskedName') : conversation.peer.name}
                    className="w-full h-full rounded-full"
                    imgClassName="w-full h-full object-cover object-[center_22%]"
                  />
                </div>
                <span className="max-w-[6.5rem] truncate text-[10px] font-bold tracking-wider inline-flex items-center gap-1.5">
                  {isShadowGhostConversation(conversation)
                    ? t('likes.shadowGhostMaskedName')
                    : `${conversation.peer.name}, ${conversation.peer.age}`}
                  {isShadowGhostConversation(conversation) && <ICONS.Ghost size={11} className="text-fuchsia-200" />}
                </span>
              </div>
            ))}
          </div>
          )}
          {showDesktopRail && showContent && hasMatches && (
            <div className="mt-3 px-1 h-4">
              <div className="rounded-full p-[1px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500/90 shadow-[0_0_12px_rgba(236,72,153,0.3)] opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
                <div className="relative h-2.5 rounded-full bg-[#09090c]/95 overflow-hidden">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(matchesProgress * 100)}
                    disabled={matchesMaxScroll <= 0}
                    onChange={(e) => {
                      const next = Number(e.target.value) / 100;
                      const node = matchesRef.current;
                      if (!node) return;
                      node.scrollLeft = next * matchesMaxScroll;
                    }}
                    className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent disabled:cursor-default disabled:opacity-50 [&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-pink-400 [&::-webkit-slider-thumb]:via-fuchsia-400 [&::-webkit-slider-thumb]:to-blue-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(236,72,153,0.45)] [&::-moz-range-track]:h-2.5 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-10 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-pink-400"
                    aria-label={t('messages.matchesSliderAria')}
                  />
                  <div
                    className="pointer-events-none absolute top-[2px] bottom-[2px] left-[2px] rounded-full bg-gradient-to-r from-pink-500/75 via-fuchsia-500/75 to-blue-500/75"
                    style={{ width: matchesProgress <= 0 ? '0%' : `calc(${matchesProgress * 100}% - 2px)` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Conversations */}
        <div className={`${isLarge ? 'space-y-3' : 'space-y-[var(--messages-conv-gap)]'} flex-1 min-h-0 relative`}>
          <div className={`${isLarge ? 'rounded-[26px] border border-[var(--messages-zone-border)] bg-[var(--messages-zone-bg)] p-3 h-full min-h-0 flex flex-col' : ''}`}>
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 shrink-0">{t('messages.conversations')}</h3>
          {showContent && !isLarge && (
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/45 mb-3">
              {t('messages.mobileHint')}
            </p>
          )}
          {isLoading ? (
            <div className="glass rounded-2xl border border-white/10 p-5 text-center">
              <div className="w-6 h-6 mx-auto rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
              <p className="text-white font-black mt-3">{t('messages.loadingTitle')}</p>
              <p className="text-xs text-white/50 mt-1">{t('messages.loadingSubtitle')}</p>
            </div>
          ) : hasError ? (
            <div className="glass rounded-2xl border border-red-400/35 bg-red-500/5 p-5 text-center">
              <p className="text-white font-black">{t('messages.errorTitle')}</p>
              <p className="text-xs text-white/60 mt-1">{t('messages.errorSubtitle')}</p>
              <button
                onClick={() => setReloadNonce((prev) => prev + 1)}
                className="mt-3 h-9 px-4 rounded-lg border border-white/20 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black"
              >
                {t('discover.retry')}
              </button>
            </div>
          ) : !hasConversations ? (
            <div className="glass rounded-2xl border border-white/10 p-5 text-center">
              <p className="text-white font-black">{t('messages.emptyConversationsTitle')}</p>
              <p className="text-xs text-white/50 mt-1">{t('messages.emptyConversationsSubtitle')}</p>
            </div>
          ) : (
          <div
            ref={conversationsRef}
            className={`${isLarge ? (isTablet ? 'space-y-2 pr-10 pb-4' : 'space-y-2.5 pr-14 pb-4') + ' flex-1 min-h-0' : 'space-y-[var(--messages-conv-gap)] pr-0 pb-[var(--messages-conv-bottom-pad)] h-full'} overflow-y-auto no-scrollbar touch-pan-y overscroll-contain`}
            style={{ touchAction: 'pan-y' }}
          >
            {conversationListItems.map((conversation) => {
                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleUserSelect(conversation.peer.id)}
                    className={`flex items-center ${isLarge ? (isTablet ? 'gap-2.5 p-3.5 rounded-[20px] min-h-[88px]' : 'gap-4 p-4 rounded-[24px]') : 'gap-[var(--messages-conv-card-gap)] p-[var(--messages-conv-card-pad)] rounded-[var(--messages-conv-card-radius)]'} transition-all cursor-pointer ${
                      isLarge && selectedUserId === conversation.peer.id
                        ? 'bg-[var(--messages-selected-bg)] border border-[var(--messages-selected-border)] shadow-[0_0_18px_rgba(236,72,153,0.18)]'
                        : 'glass border border-transparent hover:bg-white/7'
                    }`}
                    style={conversation.relationState === 'active' ? undefined : { opacity: 0.84 }}
                  >
                    <div className="relative shrink-0">
                      <AvatarImage
                        src={
                          isShadowGhostConversation(conversation)
                            ? '/placeholder.svg'
                            : resolvePhotoUrl(conversation.peer.photos)
                        }
                        name={
                          isShadowGhostConversation(conversation)
                            ? t('likes.shadowGhostMaskedName')
                            : conversation.peer.name
                        }
                        className={`${isLarge ? (isTablet ? 'w-14 h-14 rounded-[18px]' : 'w-16 h-16 rounded-[22px]') : 'w-[var(--messages-conv-avatar)] h-[var(--messages-conv-avatar)] rounded-[var(--messages-conv-avatar-radius)]'}`}
                        imgClassName="w-full h-full object-cover object-[center_20%]"
                      />
                      {canSeeOnlinePresence && conversation.online && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-black" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-start justify-between gap-[var(--messages-conv-header-gap)]">
                        <NameWithBadge
                          name={
                            isShadowGhostConversation(conversation)
                              ? t('likes.shadowGhostMaskedName')
                              : conversation.peer.name
                          }
                          age={conversation.peer.age}
                          ageMasked={isShadowGhostConversation(conversation) || conversation.peer.flags.hideAge}
                          verified={conversation.peer.flags.verifiedIdentity}
                          premiumTier={resolveDisplayPremiumTier(
                            conversation.peer.flags.premiumTier,
                            conversation.peer.flags.shortPassTier,
                          )}
                          size={isTablet ? 'md' : 'lg'}
                          textClassName="truncate max-w-[var(--messages-conv-name-max)]"
                          className="min-w-0 flex-1"
                          premiumBadgeMode="dense"
                          badgeClassName={isTablet ? 'scale-90' : ''}
                        />
                        {isShadowGhostConversation(conversation) && (
                          <ICONS.Ghost size={12} className="mt-1 text-fuchsia-200 shrink-0" />
                        )}
                        <span className="min-w-[var(--messages-conv-time-min-w)] pt-0.5 text-right text-[10px] leading-none text-secondary font-bold shrink-0">
                          {new Date(conversation.lastMessageAtIso).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className={`${isLarge ? (isTablet ? 'text-[11px]' : 'text-xs') : 'text-[length:var(--messages-conv-preview-size)]'} text-secondary/90 line-clamp-1`}>
                        {conversation.lastMessagePreview}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[8px] uppercase tracking-[0.12em] font-black ${
                            conversation.relationState === 'active'
                              ? 'border border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
                              : conversation.relationState === 'blocked_by_me'
                                ? 'border border-orange-300/35 bg-orange-500/12 text-orange-100'
                                : conversation.relationState === 'blocked_me'
                                  ? 'border border-red-300/35 bg-red-500/12 text-red-100'
                                  : 'border border-slate-300/35 bg-slate-500/12 text-slate-100'
                          }`}
                        >
                          {t(`messages.conversationStates.${conversation.relationState}`)}
                        </span>
                        {conversation.receivedSuperLikeTraceAtIso && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] uppercase tracking-[0.1em] font-black border border-fuchsia-300/35 bg-fuchsia-500/12 text-fuchsia-100">
                            {t('messages.receivedSuperLike')}
                          </span>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleQuickBlockToggle(conversation);
                          }}
                          disabled={
                            actionConversationId === conversation.id ||
                            !(conversation.relationState === 'active' || conversation.relationState === 'blocked_by_me')
                          }
                          className="min-h-6 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-[0.1em] font-black border border-orange-300/35 bg-orange-500/12 text-orange-100 disabled:opacity-50 whitespace-nowrap"
                        >
                          {conversation.relationState === 'blocked_by_me' ? t('chat.unblock') : t('chat.block')}
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleQuickReport(conversation);
                          }}
                          disabled={actionConversationId === conversation.id}
                          className="min-h-6 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-[0.1em] font-black border border-red-300/35 bg-red-500/12 text-red-100 disabled:opacity-50 whitespace-nowrap"
                        >
                          {t('chat.report')}
                        </button>
                      </div>
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className={`${isTablet ? 'w-5 h-5' : 'w-5 h-5'} shrink-0 bg-pink-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-pink-500/30`}>
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          )}
          </div>
          {showDesktopRail && showContent && hasConversations && (
            <div className="absolute right-2 top-12 bottom-4 w-4 z-20 flex items-center justify-center overflow-hidden pointer-events-auto">
              <div className="rounded-full p-[1px] bg-gradient-to-b from-pink-500 via-fuchsia-500 to-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.22)]">
                <div
                  ref={conversationsRailTrackRef}
                  onMouseDown={handleConversationsRailMouseDown}
                  className="relative w-2 h-36 rounded-full bg-[#09090c]/95 overflow-hidden cursor-ns-resize"
                >
                  <div
                    className="absolute left-[2px] right-[2px] rounded-full bg-gradient-to-b from-pink-400 via-fuchsia-400 to-blue-400"
                    style={{
                      height: `${conversationsThumb}%`,
                      top: `${conversationsProgress * (100 - conversationsThumb)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Area (Chat) */}
      {isLarge && (
        <div className="flex-1 h-full bg-[rgba(18,20,26,0.58)] relative">
          {selectedUserId ? (
            <ChatScreen embedded userId={selectedUserId} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                <ICONS.Messages size={40} />
              </div>
              <h3 className="text-xl font-bold">{t('messages.selectTitle')}</h3>
              <p className="text-secondary text-sm max-w-xs">{t('messages.selectSubtitle')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagesScreen;
