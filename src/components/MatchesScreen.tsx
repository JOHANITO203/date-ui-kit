import React from 'react';
import { motion } from 'motion/react';
import { Heart, Star, Zap } from 'lucide-react';

const MatchesScreen: React.FC = () => {
  return (
    <div className="min-h-full bg-black text-white p-6 pb-24">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Your Likes</h1>
        <p className="text-[#8E8E93]">See who's interested in you</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="aspect-[3/4] rounded-3xl bg-white/5 border border-white/10 overflow-hidden relative group"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#FF1493] to-[#00BFFF] flex items-center justify-center mb-3">
                <Heart size={24} fill="white" />
              </div>
              <p className="text-sm font-medium">Upgrade to see who liked you</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-3xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 text-center">
        <div className="inline-flex p-3 rounded-2xl bg-white/5 mb-4">
          <Star className="text-[#FFD166]" fill="#FFD166" />
        </div>
        <h2 className="text-xl font-bold mb-2">Get Premium</h2>
        <p className="text-[#8E8E93] text-sm mb-6">See everyone who likes you and match instantly.</p>
        <button className="w-full py-3 rounded-2xl bg-white text-black font-bold">
          Upgrade Now
        </button>
      </div>
    </div>
  );
};

export default MatchesScreen;
