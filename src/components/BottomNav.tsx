import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ICONS } from '../types';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'discover', icon: ICONS.Discover, label: 'Discover', path: '/discover' },
    { id: 'likes', icon: ICONS.Likes, label: 'Likes', badge: true, path: '/likes' },
    { id: 'messages', icon: ICONS.Messages, label: 'Messages', badge: true, path: '/messages' },
    { id: 'boost', icon: ICONS.Boost, label: 'Boost', path: '/boost' },
    { id: 'profile', icon: ICONS.Profile, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-24 glass border-t-0 rounded-t-[32px] flex items-center justify-around px-4 pb-4 z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className="relative flex flex-col items-center justify-center w-12 h-12"
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
