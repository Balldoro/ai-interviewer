import { useEffect, useEffectEvent, useState } from 'react';

interface UseRecordingTimerOptions {
  maxSeconds: number;
  onLimitReach: () => void;
}

export function useRecordingTimer({ maxSeconds, onLimitReach }: UseRecordingTimerOptions) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const reachLimit = useEffectEvent(onLimitReach);

  useEffect(() => {
    const startedAt = performance.now();

    const interval = setInterval(() => {
      const seconds = Math.min(Math.floor((performance.now() - startedAt) / 1000), maxSeconds);
      setElapsedSeconds(seconds);

      if (seconds === maxSeconds) {
        clearInterval(interval);
        reachLimit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [maxSeconds]);

  return { elapsedSeconds };
}
