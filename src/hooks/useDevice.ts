import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type PointerType = 'fine' | 'coarse';

export const useDevice = () => {
  const [device, setDevice] = useState<DeviceType>('mobile');
  const [pointer, setPointer] = useState<PointerType>('coarse');

  useEffect(() => {
    const updateDevice = () => {
      const width = window.innerWidth;
      if (width < 768) setDevice('mobile');
      else if (width < 1280) setDevice('tablet');
      else setDevice('desktop');

      // Detect pointer type
      if (window.matchMedia('(pointer: fine)').matches) {
        setPointer('fine');
      } else {
        setPointer('coarse');
      }
    };

    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, []);

  return { device, pointer, isMobile: device === 'mobile', isTablet: device === 'tablet', isDesktop: device === 'desktop', isTouch: pointer === 'coarse' };
};
