import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useParams, useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import { useDevice } from '../hooks/useDevice';
import NameWithBadge from './ui/NameWithBadge';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useI18n } from '../i18n/I18nProvider';
import { appApi, authApi, subscribeConversationRelationChange } from '../services';
import type { ChatMessage, ConversationSummary, PlanTier } from '../contracts';

interface ChatScreenProps {
  embedded?: boolean;
  userId?: string;
}

const formatTime = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const resolveDisplayPremiumTier = (tier: PlanTier, shortPassTier?: 'day' | 'week'): PlanTier => {
  if (tier !== 'free') return tier;
  return shortPassTier ? 'essential' : 'free';
};

const resolvePhotoUrl = (photos: string[] | undefined): string => {
  if (!Array.isArray(photos)) return '/placeholder.svg';
  const direct = photos.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return direct ?? '/placeholder.svg';
};

const resolveChatTargetLocale = (
  targetLang: string | null | undefined,
  fallbackLocale: string,
): 'en' | 'ru' => {
  if (targetLang === 'ru') return 'ru';
  if (targetLang === 'en') return 'en';
  if (fallbackLocale === 'ru') return 'ru';
  return 'en';
};

const ChatScreen = ({ embedded, userId: propUserId }: ChatScreenProps) => {
  const { userId: routeUserId } = useParams();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { isTablet, isTouch } = useDevice();
  const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [isApplyingSafetyAction, setIsApplyingSafetyAction] = useState(false);
  const [safetyFeedback, setSafetyFeedback] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [translationTargetLocale, setTranslationTargetLocale] = useState<'en' | 'ru'>(
    locale === 'ru' ? 'ru' : 'en',
  );
  const userId = propUserId || routeUserId;

  const containerProps = embedded
    ? {
        className: 'h-full w-full bg-transparent flex flex-col relative',
      }
    : {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        className: 'absolute inset-0 z-50 bg-black flex flex-col',
      };

  useEffect(() => {
    let isCancelled = false;

    const hydrateTranslationTarget = async () => {
      try {
        const profileResponse = await authApi.getProfileMe();
        if (!isCancelled && profileResponse.ok) {
          const nextTarget = resolveChatTargetLocale(profileResponse.data?.settings?.target_lang, locale);
          setTranslationTargetLocale(nextTarget);
        }
      } catch {
        if (!isCancelled) {
          setTranslationTargetLocale(locale === 'ru' ? 'ru' : 'en');
        }
      }
    };

    void hydrateTranslationTarget();

    return () => {
      isCancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (!userId) {
      if (!embedded) navigate('/messages', { replace: true });
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setHasError(false);

    const load = async () => {
      try {
        const ensuredConversationId = await appApi.openChat(userId);
        if (isCancelled) return;
        const list = await appApi.getConversations();
        if (isCancelled) return;
        const selectedConversation =
          list.find((entry) => entry.id === ensuredConversationId) ??
          list.find((entry) => entry.peer.id === userId);

        if (!selectedConversation) {
          if (!embedded) navigate('/messages', { replace: true });
          return;
        }

        setConversation(selectedConversation);
        setConversationId(selectedConversation.id);
        setShowTranslation(appApi.isTranslationEnabled(selectedConversation.id));
        const history = await appApi.getMessages(selectedConversation.id);
        if (isCancelled) return;
        setMessages(history);
        if (selectedConversation.unreadCount > 0) {
          void appApi.markConversationRead(selectedConversation.id);
        }
      } catch {
        if (!isCancelled) {
          setHasError(true);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [userId, embedded, navigate, reloadNonce]);

  useEffect(() => {
    if (!conversationId) return;
    let isCancelled = false;
    let inFlight = false;
    let failureCount = 0;
    let timerId: number | null = null;

    const refreshLive = async () => {
      if (isCancelled) return;
      if (inFlight) return;
      inFlight = true;
      try {
        const [history, list] = await Promise.all([
          appApi.getMessages(conversationId),
          appApi.getConversations(),
        ]);
        if (isCancelled) return;
        setMessages(history);
        const nextConversation =
          list.find((entry) => entry.id === conversationId) ??
          list.find((entry) => entry.peer.id === userId);
        if (nextConversation) {
          setConversation(nextConversation);
          if (nextConversation.unreadCount > 0) {
            void appApi.markConversationRead(nextConversation.id);
          }
        }
        failureCount = 0;
      } catch {
        // Keep UI stable; live refresh silently retries on next tick.
        failureCount += 1;
      } finally {
        inFlight = false;
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const baseDelay = hidden ? 18000 : 4000;
        const nextDelay = Math.min(30000, baseDelay * Math.pow(2, Math.min(failureCount, 3)));
        timerId = window.setTimeout(() => {
          void refreshLive();
        }, nextDelay);
      }
    };

    timerId = window.setTimeout(() => {
      void refreshLive();
    }, 4000);

    return () => {
      isCancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    const unsubscribe = subscribeConversationRelationChange(({ conversationId: changedConversationId, state }) => {
      setConversation((prev) => {
        if (!prev || prev.id !== changedConversationId) return prev;
        return {
          ...prev,
          relationState: state,
        };
      });
    });
    return unsubscribe;
  }, []);

  const activePeer = conversation?.peer;
  const relationState = conversation?.relationState ?? 'active';
  const isConversationRestricted = relationState !== 'active';
  const canToggleBlock = relationState === 'active' || relationState === 'blocked_by_me';

  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime(),
      ),
    [messages],
  );

  const handleToggleTranslation = () => {
    if (!conversationId) return;
    const next = !showTranslation;
    setShowTranslation(next);
    void appApi.setTranslationToggle({
      conversationId,
      enabled: next,
      targetLocale: translationTargetLocale,
    });
  };

  const handleSend = () => {
    if (!conversationId || !draft.trim() || isConversationRestricted) return;
    const text = draft.trim();
    setDraft('');
    void appApi.sendMessage({ conversationId, text }).then((response) => {
      if (response.status === 'sent' && response.message) {
        setMessages((prev) => [...prev, response.message]);
      }
    });
  };

  const handleToggleBlock = () => {
    if (!conversationId || !conversation || !canToggleBlock) return;
    const nextState = conversation.relationState === 'blocked_by_me' ? 'active' : 'blocked_by_me';
    const syncBlockState = async () => {
      setIsApplyingSafetyAction(true);
      setSafetyFeedback('');
      try {
        if (nextState === 'blocked_by_me') {
          await appApi.blockUser(conversation.peer.id);
        } else {
          await appApi.unblockUser(conversation.peer.id);
        }

        const response = await appApi.setConversationRelationState({
          conversationId,
          state: nextState,
        });

        setConversation((prev) =>
          prev
            ? {
                ...prev,
                relationState: response.state,
              }
            : prev,
        );
      } catch {
        setSafetyFeedback(t('chat.actionFailed'));
      } finally {
        setIsApplyingSafetyAction(false);
        setShowSafetyMenu(false);
      }
    };

    void syncBlockState();
  };

  const reportPeer = (reason: 'spam' | 'scam' | 'abuse' | 'fake_profile' | 'other') => {
    if (!conversation) return;

    const executeReport = async () => {
      setIsApplyingSafetyAction(true);
      setSafetyFeedback('');
      try {
        await appApi.reportUser({
          userId: conversation.peer.id,
          reason,
        });
        setSafetyFeedback(t('chat.reportSent'));
      } catch {
        setSafetyFeedback(t('chat.reportFailed'));
      } finally {
        setIsApplyingSafetyAction(false);
        setShowSafetyMenu(false);
      }
    };

    void executeReport();
  };

  if (!activePeer && isLoading) {
    return (
      <motion.div {...containerProps}>
        <div className="h-full flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/75 animate-spin" />
        </div>
      </motion.div>
    );
  }

  if (!activePeer || hasError) {
    return (
      <motion.div {...containerProps}>
        <div className="h-full flex flex-col items-center justify-center text-center px-8 space-y-4">
          <ICONS.Info size={24} className="text-red-300" />
          <p className="font-black text-white">{t('chat.errorTitle')}</p>
          <p className="text-sm text-white/60">{t('chat.errorSubtitle')}</p>
          <button
            onClick={() => setReloadNonce((prev) => prev + 1)}
            className="h-10 px-4 rounded-xl border border-white/20 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black"
          >
            {t('discover.retry')}
          </button>
          {!embedded && (
            <button
              onClick={() => navigate('/messages', { replace: true })}
              className="h-10 px-4 rounded-xl border border-white/20 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black"
            >
              {t('chat.backToMessages')}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...containerProps}>
      <div
        className={`${
          embedded ? (isTablet ? 'p-3.5' : 'p-4') : 'px-[var(--page-x)] py-4'
        } border-b border-white/10 bg-black/55 backdrop-blur-lg flex items-center justify-between shrink-0`}
      >
        <div className={`flex items-center ${isTablet ? 'gap-3' : 'gap-4'}`}>
          {!embedded && (
            <button
              onClick={() => navigate('/messages')}
              className="p-2 hover-effect rounded-full"
            >
              <ICONS.ChevronLeft />
            </button>
          )}
          <div className="relative">
            <img
              src={resolvePhotoUrl(activePeer.photos)}
              className="w-10 h-10 rounded-[14px] object-cover"
              alt={activePeer.name}
              referrerPolicy="no-referrer"
            />
            {conversation?.online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
            )}
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <NameWithBadge
              name={activePeer.name}
              age={activePeer.age}
              ageMasked={activePeer.flags.hideAge}
              verified={activePeer.flags.verifiedIdentity}
              premiumTier={resolveDisplayPremiumTier(
                activePeer.flags.premiumTier,
                activePeer.flags.shortPassTier,
              )}
              size="md"
              premiumBadgeMode="dense"
              className="w-fit"
            />
            <span
              className={`pl-0.5 text-[9px] uppercase font-black tracking-widest ${
                relationState === 'active'
                  ? 'text-green-400'
                  : relationState === 'blocked_by_me'
                    ? 'text-orange-300'
                    : relationState === 'blocked_me'
                      ? 'text-red-300'
                      : 'text-slate-300'
              }`}
            >
              {t(`chat.conversationStates.${relationState}`)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canToggleBlock && (
            <button
              onClick={handleToggleBlock}
              disabled={isApplyingSafetyAction}
              className={`h-10 px-3 rounded-full text-[9px] font-black uppercase tracking-[0.14em] transition-colors ${
                relationState === 'blocked_by_me'
                  ? 'border border-emerald-300/35 bg-emerald-500/10 text-emerald-100'
                  : 'border border-orange-300/35 bg-orange-500/10 text-orange-100'
              } ${isApplyingSafetyAction ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {relationState === 'blocked_by_me' ? t('chat.unblock') : t('chat.block')}
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowSafetyMenu((prev) => !prev)}
              className="w-11 h-11 glass rounded-full text-secondary hover:text-white transition-all flex items-center justify-center"
            >
              <ICONS.Shield size={18} />
            </button>
            {showSafetyMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-white/15 bg-[#0c0f15]/95 p-2 shadow-2xl z-20">
                <p className="px-2 py-1 text-[9px] uppercase tracking-[0.14em] font-black text-white/55">
                  {t('chat.safetyActions')}
                </p>
                <button
                  onClick={() => reportPeer('spam')}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/10"
                >
                  {t('chat.reportReasonSpam')}
                </button>
                <button
                  onClick={() => reportPeer('scam')}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/10"
                >
                  {t('chat.reportReasonScam')}
                </button>
                <button
                  onClick={() => reportPeer('abuse')}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/10"
                >
                  {t('chat.reportReasonAbuse')}
                </button>
                <button
                  onClick={() => reportPeer('fake_profile')}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/10"
                >
                  {t('chat.reportReasonFakeProfile')}
                </button>
                <button
                  onClick={() => reportPeer('other')}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/10"
                >
                  {t('chat.reportReasonOther')}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleToggleTranslation}
            className={`w-11 h-11 rounded-full transition-all flex items-center justify-center ${
              showTranslation
                ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                : 'glass text-secondary hover:text-white'
            }`}
          >
            <ICONS.Languages size={18} />
          </button>
          {embedded && (
            <button className="w-11 h-11 glass rounded-full text-secondary hover:text-white transition-all flex items-center justify-center">
              <ICONS.Info size={18} />
            </button>
          )}
        </div>
      </div>

      <div
        className={`${
          embedded
            ? isTablet
              ? 'max-w-none pb-10'
              : 'max-w-none pb-6'
            : 'container-chat pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+4.5rem)]'
        } w-full flex-1 overflow-y-auto px-[var(--page-x)] py-6 space-y-6 no-scrollbar`}
        style={
          isTouch && embedded
            ? { paddingBottom: `calc(${isTablet ? '2.5rem' : '2rem'} + ${keyboardInset}px + env(safe-area-inset-bottom))` }
            : undefined
        }
      >
        <div className="flex justify-center">
          <span className="glass px-4 py-1 rounded-full text-[9px] font-black text-secondary uppercase tracking-[0.2em]">
            {t('chat.today')}
          </span>
        </div>

        {conversation.receivedSuperLikeTraceAtIso && (
          <div className="mx-auto max-w-[24rem] rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/10 px-4 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-200">
              {t('chat.superLikeTrace')}
            </p>
          </div>
        )}

        {isConversationRestricted && (
          <div
            className={`mx-auto max-w-[26rem] rounded-2xl px-4 py-2 text-center border ${
              relationState === 'blocked_by_me'
                ? 'border-orange-300/35 bg-orange-500/10'
                : relationState === 'blocked_me'
                  ? 'border-red-300/35 bg-red-500/10'
                  : 'border-slate-300/35 bg-slate-500/10'
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
              {t(`chat.restrictions.${relationState}.title`)}
            </p>
            <p className="mt-1 text-xs text-white/70">{t(`chat.restrictions.${relationState}.subtitle`)}</p>
          </div>
        )}

        {orderedMessages.map((message) => {
          const isIncoming = message.direction === 'incoming';
          if (isIncoming) {
            return (
              <div key={message.id} className="flex gap-3 max-w-[86%] md:max-w-[74%] lg:max-w-[68%] xl:max-w-[62%]">
                <img
                  src={resolvePhotoUrl(activePeer.photos)}
                  className="w-8 h-8 rounded-xl object-cover self-end shrink-0"
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="space-y-1.5">
                  <div className="p-4 rounded-[24px] rounded-bl-none text-sm leading-relaxed bg-[#111319] border border-white/10">
                    {message.originalText}
                  </div>
                  {showTranslation && message.translatedText && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-pink-400 font-bold px-3 flex items-center gap-1.5"
                    >
                      <ICONS.Languages size={10} /> {t('chat.translationLabel')}: {message.translatedText}
                    </motion.div>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className="flex flex-col items-end gap-1.5 ml-auto max-w-[86%] md:max-w-[74%] lg:max-w-[68%] xl:max-w-[62%]"
            >
              <div className="gradient-premium p-4 rounded-[24px] rounded-br-none text-sm leading-relaxed shadow-lg shadow-pink-500/10">
                {message.originalText}
              </div>
              <span className="text-[9px] font-bold text-secondary pr-2 uppercase tracking-widest">
                {message.readAtIso
                  ? `${t('chat.readAtLabel')} ${formatTime(message.readAtIso)}`
                  : formatTime(message.createdAtIso)}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className={`${
          embedded
            ? 'p-4 sticky bottom-0 z-20 bg-black/35 backdrop-blur-lg'
            : 'px-[var(--page-x)] pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3'
        } shrink-0 ${
          embedded ? '' : 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent'
        }`}
        style={!embedded && isTouch ? { bottom: `${keyboardInset}px` } : undefined}
      >
        {safetyFeedback && (
          <div className="mx-auto mb-2 max-w-[26rem] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center text-[10px] uppercase tracking-[0.12em] font-black text-white/80">
            {safetyFeedback}
          </div>
        )}
        <div
          className={`${
            embedded ? '' : 'container-chat'
          } rounded-[28px] p-1.5 flex items-center gap-2 border border-white/10 bg-[#0f1118]/92 backdrop-blur-xl focus-within:border-white/25 transition-all`}
        >
          <button className="p-3 text-secondary hover:text-white transition-colors rounded-full hover:bg-white/5">
            <ICONS.Globe size={20} />
          </button>
          <input
            type="text"
            value={draft}
            disabled={isConversationRestricted}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isConversationRestricted ? t(`chat.restrictions.${relationState}.inputPlaceholder`) : t('chat.placeholder')
            }
            className="flex-1 bg-transparent outline-none text-sm px-2 placeholder:text-white/20 disabled:text-white/40"
          />
          <button
            onClick={handleSend}
            disabled={isConversationRestricted || !draft.trim()}
            className="w-11 h-11 gradient-premium rounded-full flex items-center justify-center shadow-xl shadow-pink-500/20 active:scale-90 transition-transform disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <ICONS.Send size={20} />
          </button>
        </div>
        {isTouch && isKeyboardOpen && <div className="h-[max(env(safe-area-inset-bottom),0px)]" />}
      </div>
    </motion.div>
  );
};

export default ChatScreen;
