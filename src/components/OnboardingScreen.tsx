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
    <div className="min-h-screen bg-background px-6 py-14 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-10">
        <div className="space-y-3">
          <h2 className="text-3xl font-display font-light text-foreground">
            Your Preferences
          </h2>
          <p className="text-sm text-muted-foreground font-body font-light">
            Tell us what you're looking for
          </p>
        </div>

        {/* Toggles */}
        <div className="bg-surface-elevated rounded-2xl p-1 shadow-sm">
          {([
            ["Show Women", "women"],
            ["Show Men", "men"],
            ["Notifications", "notifications"],
            ["Location Access", "location"],
          ] as const).map(([label, key], idx, arr) => (
            <div
              key={key}
              className={`flex items-center justify-between px-5 py-4 ${
                idx < arr.length - 1 ? "border-b border-border/60" : ""
              }`}
            >
              <span className="text-sm font-body text-foreground">{label}</span>
              <button
                onClick={() => togglePref(key)}
                className={`relative w-[52px] h-[30px] rounded-full transition-all duration-300 ${
                  preferences[key] ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-[3px] left-[3px] w-6 h-6 rounded-full shadow transition-all duration-300 ${
                    preferences[key] ? "translate-x-[22px] bg-primary-foreground" : "translate-x-0 bg-muted-foreground/70"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Age Range */}
        <div className="space-y-5">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-body text-foreground">Age Range</span>
            <span className="text-2xl font-display font-light text-primary">
              {ageRange[0]}–{ageRange[1]}
            </span>
          </div>
          <div className="space-y-3">
            <input
              type="range"
              min={18}
              max={99}
              value={ageRange[0]}
              onChange={(e) => setAgeRange([+e.target.value, Math.max(+e.target.value, ageRange[1])])}
              className="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <input
              type="range"
              min={18}
              max={99}
              value={ageRange[1]}
              onChange={(e) => setAgeRange([Math.min(ageRange[0], +e.target.value), +e.target.value])}
              className="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110"
            />
          </div>
        </div>

        {/* Distance */}
        <div className="space-y-5">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-body text-foreground">Distance</span>
            <span className="text-2xl font-display font-light text-primary">{distance} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={200}
            value={distance}
            onChange={(e) => setDistance(+e.target.value)}
            className="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110"
          />
        </div>

        <button
          onClick={onComplete}
          className="w-full py-4 bg-primary text-primary-foreground text-sm font-body tracking-[0.15em] uppercase rounded-2xl transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreen;
