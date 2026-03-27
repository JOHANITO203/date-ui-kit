import { ArrowLeft, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const PreferencesScreen = () => {
  const navigate = useNavigate();
  const [distance, setDistance] = useState(35);
  const [ageRange, setAgeRange] = useState([25, 34]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="min-h-screen bg-gradient-to-b from-[#261030] via-[#0b0b10] to-black px-5 pt-10 pb-28">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white/80 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="uppercase tracking-[0.25em] text-[11px]">Preferences</span>
            </button>
            <button className="text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white transition-colors">
              Enregistrer
            </button>
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-accent-pink" />
              <div>
                <p className="text-sm font-semibold text-white">Type de relation</p>
                <p className="text-xs text-white/50">Long terme</p>
              </div>
              <button className="ml-auto w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-accent-blue" />
              <div>
                <p className="text-sm font-semibold text-white">Distance max</p>
                <p className="text-xs text-white/50">{distance} km</p>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={200}
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
            />
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-accent-pink" />
              <div>
                <p className="text-sm font-semibold text-white">Tranche d age</p>
                <p className="text-xs text-white/50">
                  {ageRange[0]} - {ageRange[1]}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <input
                type="range"
                min={18}
                max={99}
                value={ageRange[0]}
                onChange={(e) => setAgeRange([Number(e.target.value), Math.max(Number(e.target.value), ageRange[1])])}
                className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
              />
              <input
                type="range"
                min={18}
                max={99}
                value={ageRange[1]}
                onChange={(e) => setAgeRange([Math.min(ageRange[0], Number(e.target.value)), Number(e.target.value)])}
                className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesScreen;
