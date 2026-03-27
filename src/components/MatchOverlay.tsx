import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";

interface MatchOverlayProps {
  onClose: () => void;
}

const MatchOverlay = ({ onClose }: MatchOverlayProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
      {/* Overlapping Avatars */}
      <div className="flex items-center -space-x-6 mb-8">
        <div className="w-28 h-28 rounded-full border-2 border-gold overflow-hidden z-10">
          <img src={profile2} alt="You" className="w-full h-full object-cover" />
        </div>
        <div className="w-28 h-28 rounded-full border-2 border-primary overflow-hidden">
          <img src={profile1} alt="Match" className="w-full h-full object-cover" />
        </div>
      </div>

      <h2 className="text-3xl font-light tracking-[0.25em] text-gold uppercase mb-2 animate-scale-in">
        It's a Match!
      </h2>
      <p className="text-sm text-muted-foreground font-light tracking-wide mb-10">
        You and Alina liked each other
      </p>

      <button
        onClick={onClose}
        className="px-10 py-3 border border-gold text-gold text-sm tracking-[0.2em] uppercase font-light rounded-lg transition-all hover:bg-gold hover:text-background"
      >
        Say Hello
      </button>

      <button
        onClick={onClose}
        className="mt-4 text-xs text-muted-foreground tracking-widest uppercase hover:text-foreground transition-colors"
      >
        Keep Swiping
      </button>
    </div>
  );
};

export default MatchOverlay;
