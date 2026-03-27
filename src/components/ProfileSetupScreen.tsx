import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';

const ProfileSetupScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full flex flex-col p-6 sm:p-8 pt-12 sm:pt-16 overflow-hidden bg-black relative">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] bg-pink-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <button 
        onClick={() => navigate(-1)} 
        className="absolute top-8 left-6 sm:left-8 p-2 glass rounded-full z-20"
      >
        <ICONS.ChevronLeft size={20} />
      </button>

      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col"
        >
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Votre profil.</h1>
            <p className="text-white/50 text-base sm:text-lg leading-relaxed">
              Ajoutez vos photos pour commencer à faire des rencontres.
            </p>
          </div>

          <div className="grid grid-cols-3 grid-rows-2 gap-3 aspect-square sm:aspect-auto sm:h-[380px] mb-8">
            {/* Main Photo Slot */}
            <div className="col-span-2 row-span-2 relative group cursor-pointer overflow-hidden rounded-[24px] sm:rounded-[32px] border-2 border-dashed border-white/10 hover:border-pink-500/50 transition-all duration-500 bg-white/[0.02]">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-4 group-hover:scale-110 transition-transform duration-500">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-xl">
                  <ICONS.Camera size={24} className="sm:text-white/40" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/30">Photo Principale</span>
              </div>
              <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 gradient-premium rounded-full flex items-center justify-center shadow-lg shadow-pink-500/30">
                <span className="text-xl sm:text-2xl font-light">+</span>
              </div>
            </div>

            {/* Secondary Slots */}
            {[1, 2].map((i) => (
              <div 
                key={i} 
                className="relative group cursor-pointer overflow-hidden rounded-[20px] sm:rounded-[24px] border border-dashed border-white/10 hover:border-pink-500/30 transition-all duration-500 bg-white/[0.01]"
              >
                <div className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <ICONS.Camera size={18} className="text-white/10" />
                </div>
                <div className="absolute bottom-2 right-2 w-5 h-5 sm:w-6 sm:h-6 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 group-hover:bg-white/20 transition-colors">
                  <span className="text-xs sm:text-sm font-light text-white/60">+</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 p-4 glass rounded-[20px] sm:rounded-[24px] border border-white/5 mb-8">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
              <ICONS.Star size={18} />
            </div>
            <p className="text-[10px] sm:text-[11px] text-white/40 leading-tight">
              <span className="text-white/60 font-bold block mb-0.5 uppercase tracking-wider">Conseil d'expert</span>
              Les profils avec des photos claires reçoivent 3x plus de likes.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="mt-6 shrink-0 z-10">
        <GlassButton variant="premium" className="w-full py-4 sm:py-5 text-lg font-bold" onClick={() => navigate('/discover')}>
          Continuer
        </GlassButton>
      </div>
    </div>
  );
};

export default ProfileSetupScreen;
