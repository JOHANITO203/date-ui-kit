import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ICONS } from '../types';
import { useI18n } from '../i18n/I18nProvider';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const tabs = [
    { id: 'discover', icon: ICONS.Discover, label: t('nav.discover'), path: '/discover' },
    { id: 'likes', icon: ICONS.Likes, label: t('nav.likes'), badge: true, path: '/likes' },
    { id: 'messages', icon: ICONS.Messages, label: t('nav.messages'), badge: true, path: '/messages' },
    { id: 'boost', icon: ICONS.Boost, label: t('nav.boost'), path: '/boost' },
    { id: 'profile', icon: ICONS.Profile, label: t('nav.profile'), path: '/profile' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[var(--bottom-nav-height)] rounded-t-[32px] flex items-center justify-around px-4 pb-safe z-50 border border-[var(--menu-premium-border)] border-b-0 bg-[var(--menu-premium-gray)] backdrop-blur-2xl shadow-[0_-8px_28px_rgba(0,0,0,0.45)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          location.pathname === tab.path ||
          (tab.path === '/messages' && location.pathname.startsWith('/chat/')) ||
          (tab.path === '/profile' && location.pathname.startsWith('/settings'));
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className="relative flex flex-col items-center justify-center w-12 h-12"
            aria-label={tab.label}
          >
            <Icon 
              size={24} 
              className={`transition-all duration-300 ${isActive ? 'text-white fill-white' : 'text-[#8E8E93]'}`} 
              strokeWidth={isActive ? 2.5 : 2}
            />
            {tab.badge && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-black" />
            )}
            {isActive && (
              <motion.div 
                layoutId="nav-indicator"
                className="absolute -bottom-1 w-1 h-1 bg-white rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default BottomNav;
