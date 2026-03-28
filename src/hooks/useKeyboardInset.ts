import { useEffect, useState } from 'react';

export const useKeyboardInset = (enabled = true) => {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.visualViewport) return;

    const updateInset = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setKeyboardInset(inset);
    };

    updateInset();
    window.visualViewport.addEventListener('resize', updateInset);
    window.visualViewport.addEventListener('scroll', updateInset);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateInset);
      window.visualViewport?.removeEventListener('scroll', updateInset);
    };
  }, [enabled]);

  return {
    keyboardInset,
    isKeyboardOpen: keyboardInset > 0,
  };
};

