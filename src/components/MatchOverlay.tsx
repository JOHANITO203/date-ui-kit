import { Heart, MessageCircle, X } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";

interface MatchOverlayProps {
  onClose: () => void;
}

const MatchOverlay = ({ onClose }: MatchOverlayProps) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={profile1} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30" />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl" />
      </div>

      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center z-20 hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5 text-white/70" strokeWidth={1.5} />
      </button>

      <div className="relative z-10 flex flex-col items-center px-8">
        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-8 animate-float">
          <Heart className="w-7 h-7 text-accent-pink" strokeWidth={1.5} fill="currentColor" />
        </div>

        <div className="relative flex items-center justify-center mb-10">
          <div className="w-32 h-32 rounded-full overflow-hidden shadow-2xl ring-4 ring-surface-elevated animate-scale-in z-10 -mr-4">
            <img src={profile2} alt="You" className="w-full h-full object-cover" />
          </div>
          <div className="w-32 h-32 rounded-full overflow-hidden shadow-2xl ring-4 ring-surface-elevated animate-scale-in -ml-4" style={{ animationDelay: "0.1s" }}>
            <img src={profile1} alt="Match" className="w-full h-full object-cover" />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-love shadow-lg flex items-center justify-center z-20 animate-scale-in" style={{ animationDelay: "0.3s" }}>
            <Heart className="w-5 h-5 text-white" strokeWidth={2} fill="currentColor" />
          </div>
        </div>

        <div className="text-center mb-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-3xl font-semibold text-white mb-2">
            C est un match
          </h2>
          <p className="text-sm text-white/70">
            Vous et <span className="text-white font-medium">Alina</span> vous plaisez.
          </p>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 bg-white/10 rounded-full mb-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <span className="text-xs text-white/90 font-medium">92% compatible</span>
          <span className="text-xs text-white/40">·</span>
          <span className="text-xs text-white/60">5 centres d interet</span>
        </div>

        <div className="flex flex-col items-center gap-3 w-full max-w-xs animate-slide-up" style={{ animationDelay: "0.5s" }}>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-love text-white text-sm font-semibold uppercase tracking-[0.12em] rounded-2xl transition-all hover:opacity-95 active:scale-[0.98] shadow-lg"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
            Envoyer un message
          </button>

          <button
            onClick={onClose}
            className="w-full py-3.5 text-sm text-white/70 font-body tracking-wide hover:text-white transition-colors bg-white/5 rounded-2xl"
          >
            Continuer a swiper
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchOverlay;
