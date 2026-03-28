import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useParams, useNavigate } from 'react-router-dom';
import { ICONS, MOCK_USERS } from '../types';

interface ChatScreenProps {
  embedded?: boolean;
  userId?: string;
}

const ChatScreen = ({ embedded, userId: propUserId }: ChatScreenProps) => {
  const { userId: routeUserId } = useParams();
  const navigate = useNavigate();
  const [showTranslation, setShowTranslation] = useState(false);
  
  const userId = propUserId || routeUserId;
  const user = MOCK_USERS.find(u => u.id === userId) || MOCK_USERS[0];
  
  const containerProps = embedded ? {
    className: "h-full w-full bg-transparent flex flex-col relative"
  } : {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
    className: "absolute inset-0 z-50 bg-black flex flex-col"
  };

  return (
    <motion.div {...containerProps}>
      {/* Header */}
      <div className={`glass ${embedded ? 'p-4' : 'px-[var(--page-x)] py-4'} flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-4">
          {!embedded && (
            <button onClick={() => navigate(-1)} className="p-2 hover-effect rounded-full"><ICONS.ChevronLeft /></button>
          )}
          <div className="relative">
            <img src={user.photos[0]} className="w-10 h-10 rounded-[14px] object-cover" alt={user.name} referrerPolicy="no-referrer" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
          </div>
          <div>
            <h4 className="font-bold text-sm">{user.name}</h4>
            <span className="text-[9px] text-green-400 uppercase font-black tracking-widest">En ligne</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowTranslation(!showTranslation)}
            className={`p-2.5 rounded-full transition-all ${showTranslation ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'glass text-secondary hover:text-white'}`}
          >
            <ICONS.Languages size={18} />
          </button>
          {embedded && (
            <button className="p-2.5 glass rounded-full text-secondary hover:text-white transition-all">
              <ICONS.Info size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className={`${embedded ? 'max-w-none pb-6' : 'container-content pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+4.5rem)]'} w-full flex-1 overflow-y-auto px-[var(--page-x)] py-6 space-y-6 no-scrollbar`}>
        <div className="flex justify-center">
          <span className="glass px-4 py-1 rounded-full text-[9px] font-black text-secondary uppercase tracking-[0.2em]">Aujourd'hui</span>
        </div>

        <div className="flex gap-3 max-w-[86%] md:max-w-[74%] lg:max-w-[68%] xl:max-w-[62%]">
          <img src={user.photos[0]} className="w-8 h-8 rounded-xl object-cover self-end shrink-0" alt="" referrerPolicy="no-referrer" />
          <div className="space-y-1.5">
            <div className="glass p-4 rounded-[24px] rounded-bl-none text-sm leading-relaxed">
              Hey! I saw your profile and loved your photography. Where was that last photo taken?
            </div>
            {showTranslation && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] text-pink-400 font-bold px-3 flex items-center gap-1.5"
              >
                <ICONS.Languages size={10} /> Traduction: Salut ! J'ai vu ton profil et j'ai adoré tes photos...
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 ml-auto max-w-[86%] md:max-w-[74%] lg:max-w-[68%] xl:max-w-[62%]">
          <div className="gradient-premium p-4 rounded-[24px] rounded-br-none text-sm leading-relaxed shadow-lg shadow-pink-500/10">
            Thanks! It was taken in Iceland last summer. Have you ever been there?
          </div>
          <span className="text-[9px] font-bold text-secondary pr-2 uppercase tracking-widest">Lu 14:25</span>
        </div>

        <div className="flex gap-3 max-w-[86%] md:max-w-[74%] lg:max-w-[68%] xl:max-w-[62%]">
          <img src={user.photos[0]} className="w-8 h-8 rounded-xl object-cover self-end shrink-0" alt="" referrerPolicy="no-referrer" />
          <div className="glass p-4 rounded-[24px] rounded-bl-none text-sm leading-relaxed">
            Not yet, but it's on my bucket list! 🇮🇸
          </div>
        </div>
      </div>

      {/* Input */}
      <div className={`${embedded ? 'p-4' : 'px-[var(--page-x)] pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3'} shrink-0 ${embedded ? '' : 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent'}`}>
        <div className={`${embedded ? '' : 'container-content'} glass rounded-[28px] p-1.5 flex items-center gap-2 border border-white/5 focus-within:border-white/20 transition-all`}>
          <button className="p-3 text-secondary hover:text-white transition-colors rounded-full hover:bg-white/5">
            <ICONS.Globe size={20} />
          </button>
          <input 
            type="text" 
            placeholder="Écrire un message..." 
            className="flex-1 bg-transparent outline-none text-sm px-2 placeholder:text-white/20"
          />
          <button className="w-11 h-11 gradient-premium rounded-full flex items-center justify-center shadow-xl shadow-pink-500/20 active:scale-90 transition-transform">
            <ICONS.Send size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatScreen;
