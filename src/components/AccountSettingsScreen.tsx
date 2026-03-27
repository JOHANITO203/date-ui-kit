import { ArrowLeft, ChevronRight, Lock, Mail, Phone, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AccountSettingsScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="min-h-screen bg-gradient-to-b from-[#261030] via-[#0b0b10] to-black px-5 pt-10 pb-28">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white/80 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="uppercase tracking-[0.25em] text-[11px]">Compte</span>
            </button>
            <button className="text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white transition-colors">
              Enregistrer
            </button>
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-accent-blue" />
              <div>
                <p className="text-sm font-semibold text-white">Securite</p>
                <p className="text-xs text-white/50">Protegez votre compte</p>
              </div>
            </div>
            {[
              { label: "Mot de passe", value: "Derniere mise a jour il y a 2 semaines", icon: Lock },
              { label: "Double authentification", value: "Active", icon: ShieldCheck },
            ].map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center justify-between px-3 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-white/60" />
                  <div className="text-left">
                    <p className="text-sm text-white">{item.label}</p>
                    <p className="text-xs text-white/50">{item.value}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Coordonnees</p>
            {[
              { label: "Telephone", value: "+33 6 12 34 56 78", icon: Phone },
              { label: "Email", value: "sophie.d@email.fr", icon: Mail },
            ].map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center justify-between px-3 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-white/60" />
                  <div className="text-left">
                    <p className="text-sm text-white">{item.label}</p>
                    <p className="text-xs text-white/50">{item.value}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsScreen;
