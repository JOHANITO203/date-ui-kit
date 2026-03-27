import logo from "@/assets/logo.png";

interface SplashScreenProps {
  onContinue: () => void;
  onLogin: () => void;
}

const SplashScreen = ({ onContinue, onLogin }: SplashScreenProps) => {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/videos/city-night.mp4"
        autoPlay
        muted
        loop
        playsInline
        poster="/videos/city-night-poster.jpg"
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />

      <div className="relative z-10 min-h-screen flex flex-col px-6">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <img
            src={logo}
            alt="Aura"
            width={72}
            height={72}
            className="opacity-90 animate-slide-up"
            style={{ animationDelay: "80ms" }}
          />
          <div className="space-y-4 max-w-sm">
            <h1
              className="text-3xl font-semibold text-white tracking-tight animate-slide-up"
              style={{ animationDelay: "140ms" }}
            >
              Des cultures différentes. Une seule connexion.
            </h1>
            <p
              className="text-sm text-white/70 leading-relaxed animate-slide-up"
              style={{ animationDelay: "220ms" }}
            >
              Connectez-vous avec des personnes du monde entier, sans barrière de langue.
            </p>
          </div>
        </div>

        <div className="pb-10 space-y-3 animate-slide-up" style={{ animationDelay: "300ms" }}>
          <button
            onClick={onContinue}
            className="w-full py-3.5 rounded-2xl bg-gradient-love text-white font-semibold shadow-xl transition-all hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99]"
          >
            Commencer
          </button>
          <button
            onClick={onLogin}
            className="w-full py-3.5 rounded-2xl border border-white/25 bg-white/10 text-white/90 font-medium backdrop-blur-sm transition-all hover:bg-white/15"
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
