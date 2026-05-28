import { useEffect, useState } from 'react';

export function usePollingWhenVisible(enabled: boolean) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  return isVisible;
}