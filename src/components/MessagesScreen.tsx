import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICONS } from '../types';
import { useDevice } from '../hooks/useDevice';
import ChatScreen from './ChatScreen';
import NameWithBadge from './ui/NameWithBadge';
import { useI18n } from '../i18n/I18nProvider';
import { appApi } from '../services';
import { useRuntimeSelector } from '../state';
import type { ConversationSummary } from '../contracts';

const MessagesScreen = () => {
  const navigate = useNavigate();
  const { userId: urlUserId } = useParams();
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { t } = useI18n();
  const isLarge = isDesktop || isTablet;
  const likesCount = useRuntimeSelector((payload) => payload.likes.length);
  const conversationsRefreshKey = useRuntimeSelector((payload) =>
    payload.conversations
      .map((entry) => `${entry.id}:${entry.lastMessageAtIso}:${entry.unreadCount}:${entry.relationState}`)
      .join('|'),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [conversationItems, setConversationItems] = useState<ConversationSummary[]>([]);
  
  // For Master-Detail on large screens
  const [selectedUserId, setSelectedUserId] = useState<string | null>(urlUserId || null);
  const [matchesProgress, setMatchesProgress] = useState(0);
  const [matchesMaxScroll, setMatchesMaxScroll] = useState(0);
  const [conversationsProgress, setConversationsProgress] = useState(0);
  const [conversationsThumb, setConversationsThumb] = useState(30);
  const matchesRef = useRef<HTMLDivElement | null>(null);
  const conversationsRef = useRef<HTMLDivElement | null>(null);
  const conversationItemRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (urlUserId) setSelectedUserId(urlUserId);
  }, [urlUserId]);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    appApi
      .getConversations()
      .then((items) => {
        setConversationItems(items);
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
  }, [conversationsRefreshKey, urlUserId]);

  useEffect(() => {
    const matchesNode = matchesRef.current;
    const convNode = conversationsRef.current;
    if (!isLarge || !matchesNode || !convNode) return;

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
  }, [isLarge]);

  useEffect(() => {
    if (!isLarge) return;
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
  }, [isLarge, isLoading]);

  useEffect(() => {
    const node = matchesRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      if (!isLarge) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (node.scrollWidth <= node.clientWidth) return;
      event.preventDefault();
      node.scrollLeft += event.deltaY;
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [isLarge]);

  const handleUserSelect = (id: string) => {
    if (isLarge) {
      setSelectedUserId(id);
    } else {
      navigate(`/chat/${id}`);
    }
  };

  const jumpToConversation = (index: number) => {
    const node = conversationItemRefs.current[index];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const target = conversationItems[index];
    if (target) handleUserSelect(target.peer.id);
  };

  const hasMatches = conversationItems.length > 0;
  const hasConversations = conversationItems.length > 0;
  const showContent = !isLoading && !hasError;

  return (
    <div className="h-full flex overflow-hidden">
      {/* List Area (Master) */}
      <div className={`group/messages-pane relative flex flex-col ${isLarge ? (isTablet ? 'w-full md:w-[calc(var(--panel-width-md)+2rem)] xl:w-[calc(var(--panel-width-lg)+1rem)]' : 'w-full md:w-[var(--panel-width-md)] xl:w-[var(--panel-width-lg)]') + ' border-r border-white/5 overflow-hidden pb-6 pt-6' : 'w-full overflow-y-auto no-scrollbar pt-[var(--messages-header-top)]'} h-full px-[var(--page-x)]`}>
        <div className={`flex items-center justify-between ${isLarge ? (isTablet ? 'mb-6' : 'mb-8') : 'mb-[var(--messages-header-gap)]'}`}>
          <h2 className={`${isLarge ? (isTablet ? 'text-[2.2rem]' : 'text-3xl') : 'text-[length:var(--messages-title-size)]'} font-bold tracking-tight`}>{t('messages.title')}</h2>
          <button onClick={() => navigate('/settings')} className={`glass rounded-full hover-effect flex items-center justify-center ${isLarge ? 'w-12 h-12' : 'w-11 h-11'}`}><ICONS.Settings size={isLarge ? 20 : 18} /></button>
        </div>

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
            {conversationItems.map((conversation) => (
              <div 
                key={conversation.id}
                className={`flex flex-col items-center ${isLarge ? (isTablet ? 'gap-2' : 'gap-3') : 'gap-3'} cursor-pointer group`} 
                onClick={() => handleUserSelect(conversation.peer.id)}
              >
                <div className={`${isLarge ? (isTablet ? 'w-14 h-14' : 'w-20 h-20') : 'w-[var(--messages-match-avatar)] h-[var(--messages-match-avatar)]'} rounded-full overflow-hidden border-2 border-pink-500/30 group-hover:border-pink-500 group-hover:scale-110 transition-all`}>
                  <img src={conversation.peer.photos[0]} className="w-full h-full object-cover" alt={conversation.peer.name} referrerPolicy="no-referrer" />
                </div>
                <span className="max-w-[6.5rem] truncate text-[10px] font-bold tracking-wider">
                  {conversation.peer.name}, {conversation.peer.age}
                </span>
              </div>
            ))}
          </div>
          )}
          {isLarge && showContent && hasMatches && (
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
            {conversationItems.map((conversation, index) => (
              <div 
                key={conversation.id}
                ref={(el) => {
                  conversationItemRefs.current[index] = el;
                }}
                onClick={() => handleUserSelect(conversation.peer.id)}
                className={`flex items-center ${isLarge ? (isTablet ? 'gap-2.5 p-3.5 rounded-[20px] min-h-[88px]' : 'gap-4 p-4 rounded-[24px]') : 'gap-[var(--messages-conv-card-gap)] p-[var(--messages-conv-card-pad)] rounded-[var(--messages-conv-card-radius)]'} transition-all cursor-pointer ${
                  isLarge && selectedUserId === conversation.peer.id 
                  ? 'bg-[var(--messages-selected-bg)] border border-[var(--messages-selected-border)] shadow-[0_0_18px_rgba(236,72,153,0.18)]' 
                  : 'glass border border-transparent hover:bg-white/7'
                }`}
                style={conversation.relationState === 'active' ? undefined : { opacity: 0.84 }}
              >
                <div className="relative shrink-0">
                  <img src={conversation.peer.photos[0]} className={`${isLarge ? (isTablet ? 'w-14 h-14 rounded-[18px]' : 'w-16 h-16 rounded-[22px]') : 'w-[var(--messages-conv-avatar)] h-[var(--messages-conv-avatar)] rounded-[var(--messages-conv-avatar-radius)]'} object-cover`} alt={conversation.peer.name} referrerPolicy="no-referrer" />
                  {conversation.online && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-black" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 mb-1">
                    <NameWithBadge
                      name={conversation.peer.name}
                      age={conversation.peer.age}
                      ageMasked={conversation.peer.flags.hideAge}
                      verified={conversation.peer.flags.verifiedIdentity}
                      premiumTier={conversation.peer.flags.premiumTier}
                      size={isTablet ? 'md' : 'lg'}
                      textClassName="truncate"
                      badgeClassName={isTablet ? 'scale-90' : ''}
                    />
                    <span className="text-[10px] text-secondary font-bold shrink-0">
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
                      <span className="text-[9px] uppercase tracking-[0.12em] text-fuchsia-200">
                        {t('messages.receivedSuperLike')}
                      </span>
                    )}
                  </div>
                </div>
                {conversation.unreadCount > 0 && (
                  <div className={`${isTablet ? 'w-5 h-5' : 'w-5 h-5'} shrink-0 bg-pink-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-pink-500/30`}>
                    {conversation.unreadCount}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
          </div>
          {isLarge && !isTouch && showContent && hasConversations && (
            <div className="absolute right-1 top-8 bottom-0 w-11 z-20 pointer-events-none">
              <div className="group/messages-rail h-full w-full flex items-center justify-center pointer-events-auto opacity-0 transition-opacity duration-300 group-hover/messages-pane:opacity-100 group-hover/messages-rail:opacity-100">
              <div className="rounded-full p-[1px] bg-gradient-to-b from-pink-500 via-fuchsia-500 to-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.25)]">
                <div className="relative w-2.5 h-40 rounded-full bg-[#09090c]/95 overflow-hidden">
                  <div
                    className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-pink-400 via-fuchsia-400 to-blue-400"
                    style={{
                      height: `${conversationsThumb}%`,
                      top: `${conversationsProgress * (100 - conversationsThumb)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="ml-1 flex flex-col gap-2">
                {conversationItems.map((conversation, index) => (
                  <button
                    key={`jump-${conversation.id}`}
                    onClick={() => jumpToConversation(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      selectedUserId === conversation.peer.id ? 'bg-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.6)]' : 'bg-white/30 hover:bg-white/60'
                    }`}
                    aria-label={t('messages.jumpConversation', { name: conversation.peer.name })}
                  />
                ))}
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
