import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ICONS, MOCK_USERS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';

const SwipeScreen = () => {
  const navigate = useNavigate();
  const { isDesktop, isTablet } = useDevice();
  const isLarge = isDesktop || isTablet;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const quickFilters = ['A moins de 5 km', 'Verifies', 'Actifs', 'Nouveaux'];
  const [activeFilters, setActiveFilters] = useState<string[]>(['A moins de 5 km', 'Actifs']);

  const user = MOCK_USERS[currentIndex % MOCK_USERS.length];
  const nextUser = MOCK_USERS[(currentIndex + 1) % MOCK_USERS.length];

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0.8, 1, 1, 1, 0.8]);

  const likeOpacity = useTransform(x, [40, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-40, -120], [0, 1]);
  const superLikeOpacity = useTransform(y, [-40, -120], [0, 1]);

  const handleDragEnd = (_: any, info: any) => {
    const threshold = 80;
    if (info.offset.x > threshold) {
      swipe('right');
    } else if (info.offset.x < -threshold) {
      swipe('left');
    } else if (info.offset.y < -threshold) {
      swipe('up');
    }
  };

  const swipe = (dir: 'left' | 'right' | 'up') => {
    setTimeout(() => {
      if (dir === 'right' || dir === 'up') {
        if (Math.random() > 0.8) setShowMatch(true);
      }
      setCurrentIndex((prev) => prev + 1);
      setPhotoIndex(0);
      x.set(0);
      y.set(0);
    }, 100);
  };

  const handlePhotoNav = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 3) {
      if (photoIndex > 0) setPhotoIndex((prev) => prev - 1);
    } else if (clickX > (rect.width * 2) / 3) {
      if (photoIndex < user.photos.length - 1) setPhotoIndex((prev) => prev + 1);
    }
  };

  const toggleFilter = (label: string) => {
    setActiveFilters((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const actionButtons = (
    <>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={(e) => {
          e.stopPropagation();
          swipe('left');
        }}
        className={`${isLarge ? 'w-[var(--discover-action-size)] h-[var(--discover-action-size)] rounded-full' : 'w-[var(--discover-action-mobile-w)] h-[var(--discover-action-mobile-h)] rounded-[var(--discover-action-mobile-radius)]'} flex items-center justify-center text-red-500 border-2 border-red-500/20 bg-black/50 backdrop-blur-xl shadow-[0_10px_25px_rgba(239,68,68,0.15)] hover:bg-red-500/10 transition-all duration-300`}
      >
        <ICONS.X size={isLarge ? 26 : 22} />
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.9, rotate: 12 }}
        animate={{ boxShadow: ['0 0 18px rgba(255, 20, 147, 0.2)', '0 0 34px rgba(255, 20, 147, 0.35)', '0 0 18px rgba(255, 20, 147, 0.2)'] }}
        transition={{ boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
        onClick={(e) => {
          e.stopPropagation();
          swipe('up');
        }}
        className={`${isLarge ? 'w-[var(--discover-action-main-size)] h-[var(--discover-action-main-size)] rounded-full' : 'w-[var(--discover-action-mobile-main-w)] h-[var(--discover-action-mobile-main-h)] rounded-[var(--discover-action-mobile-main-radius)]'} flex items-center justify-center text-white gradient-premium opacity-90 shadow-[0_15px_35px_rgba(255,20,147,0.3)] transition-all duration-300 relative overflow-hidden`}
      >
        <ICONS.Star size={isLarge ? 20 : 18} fill="currentColor" className="relative z-10" />
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          swipe('right');
        }}
        className={`${isLarge ? 'w-[var(--discover-action-size)] h-[var(--discover-action-size)] rounded-full' : 'w-[var(--discover-action-mobile-w)] h-[var(--discover-action-mobile-h)] rounded-[var(--discover-action-mobile-radius)]'} flex items-center justify-center text-blue-400 border-2 border-blue-400/20 bg-black/50 backdrop-blur-xl shadow-[0_10px_25px_rgba(59,130,246,0.15)] hover:bg-blue-400/10 transition-all duration-300`}
      >
        <ICONS.Likes size={isLarge ? 26 : 22} fill="currentColor" />
      </motion.button>
    </>
  );

  const verifiedBadge = (
    <div className="w-[var(--discover-verified-size)] h-[var(--discover-verified-size)] rounded-full bg-[#1D9BF0] border border-white/35 flex items-center justify-center shadow-[0_6px_16px_rgba(29,155,240,0.35)] shrink-0">
      <span className="text-white font-black leading-none text-[10px]">✓</span>
    </div>
  );

  return (
    <div className={`h-full flex flex-col bg-[#050505] relative font-sans ${isLarge ? 'overflow-y-auto no-scrollbar pb-safe' : 'overflow-y-auto no-scrollbar'}`}>
      <div className="flex items-center justify-between px-[var(--page-x)] pt-[var(--discover-header-top)] md:pt-7 lg:pt-8 pb-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-[length:var(--discover-title-size)] font-bold tracking-tight text-white leading-none">Discover</h1>
        </div>
        {!isLarge && (
          <button onClick={() => navigate('/boost')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.1)] active:scale-95 transition-all group">
            <ICONS.Boost size={14} className="text-orange-400 group-hover:animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400/90">Boost</span>
          </button>
        )}
      </div>

      {isLarge ? (
        <div className="flex-1 min-h-0 px-[var(--page-x)] py-2">
          <div className="container-immersive screen-template-immersive density-immersive h-full">
          <div
            className="h-full grid gap-[var(--grid-gap)] items-start"
            style={{ gridTemplateColumns: `${isDesktop ? 'var(--panel-width-md)' : 'var(--panel-width-sm)'} minmax(0, 1fr)` }}
          >
            <aside className="glass rounded-[28px] p-5 space-y-5 h-fit">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/settings/preferences')}
                  aria-label="Ouvrir les reglages de decouverte"
                  className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <ICONS.Settings size={18} className="text-white/80" />
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black">Filtres rapides</p>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((label) => (
                    <button
                      key={label}
                      onClick={() => toggleFilter(label)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                        activeFilters.includes(label)
                          ? 'text-white border border-fuchsia-400/60 bg-gradient-to-r from-pink-500/30 to-blue-500/30 shadow-[0_0_14px_rgba(217,70,239,0.25)]'
                          : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black">Activite</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                    <p className="text-lg font-black">24</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Likes recents</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                    <p className="text-lg font-black">7</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Matches</p>
                  </div>
                </div>
              </div>
            </aside>

            <div className="w-full flex flex-col items-center density-comfortable min-h-0">
            <div className="container-deck relative w-full h-[min(68vh,40rem)]">
          <AnimatePresence>
            <motion.div
              key={`next-${nextUser.id}`}
              className="absolute inset-0 rounded-[36px] overflow-hidden bg-zinc-900"
              style={{ scale: 0.96, y: 8, opacity: 0.4, zIndex: 0 }}
            >
              <img src={nextUser.photos[0]} className="w-full h-full object-cover object-[center_22%] grayscale-[0.3]" alt="next" referrerPolicy="no-referrer" />
            </motion.div>

            <motion.div
              key={user.id}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotate, opacity, zIndex: 10 }}
              className="absolute inset-0 rounded-[36px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing border border-white/5 bg-zinc-900"
              onClick={handlePhotoNav}
            >
              <button onClick={() => navigate('/boost')} className="absolute top-5 right-5 z-30 flex items-center gap-2 px-3 py-2 rounded-full border border-orange-500/35 bg-black/45 backdrop-blur-lg hover:bg-orange-500/10 transition-colors">
                <ICONS.Boost size={14} className="text-orange-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">Boost</span>
              </button>
              <AnimatePresence mode="wait">
                <motion.img
                  key={photoIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  src={user.photos[photoIndex]}
                  className="w-full h-full object-cover object-[center_22%] pointer-events-none"
                  alt={user.name}
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              <motion.div style={{ opacity: likeOpacity, scale: useTransform(x, [0, 150], [0.5, 1.2]) }} className="absolute top-20 left-10 border-4 border-green-500 text-green-500 font-black text-4xl px-6 py-2 rounded-xl rotate-[-20deg] pointer-events-none z-30 uppercase tracking-tighter shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                J'AIME
              </motion.div>
              <motion.div style={{ opacity: nopeOpacity, scale: useTransform(x, [0, -150], [0.5, 1.2]) }} className="absolute top-20 right-10 border-4 border-red-500 text-red-500 font-black text-4xl px-6 py-2 rounded-xl rotate-[20deg] pointer-events-none z-30 uppercase tracking-tighter shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                NON
              </motion.div>
              <motion.div style={{ opacity: superLikeOpacity, scale: useTransform(y, [0, -150], [0.5, 1.2]) }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-purple-500 text-purple-500 font-black text-4xl px-6 py-2 rounded-xl pointer-events-none z-30 uppercase tracking-tighter shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                SUPER
              </motion.div>

              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10 pointer-events-none" />

              <div className="absolute top-4 left-6 right-6 flex gap-1.5 z-20">
                {user.photos.map((_, i) => (
                  <div key={i} className="h-[2px] flex-1 rounded-full bg-white/20 overflow-hidden">
                    <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: i === photoIndex ? '100%' : i < photoIndex ? '100%' : '0%' }} transition={{ duration: 0.3 }} />
                  </div>
                ))}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 pt-24 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className={`inline-flex gap-2 ${isLarge ? 'items-end' : 'items-start'}`}>
                      <h2 className={`text-[length:var(--discover-name-size)] font-black text-white tracking-tight leading-none ${isLarge ? '' : 'max-w-[75%]'}`}>{user.name}, {user.age}</h2>
                      {user.verified && <div className={isLarge ? '' : 'mt-0.5'}>{verifiedBadge}</div>}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-white/60 text-[11px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <ICONS.MapPin size={12} className="text-pink-500" />
                        {user.distance}
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1.5">
                        <ICONS.Languages size={12} className="text-blue-400" />
                        {user.languages[0]}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {user.interests.slice(0, 2).map((interest) => (
                        <span key={interest} className="px-2.5 py-1 rounded-full bg-white/10 border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/80">
                          {interest}
                        </span>
                      ))}
                      {user.interests.length > 2 && <span className="px-2 py-1 rounded-full bg-white/5 text-[9px] font-black text-white/30">+{user.interests.length - 2}</span>}
                    </div>
                  </div>
                  <div className="relative w-[var(--discover-compat-size)] h-[var(--discover-compat-size)] flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
                      <motion.circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray="175.9"
                        initial={{ strokeDashoffset: 175.9 }}
                        animate={{ strokeDashoffset: 175.9 - (175.9 * user.compatibility) / 100 }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                        className="text-pink-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs font-black text-white leading-none">{user.compatibility}%</span>
                      <span className="text-[6px] font-bold uppercase tracking-widest text-white/40">Match</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
            </div>

            </div>
            <div className="container-deck w-full rounded-2xl glass py-3 px-4">
              <div className="grid grid-cols-3 gap-4 place-items-center">
                {actionButtons}
              </div>
            </div>
          </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-[var(--page-x)] pt-2 pb-1 flex flex-col items-center gap-2 overflow-y-auto no-scrollbar">
          <div className={`relative w-full max-w-[26rem] sm:max-w-[28rem] h-[var(--discover-card-h)] ${isLarge ? 'md:max-w-[32rem] lg:max-w-[34rem] xl:max-w-[36rem]' : ''}`}>
          <AnimatePresence>
            <motion.div
              key={`next-${nextUser.id}`}
              className="absolute inset-0 rounded-[36px] overflow-hidden bg-zinc-900"
              style={{ scale: 0.96, y: 8, opacity: 0.4, zIndex: 0 }}
            >
              <img src={nextUser.photos[0]} className="w-full h-full object-cover object-[center_22%] grayscale-[0.3]" alt="next" referrerPolicy="no-referrer" />
            </motion.div>

            <motion.div
              key={user.id}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotate, opacity, zIndex: 10 }}
              className="absolute inset-0 rounded-[36px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing border border-white/5 bg-zinc-900"
              onClick={handlePhotoNav}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={photoIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  src={user.photos[photoIndex]}
                  className="w-full h-full object-cover object-[center_22%] pointer-events-none"
                  alt={user.name}
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              <motion.div style={{ opacity: likeOpacity, scale: useTransform(x, [0, 150], [0.5, 1.2]) }} className="absolute top-20 left-10 border-4 border-green-500 text-green-500 font-black text-4xl px-6 py-2 rounded-xl rotate-[-20deg] pointer-events-none z-30 uppercase tracking-tighter shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                J'AIME
              </motion.div>
              <motion.div style={{ opacity: nopeOpacity, scale: useTransform(x, [0, -150], [0.5, 1.2]) }} className="absolute top-20 right-10 border-4 border-red-500 text-red-500 font-black text-4xl px-6 py-2 rounded-xl rotate-[20deg] pointer-events-none z-30 uppercase tracking-tighter shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                NON
              </motion.div>
              <motion.div style={{ opacity: superLikeOpacity, scale: useTransform(y, [0, -150], [0.5, 1.2]) }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-purple-500 text-purple-500 font-black text-4xl px-6 py-2 rounded-xl pointer-events-none z-30 uppercase tracking-tighter shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                SUPER
              </motion.div>

              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10 pointer-events-none" />

              <div className="absolute top-4 left-6 right-6 flex gap-1.5 z-20">
                {user.photos.map((_, i) => (
                  <div key={i} className="h-[2px] flex-1 rounded-full bg-white/20 overflow-hidden">
                    <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: i === photoIndex ? '100%' : i < photoIndex ? '100%' : '0%' }} transition={{ duration: 0.3 }} />
                  </div>
                ))}
              </div>

              {!isLarge && (
                <div className="absolute left-[var(--discover-overlay-pad)] right-[var(--discover-overlay-pad)] top-[var(--discover-identity-top)] z-30 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[length:var(--discover-name-size)] font-black text-white tracking-tight leading-none">{user.name}, {user.age}</h2>
                    {user.verified && <div className="mt-0.5">{verifiedBadge}</div>}
                  </div>
                </div>
              )}

               <div className="absolute bottom-0 left-0 right-0 p-[var(--discover-overlay-pad)] pt-[var(--discover-overlay-top)] pb-16 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {isLarge && (
                      <div className="inline-flex items-end gap-2">
                        <h2 className="text-[length:var(--discover-name-size)] font-black text-white tracking-tight leading-none">{user.name}, {user.age}</h2>
                        {user.verified && verifiedBadge}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-white/60 text-[11px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <ICONS.MapPin size={12} className="text-pink-500" />
                        {user.distance}
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1.5">
                        <ICONS.Languages size={12} className="text-blue-400" />
                        {user.languages[0]}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {user.interests.slice(0, 2).map((interest) => (
                        <span key={interest} className="px-2.5 py-1 rounded-full bg-white/10 border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/80">
                          {interest}
                        </span>
                      ))}
                      {user.interests.length > 2 && <span className="px-2 py-1 rounded-full bg-white/5 text-[9px] font-black text-white/30">+{user.interests.length - 2}</span>}
                    </div>
                  </div>

                  <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
                      <motion.circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray="175.9"
                        initial={{ strokeDashoffset: 175.9 }}
                        animate={{ strokeDashoffset: 175.9 - (175.9 * user.compatibility) / 100 }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                        className="text-pink-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs font-black text-white leading-none">{user.compatibility}%</span>
                      <span className="text-[6px] font-bold uppercase tracking-widest text-white/40">Match</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex items-center gap-[var(--discover-action-gap)] z-40 pointer-events-auto">
                {actionButtons}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        </div>
      )}

      <AnimatePresence>
        {showMatch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm text-center space-y-10">
              <div className="relative h-56 flex justify-center items-center">
                <div className="flex -space-x-8 relative z-10">
                  <motion.div initial={{ x: -50, rotate: -15 }} animate={{ x: 0, rotate: -10 }} className="w-36 h-36 rounded-[32px] border-4 border-white/10 overflow-hidden shadow-2xl">
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80" className="w-full h-full object-cover" alt="Me" />
                  </motion.div>
                  <motion.div initial={{ x: 50, rotate: 15 }} animate={{ x: 0, rotate: 10 }} className="w-36 h-36 rounded-[32px] border-4 border-white/10 overflow-hidden shadow-2xl">
                    <img src={user.photos[0]} className="w-full h-full object-cover" alt="Match" />
                  </motion.div>
                </div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }} className="absolute bottom-0 z-20 bg-white text-black px-8 py-3 rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-2xl">
                  C'est un Match !
                </motion.div>
              </div>

              <div className="space-y-3">
                <h2 className="text-4xl font-bold text-white tracking-tight">Vous et {user.name}</h2>
                <p className="text-white/40 text-sm max-w-[240px] mx-auto leading-relaxed">Envoyez un message pour briser la glace des maintenant.</p>
              </div>

              <div className="space-y-4">
                <GlassButton variant="premium" className="w-full py-5 text-sm font-bold uppercase tracking-widest">
                  Envoyer un message
                </GlassButton>
                <button onClick={() => setShowMatch(false)} className="w-full py-2 text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
                  Continuer a swiper
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SwipeScreen;

