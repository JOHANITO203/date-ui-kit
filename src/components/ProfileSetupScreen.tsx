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
    <div className="min-h-screen bg-background px-6 py-14 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-10">
        <div className="space-y-3">
          <h2 className="text-3xl font-display font-light text-foreground">
            Your Profile
          </h2>
          <p className="text-sm text-muted-foreground font-body font-light">
            Show your best self — dates exotiques
          </p>
        </div>

        {/* Photo Upload */}
        <div className="space-y-4">
          <span className="text-xs text-muted-foreground tracking-widest uppercase font-body">
            Photos
          </span>
          <div className="grid grid-cols-3 gap-3">
            <div className="aspect-[3/4] bg-surface-elevated rounded-2xl border-2 border-dashed border-primary/30 flex items-center justify-center cursor-pointer hover:border-primary/60 transition-all group shadow-sm">
              <Camera className="w-6 h-6 text-primary/50 group-hover:text-primary transition-colors" strokeWidth={1.5} />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] bg-muted/50 rounded-2xl border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-muted-foreground/40 transition-all"
              >
                <Plus className="w-5 h-5 text-muted-foreground/30" strokeWidth={1.5} />
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-3">
          <span className="text-xs text-muted-foreground tracking-widest uppercase font-body">
            Profile Visibility
          </span>
          <div className="bg-surface-elevated rounded-2xl p-1 shadow-sm">
            {([
              ["Name", "name"],
              ["City", "city"],
              ["Age", "age"],
              ["Bio", "bio"],
              ["Interests", "interests"],
            ] as const).map(([label, key], idx, arr) => (
              <div
                key={key}
                className={`flex items-center justify-between px-5 py-4 ${
                  idx < arr.length - 1 ? "border-b border-border/60" : ""
                }`}
              >
                <span className="text-sm font-body text-foreground">{label}</span>
                <button
                  onClick={() => toggleVisibility(key)}
                  className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                    visibility[key] ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
                      visibility[key] ? "translate-x-[22px]" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onComplete}
          className="w-full py-4 bg-primary text-primary-foreground text-sm font-body tracking-[0.15em] uppercase rounded-2xl transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
        >
          Start Discovering
        </button>
      </div>
    </div>
  );
};

export default ProfileSetupScreen;
