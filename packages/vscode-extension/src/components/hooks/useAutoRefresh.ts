import { useEffect, useState } from 'react';

/**
 * Hook that forces a component re-render at regular intervals
 * @param intervalMs - Refresh interval in milliseconds (default: 60000 = 1 minute)
 */
export const useAutoRefresh = (intervalMs: number = 60000) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(tick => tick + 1);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);
};
