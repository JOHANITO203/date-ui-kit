import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import PageTransition from '../components/ui/PageTransition';
import { useDevice } from '../hooks/useDevice';
import { realtime } from '../services/realtimeClient';

const AppShell: React.FC = () => {
  const { isDesktop } = useDevice();
  const location = useLocation();

  // One realtime connection for the whole authenticated session (presence +
  // live delivery work app-wide, not only inside an open chat).
  useEffect(() => {
    void realtime.connect();
    return () => realtime.disconnect();
  }, []);

  return (
    <div className="screen-safe h-full w-full bg-black text-white flex overflow-hidden">
      {isDesktop && <Sidebar />}
      
      <main className={`flex-1 relative overflow-y-auto no-scrollbar ${!isDesktop ? 'content-safe' : ''}`}>
        <div className="app-container h-full">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>

      {!isDesktop && <BottomNav />}
    </div>
  );
};

export default AppShell;
