import React from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "", size = 40, showText = true }) => {
  return (
    <div className={`flex items-center gap-2 md:gap-3 ${className}`}>
      <motion.div 
        className="relative shrink-0"
        style={{ width: size, height: size }}
        whileHover={{ scale: 1.04 }}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-pink-500/35 via-violet-500/30 to-cyan-400/30 blur-lg" />
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 w-full h-full"
        >
          <defs>
            <linearGradient id="swipe-logo-bg" x1="12" y1="12" x2="88" y2="88" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF1493" />
              <stop offset="0.55" stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#00BFFF" />
            </linearGradient>
            <linearGradient id="swipe-logo-card" x1="40" y1="18" x2="76" y2="72" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" stopOpacity="0.98" />
              <stop offset="1" stopColor="white" stopOpacity="0.82" />
            </linearGradient>
          </defs>

          <rect x="8" y="8" width="84" height="84" rx="24" fill="url(#swipe-logo-bg)" />
          <rect x="22" y="18" width="34" height="52" rx="11" fill="white" fillOpacity="0.14" stroke="white" strokeOpacity="0.32" strokeWidth="2" />

          <motion.g
            initial={{ x: 0, rotate: 0 }}
            animate={{ x: [0, 8, 0], rotate: [0, 7, 0] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformBox: "fill-box", transformOrigin: "62px 46px" }}
          >
            <rect
              x="40" y="14" width="38" height="58" rx="12"
              fill="url(#swipe-logo-card)"
              stroke="white"
              strokeOpacity="0.8"
              strokeWidth="1.25"
            />
            <motion.path
              d="M65 36C62.8 33.8 59.2 33.8 57 36L55.5 37.5L54 36C51.8 33.8 48.2 33.8 46 36C43.8 38.2 43.8 41.8 46 44L55.5 53.5L65 44C67.2 41.8 67.2 38.2 65 36Z"
              fill="#EC4899"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          </motion.g>
        </svg>
      </motion.div>

      {showText && (
        <div className="flex flex-col">
          <motion.span 
            className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-none text-white"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            SWIPE
          </motion.span>
          <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.4em] text-pink-500 leading-none mt-1">
            EXOTIQUE DATING
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
