import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/ui/Logo';

const TermsPage: React.FC = () => {
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
          <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight">Terms of Service</h1>
          <p className="text-sm text-white/60">Last updated: {updatedAt}</p>
        </header>

        <section className="space-y-4 text-sm leading-relaxed text-white/85">
          <p>
            By using Exotic, you agree to provide accurate account information, follow local laws and respect other
            users.
          </p>
          <p>
            Harassment, impersonation, fraud, illegal content or abusive behavior may result in account restriction or
            permanent suspension.
          </p>
          <p>
            Paid features (subscriptions, boosts, tokens, passes) are governed by the active pricing and entitlement
            rules displayed in-app at purchase time.
          </p>
          <p>
            Service availability may change due to maintenance, legal constraints or anti-abuse measures.
          </p>
          <p>
            Contact: <a className="underline text-pink-300" href="mailto:support@exotic-app.com">support@exotic-app.com</a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;

