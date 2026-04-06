import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../services';
import { useAuth } from '../auth/AuthProvider';
import type { AuthErrorResponse, AuthResponse } from '../contracts';

const isAuthError = (payload: AuthResponse<unknown>): payload is AuthErrorResponse =>
  payload.ok === false;

const resolveSafePath = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
};

type CallbackStatus = 'idle' | 'loading' | 'success' | 'error' | 'retry';

const AuthCallbackScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState('');
  const [status, setStatus] = useState<CallbackStatus>('idle');
  const [attempt, setAttempt] = useState(0);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStatus(attempt > 0 ? 'retry' : 'loading');
      setError('');
      try {
        const tokenHash = params.get('token_hash');
        const type = (params.get('type') as 'magiclink' | 'signup' | 'email' | null) ?? 'magiclink';
        const next = resolveSafePath(params.get('next'), '/discover');
        const from = resolveSafePath(params.get('from'), next);

        if (!tokenHash) {
          await refreshSession();
          if (!cancelled) navigate(from, { replace: true });
          return;
        }

        const verified = await authApi.verifyEmailToken(tokenHash, type);
        if (isAuthError(verified)) {
          if (!cancelled) {
            setError(verified.message ?? 'Email verification failed.');
            setStatus('error');
          }
          return;
        }

        await refreshSession();
        if (!cancelled) {
          setStatus('success');
          navigate(from, { replace: true });
        }
      } catch {
        if (!cancelled) {
          setError('Authentication callback failed.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, navigate, params, refreshSession]);

  return (
    <div className="h-screen w-full bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md glass border border-white/10 rounded-[24px] p-6 text-center">
        {status === 'loading' || status === 'retry' ? (
          <>
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            <p className="mt-4 text-sm text-white/70">{status === 'retry' ? 'Retrying sign-in...' : 'Signing you in...'}</p>
          </>
        ) : status === 'error' ? (
          <>
            <p className="text-sm text-red-300">{error}</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setAttempt((prev) => prev + 1)}
                className="h-10 px-5 rounded-[14px] border border-white/10 bg-white/5 text-xs font-black uppercase tracking-[0.16em]"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/login/methods', { replace: true })}
                className="h-10 px-5 rounded-[14px] border border-white/10 bg-white/5 text-xs font-black uppercase tracking-[0.16em]"
              >
                Go to login
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/70">Done.</p>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackScreen;
