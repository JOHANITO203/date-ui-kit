import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const FullscreenLoader = () => (
  <div className="h-screen w-full bg-black text-white flex items-center justify-center">
    <div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
  </div>
);

export const RequireAuth: React.FC = () => {
  const location = useLocation();
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') return <FullscreenLoader />;
  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace state={{ from }} />;
  }
  return <Outlet />;
};

export const RequireGuest: React.FC = () => {
  const location = useLocation();
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') return <FullscreenLoader />;
  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const requested = params.get('from');
    const safeTarget = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/discover';
    return <Navigate to={safeTarget} replace />;
  }
  return <Outlet />;
};
