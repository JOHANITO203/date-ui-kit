import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";

interface MatchOverlayProps {
  onClose: () => void;
}

const MatchOverlay = ({ onClose }: MatchOverlayProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center animate-fade-in">
      {/* Overlapping Avatars */}
      <div className="flex items-center -space-x-5 mb-10">
        <div className="w-28 h-28 rounded-full border-[3px] border-primary overflow-hidden z-10 shadow-lg">
          <img src={profile2} alt="You" className="w-full h-full object-cover" />
        </div>
        <div className="w-28 h-28 rounded-full border-[3px] border-accent overflow-hidden shadow-lg">
          <img src={profile1} alt="Match" className="w-full h-full object-cover" />
        </div>
      </div>

      <h2 className="text-4xl font-display font-light text-foreground mb-2 animate-scale-in">
        It's a Match!
      </h2>
      <p className="text-sm text-muted-foreground font-body font-light tracking-wide mb-12">
        You and Alina liked each other
      </p>

      <button
        onClick={onClose}
        className="px-12 py-4 bg-primary text-primary-foreground text-sm font-body tracking-[0.15em] uppercase rounded-2xl transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
      >
        Say Hello
      </button>

      <button
        onClick={onClose}
        className="mt-5 text-sm text-muted-foreground font-body tracking-wide hover:text-foreground transition-colors"
      >
        Keep Swiping
      </button>
    </div>
  );
};

export default MatchOverlay;
