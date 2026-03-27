import { useState } from "react";
import { X, Heart } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";
import profile3 from "@/assets/profile-3.jpg";

const profiles = [
  { name: "Alina", age: 28, bio: "Art director · Paris", image: profile1 },
  { name: "Marco", age: 31, bio: "Architect · Milan", image: profile2 },
  { name: "Sofia", age: 26, bio: "Journalist · Barcelona", image: profile3 },
];

interface SwipeScreenProps {
  onMatch: () => void;
}

const SwipeScreen = ({ onMatch }: SwipeScreenProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const current = profiles[currentIndex % profiles.length];

  const handleAction = (liked: boolean) => {
    setSwipeDirection(liked ? "right" : "left");
    setTimeout(() => {
      setSwipeDirection(null);
      if (liked && currentIndex === 0) {
        onMatch();
      }
      setCurrentIndex((i) => i + 1);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 pb-24 pt-8 animate-fade-in">
      {/* Profile Card */}
      <div
        className={`relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden border border-border/30 transition-transform duration-300 ${
          swipeDirection === "left"
            ? "-translate-x-[120%] rotate-[-15deg] opacity-0"
            : swipeDirection === "right"
            ? "translate-x-[120%] rotate-[15deg] opacity-0"
            : ""
        }`}
      >
        <img
          src={current.image}
          alt={current.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 space-y-1">
          <h3 className="text-2xl font-light tracking-wide text-foreground">
            {current.name}, <span className="text-gold">{current.age}</span>
          </h3>
          <p className="text-sm font-light text-muted-foreground tracking-wide">
            {current.bio}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-8 mt-8">
        <button
          onClick={() => handleAction(false)}
          className="w-16 h-16 rounded-full border border-border flex items-center justify-center transition-all hover:border-muted-foreground hover:scale-105 active:scale-95"
        >
          <X className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => handleAction(true)}
          className="w-16 h-16 rounded-full bg-primary flex items-center justify-center transition-all hover:opacity-90 hover:scale-105 active:scale-95 animate-pulse-glow"
        >
          <Heart className="w-7 h-7 text-primary-foreground" strokeWidth={1.5} fill="currentColor" />
        </button>
      </div>
    </div>
  );
};

export default SwipeScreen;
