import { Settings, LogOut } from "lucide-react";
import profile2 from "@/assets/profile-2.jpg";

interface ProfileScreenProps {
  onReset: () => void;
}

const ProfileScreen = ({ onReset }: ProfileScreenProps) => {
  return (
    <div className="min-h-screen bg-background px-6 pt-14 pb-28 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-display font-light text-foreground">
            Profile
          </h2>
          <button className="w-10 h-10 rounded-full bg-surface-elevated shadow-sm flex items-center justify-center hover:shadow-md transition-all">
            <Settings className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-5 py-4">
          <div className="w-28 h-28 rounded-full overflow-hidden shadow-lg ring-4 ring-primary/10">
            <img src={profile2} alt="Your profile" className="w-full h-full object-cover" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xl font-display font-light text-foreground">Marco, 31</h3>
            <p className="text-sm text-muted-foreground font-body font-light">Architect · Milan</p>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-2xl p-1 shadow-sm">
          {["Edit Profile", "Privacy Settings", "Notifications", "Help & Support", "Terms of Use"].map(
            (item, idx, arr) => (
              <div
                key={item}
                className={`flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-xl ${
                  idx < arr.length - 1 ? "border-b border-border/40" : ""
                }`}
              >
                <span className="text-sm font-body text-foreground">{item}</span>
                <span className="text-muted-foreground text-sm">›</span>
              </div>
            )
          )}
        </div>

        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-4 text-sm text-destructive font-body tracking-wide transition-opacity hover:opacity-70 bg-destructive/5 rounded-2xl"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
