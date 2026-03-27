import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import { useDevice } from '../hooks/useDevice';

const AppShell: React.FC = () => {
  const { isDesktop } = useDevice();

  return (
    <div className="h-full w-full bg-black text-white flex overflow-hidden">
      {isDesktop && <Sidebar />}
      
      <main className={`flex-1 relative overflow-y-auto no-scrollbar ${!isDesktop ? 'pb-24' : ''}`}>
        <div className="max-w-7xl mx-auto h-full">
          <Outlet />
        </div>
      </main>

      {!isDesktop && <BottomNav />}
    </div>
  );
};

export default AppShell;
