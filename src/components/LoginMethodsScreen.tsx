import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';

const LoginMethodsScreen = () => {
  const navigate = useNavigate();

  const methods = [
    { id: 'phone', icon: ICONS.Phone, label: 'Numéro de téléphone' },
    { id: 'email', icon: ICONS.Mail, label: 'Adresse Email' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full p-8 pt-16"
    >
      <button 
        onClick={() => navigate('/login')} 
        className="absolute top-8 left-8 p-2 glass rounded-full"
      >
        <ICONS.ChevronLeft size={20} />
      </button>

      <div className="mt-12 mb-12">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Autres méthodes.</h1>
        <p className="text-white/60">Choisissez comment vous souhaitez vous connecter.</p>
      </div>

      <div className="space-y-4 mt-8">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => navigate('/discover')}
            className="w-full p-6 glass rounded-[24px] flex items-center justify-between hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <method.icon size={20} className="text-white/60" />
              </div>
              <span className="font-medium">{method.label}</span>
            </div>
            <ICONS.ChevronLeft size={16} className="rotate-180 text-white/20" />
          </button>
        ))}
      </div>

      <div className="mt-auto mb-12 text-center">
        <p className="text-white/20 text-xs">
          Besoin d'aide ? <span className="text-white/40 underline">Contactez le support</span>
        </p>
      </div>
    </motion.div>
  );
};

export default LoginMethodsScreen;
