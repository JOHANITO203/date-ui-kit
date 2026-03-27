import { useState } from "react";

interface OnboardingScreenProps {
  onComplete: () => void;
}

const OnboardingScreen = ({ onComplete }: OnboardingScreenProps) => {
  const [ageRange, setAgeRange] = useState([22, 35]);
  const [distance, setDistance] = useState(50);
  const [preferences, setPreferences] = useState({
    women: true,
    men: false,
    notifications: true,
    location: true,
  });

  const togglePref = (key: keyof typeof preferences) => {
    setPreferences((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <div className="min-h-screen bg-background px-6 py-12 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-10">
        <div className="space-y-2">
          <h2 className="text-xl font-light tracking-[0.15em] text-foreground uppercase">
            Preferences
          </h2>
          <p className="text-sm text-muted-foreground font-light">
            Configure your discovery settings
          </p>
        </div>

        {/* Toggles */}
        <div className="space-y-0">
          {([
            ["Show Women", "women"],
            ["Show Men", "men"],
            ["Notifications", "notifications"],
            ["Location Access", "location"],
          ] as const).map(([label, key]) => (
            <div key={key} className="flex items-center justify-between py-4 border-b border-border">
              <span className="text-sm font-light tracking-wide text-foreground">{label}</span>
              <button
                onClick={() => togglePref(key)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  preferences[key] ? "bg-gold-muted" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${
                    preferences[key]
                      ? "translate-x-[22px] bg-gold"
                      : "translate-x-0.5 bg-muted-foreground"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Age Range */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-light tracking-wide text-foreground">Age Range</span>
            <span className="text-sm text-gold font-light">
              {ageRange[0]} – {ageRange[1]}
            </span>
          </div>
          <input
            type="range"
            min={18}
            max={99}
            value={ageRange[0]}
            onChange={(e) => setAgeRange([+e.target.value, Math.max(+e.target.value, ageRange[1])])}
            className="w-full accent-gold h-0.5 bg-muted appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <input
            type="range"
            min={18}
            max={99}
            value={ageRange[1]}
            onChange={(e) => setAgeRange([Math.min(ageRange[0], +e.target.value), +e.target.value])}
            className="w-full accent-gold h-0.5 bg-muted appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>

        {/* Distance */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-light tracking-wide text-foreground">Distance</span>
            <span className="text-sm text-gold font-light">{distance} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={200}
            value={distance}
            onChange={(e) => setDistance(+e.target.value)}
            className="w-full accent-gold h-0.5 bg-muted appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>

        <button
          onClick={onComplete}
          className="w-full py-3.5 bg-primary text-primary-foreground text-sm tracking-[0.2em] uppercase font-light rounded-lg transition-all hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreen;
