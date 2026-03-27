import profile1 from "@/assets/profile-1.jpg";
import profile3 from "@/assets/profile-3.jpg";

interface MatchesScreenProps {
  onOpenChat: () => void;
}

const matches = [
  { name: "Alina", age: 28, image: profile1, lastMsg: "It's beautiful right now!", online: true },
  { name: "Sofia", age: 26, image: profile3, lastMsg: "Let's meet sometime!", online: false },
];

const MatchesScreen = ({ onOpenChat }: MatchesScreenProps) => {
  return (
    <div className="min-h-screen bg-background px-6 pt-12 pb-24 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-8">
        <h2 className="text-xl font-light tracking-[0.15em] text-foreground uppercase">
          Matches
        </h2>

        <div className="space-y-0">
          {matches.map((match) => (
            <button
              key={match.name}
              onClick={onOpenChat}
              className="w-full flex items-center gap-4 py-4 border-b border-border hover:bg-surface-elevated/50 transition-colors text-left px-1 rounded-sm"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full overflow-hidden border border-border">
                  <img src={match.image} alt={match.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                {match.online && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gold rounded-full border-2 border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-light tracking-wide text-foreground">
                    {match.name}, {match.age}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">2h</span>
                </div>
                <p className="text-xs text-muted-foreground font-light truncate mt-0.5">
                  {match.lastMsg}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatchesScreen;
