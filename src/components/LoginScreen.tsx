import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';

const LoginScreen = () => {
  const navigate = useNavigate();

  // Simulated auto-detection
  const detectedAccount = {
    name: 'Johan',
    email: 'johaneoyaraht@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full p-8 pt-16"
    >
      <button 
        onClick={() => navigate('/')} 
        className="absolute top-8 left-8 p-2 glass rounded-full"
      >
        <ICONS.ChevronLeft size={20} />
      </button>

      <div className="mt-12 mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Bon retour.</h1>
        <p className="text-white/60 text-lg">Connectez-vous pour retrouver vos matches.</p>
      </div>

      <div className="space-y-4 mt-auto mb-12">
        {/* Main One-Tap CTA */}
        <div className="space-y-3">
          <GlassButton 
            variant="premium" 
            className="w-full py-5 flex items-center justify-center gap-3"
            onClick={() => navigate('/discover')}
          >
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
            </div>
            <span className="font-bold">Continuer avec Google</span>
          </GlassButton>

          {/* Auto-detection "Continue as" */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={() => navigate('/discover')}
            className="w-full py-3 flex items-center justify-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm"
          >
            <img 
              src={detectedAccount.avatar} 
              alt={detectedAccount.name} 
              className="w-5 h-5 rounded-full grayscale opacity-50"
              referrerPolicy="no-referrer"
            />
            <span>Continuer en tant que {detectedAccount.name}</span>
          </motion.button>
        </div>

        <GlassButton 
          className="w-full py-5 flex items-center justify-center gap-3 border border-white/10"
          onClick={() => navigate('/discover')}
        >
          <ICONS.Smartphone size={20} />
          <span className="font-bold">Continuer avec Apple</span>
        </GlassButton>

        {/* Discrete secondary option */}
        <div className="pt-4 flex flex-col items-center gap-4">
          <button 
            onClick={() => navigate('/login/methods')}
            className="text-white/40 text-sm font-medium hover:text-white/60 transition-colors underline underline-offset-4"
          >
            Autres méthodes (Email ou Téléphone)
          </button>
          
          <div className="flex items-center gap-2 text-[10px] text-white/20 uppercase tracking-widest mt-4">
            <ICONS.Fingerprint size={12} />
            <span>Sécurisé par Biométrie</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-center text-white/30 px-8">
        En vous connectant, vous acceptez nos <span className="underline">Conditions</span> et notre <span className="underline">Politique de Confidentialité</span>.
      </p>
    </motion.div>
  );
};

export default LoginScreen;
