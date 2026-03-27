import logo from "@/assets/logo.png";

interface SplashScreenProps {
  onContinue: () => void;
}

const SplashScreen = ({ onContinue }: SplashScreenProps) => {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-background px-8 animate-fade-in cursor-pointer"
      onClick={onContinue}
    >
      <div className="flex flex-col items-center gap-8">
        <img src={logo} alt="Мой Date" width={120} height={120} className="animate-scale-in" />
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-light tracking-[0.2em] text-foreground uppercase">
            Мой Date
          </h1>
          <p className="text-sm font-light tracking-[0.15em] text-gold italic">
            Des rencontres exotiques
          </p>
        </div>
      </div>
      <p className="absolute bottom-12 text-xs text-muted-foreground tracking-widest uppercase animate-fade-in">
        Tap to continue
      </p>
    </div>
  );
};

export default SplashScreen;
