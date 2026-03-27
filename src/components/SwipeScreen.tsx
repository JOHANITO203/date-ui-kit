import { useState } from "react";
import { X, Heart, Star, ChevronLeft, ChevronRight } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";
import profile3 from "@/assets/profile-3.jpg";

const profiles = [
  { name: "Alina", age: 28, bio: "Art director · Paris", images: [profile1, profile2, profile3] },
  { name: "Marco", age: 31, bio: "Architect · Milan", images: [profile2, profile1, profile3] },
  { name: "Sofia", age: 26, bio: "Journalist · Barcelona", images: [profile3, profile1, profile2] },
];

interface SwipeScreenProps {
  onMatch: () => void;
}

const SwipeScreen = ({ onMatch }: SwipeScreenProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const current = profiles[currentIndex % profiles.length];

  const handleAction = (type: "skip" | "like" | "superlike") => {
    setSwipeDirection(type === "skip" ? "left" : "right");
    setTimeout(() => {
      setSwipeDirection(null);
      setPhotoIndex(0);
      if ((type === "like" || type === "superlike") && currentIndex === 0) {
        onMatch();
      }
      setCurrentIndex((i) => i + 1);
    }, 350);
  };

  const navigatePhoto = (dir: "prev" | "next") => {
    setPhotoIndex((i) => {
      if (dir === "next") return Math.min(i + 1, current.images.length - 1);
      return Math.max(i - 1, 0);
    });
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
          src={current.images[photoIndex]}
          alt={current.name}
          className="w-full h-full object-cover transition-opacity duration-200"
        />

        {/* Photo navigation zones */}
        <button
          onClick={() => navigatePhoto("prev")}
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
          aria-label="Previous photo"
        />
        <button
          onClick={() => navigatePhoto("next")}
          className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
          aria-label="Next photo"
        />

        {/* Photo nav arrows (subtle) */}
        {photoIndex > 0 && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center pointer-events-none z-20">
            <ChevronLeft className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
        )}
        {photoIndex < current.images.length - 1 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center pointer-events-none z-20">
            <ChevronRight className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
        )}

        {/* Photo indicator dots */}
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 z-20">
          {current.images.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === photoIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-7 space-y-1 pointer-events-none">
          <h3 className="text-3xl font-display font-light text-white">
            {current.name}, <span className="text-white/80">{current.age}</span>
          </h3>
          <p className="text-sm font-body font-light text-white/70 tracking-wide">
            {current.bio}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-5 mt-8">
        <button
          onClick={() => handleAction("skip")}
          className="w-14 h-14 rounded-full bg-surface-elevated shadow-md flex items-center justify-center transition-all hover:shadow-lg hover:scale-105 active:scale-95"
        >
          <X className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => handleAction("superlike")}
          className="w-14 h-14 rounded-full bg-surface-elevated shadow-md flex items-center justify-center transition-all hover:shadow-lg hover:scale-105 active:scale-95"
        >
          <Star className="w-6 h-6 text-blue-500" strokeWidth={1.5} fill="currentColor" />
        </button>
        <button
          onClick={() => handleAction("like")}
          className="w-[72px] h-[72px] rounded-full bg-primary shadow-lg flex items-center justify-center transition-all hover:shadow-xl hover:scale-105 active:scale-95"
        >
          <Heart className="w-8 h-8 text-primary-foreground" strokeWidth={1.5} fill="currentColor" />
        </button>
      </div>
    </div>
  );
};

export default SwipeScreen;
