import { useState } from "react";
import { Camera, Plus } from "lucide-react";

interface ProfileSetupScreenProps {
  onComplete: () => void;
}

const ProfileSetupScreen = ({ onComplete }: ProfileSetupScreenProps) => {
  const [visibility, setVisibility] = useState({
    name: true,
    city: true,
    age: true,
    bio: false,
    interests: true,
  });

  const toggleVisibility = (key: keyof typeof visibility) => {
    setVisibility((v) => ({ ...v, [key]: !v[key] }));
  };

  return (
    <div className="min-h-screen bg-background px-6 py-12 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-10">
        <div className="space-y-2">
          <h2 className="text-xl font-light tracking-[0.15em] text-foreground uppercase">
            Profile Setup
          </h2>
          <p className="text-sm text-muted-foreground font-light">
            Dates exotiques — show your best self
          </p>
        </div>

        {/* Photo Upload */}
        <div className="space-y-4">
          <span className="text-xs text-muted-foreground tracking-widest uppercase">Photos</span>
          <div className="grid grid-cols-3 gap-3">
            <div className="aspect-[3/4] bg-surface-elevated rounded-lg border border-border flex items-center justify-center cursor-pointer hover:border-gold transition-colors group">
              <Camera className="w-6 h-6 text-muted-foreground group-hover:text-gold transition-colors" strokeWidth={1.5} />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] bg-surface rounded-lg border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-gold/50 transition-colors"
              >
                <Plus className="w-5 h-5 text-muted-foreground/50" strokeWidth={1} />
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground tracking-widest uppercase">
            Profile Visibility
          </span>
          {([
            ["Name", "name"],
            ["City", "city"],
            ["Age", "age"],
            ["Bio", "bio"],
            ["Interests", "interests"],
          ] as const).map(([label, key]) => (
            <div key={key} className="flex items-center justify-between py-3.5 border-b border-border">
              <span className="text-sm font-light tracking-wide text-foreground">{label}</span>
              <button
                onClick={() => toggleVisibility(key)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  visibility[key] ? "bg-gold-muted" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${
                    visibility[key]
                      ? "translate-x-[22px] bg-gold"
                      : "translate-x-0.5 bg-muted-foreground"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onComplete}
          className="w-full py-3.5 bg-primary text-primary-foreground text-sm tracking-[0.2em] uppercase font-light rounded-lg transition-all hover:opacity-90"
        >
          Start Discovering
        </button>
      </div>
    </div>
  );
};

export default ProfileSetupScreen;
