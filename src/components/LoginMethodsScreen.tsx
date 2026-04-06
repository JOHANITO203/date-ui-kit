import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import { useI18n } from '../i18n/I18nProvider';
import { authApi } from '../services';
import { useAuth } from '../auth/AuthProvider';

type ApiStatus = 'idle' | 'loading' | 'success' | 'error' | 'retry';

const LoginMethodsScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { isAuthenticated, refreshSession } = useAuth();
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('from');
  const fromState = (location.state as { from?: string } | null)?.from;
  const redirectTarget =
    (fromQuery && fromQuery.startsWith('/') && !fromQuery.startsWith('//') && fromQuery) ||
    (fromState && fromState.startsWith('/') && !fromState.startsWith('//') && fromState) ||
    '/discover';

  const [sessionRefreshStatus, setSessionRefreshStatus] = useState<ApiStatus>('idle');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  useEffect(() => {
    if (!location.search) return;
    void (async () => {
      setSessionRefreshStatus('loading');
      try {
        await refreshSession();
        setSessionRefreshStatus('success');
      } catch {
        setSessionRefreshStatus('error');
        setErrorText('Unable to refresh Google session.');
      }
    })();
  }, [location.search, refreshSession]);

  const startGoogleAuth = () => {
    window.location.href = authApi.getGoogleStartUrl(
      redirectTarget,
      `/login/methods?from=${encodeURIComponent(redirectTarget)}`,
    );
  };

  const retrySessionRefresh = () => {
    setSessionRefreshStatus('retry');
    setErrorText('');
    void (async () => {
      try {
        await refreshSession();
        setSessionRefreshStatus('success');
      } catch {
        setSessionRefreshStatus('error');
        setErrorText('Unable to refresh Google session.');
      }
    })();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full p-8 pt-16"
    >
      <button onClick={() => navigate('/login')} className="absolute top-8 left-8 p-2 glass rounded-full">
        <ICONS.ChevronLeft size={20} />
      </button>

      <div className="mt-12 mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-4">{t('loginMethods.title')}</h1>
        <p className="text-white/60">Google authentication only (MVP mode).</p>
      </div>

      <div className="rounded-[24px] glass border border-white/10 p-4 space-y-4">
        <button
          onClick={startGoogleAuth}
          className="w-full h-12 rounded-2xl text-xs font-black uppercase tracking-[0.16em] gradient-premium text-white"
        >
          {t('login.continueGoogle')}
        </button>

        {errorText && <p className="text-xs text-red-300">{errorText}</p>}

        {sessionRefreshStatus === 'error' && (
          <button
            onClick={retrySessionRefresh}
            className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black text-white/75"
          >
            Retry session refresh
          </button>
        )}

        {(sessionRefreshStatus === 'loading' || sessionRefreshStatus === 'retry') && (
          <p className="text-xs text-white/55">Session refresh in progress...</p>
        )}
      </div>
    </motion.div>
  );
};

export default LoginMethodsScreen;

