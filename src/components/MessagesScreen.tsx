import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICONS, MOCK_USERS } from '../types';
import { useDevice } from '../hooks/useDevice';
import ChatScreen from './ChatScreen';
import NameWithBadge from './ui/NameWithBadge';
import { useI18n } from '../i18n/I18nProvider';

const MessagesScreen = () => {
  const navigate = useNavigate();
  const { userId: urlUserId } = useParams();
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { t } = useI18n();
  const isLarge = isDesktop || isTablet;
  
  // For Master-Detail on large screens
  const [selectedUserId, setSelectedUserId] = useState<string | null>(urlUserId || MOCK_USERS[0].id);
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
    handleUserSelect(MOCK_USERS[index].id);
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* List Area (Master) */}
      <div className={`group/messages-pane relative flex flex-col ${isLarge ? (isTablet ? 'w-full md:w-[calc(var(--panel-width-md)+2rem)] xl:w-[calc(var(--panel-width-lg)+1rem)]' : 'w-full md:w-[var(--panel-width-md)] xl:w-[var(--panel-width-lg)]') + ' border-r border-white/5 overflow-hidden pb-6 pt-6' : 'w-full overflow-y-auto no-scrollbar pt-[var(--messages-header-top)]'} h-full px-[var(--page-x)]`}>
        <div className={`flex items-center justify-between ${isLarge ? (isTablet ? 'mb-6' : 'mb-8') : 'mb-[var(--messages-header-gap)]'}`}>
          <h2 className={`${isLarge ? (isTablet ? 'text-[2.2rem]' : 'text-3xl') : 'text-[length:var(--messages-title-size)]'} font-bold tracking-tight`}>{t('messages.title')}</h2>
          <button onClick={() => navigate('/settings')} className={`glass rounded-full hover-effect flex items-center justify-center ${isLarge ? 'w-12 h-12' : 'w-11 h-11'}`}><ICONS.Settings size={isLarge ? 20 : 18} /></button>
        </div>

        {/* New Matches */}
        <div className={`${isLarge ? 'mb-10' : 'mb-[var(--messages-matches-section-gap)]'} group/matches relative`}>
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">{t('messages.newMatches')}</h3>
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
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('messages.likesCounter')}</span>
            </div>
            {MOCK_USERS.map(user => (
              <div 
                key={user.id} 
                className={`flex flex-col items-center ${isLarge ? (isTablet ? 'gap-2' : 'gap-3') : 'gap-3'} cursor-pointer group`} 
                onClick={() => handleUserSelect(user.id)}
              >
                <div className={`${isLarge ? (isTablet ? 'w-14 h-14' : 'w-20 h-20') : 'w-[var(--messages-match-avatar)] h-[var(--messages-match-avatar)]'} rounded-full overflow-hidden border-2 border-pink-500/30 group-hover:border-pink-500 group-hover:scale-110 transition-all`}>
                  <img src={user.photos[0]} className="w-full h-full object-cover" alt={user.name} referrerPolicy="no-referrer" />
                </div>
                <span className="text-[10px] font-bold tracking-wider">{user.name}, {user.age}</span>
              </div>
            ))}
          </div>
          {isLarge && !isTouch && (
            <div className="mt-3 px-1 h-4 group/matches-slider">
              <div className="rounded-full p-[1px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500/90 shadow-[0_0_12px_rgba(236,72,153,0.3)] opacity-0 transition-opacity duration-200 group-hover/matches-slider:opacity-100 group-focus-within/matches-slider:opacity-100">
                <div className="relative h-2.5 rounded-full bg-[#09090c]/95 overflow-hidden">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(matchesProgress * 100)}
                    onChange={(e) => {
                      const next = Number(e.target.value) / 100;
                      const node = matchesRef.current;
                      if (!node) return;
                      node.scrollLeft = next * matchesMaxScroll;
                    }}
                    className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-pink-400 [&::-webkit-slider-thumb]:via-fuchsia-400 [&::-webkit-slider-thumb]:to-blue-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(236,72,153,0.45)] [&::-moz-range-track]:h-2.5 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-10 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-pink-400"
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
          <div
            ref={conversationsRef}
            className={`${isLarge ? (isTablet ? 'space-y-2 pr-10 pb-4' : 'space-y-2.5 pr-14 pb-4') + ' flex-1 min-h-0' : 'space-y-[var(--messages-conv-gap)] pr-0 pb-[var(--messages-conv-bottom-pad)] h-full'} overflow-y-auto no-scrollbar touch-pan-y overscroll-contain`}
            style={{ touchAction: 'pan-y' }}
          >
            {MOCK_USERS.map((user, index) => (
              <div 
                key={user.id}
                ref={(el) => {
                  conversationItemRefs.current[index] = el;
                }}
                onClick={() => handleUserSelect(user.id)}
                className={`flex items-center ${isLarge ? (isTablet ? 'gap-2.5 p-3.5 rounded-[20px] min-h-[88px]' : 'gap-4 p-4 rounded-[24px]') : 'gap-[var(--messages-conv-card-gap)] p-[var(--messages-conv-card-pad)] rounded-[var(--messages-conv-card-radius)]'} transition-all cursor-pointer ${
                  isLarge && selectedUserId === user.id 
                  ? 'bg-[var(--messages-selected-bg)] border border-[var(--messages-selected-border)] shadow-[0_0_18px_rgba(236,72,153,0.18)]' 
                  : 'glass border border-transparent hover:bg-white/7'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={user.photos[0]} className={`${isLarge ? (isTablet ? 'w-14 h-14 rounded-[18px]' : 'w-16 h-16 rounded-[22px]') : 'w-[var(--messages-conv-avatar)] h-[var(--messages-conv-avatar)] rounded-[var(--messages-conv-avatar-radius)]'} object-cover`} alt={user.name} referrerPolicy="no-referrer" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 mb-1">
                    <NameWithBadge
                      name={user.name}
                      age={user.age}
                      verified={user.verified}
                      size={isTablet ? 'md' : 'lg'}
                      textClassName="truncate"
                      badgeClassName={isTablet ? 'scale-90' : ''}
                    />
                    <span className="text-[10px] text-secondary font-bold shrink-0">14:20</span>
                  </div>
                  <p className={`${isLarge ? (isTablet ? 'text-[11px]' : 'text-xs') : 'text-[length:var(--messages-conv-preview-size)]'} text-secondary/90 line-clamp-1`}>{t('messages.preview')}</p>
                </div>
                <div className={`${isTablet ? 'w-5 h-5' : 'w-5 h-5'} shrink-0 bg-pink-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-pink-500/30`}>2</div>
              </div>
            ))}
          </div>
          </div>
          {isLarge && !isTouch && (
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
                {MOCK_USERS.map((user, index) => (
                  <button
                    key={`jump-${user.id}`}
                    onClick={() => jumpToConversation(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      selectedUserId === user.id ? 'bg-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.6)]' : 'bg-white/30 hover:bg-white/60'
                    }`}
                    aria-label={t('messages.jumpConversation', { name: user.name })}
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
