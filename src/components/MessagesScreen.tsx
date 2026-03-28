import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICONS, MOCK_USERS } from '../types';
import { useDevice } from '../hooks/useDevice';
import ChatScreen from './ChatScreen';
import NameWithBadge from './ui/NameWithBadge';

const MessagesScreen = () => {
  const navigate = useNavigate();
  const { userId: urlUserId } = useParams();
  const { isDesktop, isTablet } = useDevice();
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
      <div className={`group/messages-pane relative flex flex-col ${isLarge ? 'w-full md:w-[var(--panel-width-md)] xl:w-[var(--panel-width-lg)] border-r border-white/5 overflow-hidden pb-6 pt-6' : 'w-full overflow-y-auto no-scrollbar pt-[var(--messages-header-top)]'} h-full px-[var(--page-x)]`}>
        <div className={`flex items-center justify-between ${isLarge ? 'mb-8' : 'mb-[var(--messages-header-gap)]'}`}>
          <h2 className={`${isLarge ? 'text-3xl' : 'text-[length:var(--messages-title-size)]'} font-bold tracking-tight`}>Messages</h2>
          <button onClick={() => navigate('/settings')} className={`glass ${isLarge ? 'p-2.5' : 'p-[var(--messages-settings-pad)]'} rounded-full hover-effect`}><ICONS.Settings size={isLarge ? 20 : 18} /></button>
        </div>

        {/* New Matches */}
        <div className={`${isLarge ? 'mb-10' : 'mb-[var(--messages-matches-section-gap)]'} group/matches relative`}>
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">Nouveaux matches</h3>
          <div ref={matchesRef} className={`flex ${isLarge ? 'gap-5' : 'gap-[var(--messages-matches-gap)]'} overflow-x-auto no-scrollbar pb-2`}>
            <div onClick={() => navigate('/likes')} className="flex flex-col items-center gap-3 cursor-pointer group">
              <div className={`${isLarge ? 'w-16 h-16' : 'w-[var(--messages-match-avatar)] h-[var(--messages-match-avatar)]'} rounded-full gradient-premium p-[2.5px] group-hover:scale-110 transition-transform`}>
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                  <ICONS.Likes size={isLarge ? 24 : 20} className="text-white" />
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">99+ Likes</span>
            </div>
            {MOCK_USERS.map(user => (
              <div 
                key={user.id} 
                className="flex flex-col items-center gap-3 cursor-pointer group" 
                onClick={() => handleUserSelect(user.id)}
              >
                <div className={`${isLarge ? 'w-20 h-20' : 'w-[var(--messages-match-avatar)] h-[var(--messages-match-avatar)]'} rounded-full overflow-hidden border-2 border-pink-500/30 group-hover:border-pink-500 group-hover:scale-110 transition-all`}>
                  <img src={user.photos[0]} className="w-full h-full object-cover" alt={user.name} referrerPolicy="no-referrer" />
                </div>
                <span className="text-[10px] font-bold tracking-wider">{user.name}, {user.age}</span>
              </div>
            ))}
          </div>
          {isLarge && (
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
                    aria-label="Naviguer entre les nouveaux matches"
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
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">Conversations</h3>
          <div ref={conversationsRef} className={`${isLarge ? 'space-y-3 pr-14' : 'space-y-[var(--messages-conv-gap)] pr-0 pb-[var(--messages-conv-bottom-pad)]'} overflow-y-auto no-scrollbar h-full`}>
            {MOCK_USERS.map((user, index) => (
              <div 
                key={user.id}
                ref={(el) => {
                  conversationItemRefs.current[index] = el;
                }}
                onClick={() => handleUserSelect(user.id)}
                className={`flex items-center ${isLarge ? 'gap-4 p-4 rounded-[28px]' : 'gap-[var(--messages-conv-card-gap)] p-[var(--messages-conv-card-pad)] rounded-[var(--messages-conv-card-radius)]'} transition-all cursor-pointer ${
                  isLarge && selectedUserId === user.id 
                  ? 'bg-white/10 border border-white/10 shadow-lg' 
                  : 'glass border border-transparent hover:bg-white/5'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={user.photos[0]} className={`${isLarge ? 'w-16 h-16 rounded-[22px]' : 'w-[var(--messages-conv-avatar)] h-[var(--messages-conv-avatar)] rounded-[var(--messages-conv-avatar-radius)]'} object-cover`} alt={user.name} referrerPolicy="no-referrer" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1 gap-2">
                    <NameWithBadge
                      name={user.name}
                      age={user.age}
                      verified={user.verified}
                      size="lg"
                      textClassName="truncate"
                    />
                    <span className="text-[10px] text-secondary font-bold shrink-0">14:20</span>
                  </div>
                  <p className={`${isLarge ? 'text-xs' : 'text-[length:var(--messages-conv-preview-size)]'} text-secondary line-clamp-1`}>Hey! I saw your profile and loved your photography...</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-pink-500/30">2</div>
                </div>
              </div>
            ))}
          </div>
          {isLarge && (
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
                    aria-label={`Aller a la conversation ${user.name}`}
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
        <div className="flex-1 h-full bg-zinc-950/50 relative">
          {selectedUserId ? (
            <ChatScreen embedded userId={selectedUserId} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                <ICONS.Messages size={40} />
              </div>
              <h3 className="text-xl font-bold">Sélectionnez une conversation</h3>
              <p className="text-secondary text-sm max-w-xs">Choisissez un match à gauche pour commencer à discuter.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagesScreen;
