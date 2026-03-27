import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Settings,
  Sparkles,
} from "lucide-react";
import profile2 from "@/assets/profile-2.jpg";
import profile1 from "@/assets/profile-1.jpg";
import profile3 from "@/assets/profile-3.jpg";
import { Link } from "react-router-dom";

interface ProfileScreenProps {
  onReset: () => void;
}

const ProfileScreen = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="min-h-screen bg-gradient-to-b from-[#3a1456] via-[#0b0b10] to-black px-5 pt-10 pb-28">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span className="uppercase tracking-[0.25em] text-[11px]">Parametres du profil</span>
            </div>
            <button className="text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white transition-colors">
              Enregistrer
            </button>
          </div>

          {/* Identity / Progress */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-full p-1 bg-gradient-love shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
                <div className="w-full h-full rounded-full overflow-hidden bg-black">
                  <img src={profile2} alt="Profil" className="w-full h-full object-cover" />
                </div>
              </div>
              <CheckCircle2 className="absolute -right-1 -bottom-1 w-5 h-5 text-accent-blue" />
            </div>
            <button className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white/80 hover:text-white transition-colors">
              Modifier la photo
            </button>
            <div className="w-full">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Profil complete : 85%</span>
                <span>85%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                <div className="h-full w-[85%] bg-gradient-love" />
              </div>
            </div>
          </div>

          {/* Basic info */}
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Informations de base</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Nom", value: "Sophie" },
                { label: "Age", value: "26" },
                { label: "Genre", value: "Femme" },
                { label: "Localisation", value: "Paris" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{item.label}</p>
                  <p className="text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Votre biographie</p>
            <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 px-4 py-4">
              <p className="text-sm text-white/80">
                Salut ! J aime la randonnee, le cafe et decouvrir de nouveaux restos. Curieuse et spontanee.
              </p>
              <p className="text-[10px] text-white/40 mt-3">140 / 250</p>
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Photos & medias</p>
            <div className="grid grid-cols-3 gap-3">
              {[profile1, profile2, profile3, profile1, profile2].map((src, idx) => (
                <div
                  key={`${src}-${idx}`}
                  className="aspect-square rounded-2xl overflow-hidden bg-white/10 border border-white/10"
                >
                  <img src={src} alt="Media" className="w-full h-full object-cover" />
                </div>
              ))}
              <button className="aspect-square rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-white/60" />
              </button>
            </div>
            <p className="text-[11px] text-white/50">Ajoutez des photos pour booster votre profil.</p>
          </div>

          {/* Preferences */}
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Ce que je recherche</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Relation", value: "Long terme", icon: Sparkles },
                { label: "Dist. max", value: "35 km", icon: MapPin },
                { label: "Age", value: "25-34", icon: ChevronRight },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 px-3 py-3"
                >
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-white mt-2">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Settings links */}
          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-2">
            {[
              { label: "Parametres du compte", to: "/settings/account" },
              { label: "Confidentialite", to: "/settings/privacy" },
              { label: "Notifications", to: "/settings/notifications" },
              { label: "Preferences de recherche", to: "/settings/preferences" },
            ].map((item, idx) => (
              <Link
                key={item.label}
                to={item.to}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl hover:bg-white/10 transition-colors ${
                  idx < 3 ? "border-b border-white/10" : ""
                }`}
              >
                <span className="text-sm text-white">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
