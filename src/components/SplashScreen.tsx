import { useNavigate } from 'react-router-dom';
import GlassButton from './ui/GlassButton';

const SplashScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="screen-safe relative h-full w-full flex flex-col items-center justify-end overflow-hidden">
      <div className="absolute inset-0 z-0">
        <video
          className="w-full h-full object-cover opacity-70"
          src="/videos/city-night.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="relative z-10 container-narrow w-full px-[var(--page-x)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:pb-10 flex flex-col items-center gap-[var(--section-gap)]">
        <div className="w-20 h-20 glass rounded-[24px] flex items-center justify-center mb-4">
          <div className="w-10 h-10 gradient-premium rounded-full blur-[2px]" />
        </div>

        <div className="text-center space-y-3">
          <h1 className="fluid-title font-bold tracking-tight">
            Des cultures differentes.<br />
            <span className="text-transparent bg-clip-text gradient-premium">Une seule connexion.</span>
          </h1>
          <p className="text-secondary fluid-subtitle">
            Connectez-vous avec des personnes du monde entier...
          </p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <GlassButton variant="premium" onClick={() => navigate('/onboarding')} className="w-full h-[var(--cta-height)] text-base md:text-lg font-semibold">
            Commencer
          </GlassButton>
          <GlassButton onClick={() => navigate('/login')} className="w-full h-[var(--cta-height)] text-base md:text-lg">
            Se connecter
          </GlassButton>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
