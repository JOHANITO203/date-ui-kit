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
    <div className="min-h-screen bg-background px-6 pt-14 pb-28 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-8">
        <h2 className="text-3xl font-display font-light text-foreground">
          Matches
        </h2>

        <div className="space-y-3">
          {matches.map((match) => (
            <button
              key={match.name}
              onClick={onOpenChat}
              className="w-full flex items-center gap-4 p-4 bg-surface-elevated rounded-2xl shadow-sm hover:shadow-md transition-all text-left active:scale-[0.98]"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full overflow-hidden shadow-sm">
                  <img src={match.image} alt={match.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                {match.online && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary rounded-full border-2 border-surface-elevated" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-body font-medium text-foreground">
                    {match.name}, {match.age}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-body">2h</span>
                </div>
                <p className="text-xs text-muted-foreground font-body font-light truncate mt-0.5">
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
