import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useDevice } from '../hooks/useDevice';
import { motion } from 'motion/react';
import NameWithBadge from './ui/NameWithBadge';
import { useI18n } from '../i18n/I18nProvider';

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { isDesktop, isTablet, isTouch } = useDevice();
  const { t } = useI18n();
  const isLarge = isDesktop || isTablet;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [profileScrollProgress, setProfileScrollProgress] = useState(0);
  const [profileScrollThumb, setProfileScrollThumb] = useState(28);

  useEffect(() => {
    const node = scrollRef.current;
    if (!isLarge || !node) return;

    const updateScroll = () => {
      const max = node.scrollHeight - node.clientHeight;
      const progress = max <= 0 ? 0 : node.scrollTop / max;
      const size = node.scrollHeight <= 0 ? 100 : (node.clientHeight / node.scrollHeight) * 100;
      setProfileScrollProgress(Math.min(1, Math.max(0, progress)));
      setProfileScrollThumb(Math.max(20, Math.min(100, size)));
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
    <div ref={scrollRef} className={`relative group/profile h-full flex flex-col ${isLarge ? 'py-10 pr-8' : 'py-6 pb-nav'} overflow-y-auto no-scrollbar bg-black`}>
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8 md:mb-10 px-[var(--page-x)]">
        <div>
          <h2 className="text-4xl font-black tracking-tighter mb-1">{t('profile.title')}</h2>
          <p className="text-secondary text-xs uppercase tracking-[0.3em] font-bold">{t('profile.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {isDesktop && (
            <div className="hidden xl:flex items-center gap-2 mr-6 px-4 py-2 glass rounded-full border border-white/5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-secondary uppercase tracking-widest font-black">{t('profile.server')}</span>
            </div>
          )}
          <button 
            onClick={() => navigate('/settings')} 
            className="w-12 h-12 glass rounded-full flex items-center justify-center hover-effect transition-all"
          >
            <ICONS.Settings size={22} className="text-white" />
          </button>
        </div>
      </div>

      <div className={`${isLarge ? 'container-dashboard screen-template-dashboard density-comfortable' : ''}`}>
      <div className={`grid px-[var(--page-x)] ${isLarge ? 'grid-cols-12 gap-[var(--grid-gap)] density-comfortable' : 'grid-cols-1 gap-[var(--section-gap)]'}`}>
        {/* Left Column: Identity & Status */}
        <div className={`${isLarge ? 'col-span-5' : ''} space-y-10`}>
          <div
            ref={(el) => {
              sectionRefs.current[0] = el;
            }}
            className="relative group"
          >
            <motion.div 
              whileHover={!isTouch ? { scale: 1.02 } : {}}
              className="relative z-10"
            >
              <div className="aspect-square rounded-[var(--card-radius)] overflow-hidden border border-white/10 shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80" 
                  className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" 
                  alt="Me" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
                  <div>
                    <div className="mb-1">
                      <NameWithBadge name="Alex" age={26} verified size="xl" />
                    </div>
                    <div className="flex items-center gap-2 text-white/60 text-xs font-bold uppercase tracking-widest">
                      <ICONS.MapPin size={12} className="text-pink-500" /> {t('profile.city')}
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/profile/edit')}
                    className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                  >
                    <ICONS.Edit size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
            {/* Decorative background element */}
            <div className="absolute -inset-4 bg-pink-500/5 blur-3xl rounded-full -z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </div>

          {/* Premium Membership Card */}
          <div
            ref={(el) => {
              sectionRefs.current[1] = el;
            }}
            className="relative overflow-hidden rounded-[var(--card-radius)] p-6 md:p-8 bg-gradient-to-br from-zinc-900 to-black border border-white/5 group cursor-pointer"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
                  <ICONS.Star size={20} className="text-white" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-pink-500">{t('profile.premiumTag')}</span>
              </div>
              <h4 className="text-2xl font-bold mb-2">{t('profile.premiumTitle')}</h4>
              <p className="text-secondary text-sm leading-relaxed mb-6">{t('profile.premiumSubtitle')}</p>
              <GlassButton
                onClick={() => navigate('/boost')}
                className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-pink-500 hover:text-white transition-all"
              >
                {t('profile.premiumButton')}
              </GlassButton>
            </div>
            {/* Abstract background shape */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl group-hover:bg-pink-500/20 transition-all duration-1000" />
          </div>
        </div>

        {/* Right Column: Performance & Insights */}
        <div className={`${isLarge ? 'col-span-7' : ''} space-y-6 md:space-y-8`}>
          {/* Stats Bento Grid */}
          <div
            ref={(el) => {
              sectionRefs.current[2] = el;
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-[var(--grid-gap)]"
          >
            <div className="p-8 rounded-[var(--card-radius)] space-y-4 bg-[#10131b]/95 border border-white/10 hover:bg-[#131723] transition-colors group">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                  <ICONS.Eye size={24} />
                </div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">+12%</span>
              </div>
              <div>
                <span className="text-4xl font-black tracking-tighter block">1,284</span>
                <span className="text-[10px] text-secondary uppercase tracking-[0.2em] font-bold">{t('profile.profileViews')}</span>
              </div>
            </div>
            
            <div className="p-8 rounded-[var(--card-radius)] space-y-4 bg-[#10131b]/95 border border-white/10 hover:bg-[#131723] transition-colors group">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-pink-500/10 text-pink-400 group-hover:scale-110 transition-transform">
                  <ICONS.Heart size={24} />
                </div>
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">+5</span>
              </div>
              <div>
                <span className="text-4xl font-black tracking-tighter block">48</span>
                <span className="text-[10px] text-secondary uppercase tracking-[0.2em] font-bold">{t('profile.newMatches')}</span>
              </div>
            </div>
          </div>

          {/* Profile Completion */}
          <div
            ref={(el) => {
              sectionRefs.current[3] = el;
            }}
            className="p-6 md:p-8 rounded-[var(--card-radius)] space-y-8 relative overflow-hidden bg-[#0d0f16]/95 border border-white/10"
          >
            <div className="flex justify-between items-end relative z-10">
              <div className="space-y-2">
                <h4 className="text-2xl font-bold">{t('profile.visibilityTitle')}</h4>
                <p className="text-secondary text-sm">{t('profile.visibilitySubtitle')}</p>
              </div>
              <div className="text-right">
                <span className="text-5xl font-black tracking-tighter text-pink-500">85%</span>
              </div>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative z-10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '85%' }}
                transition={{ duration: 1.5, ease: "circOut" }}
                className="h-full bg-gradient-to-r from-pink-500 to-violet-500 rounded-full shadow-[0_0_20px_rgba(236,72,153,0.3)]" 
              />
            </div>
            <div className="flex gap-4 relative z-10">
              <button
                onClick={() => navigate('/profile/edit')}
                className="flex-1 py-4 glass rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                {t('profile.improve')}
              </button>
              <button
                onClick={() => navigate('/discover')}
                className="flex-1 py-4 glass rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                {t('profile.preview')}
              </button>
            </div>
          </div>

          {/* Public Profile */}
          <div className="p-6 md:p-8 rounded-[var(--card-radius)] bg-[#0f1118]/92 border border-white/10 space-y-5">
            <h4 className="text-xl font-bold">{t('editProfile.title')}</h4>
            <p className="text-sm text-secondary">{t('editProfile.subtitle')}</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => navigate('/discover')}
                className="py-3 rounded-2xl glass text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                {t('profile.preview')}
              </button>
              <button
                onClick={() => navigate('/profile/edit')}
                className="py-3 rounded-2xl glass text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                {t('editProfile.save')}
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div
            ref={(el) => {
              sectionRefs.current[4] = el;
            }}
            className="grid grid-cols-2 md:grid-cols-3 gap-[var(--grid-gap)]"
          >
            {[
              { icon: <ICONS.Shield size={20} />, label: t('profile.quickActions.security'), color: 'text-blue-400', to: '/settings/privacy' },
              { icon: <ICONS.Zap size={20} />, label: t('profile.quickActions.boost'), color: 'text-orange-400', to: '/boost' },
              { icon: <ICONS.HelpCircle size={20} />, label: t('profile.quickActions.help'), color: 'text-green-400', to: '/settings/account' }
            ].map((action, i) => (
              <button 
                key={i}
                onClick={() => navigate(action.to)}
                className="p-6 rounded-[var(--card-radius)] flex flex-col items-center gap-3 bg-[#0f1118]/92 border border-white/10 hover:bg-[#151925] transition-all group"
              >
                <div className={`p-3 rounded-2xl bg-white/5 ${action.color} group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="rounded-[var(--card-radius)] bg-[#0f1118]/92 border border-white/10 overflow-hidden">
            {[
              { icon: <ICONS.Profile size={16} />, label: t('settings.sections.account'), to: '/settings/account' },
              { icon: <ICONS.Shield size={16} />, label: t('settings.sections.privacy'), to: '/settings/privacy' },
              { icon: <ICONS.Bell size={16} />, label: t('settings.sections.notifications'), to: '/settings/notifications' },
              { icon: <ICONS.Settings size={16} />, label: t('settings.sections.preferences'), to: '/settings/preferences' },
            ].map((item, index, arr) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors ${
                  index < arr.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <span className="text-white/70">{item.icon}</span>
                  {item.label}
                </span>
                <ICONS.ChevronLeft size={16} className="text-white/35 rotate-180" />
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>

      {isLarge && (
        <div className="fixed right-0 top-0 bottom-0 w-20 z-30 pointer-events-none">
          <div className="group/profile-rail h-full w-full flex items-center justify-center pointer-events-auto">
            <div className="flex items-center opacity-0 transition-opacity duration-200 group-hover/profile:opacity-100 group-focus-within/profile:opacity-100 group-hover/profile-rail:opacity-100">
              <div className="rounded-full p-[1px] bg-gradient-to-b from-pink-500 via-fuchsia-500 to-blue-500 shadow-[0_0_14px_rgba(168,85,247,0.28)]">
                <div className="relative w-3 h-52 rounded-full bg-[#09090c]/95 overflow-hidden">
                  <div
                    className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-pink-400 via-fuchsia-400 to-blue-400"
                    style={{
                      height: `${profileScrollThumb}%`,
                      top: `${profileScrollProgress * (100 - profileScrollThumb)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="ml-2 flex flex-col gap-2.5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <button
                    key={`profile-jump-${index}`}
                    onClick={() => jumpToSection(index)}
                    className="w-3 h-3 rounded-full bg-white/35 hover:bg-white/70 transition-colors"
                    aria-label={`Aller a la section ${index + 1}`}
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

export default ProfileScreen;
