import { useMemo, useState } from "react";
import { Camera, ChevronLeft, MapPin, Sparkles } from "lucide-react";

interface ProfileSetupScreenProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

const zodiacFromDate = (dateValue: string) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Belier";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taureau";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemeaux";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Lion";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Vierge";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Balance";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpion";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittaire";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorne";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Verseau";
  return "Poissons";
};

const ageFromDate = (dateValue: string) => {
  if (!dateValue) return "";
  const birth = new Date(dateValue);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age.toString();
};

const steps = [
  { id: 1, label: "Photo" },
  { id: 2, label: "Identite" },
  { id: 3, label: "Lieu" },
  { id: 4, label: "Terminer" },
];

const ProfileSetupScreen = ({ onComplete }: ProfileSetupScreenProps) => {
  const [step, setStep] = useState<Step>(1);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [location, setLocation] = useState("Paris, France");

  const age = useMemo(() => ageFromDate(birthDate), [birthDate]);
  const zodiac = useMemo(() => zodiacFromDate(birthDate), [birthDate]);

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(photoUrl);
    if (step === 2) return Boolean(firstName && lastName && birthDate);
    if (step === 3) return Boolean(location);
    return true;
  }, [step, photoUrl, firstName, lastName, birthDate, location]);

  const handlePhoto = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  };

  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-28 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            className={`w-10 h-10 rounded-full border border-border/60 flex items-center justify-center transition-all ${
              step === 1 ? "opacity-30 pointer-events-none" : "hover:bg-surface-elevated"
            }`}
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            {steps.map((s) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  step === s.id ? "w-6 bg-accent-pink" : "w-2 bg-white/10"
                }`}
              />
            ))}
          </div>
          <div className="w-10 h-10" />
        </div>

        {step === 1 && (
          <div className="space-y-6 animate-slide-up">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Votre photo</h2>
              <p className="text-sm text-muted-foreground">
                Une photo claire suffit. Gardez-le simple et naturel.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-2 row-span-2 aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 bg-surface-elevated shadow-lg flex items-center justify-center cursor-pointer">
                {photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Camera className="w-7 h-7" />
                    <span className="text-xs uppercase tracking-[0.3em]">Importer</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhoto(e.target.files?.[0])}
                />
              </label>
              <div className="aspect-square rounded-2xl bg-white/5 border border-white/10" />
              <div className="aspect-square rounded-2xl bg-white/5 border border-white/10" />
              <div className="aspect-square rounded-2xl bg-white/5 border border-white/10" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-slide-up">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Identite</h2>
              <p className="text-sm text-muted-foreground">
                Le prenom sera mis en avant. Le nom reste discret.
              </p>
            </div>

            <div className="space-y-4">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prenom"
                className="w-full bg-surface-elevated border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-blue/60"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className="w-full bg-surface-elevated border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-blue/60"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-surface-elevated border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent-blue/60"
                />
                <div className="w-full bg-surface-elevated border border-border/60 rounded-2xl px-4 py-3 text-sm text-muted-foreground flex items-center justify-between">
                  <span>Age</span>
                  <span className="text-foreground">{age || "--"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-accent-blue" />
                <span>Signe astrologique: {zodiac || "Auto"}</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-slide-up">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Localisation</h2>
              <p className="text-sm text-muted-foreground">
                Nous utilisons votre position pour des matches proches.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setLocation("Paris, France")}
                className="w-full py-3 rounded-2xl border border-white/15 bg-white/5 text-white/80 text-sm flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4 text-accent-blue" />
                Utiliser ma position
              </button>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ville"
                className="w-full bg-surface-elevated border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-blue/60"
              />
              <p className="text-xs text-muted-foreground">
                Vous pourrez modifier ce champ plus tard.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-slide-up">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Pret a matcher</h2>
              <p className="text-sm text-muted-foreground">
                Profil pret. Vous pouvez commencer des maintenant.
              </p>
            </div>

            <div className="rounded-3xl bg-surface-elevated border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10">
                  {photoUrl && <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{firstName}</p>
                  <p className="text-xs text-muted-foreground">
                    {age ? `${age} ans` : "Age"} · {location}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Signe: {zodiac || "Auto"}
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 space-y-3">
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => ((s + 1) as Step))}
              disabled={!canContinue}
              className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all shadow-lg ${
                canContinue
                  ? "bg-gradient-love text-white hover:shadow-xl"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              Continuer
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-gradient-love text-white shadow-lg hover:shadow-xl"
            >
              Acceder a l app
            </button>
          )}
          <p className="text-[11px] text-muted-foreground text-center">
            30-60 secondes pour activer votre profil
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetupScreen;
