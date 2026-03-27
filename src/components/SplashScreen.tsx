import logo from "@/assets/logo.png";

interface SplashScreenProps {
  onContinue: () => void;
}

const SplashScreen = ({ onContinue }: SplashScreenProps) => {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-background px-8 cursor-pointer"
      onClick={onContinue}
    >
      <div className="flex flex-col items-center gap-10 animate-fade-in">
        <img
          src={logo}
          alt="Мой Date"
          width={100}
          height={100}
          className="animate-scale-in opacity-80"
        />
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-display font-light tracking-wide text-foreground">
            Мой Date
          </h1>
          <p className="text-sm font-body font-light tracking-[0.12em] text-muted-foreground italic">
            Des rencontres exotiques
          </p>
        </div>
      </div>
      <p className="absolute bottom-14 text-xs text-muted-foreground/60 tracking-[0.2em] uppercase font-body animate-fade-in-slow">
        Tap to continue
      </p>
    </div>
  );
};

export default SplashScreen;
