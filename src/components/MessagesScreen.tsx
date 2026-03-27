import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICONS, MOCK_USERS } from '../types';
import { useDevice } from '../hooks/useDevice';
import ChatScreen from './ChatScreen';

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
      <div className={`flex flex-col ${isLarge ? 'w-[min(30vw,26rem)] border-r border-white/5 overflow-hidden' : 'w-full overflow-y-auto no-scrollbar'} h-full px-[var(--page-x)] pt-6 pb-nav`}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Messages</h2>
          <button onClick={() => navigate('/settings')} className="glass p-2.5 rounded-full hover-effect"><ICONS.Settings size={20} /></button>
        </div>

        {/* New Matches */}
        <div className="mb-10 group/matches relative">
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-5">Nouveaux matches</h3>
          <div ref={matchesRef} className="flex gap-5 overflow-x-auto no-scrollbar pb-2">
            <div onClick={() => navigate('/likes')} className="flex flex-col items-center gap-3 cursor-pointer group">
              <div className="w-16 h-16 rounded-full gradient-premium p-[2.5px] group-hover:scale-110 transition-transform">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                  <ICONS.Likes size={24} className="text-white" />
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
                <div className={`${isLarge ? 'w-20 h-20' : 'w-16 h-16'} rounded-full overflow-hidden border-2 border-pink-500/30 group-hover:border-pink-500 group-hover:scale-110 transition-all`}>
                  <img src={user.photos[0]} className="w-full h-full object-cover" alt={user.name} referrerPolicy="no-referrer" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">{user.name}</span>
              </div>
            ))}
          </div>
          {isLarge && (
            <div className="mt-3 px-1">
              <div className="rounded-full p-[1px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500/90 shadow-[0_0_12px_rgba(236,72,153,0.3)]">
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
        <div className="space-y-3 flex-1 min-h-0 group/conversations relative">
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">Conversations</h3>
          <div ref={conversationsRef} className="space-y-3 overflow-y-auto no-scrollbar h-full pr-12">
            {MOCK_USERS.map((user, index) => (
              <div 
                key={user.id}
                ref={(el) => {
                  conversationItemRefs.current[index] = el;
                }}
                onClick={() => handleUserSelect(user.id)}
                className={`flex items-center gap-4 p-4 rounded-[28px] transition-all cursor-pointer ${
                  isLarge && selectedUserId === user.id 
                  ? 'bg-white/10 border border-white/10 shadow-lg' 
                  : 'glass border border-transparent hover:bg-white/5'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={user.photos[0]} className={`${isLarge ? 'w-16 h-16 rounded-[22px]' : 'w-14 h-14 rounded-[20px]'} object-cover`} alt={user.name} referrerPolicy="no-referrer" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold truncate">{user.name}</span>
                    <span className="text-[10px] text-secondary font-bold">14:20</span>
                  </div>
                  <p className="text-xs text-secondary line-clamp-1">Hey! I saw your profile and loved your photography...</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-pink-500/30">2</div>
                </div>
              </div>
            ))}
          </div>
          {isLarge && (
            <div className="absolute top-8 right-2 bottom-1 opacity-0 group-hover/conversations:opacity-100 transition-opacity duration-300 flex items-center">
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
              <div className="ml-2 flex flex-col gap-2">
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
