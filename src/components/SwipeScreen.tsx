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
    }, 350);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 pb-28 pt-8 animate-fade-in">
      {/* Profile Card */}
      <div
        className={`relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-xl transition-all duration-350 ${
          swipeDirection === "left"
            ? "-translate-x-[120%] rotate-[-12deg] opacity-0"
            : swipeDirection === "right"
            ? "translate-x-[120%] rotate-[12deg] opacity-0"
            : ""
        }`}
      >
        <img
          src={current.image}
          alt={current.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-7 space-y-1">
          <h3 className="text-3xl font-display font-light text-white">
            {current.name}, <span className="text-white/80">{current.age}</span>
          </h3>
          <p className="text-sm font-body font-light text-white/70 tracking-wide">
            {current.bio}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-6 mt-8">
        <button
          onClick={() => handleAction(false)}
          className="w-16 h-16 rounded-full bg-surface-elevated shadow-md flex items-center justify-center transition-all hover:shadow-lg hover:scale-105 active:scale-95"
        >
          <X className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => handleAction(true)}
          className="w-20 h-20 rounded-full bg-primary shadow-lg flex items-center justify-center transition-all hover:shadow-xl hover:scale-105 active:scale-95"
        >
          <Heart className="w-8 h-8 text-primary-foreground" strokeWidth={1.5} fill="currentColor" />
        </button>
      </div>
    </div>
  );
};

export default SwipeScreen;
