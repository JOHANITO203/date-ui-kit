import { useNavigate } from 'react-router-dom';
import GlassButton from './ui/GlassButton';

const SplashScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="relative h-full w-full flex flex-col items-center justify-end p-8 overflow-hidden">
      {/* Background "Video" Simulation */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1514525253344-f814d0743b15?auto=format&fit=crop&w=1920&q=80" 
          className="w-full h-full object-cover opacity-60 scale-110 animate-pulse"
          alt="Splash Background"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-8 mb-12">
        <div className="w-20 h-20 glass rounded-[24px] flex items-center justify-center mb-4">
          <div className="w-10 h-10 gradient-premium rounded-full blur-[2px]" />
        </div>
        
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">
            Des cultures différentes.<br/>
            <span className="text-transparent bg-clip-text gradient-premium">Une seule connexion.</span>
          </h1>
          <p className="text-secondary text-lg">
            Connectez-vous avec des personnes du monde entier...
          </p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <GlassButton variant="premium" onClick={() => navigate('/onboarding')} className="w-full text-lg font-semibold">
            Commencer
          </GlassButton>
          <GlassButton onClick={() => navigate('/login')} className="w-full text-lg">
            Se connecter
          </GlassButton>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
