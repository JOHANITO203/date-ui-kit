import { ArrowLeft, Camera, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";
import profile3 from "@/assets/profile-3.jpg";

const EditProfileScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="min-h-screen bg-gradient-to-b from-[#3a1456] via-[#0b0b10] to-black px-5 pt-10 pb-28">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white/80 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="uppercase tracking-[0.25em] text-[11px]">Modifier profil</span>
            </button>
            <button className="text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white transition-colors">
              Enregistrer
            </button>
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
        </div>
      </div>
    </div>
  );
};

export default EditProfileScreen;
