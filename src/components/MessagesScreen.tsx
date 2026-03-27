import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (urlUserId) setSelectedUserId(urlUserId);
  }, [urlUserId]);

  const handleUserSelect = (id: string) => {
    if (isLarge) {
      setSelectedUserId(id);
    } else {
      navigate(`/chat/${id}`);
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* List Area (Master) */}
      <div className={`flex flex-col ${isLarge ? 'w-[380px] border-r border-white/5' : 'w-full'} h-full p-6 pb-28 overflow-y-auto no-scrollbar`}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Messages</h2>
          <button onClick={() => navigate('/settings')} className="glass p-2.5 rounded-full hover-effect"><ICONS.Settings size={20} /></button>
        </div>

        {/* New Matches */}
        <div className="mb-10">
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-5">Nouveaux matches</h3>
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2">
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
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-pink-500/30 group-hover:border-pink-500 group-hover:scale-110 transition-all">
                  <img src={user.photos[0]} className="w-full h-full object-cover" alt={user.name} referrerPolicy="no-referrer" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">{user.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Conversations */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">Conversations</h3>
          {MOCK_USERS.map(user => (
            <div 
              key={user.id} 
              onClick={() => handleUserSelect(user.id)}
              className={`flex items-center gap-4 p-4 rounded-[28px] transition-all cursor-pointer ${
                isLarge && selectedUserId === user.id 
                ? 'bg-white/10 border border-white/10 shadow-lg' 
                : 'glass border border-transparent hover:bg-white/5'
              }`}
            >
              <div className="relative shrink-0">
                <img src={user.photos[0]} className="w-14 h-14 rounded-[20px] object-cover" alt={user.name} referrerPolicy="no-referrer" />
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
