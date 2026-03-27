import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X, MessageSquare } from 'lucide-react';

interface MatchOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  user1: { name: string; photo: string };
  user2: { name: string; photo: string };
}

const MatchOverlay: React.FC<MatchOverlayProps> = ({ isVisible, onClose, user1, user2 }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-r from-[#FF1493] to-[#00BFFF] bg-clip-text text-transparent mb-2">
              IT'S A MATCH!
            </h1>
            <p className="text-[#8E8E93]">You and {user2.name} have liked each other.</p>
          </motion.div>

          <div className="flex items-center gap-4 mb-16 relative">
            <motion.div 
              initial={{ x: -50, rotate: -10 }}
              animate={{ x: 0, rotate: -5 }}
              className="w-32 h-44 rounded-3xl border-4 border-white overflow-hidden shadow-2xl"
            >
              <img src={user1.photo} alt={user1.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </motion.div>
            
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl"
            >
              <Heart size={32} fill="#FF1493" className="text-[#FF1493]" />
            </motion.div>

            <motion.div 
              initial={{ x: 50, rotate: 10 }}
              animate={{ x: 0, rotate: 5 }}
              className="w-32 h-44 rounded-3xl border-4 border-white overflow-hidden shadow-2xl"
            >
              <img src={user2.photo} alt={user2.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </motion.div>
          </div>

          <div className="w-full max-w-xs space-y-4">
            <button className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF1493] to-[#00BFFF] font-bold flex items-center justify-center gap-2">
              <MessageSquare size={20} />
              Send a Message
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 rounded-full bg-white/10 border border-white/20 font-bold"
            >
              Keep Swiping
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MatchOverlay;
