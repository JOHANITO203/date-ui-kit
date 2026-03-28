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
        whileHover={{ scale: 1.05 }}
      >
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 to-violet-500 blur-lg opacity-40 rounded-xl" />
        
        {/* Logo Symbol: Two overlapping cards representing the swipe motion */}
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 w-full h-full"
        >
          {/* Back Card */}
          <rect 
            x="20" y="15" width="50" height="70" rx="12" 
            className="fill-white/10 stroke-white/20" 
            strokeWidth="2"
          />
          
          {/* Front Card (Swiping) + Heart */}
          <motion.g
            initial={{ x: 0, rotate: 0 }}
            animate={{ x: [0, 10, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformBox: "fill-box", transformOrigin: "60px 45px" }}
          >
            <rect
              x="35" y="10" width="50" height="70" rx="12"
              className="fill-white stroke-white"
              strokeWidth="1"
            />
            <motion.path
              d="M60 35C58 33 55 33 53 35L50 38L47 35C45 33 42 33 40 35C38 37 38 40 40 42L50 52L60 42C62 40 62 37 60 35Z"
              fill="#EC4899"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
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
