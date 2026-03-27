import React from 'react';
import { motion } from 'motion/react';

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "glass" | "premium" | "boost";
}

const GlassButton = ({ children, onClick, className = "", variant = "glass" }: GlassButtonProps) => {
  const variants = {
    glass: "glass hover:bg-white/10",
    premium: "gradient-premium shadow-lg shadow-pink-500/20",
    boost: "gradient-boost shadow-lg shadow-orange-500/20 text-black font-semibold"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-6 py-4 rounded-[24px] transition-all duration-300 flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

export default GlassButton;
