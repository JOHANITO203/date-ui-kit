import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/ui/Logo';

const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();
  const updatedAt = '2026-04-07';

  return (
    <div className="h-full w-full bg-black text-white overflow-y-auto no-scrollbar">
      <div className="max-w-3xl mx-auto px-6 py-8 md:py-12 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Logo size={36} />
          <button
            type="button"
            onClick={() => navigate('/')}
            className="h-10 px-4 rounded-full border border-white/15 bg-white/5 text-[11px] font-black uppercase tracking-[0.14em]"
          >
            Home
          </button>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-white/60">Last updated: {updatedAt}</p>
        </header>

        <section className="space-y-4 text-sm leading-relaxed text-white/85">
          <p>
            Exotic collects account, profile and usage data to deliver matching, messaging, safety and subscription
            features.
          </p>
          <p>
            Authentication data is processed through secure providers (Google / Supabase). Sensitive tokens are handled
            server-side by backend services.
          </p>
          <p>
            We use technical logs and analytics for reliability, fraud prevention and product quality. Data is retained
            only as long as needed for legal, safety or operational reasons.
          </p>
          <p>
            Users can request account deletion and data export through support channels available in the app settings.
          </p>
          <p>
            Contact: <a className="underline text-pink-300" href="mailto:support@exotic-app.com">support@exotic-app.com</a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;

