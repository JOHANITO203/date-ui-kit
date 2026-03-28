import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import { useDevice } from '../hooks/useDevice';
import LanguageSwitch from '../components/ui/LanguageSwitch';

const AppShell: React.FC = () => {
  const { isDesktop } = useDevice();

  return (
    <div className="screen-safe h-full w-full bg-black text-white flex overflow-hidden">
      {isDesktop && <Sidebar />}
      
      <main className={`flex-1 relative overflow-y-auto no-scrollbar ${!isDesktop ? 'content-safe' : ''}`}>
        <div className="absolute top-3 right-3 z-50">
          <LanguageSwitch />
        </div>
        <div className="app-container h-full">
          <Outlet />
        </div>
      </main>

      {!isDesktop && <BottomNav />}
    </div>
  );
};

export default AppShell;
