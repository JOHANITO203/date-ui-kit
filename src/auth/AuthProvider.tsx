import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionUser } from '../contracts';
import { authApi } from '../services';

type AuthStatus = 'loading' | 'authenticated' | 'guest';

type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  isAuthenticated: boolean;
  ephemeralAccessEnabled: boolean;
  enableEphemeralAccess: () => void;
  disableEphemeralAccess: () => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const EPHEMERAL_ACCESS_STORAGE_KEY = 'exotic.auth.ephemeral-access.v1';
const EPHEMERAL_ACCESS_TTL_MS = 12 * 60 * 60 * 1000;

type EphemeralAccessPayload = {
  enabledAtIso: string;
};

const buildEphemeralUser = (): SessionUser => ({
  id: 'ephemeral-access-user',
  email: 'ephemeral@local.access',
  profile: { ephemeral: true },
  settings: null,
});

const readEphemeralAccess = () => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(EPHEMERAL_ACCESS_STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw) as EphemeralAccessPayload;
    const enabledAtMs = new Date(payload.enabledAtIso).getTime();
    if (!Number.isFinite(enabledAtMs)) return false;
    if (Date.now() - enabledAtMs > EPHEMERAL_ACCESS_TTL_MS) {
      window.localStorage.removeItem(EPHEMERAL_ACCESS_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const writeEphemeralAccess = () => {
  if (typeof window === 'undefined') return;
  const payload: EphemeralAccessPayload = {
    enabledAtIso: new Date().toISOString(),
  };
  window.localStorage.setItem(EPHEMERAL_ACCESS_STORAGE_KEY, JSON.stringify(payload));
};

const clearEphemeralAccess = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(EPHEMERAL_ACCESS_STORAGE_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ephemeralAccessEnabled, setEphemeralAccessEnabled] = useState(() => readEphemeralAccess());
  const [status, setStatus] = useState<AuthStatus>(() => (ephemeralAccessEnabled ? 'authenticated' : 'loading'));
  const [user, setUser] = useState<SessionUser | null>(() =>
    ephemeralAccessEnabled ? buildEphemeralUser() : null,
  );
  const refreshRequestIdRef = useRef(0);
  const ephemeralAccessRef = useRef(ephemeralAccessEnabled);

  useEffect(() => {
    ephemeralAccessRef.current = ephemeralAccessEnabled;
  }, [ephemeralAccessEnabled]);

  const refreshSession = async () => {
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    if (ephemeralAccessRef.current) {
      setUser(buildEphemeralUser());
      setStatus('authenticated');
      return;
    }
    try {
      const session = await authApi.getSession();
      if (requestId !== refreshRequestIdRef.current) return;
      if (ephemeralAccessRef.current) return;
      if (!session.ok || !session.data?.authenticated || !session.data.user) {
        setUser(null);
        setStatus('guest');
        return;
      }
      setUser(session.data.user);
      setStatus('authenticated');
    } catch {
      if (requestId !== refreshRequestIdRef.current) return;
      if (ephemeralAccessRef.current) return;
      setUser(null);
      setStatus('guest');
    }
  };

  useEffect(() => {
    void refreshSession();
  }, [ephemeralAccessEnabled]);

  const enableEphemeralAccess = () => {
    refreshRequestIdRef.current += 1;
    writeEphemeralAccess();
    setEphemeralAccessEnabled(true);
    setUser(buildEphemeralUser());
    setStatus('authenticated');
  };

  const disableEphemeralAccess = () => {
    refreshRequestIdRef.current += 1;
    clearEphemeralAccess();
    setEphemeralAccessEnabled(false);
    setUser(null);
    setStatus('guest');
  };

  const logout = async () => {
    if (ephemeralAccessEnabled) {
      disableEphemeralAccess();
      return;
    }
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus('guest');
    }
  };

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated',
      ephemeralAccessEnabled,
      enableEphemeralAccess,
      disableEphemeralAccess,
      refreshSession,
      logout,
    }),
    [status, user, ephemeralAccessEnabled],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
