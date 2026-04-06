import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { SessionUser } from '../contracts';
import { authApi } from '../services';

type AuthStatus = 'loading' | 'authenticated' | 'guest';

type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  isAuthenticated: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  const refreshSession = async () => {
    try {
      const session = await authApi.getSession();
      if (!session.ok || !session.data?.authenticated || !session.data.user) {
        setUser(null);
        setStatus('guest');
        return;
      }
      setUser(session.data.user);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('guest');
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const logout = async () => {
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
      refreshSession,
      logout,
    }),
    [status, user],
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
