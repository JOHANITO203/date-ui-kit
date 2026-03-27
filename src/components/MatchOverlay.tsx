import { Heart, MessageCircle, X } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";

interface MatchOverlayProps {
  onClose: () => void;
}

const MatchOverlay = ({ onClose }: MatchOverlayProps) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Blurred background with both profile images */}
      <div className="absolute inset-0">
        <img src={profile1} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30" />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-2xl" />
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center z-20 hover:bg-foreground/10 transition-colors"
      >
        <X className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
      </button>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-8">
        {/* Floating heart icon */}
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-8 animate-float">
          <Heart className="w-7 h-7 text-primary" strokeWidth={1.5} fill="currentColor" />
        </div>

        {/* Overlapping Avatars */}
        <div className="relative flex items-center justify-center mb-10">
          <div className="w-32 h-32 rounded-full overflow-hidden shadow-2xl ring-4 ring-surface-elevated animate-scale-in z-10 -mr-4">
            <img src={profile2} alt="You" className="w-full h-full object-cover" />
          </div>
          <div className="w-32 h-32 rounded-full overflow-hidden shadow-2xl ring-4 ring-surface-elevated animate-scale-in -ml-4" style={{ animationDelay: "0.1s" }}>
            <img src={profile1} alt="Match" className="w-full h-full object-cover" />
          </div>
          {/* Connection line */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary shadow-lg flex items-center justify-center z-20 animate-scale-in" style={{ animationDelay: "0.3s" }}>
            <Heart className="w-5 h-5 text-primary-foreground" strokeWidth={2} fill="currentColor" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-4xl font-display font-light text-foreground mb-3">
            It's a Match!
          </h2>
          <p className="text-base text-muted-foreground font-body font-light">
            You and <span className="text-foreground font-medium">Alina</span> liked each other
          </p>
        </div>

        {/* Compatibility badge */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-primary/8 rounded-full mb-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <span className="text-xs font-body text-primary font-medium">92% Compatible</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs font-body text-muted-foreground">5 shared interests</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs animate-slide-up" style={{ animationDelay: "0.5s" }}>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-3 py-4 bg-primary text-primary-foreground text-sm font-body tracking-[0.1em] uppercase rounded-2xl transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
            Send a Message
          </button>

          <button
            onClick={onClose}
            className="w-full py-3.5 text-sm text-muted-foreground font-body tracking-wide hover:text-foreground transition-colors bg-foreground/5 rounded-2xl"
          >
            Keep Swiping
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchOverlay;
