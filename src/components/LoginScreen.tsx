import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import GlassButton from './ui/GlassButton';
import { useI18n } from '../i18n/I18nProvider';
import Logo from './ui/Logo';
import { authApi } from '../services';

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.4l2.7-2.6C17 3.5 14.7 2.5 12 2.5A9.5 9.5 0 0 0 2.5 12 9.5 9.5 0 0 0 12 21.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-2.1H12Z" />
    <path fill="#34A853" d="M3.6 7.6l3.2 2.3A6 6 0 0 1 12 6c1.9 0 3.1.8 3.9 1.4l2.7-2.6C17 3.5 14.7 2.5 12 2.5A9.5 9.5 0 0 0 3.6 7.6Z" />
    <path fill="#4285F4" d="M12 21.5c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.9 1.1-3.4 1.1-2.7 0-5-1.8-5.8-4.3l-3.3 2.5A9.5 9.5 0 0 0 12 21.5Z" />
    <path fill="#FBBC05" d="M6.2 13.4a5.8 5.8 0 0 1 0-2.8L2.9 8.1a9.5 9.5 0 0 0 0 7.8l3.3-2.5Z" />
  </svg>
);

const LoginScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const params = new URLSearchParams(location.search);
  const from = params.get('from');
  const safeFrom = from && from.startsWith('/') && !from.startsWith('//') ? from : '/discover';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full p-8 pt-16"
    >
      <button onClick={() => navigate('/')} className="absolute top-8 left-8 p-2 glass rounded-full">
        <ICONS.ChevronLeft size={20} />
      </button>

      <div className="mt-12 mb-12">
        <div className="mb-8">
          <Logo size={42} />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">{t('login.title')}</h1>
        <p className="text-white/60 text-lg">{t('login.subtitle')}</p>
      </div>

      <div className="space-y-4 mt-auto mb-12">
        <GlassButton
          variant="premium"
          className="w-full py-5 flex items-center justify-center gap-3"
          onClick={() => {
            window.location.href = authApi.getGoogleStartUrl(
              safeFrom,
              `/login/methods?from=${encodeURIComponent(safeFrom)}`,
            );
          }}
        >
          <GoogleMark />
          <span className="font-bold">{t('login.continueGoogle')}</span>
        </GlassButton>
      </div>

      <p className="text-[10px] text-center text-white/30 px-8">
        {t('login.legalPrefix')} <span className="underline">{t('login.legalTerms')}</span>{' '}
        {t('login.legalAnd')} <span className="underline">{t('login.legalPrivacy')}</span>.
      </p>
    </motion.div>
  );
};

export default LoginScreen;
