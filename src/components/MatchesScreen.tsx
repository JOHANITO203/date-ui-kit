import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Star, Sparkles, Eye } from 'lucide-react';
import { useDevice } from '../hooks/useDevice';

const lockedLikes = [
  {
    id: 'lk-1',
    name: 'Mila',
    age: 26,
    city: 'Paris',
    photo:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'lk-2',
    name: 'Lina',
    age: 24,
    city: 'Lyon',
    photo:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'lk-3',
    name: 'Emma',
    age: 29,
    city: 'Marseille',
    photo:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'lk-4',
    name: 'Nora',
    age: 27,
    city: 'Toulouse',
    photo:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'lk-5',
    name: 'Lea',
    age: 25,
    city: 'Nice',
    photo:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'lk-6',
    name: 'Yasmin',
    age: 30,
    city: 'Bordeaux',
    photo:
      'https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=1200&q=80',
  },
];

const MatchesScreen: React.FC = () => {
  const { isDesktop, isTablet } = useDevice();
  const isLarge = isDesktop || isTablet;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollThumb, setScrollThumb] = useState(28);

  useEffect(() => {
    const node = scrollRef.current;
    if (!isLarge || !node) return;

    const updateScroll = () => {
      const max = node.scrollHeight - node.clientHeight;
      const progress = max <= 0 ? 0 : node.scrollTop / max;
      const size = node.scrollHeight <= 0 ? 100 : (node.clientHeight / node.scrollHeight) * 100;
      setScrollProgress(Math.min(1, Math.max(0, progress)));
      setScrollThumb(Math.max(20, Math.min(100, size)));
    };

    updateScroll();
    node.addEventListener('scroll', updateScroll);
    window.addEventListener('resize', updateScroll);

    return () => {
      node.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [isLarge]);

  const jumpToSection = (index: number) => {
    const node = sectionRefs.current[index];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={scrollRef} className="relative group/likes h-full overflow-y-auto no-scrollbar py-6 pb-nav">
      <div className="container-wide px-[var(--page-x)] layout-stack">
        <header
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          className="flex items-end justify-between gap-4"
        >
          <div>
            <h1 className="fluid-title font-black tracking-tight">Vos Likes</h1>
            <p className="text-secondary fluid-subtitle">Voyez qui s'interesse a vous et debloquez les profils en un geste.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full glass border border-pink-500/20">
            <Sparkles size={14} className="text-pink-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-pink-300">Nouveaux likes: 24</span>
          </div>
        </header>

        {isLarge ? (
          <div
            ref={(el) => {
              sectionRefs.current[1] = el;
            }}
            className="grid grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_22rem] gap-5 items-start"
          >
            <section className="grid grid-cols-2 xl:grid-cols-3 gap-[var(--grid-gap)]">
              {lockedLikes.map((like, index) => (
                <motion.article
                  key={like.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="relative overflow-hidden rounded-[var(--card-radius)] border border-white/10 bg-white/[0.03] aspect-[3/4]"
                >
                  <img src={like.photo} alt={like.name} className="absolute inset-0 w-full h-full object-cover object-center scale-105" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/45 backdrop-blur-md" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/20" />

                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/50 border border-white/20 text-[10px] font-black uppercase tracking-wider text-white/80">
                    Verrouille
                  </div>

                  <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#FF1493] to-[#00BFFF] flex items-center justify-center mb-3 shadow-lg shadow-pink-500/30">
                      <Heart size={24} fill="white" />
                    </div>
                    <p className="text-sm font-semibold text-white">Debloquez pour voir ce profil</p>
                    <p className="text-xs text-white/50 mt-1">{like.city}</p>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white/70">
                    <span className="text-sm font-bold blur-sm">{like.name}, {like.age}</span>
                    <Eye size={16} className="text-white/50" />
                  </div>
                </motion.article>
              ))}
            </section>

            <aside
              ref={(el) => {
                sectionRefs.current[2] = el;
              }}
              className="layout-stack"
            >
              <section className="glass rounded-[var(--card-radius)] p-5 border border-white/10">
                <div className="inline-flex p-2 rounded-xl bg-white/5 mb-3">
                  <Star className="text-[#FFD166]" fill="#FFD166" size={18} />
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-2">Passez Premium</h2>
                <p className="text-secondary text-sm leading-relaxed mb-5">
                  Voyez tous vos likes, matchez instantanement et boostez votre visibilite.
                </p>
                <button className="w-full h-[var(--cta-height)] rounded-2xl gradient-premium text-white font-black uppercase tracking-[0.15em] text-[11px]">
                  Debloquer mes likes
                </button>
              </section>

              <section className="glass rounded-[var(--card-radius)] p-5 border border-white/10 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black">Inclut</p>
                {[
                  'Voir tous les likes recus',
                  'Likes illimites',
                  'Filtres avances',
                  'Boost hebdomadaire',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-white/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </section>
            </aside>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-[var(--grid-gap)]">
              {lockedLikes.slice(0, 4).map((like, index) => (
                <motion.article
                  key={like.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative overflow-hidden rounded-[var(--card-radius)] border border-white/10 bg-white/[0.03] aspect-[3/4]"
                >
                  <img src={like.photo} alt={like.name} className="absolute inset-0 w-full h-full object-cover object-center scale-105" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/45 backdrop-blur-md" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-r from-[#FF1493] to-[#00BFFF] flex items-center justify-center mb-2">
                      <Heart size={22} fill="white" />
                    </div>
                    <p className="text-xs font-semibold text-white">Debloquez pour voir</p>
                  </div>
                </motion.article>
              ))}
            </section>

            <section className="glass p-6 rounded-[var(--card-radius)] border border-white/10 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-white/5 mb-4">
                <Star className="text-[#FFD166]" fill="#FFD166" />
              </div>
              <h2 className="text-xl font-black mb-2">Passez Premium</h2>
              <p className="text-secondary text-sm mb-6">Voyez tous vos likes et matchez instantanement.</p>
              <button className="w-full h-[var(--cta-height)] rounded-2xl gradient-premium text-white font-black uppercase tracking-[0.15em] text-[11px]">
                Debloquer
              </button>
            </section>
          </>
        )}
      </div>
      {isLarge && (
        <div className="fixed right-0 top-0 bottom-0 w-14 z-30 pointer-events-none">
          <div className="group/likes-rail h-full w-full flex items-center justify-center pointer-events-auto">
            <div className="flex items-center opacity-0 transition-opacity duration-300 group-hover/likes-rail:opacity-100">
              <div className="rounded-full p-[1px] bg-gradient-to-b from-pink-500 via-fuchsia-500 to-blue-500 shadow-[0_0_14px_rgba(217,70,239,0.33)]">
                <div className="relative w-2.5 h-40 rounded-full bg-[#09090c]/95 overflow-hidden">
                  <div
                    className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-pink-400 via-fuchsia-400 to-blue-400"
                    style={{
                      height: `${scrollThumb}%`,
                      top: `${scrollProgress * (100 - scrollThumb)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="ml-2 flex flex-col gap-2">
                {[0, 1, 2].map((index) => (
                  <button
                    key={`likes-jump-${index}`}
                    onClick={() => jumpToSection(index)}
                    className="w-2 h-2 rounded-full bg-white/35 hover:bg-pink-300 transition-colors"
                    aria-label={`Aller a la section likes ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchesScreen;
