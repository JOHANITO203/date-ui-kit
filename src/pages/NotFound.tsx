import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-full bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <motion.h1 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-9xl font-black italic tracking-tighter bg-gradient-to-r from-[#FF1493] to-[#00BFFF] bg-clip-text text-transparent mb-4"
      >
        404
      </motion.h1>
      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <p className="text-[#8E8E93] mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/" className="px-8 py-4 rounded-full bg-white text-black font-bold">
        Go Home
      </Link>
    </div>
  );
};

export default NotFound;
