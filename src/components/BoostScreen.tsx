import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';

const BoostScreen = () => {
  return (
    <div className="h-full flex flex-col p-6 pb-28">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <div className="w-24 h-24 gradient-boost rounded-[32px] flex items-center justify-center shadow-2xl shadow-orange-500/30 animate-float">
          <ICONS.Boost size={48} className="text-black" />
        </div>
        
        <div className="space-y-3">
          <h2 className="text-4xl font-bold">Boostez votre visibilité</h2>
          <p className="text-secondary text-lg max-w-xs mx-auto">Soyez le profil n°1 dans votre région pendant 30 minutes.</p>
        </div>

        <div className="w-full space-y-4">
          <div className="glass p-6 rounded-[32px] border-orange-500/30 bg-orange-500/5 flex items-center justify-between">
            <div className="text-left">
              <span className="block text-orange-400 font-bold">10 Boosts</span>
              <span className="text-sm text-secondary">Économisez 40%</span>
            </div>
            <span className="text-xl font-bold">19,99 €</span>
          </div>
          <div className="glass p-6 rounded-[32px] flex items-center justify-between">
            <div className="text-left">
              <span className="block font-bold">1 Boost</span>
              <span className="text-sm text-secondary">Populaire</span>
            </div>
            <span className="text-xl font-bold">3,99 €</span>
          </div>
        </div>

        <GlassButton variant="boost" className="w-full py-5 text-lg">
          Activer le Boost
        </GlassButton>
      </div>
    </div>
  );
};

export default BoostScreen;
