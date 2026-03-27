import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Flame, Heart, MapPin, Sparkles, X, Zap } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";
import profile3 from "@/assets/profile-3.jpg";

const profiles = [
  {
    name: "Alina",
    age: 28,
    city: "Paris",
    distance: "2 km",
    languages: ["FR", "EN"],
    match: "89%",
    bio: "Art director · Paris",
    interest: "Musées & vin",
    images: [profile1, profile2, profile3],
  },
  {
    name: "Marco",
    age: 31,
    city: "Milan",
    distance: "5 km",
    languages: ["IT", "EN"],
    match: "83%",
    bio: "Architect · Milan",
    interest: "Design durable",
    images: [profile2, profile1, profile3],
  },
  {
    name: "Sofia",
    age: 26,
    city: "Barcelona",
    distance: "3 km",
    languages: ["ES", "EN"],
    match: "91%",
    bio: "Journalist · Barcelona",
    interest: "Surf & cafés",
    images: [profile3, profile1, profile2],
  },
];

interface SwipeScreenProps {
  onMatch: () => void;
}

const SwipeScreen = ({ onMatch }: SwipeScreenProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "super" | null>(null);

  const current = profiles[currentIndex % profiles.length];
  const next = profiles[(currentIndex + 1) % profiles.length];

  const handleAction = (type: "skip" | "like" | "superlike") => {
    setSwipeDirection(type === "skip" ? "left" : type === "superlike" ? "super" : "right");
    setTimeout(() => {
      setSwipeDirection(null);
      setPhotoIndex(0);
      if ((type === "like" || type === "superlike") && currentIndex === 0) {
        onMatch();
      }
      setCurrentIndex((i) => i + 1);
    }, 420);
  };

  const navigatePhoto = (dir: "prev" | "next") => {
    setPhotoIndex((i) => {
      if (dir === "next") return Math.min(i + 1, current.images.length - 1);
      return Math.max(i - 1, 0);
    });
  };

  const swipeLabel = useMemo(() => {
    if (swipeDirection === "left") return { text: "NOPE", tone: "border-accent-red text-accent-red" };
    if (swipeDirection === "right") return { text: "LIKE", tone: "border-accent-blue text-accent-blue" };
    if (swipeDirection === "super") return { text: "SUPER", tone: "border-[#a855f7] text-[#c084fc]" };
    return null;
  }, [swipeDirection]);

  return (
    <div className="min-h-screen bg-background pb-28 pt-6 animate-fade-in">
      <div className="max-w-lg mx-auto px-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-love shadow-md" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Découvrir</p>
              <h2 className="text-xl font-semibold text-foreground">Swipe</h2>
            </div>
          </div>
          <button className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-accent-orange" />
            Boost actif
          </button>
        </div>

        <div className="relative">
          {/* Subtle depth ring */}
          <div className="absolute inset-0 rounded-[40px] bg-white/5 blur-2xl opacity-30" />

          {/* Main card */}
          <div
            className={`relative w-full aspect-[3/4] rounded-[36px] overflow-hidden shadow-2xl transition-all duration-500 ${
              swipeDirection === "left"
                ? "-translate-x-[120%] rotate-[-10deg] opacity-0"
                : swipeDirection === "right"
                ? "translate-x-[120%] rotate-[10deg] opacity-0"
                : swipeDirection === "super"
                ? "translate-y-[-12%] rotate-[2deg] opacity-0"
                : ""
            }`}
          >
            <img
              key={`${currentIndex}-${photoIndex}`}
              src={current.images[photoIndex]}
              alt={current.name}
              className="w-full h-full object-cover transition-opacity duration-500"
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

            {/* Photo nav arrows */}
            {photoIndex > 0 && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-none z-20">
                <ChevronLeft className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
            )}
            {photoIndex < current.images.length - 1 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-none z-20">
                <ChevronRight className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
            )}

            {/* Photo indicator bar */}
            <div className="absolute top-3 left-4 right-4 flex gap-1.5 z-20">
              {current.images.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === photoIndex ? "flex-1 bg-white/90 shadow" : "flex-1 bg-white/30"
                  }`}
                />
              ))}
            </div>

            {/* Swipe feedback label */}
            {swipeLabel && (
              <div className={`absolute top-16 left-6 px-3 py-1 rounded-xl border text-xs font-semibold tracking-[0.3em] ${swipeLabel.tone}`}>
                {swipeLabel.text}
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3 pointer-events-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-3xl font-semibold text-white">
                    {current.name}, <span className="text-white/80">{current.age}</span>
                  </h3>
                  <CheckCircle2 className="w-5 h-5 text-accent-blue" />
                </div>
                <span className="text-xs text-white/75 bg-white/10 px-3 py-1 rounded-full">
                  {current.match} match
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/70">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-accent-blue" />
                  {current.city} · {current.distance}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent-pink" />
                  {current.languages.join(" / ")}
                </span>
              </div>
              <p className="text-sm font-body font-light text-white/75 tracking-wide">
                {current.bio}
              </p>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 text-white text-xs">
                {current.interest}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-5 mt-4">
          <button
            onClick={() => handleAction("skip")}
            className="w-14 h-14 rounded-full bg-surface-elevated border border-white/10 shadow-md flex items-center justify-center transition-all hover:shadow-lg hover:scale-105 active:scale-95 text-accent-red"
          >
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => handleAction("superlike")}
            className="w-[72px] h-[72px] rounded-full bg-gradient-violet shadow-lg flex items-center justify-center transition-all hover:shadow-xl hover:scale-105 active:scale-95 text-white"
          >
            <Flame className="w-7 h-7" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => handleAction("like")}
            className="w-14 h-14 rounded-full bg-surface-elevated border border-white/10 shadow-md flex items-center justify-center transition-all hover:shadow-lg hover:scale-105 active:scale-95 text-accent-blue"
          >
            <Heart className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwipeScreen;
