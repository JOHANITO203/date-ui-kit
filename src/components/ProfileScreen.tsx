import { Settings, LogOut } from "lucide-react";
import profile2 from "@/assets/profile-2.jpg";

interface ProfileScreenProps {
  onReset: () => void;
}

const ProfileScreen = ({ onReset }: ProfileScreenProps) => {
  return (
    <div className="min-h-screen bg-background px-6 pt-12 pb-24 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-light tracking-[0.15em] text-foreground uppercase">
            Profile
          </h2>
          <Settings className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-gold">
            <img src={profile2} alt="Your profile" className="w-full h-full object-cover" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-light tracking-wide text-foreground">Marco, 31</h3>
            <p className="text-sm text-muted-foreground font-light">Architect · Milan</p>
          </div>
        </div>

        <div className="space-y-0">
          {["Edit Profile", "Privacy Settings", "Notifications", "Help & Support", "Terms of Use"].map(
            (item) => (
              <div
                key={item}
                className="flex items-center justify-between py-4 border-b border-border cursor-pointer hover:bg-surface-elevated/30 transition-colors px-1"
              >
                <span className="text-sm font-light tracking-wide text-foreground">{item}</span>
                <span className="text-muted-foreground text-xs">›</span>
              </div>
            )
          )}
        </div>

        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-primary tracking-[0.15em] uppercase font-light transition-opacity hover:opacity-70"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
