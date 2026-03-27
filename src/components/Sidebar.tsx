import React from 'react';
import { NavLink } from 'react-router-dom';
import { ICONS } from '../types';
import { motion } from 'motion/react';

const Sidebar: React.FC = () => {
  const navItems = [
    { path: '/discover', icon: ICONS.Discover, label: 'Découvrir' },
    { path: '/likes', icon: ICONS.Likes, label: 'Likes' },
    { path: '/messages', icon: ICONS.Messages, label: 'Messages' },
    { path: '/boost', icon: ICONS.Boost, label: 'Boost' },
    { path: '/profile', icon: ICONS.Profile, label: 'Profil' },
  ];

  return (
    <aside className="w-64 h-full glass border-r border-white/10 flex flex-col p-6 z-40">
      <div className="flex items-center gap-3 mb-12 px-2">
        <div className="w-8 h-8 gradient-premium rounded-lg" />
        <h1 className="text-xl font-black italic tracking-tighter">SWIPE</h1>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-white/10 text-white' 
                  : 'text-secondary hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon 
                  size={20} 
                  className={isActive ? 'text-pink-500' : 'group-hover:text-pink-400 transition-colors'} 
                  fill={isActive ? 'currentColor' : 'none'}
                />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="ml-auto w-1 h-4 bg-pink-500 rounded-full"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/5">
        <button className="w-full flex items-center gap-4 px-4 py-3 text-secondary hover:text-white transition-colors group">
          <ICONS.Settings size={20} className="group-hover:rotate-45 transition-transform duration-500" />
          <span className="font-medium">Paramètres</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
