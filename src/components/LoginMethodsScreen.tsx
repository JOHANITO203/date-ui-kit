import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ICONS } from '../types';
import { useI18n } from '../i18n/I18nProvider';
import { authApi } from '../services';
import { useAuth } from '../auth/AuthProvider';
import type { AuthErrorResponse, AuthFallback, AuthResponse } from '../contracts';

type PasswordMode = 'login' | 'signup';
type MethodTab = 'password' | 'magic';
type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

const isAuthError = (payload: AuthResponse<unknown>): payload is AuthErrorResponse =>
  payload.ok === false;

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

  const [methodTab, setMethodTab] = useState<MethodTab>('password');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [fallbackActions, setFallbackActions] = useState<AuthFallback[]>([]);
  const [passwordStatus, setPasswordStatus] = useState<ApiStatus>('idle');
  const [magicStatus, setMagicStatus] = useState<ApiStatus>('idle');
  const [sessionRefreshStatus, setSessionRefreshStatus] = useState<ApiStatus>('idle');

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  useEffect(() => {
    // Google callback returns to this route with query params.
    if (!location.search) return;
    void (async () => {
      setSessionRefreshStatus('loading');
      try {
        await refreshSession();
        setSessionRefreshStatus('success');
      } catch {
        setSessionRefreshStatus('error');
      }
    })();
  }, [location.search, refreshSession]);

  const submitPasswordRequest = async () => {
    setErrorText('');
    setInfoText('');
    setFallbackActions([]);
    setPasswordStatus('loading');
    let failed = false;
    try {
      const response =
        passwordMode === 'login'
          ? await authApi.loginWithPassword(email.trim(), password)
          : await authApi.signUpWithPassword(email.trim(), password);

      if (isAuthError(response)) {
        failed = true;
        setErrorText(response.message ?? 'Authentication failed.');
        setFallbackActions(response.fallback ?? []);
        setPasswordStatus('error');
        return;
      }

      if (passwordMode === 'signup') {
        setInfoText('Account created. Check your inbox for verification, then sign in.');
        setPasswordMode('login');
        setPasswordStatus('success');
        return;
      }

      await refreshSession();
      setPasswordStatus('success');
      navigate(redirectTarget, { replace: true });
    } catch {
      failed = true;
      setErrorText('Authentication failed. Please try again.');
      setPasswordStatus('error');
    } finally {
      if (!failed) {
        setTimeout(() => setPasswordStatus('idle'), 700);
      }
    }
  };

  const submitMagicRequest = async () => {
    setErrorText('');
    setInfoText('');
    setFallbackActions([]);
    setMagicStatus('loading');
    let failed = false;
    try {
      const response = await authApi.sendMagicLink(email.trim(), redirectTarget);
      if (isAuthError(response)) {
        failed = true;
        setErrorText(response.message ?? 'Unable to send magic link.');
        setFallbackActions(response.fallback ?? []);
        setMagicStatus('error');
        return;
      }
      setInfoText('Magic link sent. Open your email to continue.');
      setMagicStatus('success');
    } catch {
      failed = true;
      setErrorText('Unable to send magic link right now.');
      setMagicStatus('error');
    } finally {
      if (!failed) {
        setTimeout(() => setMagicStatus('idle'), 700);
      }
    }
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
        <p className="text-white/60">{t('loginMethods.subtitle')}</p>
      </div>

      <div className="rounded-[24px] glass border border-white/10 p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMethodTab('password')}
            className={`h-11 rounded-2xl text-xs font-black uppercase tracking-[0.16em] transition-all ${
              methodTab === 'password' ? 'gradient-premium text-white' : 'bg-white/5 text-white/55 border border-white/10'
            }`}
          >
            {t('loginMethods.email')}
          </button>
          <button
            onClick={() => setMethodTab('magic')}
            className={`h-11 rounded-2xl text-xs font-black uppercase tracking-[0.16em] transition-all ${
              methodTab === 'magic' ? 'gradient-premium text-white' : 'bg-white/5 text-white/55 border border-white/10'
            }`}
          >
            OTP
          </button>
        </div>

        {methodTab === 'password' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitPasswordRequest();
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPasswordMode('login')}
                className={`h-9 rounded-xl text-[10px] font-black uppercase tracking-[0.16em] ${
                  passwordMode === 'login' ? 'bg-white text-black' : 'bg-white/5 text-white/55 border border-white/10'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setPasswordMode('signup')}
                className={`h-9 rounded-xl text-[10px] font-black uppercase tracking-[0.16em] ${
                  passwordMode === 'signup' ? 'bg-white text-black' : 'bg-white/5 text-white/55 border border-white/10'
                }`}
              >
                Sign Up
              </button>
            </div>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder={t('loginMethods.email')}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-white/35 outline-none focus:border-pink-500/50"
              required
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-white/35 outline-none focus:border-pink-500/50"
              minLength={8}
              required
            />
            <button
              disabled={passwordStatus === 'loading'}
              className={`w-full h-12 rounded-2xl text-xs font-black uppercase tracking-[0.16em] ${
                passwordStatus === 'loading' ? 'bg-white/20 text-white/45 cursor-not-allowed' : 'gradient-premium text-white'
              }`}
            >
              {passwordStatus === 'loading' ? 'Please wait...' : passwordMode === 'login' ? 'Continue' : 'Create account'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitMagicRequest();
            }}
            className="space-y-3"
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder={t('loginMethods.email')}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-white/35 outline-none focus:border-pink-500/50"
              required
            />
            <button
              disabled={magicStatus === 'loading'}
              className={`w-full h-12 rounded-2xl text-xs font-black uppercase tracking-[0.16em] ${
                magicStatus === 'loading' ? 'bg-white/20 text-white/45 cursor-not-allowed' : 'gradient-premium text-white'
              }`}
            >
              {magicStatus === 'loading' ? 'Please wait...' : 'Send magic link'}
            </button>
          </form>
        )}

        <button
          onClick={() => {
            window.location.href = authApi.getGoogleStartUrl(redirectTarget, `/login/methods?from=${encodeURIComponent(redirectTarget)}`);
          }}
          className="w-full h-11 rounded-2xl border border-white/10 bg-white/5 text-xs font-black uppercase tracking-[0.16em] hover:bg-white/10 transition-colors"
        >
          {t('login.continueGoogle')}
        </button>

        {errorText && <p className="text-xs text-red-300">{errorText}</p>}
        {methodTab === 'password' && passwordStatus === 'error' && (
          <button
            onClick={() => void submitPasswordRequest()}
            className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black text-white/75"
          >
            Retry password auth
          </button>
        )}
        {methodTab === 'magic' && magicStatus === 'error' && (
          <button
            onClick={() => void submitMagicRequest()}
            className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black text-white/75"
          >
            Retry magic link
          </button>
        )}
        {fallbackActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fallbackActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  if (action === 'send_magic_link') {
                    setMethodTab('magic');
                  } else if (action === 'login_with_password') {
                    setMethodTab('password');
                    setPasswordMode('login');
                  } else if (action === 'resend_verification') {
                    void (async () => {
                      if (!email.trim()) return;
                      const resend = await authApi.resendVerification(email.trim());
                      if (isAuthError(resend)) {
                        setErrorText(resend.message ?? 'Unable to resend verification.');
                        return;
                      }
                      setInfoText('Verification email resent.');
                    })();
                  }
                }}
                className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.14em] font-black text-white/75"
              >
                {action.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        )}
        {infoText && <p className="text-xs text-cyan-200">{infoText}</p>}
        {sessionRefreshStatus === 'loading' && (
          <p className="text-xs text-white/55">Session refresh in progress...</p>
        )}
      </div>

      <div className="mt-auto mb-12 text-center">
        <p className="text-white/20 text-xs">
          {t('loginMethods.help')} <span className="text-white/40 underline">{t('loginMethods.support')}</span>
        </p>
      </div>
    </motion.div>
  );
};

export default LoginMethodsScreen;
